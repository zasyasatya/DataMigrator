from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.security import create_session_token, is_secure_request, verify_password
from app.models import User, Workspace
from app.schemas import LoginIn, LoginOut, UserOut, WorkspaceOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
async def login(
    payload: LoginIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    email = (payload.email or "").strip().lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user or not verify_password(payload.password or "", user.password_hash):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_session_token(user.id)
    # `secure` mengikuti skema request asli (x-forwarded-proto) — wajib di balik
    # Cloudflare/Coolify agar cookie sesi tidak ditolak browser pada HTTPS.
    response.set_cookie(
        settings.session_cookie,
        token,
        httponly=True,
        secure=is_secure_request(request),
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    ws = (await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))).scalar_one()
    return LoginOut(token=token, user=UserOut.model_validate(user), workspace=WorkspaceOut.model_validate(ws))


@router.get("/me", response_model=dict)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ws = (await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))).scalar_one()
    return {
        "user": UserOut.model_validate(user),
        "workspace": WorkspaceOut.model_validate(ws),
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    # Atribut harus sama persis dengan saat set_cookie, bila tidak cookie tidak terhapus.
    response.delete_cookie(
        settings.session_cookie,
        path="/",
        secure=is_secure_request(request),
        samesite="lax",
    )
    return {"ok": True}
