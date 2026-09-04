"""Chat orchestration: retrieval → provider → SSE events → persistence."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models import Agent, Conversation, KnowledgeChunk, Message, Workspace
from app.services.llm import GenParams, Turn
from app.services.llm.offline import AgentBrain, OfflineProvider
from app.services.llm.openai_compat import OpenAICompatibleProvider
from app.services.retrieval import Hit, retrieve

_TONE_DESC = {
    "friendly": "ramah, hangat, gunakan sapaan santai yang sopan",
    "formal": "formal, profesional, gunakan Bahasa Indonesia baku",
    "casual": "santai seperti ngobrol dengan teman, tetap sopan",
    "playful": "ceriah, ringan, boleh pakai emoji seperlunya",
}


@dataclass
class SSEEvent:
    event: str
    data: dict

    def encode(self) -> str:
        import json

        return f"event: {self.event}\ndata: {json.dumps(self.data, ensure_ascii=False)}\n\n"


def build_system_prompt(agent: Agent, hits: list[Hit]) -> str:
    lang = "Bahasa Indonesia" if agent.language == "id" else "English"
    parts = [
        f"Kamu adalah {agent.name}, {agent.role_title}.",
        f"Gunakan {lang}. Gaya bicara: {_TONE_DESC.get(agent.tone, agent.tone)}.",
    ]
    if agent.instructions.strip():
        parts.append(f"Instruksi dari pemilik bisnis (patuhi):\n{agent.instructions.strip()}")
    if agent.guardrails:
        parts.append("Guardrails (jangan pernah dilanggar):\n- " + "\n- ".join(agent.guardrails))
    if hits:
        ctx = "\n\n".join(f"[{i + 1}] ({h.document_title}) {h.content}" for i, h in enumerate(hits))
        parts.append(
            "Konteks pengetahuan terambil (retrieval). Jawab berdasarkan ini bila relevan:\n" + ctx
        )
    parts.append(
        f"Bila jawaban tidak tersedia di konteks/instruksi, katakan persis: {agent.fallback_message}"
    )
    parts.append("Jawab ringkas (maksimal ~120 kata). Markdown ringan diperbolehkan.")
    return "\n\n".join(parts)


@dataclass
class LLMConfig:
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None


async def get_llm_config(db: AsyncSession, workspace_id: str) -> LLMConfig:
    """Workspace override (dashboard Settings) → fallback env."""
    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    return LLMConfig(
        api_key=(ws.llm_api_key if ws and ws.llm_api_key else None) or settings.openai_api_key,
        base_url=(ws.llm_base_url if ws and ws.llm_base_url else None) or settings.openai_base_url,
        model=(ws.llm_model if ws and ws.llm_model else None) or settings.openai_model,
    )


def pick_provider(
    agent: Agent, cfg: LLMConfig | None = None
) -> tuple[str, OpenAICompatibleProvider | OfflineProvider | None]:
    """Return (engine_name, provider_or_None)."""
    cfg = cfg or LLMConfig()
    want = agent.engine
    openai = OpenAICompatibleProvider(api_key=cfg.api_key, base_url=cfg.base_url)
    if want == "openai":
        return ("openai", openai if openai.available else None)
    if want == "offline":
        return ("offline", None)
    return ("openai", openai) if openai.available else ("offline", None)


async def load_chunks(db: AsyncSession, agent_id: str) -> list[tuple[str, str, str, str]]:
    rows = (
        await db.execute(
            select(KnowledgeChunk, ).where(KnowledgeChunk.agent_id == agent_id)
        )
    ).scalars().all()
    from app.models import KnowledgeDocument

    doc_ids = {c.document_id for c in rows}
    titles: dict[str, str] = {}
    if doc_ids:
        docs = (
            await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id.in_(doc_ids)))
        ).scalars().all()
        titles = {d.id: d.title for d in docs}
    return [(c.id, c.document_id, titles.get(c.document_id, "Dokumen"), c.content) for c in rows]


async def stream_chat(
    db: AsyncSession,
    agent: Agent,
    conversation: Conversation,
    user_text: str,
) -> AsyncIterator[SSEEvent]:
    started = time.perf_counter()

    user_msg = Message(
        conversation_id=conversation.id,
        agent_id=agent.id,
        role="user",
        content=user_text,
    )
    db.add(user_msg)
    await db.commit()

    chunks = await load_chunks(db, agent.id)
    hits: list[Hit] = retrieve(chunks, user_text, top_k=agent.retrieval_top_k)
    llm_cfg = await get_llm_config(db, agent.workspace_id)
    engine_name, provider = pick_provider(agent, llm_cfg)

    sources = [
        {"document_id": h.document_id, "title": h.document_title, "score": round(h.score, 3)}
        for h in hits
    ]
    assistant_msg = Message(
        conversation_id=conversation.id,
        agent_id=agent.id,
        role="assistant",
        content="",
        sources=sources,
        engine=engine_name,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    yield SSEEvent(
        "meta",
        {
            "conversation_id": conversation.id,
            "message_id": assistant_msg.id,
            "engine": engine_name,
            "sources": sources,
        },
    )

    accumulated: list[str] = []
    try:
        if isinstance(provider, OpenAICompatibleProvider):
            history = (
                await db.execute(
                    select(Message)
                    .where(Message.conversation_id == conversation.id)
                    .order_by(Message.created_at.desc())
                    .limit(12)
                )
            ).scalars().all()
            history = list(reversed(history[:-1]))  # exclude the just-saved user msg? keep context
            turns = [Turn("system", build_system_prompt(agent, hits))]
            for m in history:
                turns.append(Turn(m.role, m.content))
            turns.append(Turn("user", user_text))
            gen = provider.stream(
                turns,
                GenParams(
                    temperature=agent.temperature,
                    model=agent.model or llm_cfg.model,
                ),
            )
        else:
            brain = AgentBrain(
                name=agent.name,
                tone=agent.tone,
                language=agent.language,
                rules=agent.rules or [],
                greeting=agent.greeting,
                fallback=agent.fallback_message,
                handoff_enabled=agent.handoff_enabled,
                handoff_message=agent.handoff_message,
                starters=agent.starter_prompts or [],
            )
            gen = OfflineProvider(brain, hits).stream([Turn("user", user_text)], GenParams())

        async for piece in gen:
            accumulated.append(piece)
            yield SSEEvent("delta", {"t": piece})
    except asyncio.CancelledError:  # pragma: no cover
        raise
    except Exception as exc:  # provider failure → graceful fallback
        fallback = OfflineProvider(
            AgentBrain(
                name=agent.name,
                tone=agent.tone,
                rules=agent.rules or [],
                greeting=agent.greeting,
                fallback=agent.fallback_message,
                handoff_enabled=agent.handoff_enabled,
                handoff_message=agent.handoff_message,
                starters=agent.starter_prompts or [],
            ),
            hits,
        )
        accumulated = []
        yield SSEEvent("engine_fallback", {"reason": str(exc)[:200]})
        async for piece in fallback.stream([Turn("user", user_text)], GenParams()):
            accumulated.append(piece)
            yield SSEEvent("delta", {"t": piece})

    latency = int((time.perf_counter() - started) * 1000)
    content = "".join(accumulated)
    assistant_msg.content = content
    assistant_msg.latency_ms = latency
    conversation.last_message_at = _now()
    await db.commit()

    yield SSEEvent(
        "done",
        {
            "message_id": assistant_msg.id,
            "latency_ms": latency,
            "sources": sources,
            "engine": assistant_msg.engine,
        },
    )


async def run_chat(db: AsyncSession, agent: Agent, conversation: Conversation, text: str) -> dict:
    """Non-streaming wrapper around stream_chat (dipakai channel WhatsApp/Instagram/API)."""
    reply: list[str] = []
    meta: dict = {}
    async for ev in stream_chat(db, agent, conversation, text):
        if ev.event == "delta":
            reply.append(ev.data.get("t", ""))
        elif ev.event == "meta":
            meta.update(ev.data)
        elif ev.event == "done":
            meta.update(ev.data)
    return {
        "reply": "".join(reply),
        "sources": meta.get("sources", []),
        "latency_ms": meta.get("latency_ms", 0),
        "engine": meta.get("engine", "offline"),
        "message_id": meta.get("message_id"),
        "conversation_id": conversation.id,
    }


def _now():
    from app.models import utcnow

    return utcnow()


def brain_of(agent: Agent) -> AgentBrain:  # convenience for tests
    return AgentBrain(
        name=agent.name,
        tone=agent.tone,
        rules=agent.rules or [],
        greeting=agent.greeting,
        fallback=agent.fallback_message,
        handoff_enabled=agent.handoff_enabled,
        handoff_message=agent.handoff_message,
        starters=agent.starter_prompts or [],
    )


def params_of(agent: Agent) -> dict:
    return asdict(GenParams(temperature=agent.temperature, model=agent.model))


async def get_conversation_or_none(db: AsyncSession, cid: str) -> Conversation | None:
    return (
        await db.execute(select(Conversation).where(Conversation.id == cid))
    ).scalar_one_or_none()


async def get_agent_full(db: AsyncSession, agent_id: str) -> Agent | None:
    return (
        await db.execute(
            select(Agent).where(Agent.id == agent_id).options(selectinload(Agent.documents))
        )
    ).scalar_one_or_none()


_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def sse_headers() -> dict:
    return dict(_STREAM_HEADERS)


def public_base_url() -> str:
    return settings.app_url
