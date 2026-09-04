from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_workspace_id
from app.core.ids import new_id, new_public_key, new_secret_key
from app.core.security import sha256_hex
from app.models import ApiKey
from app.schemas import KeyCreateIn, KeyCreatedOut, KeyOut

router = APIRouter(prefix="/api/v1/keys", tags=["keys"])


@router.get("", response_model=list[KeyOut])
async def list_keys(
    workspace_id: str = Depends(get_workspace_id), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(ApiKey)
            .where(ApiKey.workspace_id == workspace_id)
            .order_by(ApiKey.created_at.desc())
        )
    ).scalars().all()
    return [KeyOut.model_validate(k) for k in rows]


@router.post("", response_model=KeyCreatedOut, status_code=201)
async def create_key(
    payload: KeyCreateIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    key = ApiKey(
        id=new_id("key"),
        workspace_id=workspace_id,
        label=payload.label,
        kind=payload.kind,
    )
    secret: str | None = None
    if payload.kind == "public":
        key.public_key = new_public_key()
        key.prefix = key.public_key[:6]
    else:
        secret = new_secret_key()
        key.secret_hash = sha256_hex(secret)
        key.prefix = secret[:7]
    db.add(key)
    await db.commit()
    await db.refresh(key)
    out = KeyCreatedOut.model_validate(key)
    out.secret = secret
    return out


@router.delete("/{key_id}", status_code=204)
async def revoke_key(
    key_id: str,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    key = (await db.execute(select(ApiKey).where(ApiKey.id == key_id))).scalar_one_or_none()
    if not key or key.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Key tidak ditemukan")
    key.revoked = True
    await db.commit()
