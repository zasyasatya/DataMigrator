"""Dashboard simulator: same engine as the widget, streamed over SSE."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal, get_db
from app.core.deps import get_workspace_id
from app.core.ids import new_id
from app.models import Agent, Conversation
from app.schemas import WidgetChatIn
from app.services.chat import sse_headers, stream_chat

router = APIRouter(prefix="/api/v1/agents", tags=["simulator"])


@router.post("/{agent_id}/simulate")
async def simulate(
    agent_id: str,
    payload: WidgetChatIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent or agent.workspace_id != workspace_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")

    conv = None
    if payload.conversation_id:
        conv = (
            await db.execute(select(Conversation).where(Conversation.id == payload.conversation_id))
        ).scalar_one_or_none()
        if conv and conv.agent_id != agent.id:
            conv = None
    if not conv:
        conv = Conversation(
            id=new_id("conversation"),
            agent_id=agent.id,
            channel="simulator",
            visitor_id="simulator",
        )
        db.add(conv)
        await db.commit()
    conversation_id = conv.id

    async def gen():
        async with SessionLocal() as session:
            agent = (await session.execute(select(Agent).where(Agent.id == agent_id))).scalar_one()
            conv = (
                await session.execute(
                    select(Conversation).where(Conversation.id == conversation_id)
                )
            ).scalar_one()
            async for event in stream_chat(session, agent, conv, payload.message):
                yield event.encode()

    return StreamingResponse(gen(), media_type="text/event-stream", headers=sse_headers())
