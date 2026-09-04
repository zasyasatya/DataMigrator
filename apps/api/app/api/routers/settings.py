"""Workspace settings: OpenAI-compatible provider (diset dari dashboard)."""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_workspace_id
from app.models import Workspace
from app.schemas import LLMSettingsIn, LLMSettingsOut, LLMTestOut
from app.services.chat import LLMConfig
from app.services.llm import GenParams, Turn
from app.services.llm.openai_compat import OpenAICompatibleProvider

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


def _mask(key: str | None) -> str | None:
    if not key:
        return None
    return f"••••{key[-4:]}" if len(key) > 4 else "••••"


@router.get("/llm", response_model=LLMSettingsOut)
async def get_llm(
    workspace_id: str = Depends(get_workspace_id), db: AsyncSession = Depends(get_db)
):
    from app.core.config import settings

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one()
    if ws.llm_api_key:
        return LLMSettingsOut(
            base_url=ws.llm_base_url or settings.openai_base_url,
            model=ws.llm_model or settings.openai_model,
            has_key=True,
            key_masked=_mask(ws.llm_api_key),
            source="workspace",
        )
    return LLMSettingsOut(
        base_url=settings.openai_base_url,
        model=settings.openai_model,
        has_key=bool(settings.openai_api_key),
        key_masked=_mask(settings.openai_api_key),
        source="env" if settings.openai_api_key else "none",
    )


@router.put("/llm", response_model=LLMSettingsOut)
async def put_llm(
    payload: LLMSettingsIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    from app.core.config import settings

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one()
    if payload.api_key is not None:
        ws.llm_api_key = payload.api_key.strip() or None
    if payload.base_url is not None:
        ws.llm_base_url = payload.base_url.strip() or None
    if payload.model is not None:
        ws.llm_model = payload.model.strip() or None
    await db.commit()
    await db.refresh(ws)
    return LLMSettingsOut(
        base_url=ws.llm_base_url or settings.openai_base_url,
        model=ws.llm_model or settings.openai_model,
        has_key=bool(ws.llm_api_key or settings.openai_api_key),
        key_masked=_mask(ws.llm_api_key or settings.openai_api_key),
        source="workspace" if ws.llm_api_key else ("env" if settings.openai_api_key else "none"),
    )


@router.post("/llm/test", response_model=LLMTestOut)
async def test_llm(
    workspace_id: str = Depends(get_workspace_id), db: AsyncSession = Depends(get_db)
):
    from app.core.config import settings

    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one()
    cfg = LLMConfig(
        api_key=ws.llm_api_key or settings.openai_api_key,
        base_url=ws.llm_base_url or settings.openai_base_url,
        model=ws.llm_model or settings.openai_model,
    )
    if not cfg.api_key:
        return LLMTestOut(ok=False, error="API key belum diset (workspace maupun env).")
    provider = OpenAICompatibleProvider(api_key=cfg.api_key, base_url=cfg.base_url)
    started = time.perf_counter()
    chunks: list[str] = []
    try:
        async for piece in provider.stream(
            [Turn("user", "Balas dengan satu kata: siap.")],
            GenParams(temperature=0, max_tokens=8, model=cfg.model),
        ):
            chunks.append(piece)
            if len("".join(chunks)) > 60:
                break
        return LLMTestOut(
            ok=True,
            latency_ms=int((time.perf_counter() - started) * 1000),
            model=cfg.model,
            reply="".join(chunks).strip() or "(kosong)",
        )
    except Exception as exc:
        return LLMTestOut(ok=False, model=cfg.model, error=str(exc)[:300])
