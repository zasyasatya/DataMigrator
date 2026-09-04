"""FastAPI dependencies: auth, workspace scoping, widget key resolution."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_session_token, sha256_hex
from app.models import Agent, ApiKey, User

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Autentikasi diperlukan",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    token: str | None = None
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not token:
        token = request.cookies.get("sapa_session")
    if not token:
        raise CREDENTIALS_ERROR
    subject = decode_session_token(token)
    if not subject:
        raise CREDENTIALS_ERROR
    user = (await db.execute(select(User).where(User.id == subject))).scalar_one_or_none()
    if not user:
        raise CREDENTIALS_ERROR
    return user


async def get_workspace_id(user: User = Depends(get_current_user)) -> str:
    return user.workspace_id


async def resolve_agent_by_public_key(
    public_key: str, db: AsyncSession
) -> tuple[Agent, ApiKey]:
    key = (
        await db.execute(
            select(ApiKey).where(ApiKey.public_key == public_key, ApiKey.revoked.is_(False))
        )
    ).scalar_one_or_none()
    if not key or not key.agent_id:
        raise HTTPException(status_code=404, detail="Widget key tidak ditemukan")
    agent = (await db.execute(select(Agent).where(Agent.id == key.agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")
    return agent, key


async def resolve_secret_key(request: Request, db: AsyncSession) -> str:
    """Server-to-server auth: returns workspace_id for `Authorization: Bearer sk_...`."""
    auth = request.headers.get("authorization", "")
    raw = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    if not raw.startswith("sk_"):
        raise CREDENTIALS_ERROR
    digest = sha256_hex(raw)
    key = (
        await db.execute(
            select(ApiKey).where(ApiKey.secret_hash == digest, ApiKey.revoked.is_(False))
        )
    ).scalar_one_or_none()
    if not key:
        raise CREDENTIALS_ERROR
    return key.workspace_id


def check_origin(agent: Agent, origin: str | None) -> None:
    allowed = [o for o in (agent.allowed_origins or []) if o and o.strip()]
    if not allowed or not origin:
        return
    origin = origin.rstrip("/").lower()
    for pattern in allowed:
        p = pattern.strip().rstrip("/").lower()
        if not p:
            continue
        if p == "*" or origin == p or origin.endswith("://" + p) or _host(origin) == _host(p):
            return
    raise HTTPException(status_code=403, detail="Origin tidak diizinkan untuk agent ini")


def _host(url: str) -> str:
    without_scheme = url.split("://", 1)[-1]
    return without_scheme.split("/", 1)[0]
