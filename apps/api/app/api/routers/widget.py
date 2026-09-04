"""Public widget endpoints — consumed by the embeddable popup chat."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal, get_db
from app.core.deps import check_origin, resolve_agent_by_public_key
from app.core.ids import new_id
from app.models import Conversation, Message
from app.schemas import (
    MessageOut,
    WidgetChatIn,
    WidgetConfigOut,
    WidgetSessionOut,
)
from app.services.chat import sse_headers, stream_chat

router = APIRouter(prefix="/w", tags=["widget"])


def _origin(request: Request) -> str | None:
    return request.headers.get("origin") or request.headers.get("referer")


@router.get("/{public_key}/config", response_model=WidgetConfigOut)
async def widget_config(
    public_key: str, request: Request, db: AsyncSession = Depends(get_db)
):
    agent, _ = await resolve_agent_by_public_key(public_key, db)
    check_origin(agent, _origin(request))
    return WidgetConfigOut(
        agent_id=agent.id,
        name=agent.name,
        role_title=agent.role_title,
        emoji=agent.emoji,
        greeting=agent.greeting,
        starter_prompts=agent.starter_prompts or [],
        language=agent.language,
        theme=agent.theme or {},
        handoff_enabled=agent.handoff_enabled,
    )


@router.post("/{public_key}/session", response_model=WidgetSessionOut)
async def widget_session(
    public_key: str,
    request: Request,
    visitor_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    agent, _ = await resolve_agent_by_public_key(public_key, db)
    check_origin(agent, _origin(request))
    conv = Conversation(
        id=new_id("conversation"),
        agent_id=agent.id,
        channel="widget",
        visitor_id=visitor_id,
        origin=_origin(request),
    )
    db.add(conv)
    await db.commit()
    return WidgetSessionOut(
        conversation_id=conv.id,
        greeting=agent.greeting,
        starter_prompts=agent.starter_prompts or [],
    )


@router.post("/{public_key}/chat")
async def widget_chat(public_key: str, payload: WidgetChatIn, request: Request):
    origin = _origin(request)
    async with SessionLocal() as db:
        agent, _ = await resolve_agent_by_public_key(public_key, db)
        check_origin(agent, origin)
        conv = await _resolve_conversation(db, payload, agent.id, origin)
        conversation_id = conv.id

    async def gen():
        async with SessionLocal() as db:
            agent = (await db.execute(select_agent(public_key))).scalar_one()
            conv = (
                await db.execute(select(Conversation).where(Conversation.id == conversation_id))
            ).scalar_one()
            async for event in stream_chat(db, agent, conv, payload.message):
                yield event.encode()

    return StreamingResponse(gen(), media_type="text/event-stream", headers=sse_headers())


@router.get("/{public_key}/history", response_model=list[MessageOut])
async def widget_history(
    public_key: str, conversation_id: str, request: Request, db: AsyncSession = Depends(get_db)
):
    agent, _ = await resolve_agent_by_public_key(public_key, db)
    check_origin(agent, _origin(request))
    conv = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if not conv or conv.agent_id != agent.id:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan")
    msgs = (
        await db.execute(
            select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at).options(selectinload(Message.feedback))
        )
    ).scalars().all()
    return [MessageOut.model_validate(m) for m in msgs]


async def _resolve_conversation(
    db: AsyncSession, payload: WidgetChatIn, agent_id: str, origin: str | None
) -> Conversation:
    conv = None
    if payload.conversation_id:
        conv = (
            await db.execute(select(Conversation).where(Conversation.id == payload.conversation_id))
        ).scalar_one_or_none()
        if conv and conv.agent_id != agent_id:
            conv = None
    if not conv:
        conv = Conversation(
            id=new_id("conversation"),
            agent_id=agent_id,
            channel="widget",
            visitor_id=payload.visitor_id,
            origin=origin,
        )
        db.add(conv)
    if payload.visitor_name:
        conv.visitor_name = payload.visitor_name
    if payload.visitor_email:
        conv.visitor_email = payload.visitor_email
    await db.commit()
    return conv


def select_agent(public_key: str):
    from app.models import Agent, ApiKey

    return (
        select(Agent)
        .join(ApiKey, ApiKey.agent_id == Agent.id)
        .where(ApiKey.public_key == public_key, ApiKey.revoked.is_(False))
    )
