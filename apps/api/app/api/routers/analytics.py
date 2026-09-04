from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, get_workspace_id
from app.models import User
from app.schemas import AgentAnalyticsOut, OverviewOut
from app.services import analytics

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/agents/{agent_id}", response_model=AgentAnalyticsOut)
async def get_agent_analytics(
    agent_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    from sqlalchemy import select

    from app.models import Agent

    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent or agent.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")
    return await analytics.agent_analytics(db, agent_id)


@router.get("/overview", response_model=OverviewOut)
async def get_overview(
    workspace_id: str = Depends(get_workspace_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics.overview(db, workspace_id, user.name or user.email)
