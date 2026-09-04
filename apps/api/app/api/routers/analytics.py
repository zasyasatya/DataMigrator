from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, get_workspace_id
from app.models import User
from app.schemas import OverviewOut
from app.services import analytics

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewOut)
async def get_overview(
    workspace_id: str = Depends(get_workspace_id),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await analytics.overview(db, workspace_id, user.name or user.email)
