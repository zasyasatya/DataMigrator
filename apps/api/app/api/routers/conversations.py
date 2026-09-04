from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_workspace_id
from app.core.ids import new_id
from app.models import Agent, Conversation, Feedback, Message
from app.schemas import ConversationDetailOut, ConversationOut, FeedbackIn, FeedbackOut, MessageOut

router = APIRouter(prefix="/api/v1", tags=["conversations"])


@router.get("/agents/{agent_id}/conversations", response_model=list[ConversationOut])
async def list_conversations(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Conversation)
            .where(Conversation.agent_id == agent_id)
            .order_by(Conversation.last_message_at.desc())
            .limit(100)
        )
    ).scalars().all()
    out: list[ConversationOut] = []
    for c in rows:
        count = (
            await db.execute(
                select(func.count(Message.id)).where(Message.conversation_id == c.id)
            )
        ).scalar_one()
        last = (
            await db.execute(
                select(Message)
                .where(Message.conversation_id == c.id)
                .order_by(Message.created_at.desc())
                .limit(1)
            )
        ).scalars().all()
        out.append(
            ConversationOut(
                id=c.id,
                channel=c.channel,
                visitor_name=c.visitor_name,
                visitor_email=c.visitor_email,
                origin=c.origin,
                status=c.status,
                started_at=c.started_at,
                last_message_at=c.last_message_at,
                message_count=count,
                last_message=last[0].content[:90] if last else "",
            )
        )
    return out


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    conv = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan")
    agent = (await db.execute(select(Agent).where(Agent.id == conv.agent_id))).scalar_one()
    if agent.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan")
    msgs = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at)
            .options(selectinload(Message.feedback))
        )
    ).scalars().all()
    detail = ConversationDetailOut.model_validate(conv)
    detail.message_count = len(msgs)
    detail.messages = [MessageOut.model_validate(m) for m in msgs]
    detail.last_message = msgs[-1].content[:90] if msgs else ""
    return detail


@router.post("/conversations/{conversation_id}/feedback", response_model=FeedbackOut, status_code=201)
async def add_feedback(
    conversation_id: str,
    payload: FeedbackIn,
    db: AsyncSession = Depends(get_db),
):
    """Public feedback endpoint (widget thumbs up/down)."""
    msg = (await db.execute(select(Message).where(Message.id == payload.message_id))).scalar_one_or_none()
    if not msg or msg.conversation_id != conversation_id:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan")
    fb = Feedback(
        id=new_id("feedback"),
        message_id=msg.id,
        conversation_id=conversation_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(fb)
    if payload.rating == "up":
        conv = (
            await db.execute(select(Conversation).where(Conversation.id == conversation_id))
        ).scalar_one_or_none()
        if conv:
            conv.status = "resolved"
    await db.commit()
    await db.refresh(fb)
    return FeedbackOut.model_validate(fb)
