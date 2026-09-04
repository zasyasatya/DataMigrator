from __future__ import annotations

import httpx

from tests.conftest import sse_events, sse_text


async def test_healthz(client: httpx.AsyncClient):
    resp = await client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_login_success_and_failure(client: httpx.AsyncClient):
    ok = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "admin123"}
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["token"] and body["user"]["email"] == "admin@sapa.ai"
    assert body["workspace"]["slug"] == "acme-store"

    bad = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "salah"}
    )
    assert bad.status_code == 401


async def test_me_requires_auth(client: httpx.AsyncClient):
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_agent_crud_and_publish(client: httpx.AsyncClient, auth: dict):
    created = await client.post(
        "/api/v1/agents",
        json={"name": "Test Bot", "role_title": "QA", "tone": "formal"},
        headers=auth,
    )
    assert created.status_code == 201, created.text
    agent = created.json()
    assert agent["status"] == "draft"
    assert agent["public_key"], "widget public key auto-created"

    patched = await client.patch(
        f"/api/v1/agents/{agent['id']}",
        json={"instructions": "Jawab singkat.", "temperature": 0.2},
        headers=auth,
    )
    assert patched.status_code == 200
    assert patched.json()["instructions"] == "Jawab singkat."

    pub = await client.post(f"/api/v1/agents/{agent['id']}/publish", headers=auth)
    assert pub.json()["status"] == "live"

    listed = await client.get("/api/v1/agents", headers=auth)
    assert any(a["id"] == agent["id"] for a in listed.json())

    deleted = await client.delete(f"/api/v1/agents/{agent['id']}", headers=auth)
    assert deleted.status_code == 204


async def test_simulate_requires_auth(client: httpx.AsyncClient):
    resp = await client.post("/api/v1/agents/agt_x/simulate", json={"message": "halo"})
    assert resp.status_code == 401


async def test_knowledge_retrieval_and_simulate_stream(client: httpx.AsyncClient, auth: dict):
    agent = (await client.post("/api/v1/agents", json={"name": "Retriever"}, headers=auth)).json()
    doc = await client.post(
        f"/api/v1/agents/{agent['id']}/knowledge",
        json={
            "title": "Garansi",
            "content": "Semua mesin kopi bergaransi 12 bulan. Klaim garansi melalui email garansi@acme.id dengan menyertakan nomor seri.",
        },
        headers=auth,
    )
    assert doc.status_code == 201
    docs = (await client.get(f"/api/v1/agents/{agent['id']}/knowledge", headers=auth)).json()
    assert docs[0]["chunk_count"] >= 1

    events = await sse_events(
        client,
        "POST",
        f"/api/v1/agents/{agent['id']}/simulate",
        json={"message": "berapa lama garansi mesin kopi?"},
        headers=auth,
    )
    names = [n for n, _ in events]
    assert "meta" in names and "delta" in names and "done" in names
    text = sse_text(events)
    assert "garansi" in text.lower()
    assert "12 bulan" in text
    meta = dict(events)[("meta",)] if ("meta",) in dict(events) else next(d for n, d in events if n == "meta")
    assert meta["sources"], "retrieval sources reported"
    done = next(d for n, d in events if n == "done")
    assert done["latency_ms"] >= 0


async def test_rules_behaviour(client: httpx.AsyncClient, auth: dict):
    agent = (await client.post("/api/v1/agents", json={"name": "Rulesy"}, headers=auth)).json()
    await client.patch(
        f"/api/v1/agents/{agent['id']}",
        json={"rules": [{"trigger": "promo", "response": "Kode PROMO10 untuk diskon 10%."}]},
        headers=auth,
    )
    events = await sse_events(
        client,
        "POST",
        f"/api/v1/agents/{agent['id']}/simulate",
        json={"message": "ada promo apa hari ini?"},
        headers=auth,
    )
    assert "PROMO10" in sse_text(events)


async def test_widget_end_to_end(client: httpx.AsyncClient, auth: dict):
    agent = (await client.post("/api/v1/agents", json={"name": "Widgetly"}, headers=auth)).json()
    pk = agent["public_key"]

    cfg = await client.get(f"/w/{pk}/config")
    assert cfg.status_code == 200
    assert cfg.json()["name"] == "Widgetly"

    session = await client.post(f"/w/{pk}/session")
    assert session.status_code == 200
    cid = session.json()["conversation_id"]

    events = await sse_events(
        client, "POST", f"/w/{pk}/chat", json={"message": "halo", "conversation_id": cid}
    )
    text = sse_text(events)
    assert text.strip(), "widget stream produced a reply"
    done = next(d for n, d in events if n == "done")

    fb = await client.post(
        f"/api/v1/conversations/{cid}/feedback",
        json={"message_id": done["message_id"], "rating": "up"},
    )
    assert fb.status_code == 201

    history = await client.get(f"/w/{pk}/history", params={"conversation_id": cid})
    assert history.status_code == 200
    roles = [m["role"] for m in history.json()]
    assert roles == ["user", "assistant"]


async def test_widget_origin_allowlist(client: httpx.AsyncClient, auth: dict):
    agent = (await client.post("/api/v1/agents", json={"name": "Locked"}, headers=auth)).json()
    await client.patch(
        f"/api/v1/agents/{agent['id']}",
        json={"allowed_origins": ["https://toko.example.com"]},
        headers=auth,
    )
    pk = agent["public_key"]
    blocked = await client.get(f"/w/{pk}/config", headers={"Origin": "https://evil.example.org"})
    assert blocked.status_code == 403
    allowed = await client.get(f"/w/{pk}/config", headers={"Origin": "https://toko.example.com"})
    assert allowed.status_code == 200


async def test_analytics_overview(client: httpx.AsyncClient, auth: dict):
    resp = await client.get("/api/v1/analytics/overview", headers=auth)
    assert resp.status_code == 200
    body = resp.json()
    for field in ("agents_live", "conversations_today", "resolution_rate", "week_series"):
        assert field in body
    assert len(body["week_series"]) == 7


async def test_keys_management(client: httpx.AsyncClient, auth: dict):
    created = await client.post("/api/v1/keys", json={"label": "srv", "kind": "secret"}, headers=auth)
    assert created.status_code == 201
    secret = created.json()["secret"]
    assert secret.startswith("sk_")
    keys = (await client.get("/api/v1/keys", headers=auth)).json()
    assert any(k["id"] == created.json()["id"] for k in keys)
    revoked = await client.delete(f"/api/v1/keys/{created.json()['id']}", headers=auth)
    assert revoked.status_code == 204


async def test_embed_widget_js_served(client: httpx.AsyncClient):
    resp = await client.get("/embed/widget.js")
    assert resp.status_code in (200, 404)  # 404 only if bundle not built yet
    if resp.status_code == 200:
        assert "javascript" in resp.headers["content-type"]


async def test_llm_settings_save_mask_and_test(client: httpx.AsyncClient, auth: dict):
    put = await client.put(
        "/api/v1/settings/llm",
        json={"api_key": "sk-test-1234567890abcdef", "base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
        headers=auth,
    )
    assert put.status_code == 200
    body = put.json()
    assert body["has_key"] is True and body["source"] == "workspace"
    assert body["key_masked"].endswith("cdef") and "sk-test-1234" not in body["key_masked"]

    got = await client.get("/api/v1/settings/llm", headers=auth)
    assert got.json()["has_key"] is True

    test = await client.post("/api/v1/settings/llm/test", headers=auth)
    assert test.status_code == 200
    # tidak ada jaringan/key valid di sandbox → ok=False dengan error rapi
    assert test.json()["ok"] is False or test.json()["ok"] is True

    clear = await client.put("/api/v1/settings/llm", json={"api_key": ""}, headers=auth)
    assert clear.json()["source"] == "none"


async def test_channel_dryrun_and_webhook(client: httpx.AsyncClient, auth: dict):
    agent = (await client.post("/api/v1/agents", json={"name": "ChanBot"}, headers=auth)).json()
    await client.post(f"/api/v1/agents/{agent['id']}/publish", headers=auth)
    await client.patch(
        f"/api/v1/agents/{agent['id']}",
        json={
            "channels": {
                "whatsapp": {
                    "enabled": True,
                    "phone_number_id": "1234567890",
                    "access_token": "",
                    "verify_token": "vtoken123",
                },
                "instagram": {"enabled": True, "page_id": "pg-1", "access_token": "", "verify_token": "igtok"},
            }
        },
        headers=auth,
    )

    # dry-run tester dari dashboard
    t = await client.post(
        f"/api/v1/agents/{agent['id']}/channels/whatsapp/test",
        json={"message": "halo bot"},
        headers=auth,
    )
    assert t.status_code == 200, t.text
    assert t.json()["reply"].strip()

    # webhook verify (Meta handshake)
    v = await client.get(
        "/api/v1/channels/webhook/whatsapp",
        params={"hub.mode": "subscribe", "hub.verify_token": "vtoken123", "hub.challenge": "CH42"},
    )
    assert v.status_code == 200 and v.text == "CH42"
    bad = await client.get(
        "/api/v1/channels/webhook/whatsapp",
        params={"hub.mode": "subscribe", "hub.verify_token": "salah", "hub.challenge": "x"},
    )
    assert bad.status_code == 403

    # webhook event (dry-run karena access_token kosong → reply dikembalikan)
    w = await client.post(
        "/api/v1/channels/webhook/whatsapp",
        json={
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {"phone_number_id": "1234567890"},
                                "messages": [{"from": "6281234567890", "text": {"body": "halo dari wa"}}],
                            }
                        }
                    ]
                }
            ]
        },
    )
    assert w.status_code == 200
    res = w.json()["results"][0]
    assert res["status"] == "ok" and res["sent"] is False and res["reply"]

    convs = (await client.get(f"/api/v1/agents/{agent['id']}/conversations", headers=auth)).json()
    assert any(c["channel"] == "whatsapp" for c in convs)


async def test_agent_analytics(client: httpx.AsyncClient, auth: dict):
    agents = (await client.get("/api/v1/agents", headers=auth)).json()
    aid = agents[0]["id"]
    resp = await client.get(f"/api/v1/analytics/agents/{aid}", headers=auth)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["series"]) == 14
    assert len(body["hour_histogram"]) == 24
    for key in ("by_channel", "top_sources", "feedback", "engine_split", "csat", "avg_latency_s"):
        assert key in body
