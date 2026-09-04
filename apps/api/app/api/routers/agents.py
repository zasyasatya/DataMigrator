from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_workspace_id
from app.core.ids import new_id, new_public_key
from app.models import Agent, ApiKey, Conversation, KnowledgeDocument, utcnow
from app.schemas import AgentCreateIn, AgentOut, AgentUpdateIn, KeyOut

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


async def _public_key_of(db: AsyncSession, agent_id: str) -> str | None:
    key = (
        await db.execute(
            select(ApiKey).where(
                ApiKey.agent_id == agent_id, ApiKey.kind == "public", ApiKey.revoked.is_(False)
            )
        )
    ).scalar_one_or_none()
    return key.public_key if key else None


async def _serialize(db: AsyncSession, agent: Agent) -> AgentOut:
    doc_count = (
        await db.execute(
            select(func.count(KnowledgeDocument.id)).where(KnowledgeDocument.agent_id == agent.id)
        )
    ).scalar_one()
    conv_count = (
        await db.execute(
            select(func.count(Conversation.id)).where(Conversation.agent_id == agent.id)
        )
    ).scalar_one()
    out = AgentOut.model_validate(agent)
    out.document_count = doc_count
    out.conversation_count = conv_count
    out.public_key = await _public_key_of(db, agent.id)
    return out


@router.get("", response_model=list[AgentOut])
async def list_agents(
    workspace_id: str = Depends(get_workspace_id), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(Agent)
            .where(Agent.workspace_id == workspace_id)
            .order_by(Agent.created_at.desc())
        )
    ).scalars().all()
    return [await _serialize(db, a) for a in rows]


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(
    payload: AgentCreateIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = Agent(
        id=new_id("agent"),
        workspace_id=workspace_id,
        name=payload.name,
        role_title=payload.role_title,
        emoji=payload.emoji,
        instructions=payload.instructions,
        tone=payload.tone,
        language=payload.language,
        greeting=f"Halo! Saya {payload.name}. Ada yang bisa saya bantu?",
        starter_prompts=[],
    )
    db.add(agent)
    await db.flush()
    pk = new_public_key()
    db.add(
        ApiKey(
            id=new_id("key"),
            workspace_id=workspace_id,
            agent_id=agent.id,
            label=f"Widget {agent.name}",
            kind="public",
            public_key=pk,
            prefix=pk[:6],
        )
    )
    await db.commit()
    await db.refresh(agent)
    return await _serialize(db, agent)


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_owned(db, agent_id, workspace_id)
    return await _serialize(db, agent)


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: str,
    payload: AgentUpdateIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_owned(db, agent_id, workspace_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return await _serialize(db, agent)


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_owned(db, agent_id, workspace_id)
    keys = (await db.execute(select(ApiKey).where(ApiKey.agent_id == agent.id))).scalars().all()
    for k in keys:
        await db.delete(k)
    await db.delete(agent)
    await db.commit()


@router.post("/{agent_id}/publish", response_model=AgentOut)
async def publish_agent(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_owned(db, agent_id, workspace_id)
    agent.status = "live" if agent.status != "live" else "draft"
    agent.published_at = utcnow() if agent.status == "live" else None
    await db.commit()
    await db.refresh(agent)
    return await _serialize(db, agent)


@router.post("/{agent_id}/keys", response_model=KeyOut, status_code=201)
async def rotate_widget_key(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = await _get_owned(db, agent_id, workspace_id)
    old = (
        await db.execute(select(ApiKey).where(ApiKey.agent_id == agent.id, ApiKey.kind == "public"))
    ).scalars().all()
    for k in old:
        k.revoked = True
    pk = new_public_key()
    key = ApiKey(
        id=new_id("key"),
        workspace_id=workspace_id,
        agent_id=agent.id,
        label=f"Widget {agent.name}",
        kind="public",
        public_key=pk,
        prefix=pk[:6],
    )
    db.add(key)
    await db.commit()
    return KeyOut.model_validate(key)


async def _get_owned(db: AsyncSession, agent_id: str, workspace_id: str) -> Agent:
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent or agent.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")
    return agent
