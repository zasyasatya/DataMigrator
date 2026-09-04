"""Channel WhatsApp & Instagram — webhook Meta (Cloud API) compatible.

Alur: Meta mengirim event ke POST /api/v1/channels/webhook/{whatsapp|instagram}.
Kita cari agent dari phone_number_id / page id, jalankan engine chat yang sama
(simulator/widget), lalu balas lewat Graph API bila access token tersedia.
Tanpa token = mode dry-run: balasan tetap disimpan & dikembalikan di response
(sehingga bisa diuji tanpa akun Meta).
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal, get_db
from app.core.deps import get_workspace_id
from app.core.ids import new_id
from app.models import Agent, Conversation
from app.schemas import ChannelTestIn, ChannelTestOut
from app.services.chat import run_chat

log = logging.getLogger("sapa.channels")
GRAPH = "https://graph.facebook.com/v21.0"

router = APIRouter(tags=["channels"])


def _channel_cfg(agent: Agent, channel: str) -> dict:
    return (agent.channels or {}).get(channel) or {}


async def _find_agent_by_channel(db: AsyncSession, channel: str, remote_id: str) -> Agent | None:
    field = "phone_number_id" if channel == "whatsapp" else "page_id"
    rows = (await db.execute(select(Agent).where(Agent.status == "live"))).scalars().all()
    for a in rows:
        cfg = _channel_cfg(a, channel)
        if cfg.get("enabled") and str(cfg.get(field, "")) == str(remote_id):
            return a
    return None


async def _get_or_create_conversation(
    db: AsyncSession, agent: Agent, channel: str, visitor_id: str, visitor_name: str | None
) -> Conversation:
    conv = (
        await db.execute(
            select(Conversation)
            .where(Conversation.agent_id == agent.id, Conversation.visitor_id == visitor_id)
            .order_by(Conversation.last_message_at.desc())
            .limit(1)
        )
    ).scalars().first()
    if conv and conv.status == "open":
        return conv
    conv = Conversation(
        id=new_id("conversation"),
        agent_id=agent.id,
        channel=channel,
        visitor_id=visitor_id,
        visitor_name=visitor_name,
    )
    db.add(conv)
    await db.commit()
    return conv


async def _send_whatsapp(cfg: dict, to: str, text: str) -> bool:
    token, pnid = cfg.get("access_token"), cfg.get("phone_number_id")
    if not token or not pnid:
        return False
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{GRAPH}/{pnid}/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={"messaging_product": "whatsapp", "to": to, "text": {"body": text}},
        )
    if resp.status_code >= 300:
        log.warning("whatsapp send failed %s %s", resp.status_code, resp.text[:200])
        return False
    return True


async def _send_instagram(cfg: dict, recipient_psid: str, text: str) -> bool:
    token = cfg.get("access_token")
    if not token:
        return False
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{GRAPH}/me/messages",
            params={"access_token": token},
            json={
                "recipient": {"id": recipient_psid},
                "message": {"text": text},
                "messaging_type": "RESPONSE",
            },
        )
    if resp.status_code >= 300:
        log.warning("instagram send failed %s %s", resp.status_code, resp.text[:200])
        return False
    return True


# ------------------------------------------------------------------ webhooks
@router.get("/api/v1/channels/webhook/{channel}", include_in_schema=False)
async def verify(channel: str, request: Request):
    """Meta webhook subscription verification (hub.challenge echo)."""
    if channel not in ("whatsapp", "instagram"):
        return PlainTextResponse("not found", status_code=404)
    q = request.query_params
    if q.get("hub.mode") != "subscribe":
        return PlainTextResponse("bad request", status_code=400)
    token = q.get("hub.verify_token", "")
    async with SessionLocal() as db:
        rows = (await db.execute(select(Agent))).scalars().all()
        for a in rows:
            cfg = _channel_cfg(a, channel)
            if cfg.get("verify_token") and cfg["verify_token"] == token:
                return PlainTextResponse(q.get("hub.challenge", ""))
    return PlainTextResponse("forbidden", status_code=403)


@router.post("/api/v1/channels/webhook/{channel}", include_in_schema=False)
async def webhook(channel: str, request: Request):
    if channel not in ("whatsapp", "instagram"):
        return {"status": "not found"}
    body = await request.json()
    results = []
    async with SessionLocal() as db:
        for entry in body.get("entry", []):
            # ---- WhatsApp (fields API) ----
            if channel == "whatsapp":
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    msgs = value.get("messages") or []
                    pnid = (value.get("metadata") or {}).get("phone_number_id", "")
                    for m in msgs:
                        text = (m.get("text") or {}).get("body") or (m.get("button") or {}).get("text") or ""
                        if not text:
                            continue
                        sender = m.get("from", "unknown")
                        agent = await _find_agent_by_channel(db, "whatsapp", pnid)
                        if not agent:
                            results.append({"status": "ignored", "reason": "no agent"})
                            continue
                        cfg = _channel_cfg(agent, "whatsapp")
                        conv = await _get_or_create_conversation(db, agent, "whatsapp", f"wa:{sender}", f"WA {sender[-4:]}")
                        out = await run_chat(db, agent, conv, text)
                        sent = await _send_whatsapp(cfg, sender, out["reply"])
                        results.append({"status": "ok", "sent": sent, "reply": out["reply"]})
            # ---- Instagram (messenger-style webhook) ----
            else:
                for messaging in entry.get("messaging", []):
                    message = messaging.get("message") or {}
                    text = message.get("text") or ""
                    sender = (messaging.get("sender") or {}).get("id", "unknown")
                    if not text:
                        continue
                    page_id = entry.get("id", "")
                    agent = await _find_agent_by_channel(db, "instagram", page_id)
                    if not agent:
                        results.append({"status": "ignored", "reason": "no agent"})
                        continue
                    cfg = _channel_cfg(agent, "instagram")
                    conv = await _get_or_create_conversation(db, agent, "instagram", f"ig:{sender}", f"IG {sender[-4:]}")
                    out = await run_chat(db, agent, conv, text)
                    sent = await _send_instagram(cfg, sender, out["reply"])
                    results.append({"status": "ok", "sent": sent, "reply": out["reply"]})
    return {"status": "processed", "results": results}


# ------------------------------------------------------- in-dashboard tester
@router.post(
    "/api/v1/agents/{agent_id}/channels/{channel}/test",
    response_model=ChannelTestOut,
)
async def test_channel(
    agent_id: str,
    channel: str,
    payload: ChannelTestIn,
    workspace_id: str = Depends(get_workspace_id),
    db: AsyncSession = Depends(get_db),
):
    """Dry-run incoming message dari channel (tanpa memanggil Meta)."""
    if channel not in ("whatsapp", "instagram", "api"):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Channel tidak didukung")
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent or agent.workspace_id != workspace_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")
    conv = await _get_or_create_conversation(
        db, agent, channel, f"{channel}:tester", f"Tester {channel}"
    )
    out = await run_chat(db, agent, conv, payload.message)
    return ChannelTestOut(
        reply=out["reply"],
        engine=out["engine"],
        latency_ms=out["latency_ms"],
        sources=out["sources"],
        conversation_id=out["conversation_id"],
    )


@router.get("/api/v1/agents/{agent_id}/channels/webhook-info")
async def webhook_info(agent_id: str, workspace_id: str = Depends(get_workspace_id), db: AsyncSession = Depends(get_db)):
    from app.core.config import settings

    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent or agent.workspace_id != workspace_id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Agent tidak ditemukan")
    base = settings.app_url.rstrip("/")
    cfg = _channel_cfg(agent, "whatsapp")
    verify_token = cfg.get("verify_token") or agent.public_key or ""
    return {
        "whatsapp_callback_url": f"{base}/api/v1/channels/webhook/whatsapp",
        "instagram_callback_url": f"{base}/api/v1/channels/webhook/instagram",
        "verify_token_suggestion": verify_token,
    }
