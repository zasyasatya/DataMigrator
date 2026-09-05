"""Regresi untuk bug produksi: login gagal di balik reverse proxy / HTTPS.

Dua akar masalah yang dikunci di sini:

1. **Proxy build-time** — `rewrites()` Next.js dibekukan saat build sehingga
   `API_INTERNAL_URL` runtime diabaikan (diperbaiki di sisi web dengan route
   handler; di sini kita kunci perilaku backend yang mendukungnya).
2. **Cookie sesi** — tanpa flag `Secure` di HTTPS, dan nilai token mengandung
   padding `=` yang membuat Starlette meng-quote Set-Cookie.
3. **Bootstrap admin** — `seed()` hanya jalan saat DB kosong, jadi admin yang
   hilang di DB produksi tidak pernah dibuat ulang.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json

import httpx
import pytest
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import (
    create_session_token,
    decode_session_token,
    hash_password,
    is_secure_request,
    verify_password,
)
from app.models import User
from app.seed import ensure_admin


# ---------------------------------------------------------------- cookie / TLS


async def test_login_sets_secure_cookie_only_behind_https(client: httpx.AsyncClient):
    """Di balik Cloudflare/Coolify skema yang terlihat uvicorn adalah http;
    satu-satunya sinyal HTTPS adalah x-forwarded-proto."""
    https = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@sapa.ai", "password": "admin123"},
        headers={"X-Forwarded-Proto": "https", "X-Forwarded-Host": "sapa.example.id"},
    )
    assert https.status_code == 200, https.text
    cookie = https.headers.get("set-cookie", "")
    assert "sapa_session=" in cookie
    assert "Secure" in cookie, "cookie harus Secure saat klien pakai HTTPS"
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie.lower().replace("samesite=lax", "SameSite=lax")
    assert "Path=/" in cookie

    plain = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "admin123"}
    )
    assert plain.status_code == 200
    assert "Secure" not in plain.headers.get("set-cookie", ""), (
        "cookie tidak boleh Secure pada http biasa, atau browser lokal menolaknya"
    )


def test_x_forwarded_proto_multi_hop_parsing():
    """Proxy bertingkat mengirim 'https, http' — hop pertama yang menentukan."""

    class _Req:
        def __init__(self, headers, scheme="http"):
            self.headers = headers
            self.url = type("U", (), {"scheme": scheme})()

    assert is_secure_request(_Req({"x-forwarded-proto": "https, http"})) is True
    assert is_secure_request(_Req({"x-forwarded-proto": "HTTPS"})) is True
    assert is_secure_request(_Req({"x-forwarded-proto": "http"})) is False
    assert is_secure_request(_Req({"x-forwarded-ssl": "on"})) is True
    assert is_secure_request(_Req({})) is False
    assert is_secure_request(_Req({}, scheme="https")) is True


# ------------------------------------------------------------------- token


def test_session_token_has_no_base64_padding():
    """Padding '=' memaksa Starlette meng-quote nilai cookie
    (sapa_session="…"), yang sebagian klien kirim ulang apa adanya."""
    token = create_session_token("user_abc123")
    body, _, sig = token.partition(".")
    assert "=" not in token, f"token masih mengandung padding: {token!r}"
    assert decode_session_token(token) == "user_abc123"
    assert hmac.compare_digest(sig, hmac.new(settings.secret_key.encode(), body.encode(), hashlib.sha256).hexdigest())


def test_decode_token_tolerates_legacy_padding_and_quotes():
    """Token lama (dengan '=') dan cookie yang tiba masih ter-quote tetap valid."""
    payload = {"sub": "user_legacy", "iat": 1, "exp": 4_000_000_000}
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode()
    sig = hmac.new(settings.secret_key.encode(), body.encode(), hashlib.sha256).hexdigest()
    legacy = f"{body}.{sig}"
    assert "=" in body, "prekondisi: body legacy memang berpadding"
    assert decode_session_token(legacy) == "user_legacy"
    assert decode_session_token(f'"{legacy}"') == "user_legacy"
    assert decode_session_token(legacy.rstrip("=")) is None or True  # tidak boleh crash


def test_decode_token_rejects_tampered_signature():
    token = create_session_token("user_abc")
    body, _, _ = token.partition(".")
    assert decode_session_token(f"{body}." + "0" * 64) is None
    assert decode_session_token("bukan-token") is None


async def test_cookie_only_auth_works_like_browser(client: httpx.AsyncClient):
    """Browser mengirim ulang cookie TANPA quote — jalur auth kedua setelah Bearer."""
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "admin123"}
    )
    raw = resp.headers.get("set-cookie", "")
    assert raw.startswith("sapa_session=")
    assert '"' not in raw.split(";", 1)[0], "nilai cookie tidak boleh ter-quote"

    me = await client.get("/api/v1/auth/me", headers={"Cookie": raw.split(";", 1)[0]})
    assert me.status_code == 200, me.text
    assert me.json()["user"]["email"] == "admin@sapa.ai"


async def test_logout_clears_cookie_with_matching_attributes(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/auth/logout", headers={"X-Forwarded-Proto": "https"}
    )
    assert resp.status_code == 200
    cookie = resp.headers.get("set-cookie", "")
    assert "sapa_session=" in cookie
    assert "Path=/" in cookie and "Secure" in cookie, (
        "atribut delete_cookie harus sama dengan set_cookie agar benar-benar terhapus"
    )


# ------------------------------------------------------------- bootstrap admin


@pytest.mark.parametrize("password", ["admin123"])
async def test_ensure_admin_is_idempotent(client: httpx.AsyncClient, password: str):
    for _ in range(2):
        async with SessionLocal() as db:
            await ensure_admin(db)
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": password}
    )
    assert resp.status_code == 200


async def test_ensure_admin_recreates_missing_admin(client: httpx.AsyncClient):
    """Skenario produksi: volume /data sudah berisi workspace tetapi user admin
    hilang/berganti email. `seed()` melewati DB tidak-kosong, jadi tanpa
    `ensure_admin` login gagal 401 selamanya."""
    async with SessionLocal() as db:
        await db.execute(delete(User))
        await db.commit()

    gone = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "admin123"}
    )
    assert gone.status_code == 401, "prekondisi: admin memang hilang"

    async with SessionLocal() as db:
        await ensure_admin(db)

    back = await client.post(
        "/api/v1/auth/login", json={"email": "admin@sapa.ai", "password": "admin123"}
    )
    assert back.status_code == 200, back.text
    assert back.json()["workspace"]["slug"] == "acme-store"


async def test_ensure_admin_respects_reset_flag(monkeypatch: pytest.MonkeyPatch):
    """ADMIN_PASSWORD baru hanya diterapkan saat RESET_ADMIN_PASSWORD=1 —
    default-nya tidak, supaya env yang bocor tidak membajak akun."""
    monkeypatch.setattr(settings, "admin_password", "PasswordBaru123!")

    monkeypatch.delenv("RESET_ADMIN_PASSWORD", raising=False)
    async with SessionLocal() as db:
        await ensure_admin(db)
        user = (
            await db.execute(select(User).where(User.email == settings.admin_email))
        ).scalar_one()
        assert not verify_password("PasswordBaru123!", user.password_hash), (
            "tanpa flag, password lama harus tetap berlaku"
        )

    monkeypatch.setenv("RESET_ADMIN_PASSWORD", "1")
    async with SessionLocal() as db:
        await ensure_admin(db)
        user = (
            await db.execute(select(User).where(User.email == settings.admin_email))
        ).scalar_one()
        assert verify_password("PasswordBaru123!", user.password_hash)

    # kembalikan agar test lain tidak terpengaruh
    monkeypatch.delenv("RESET_ADMIN_PASSWORD", raising=False)
    monkeypatch.setattr(settings, "admin_password", "admin123")
    async with SessionLocal() as db:
        await ensure_admin(db)


async def test_password_hash_verifies_independent_of_secret_key(
    monkeypatch: pytest.MonkeyPatch,
):
    """Salt disimpan di dalam hash: mengganti SECRET_KEY (umum saat pindah
    environment) tidak boleh membuat semua user gagal login."""
    stored = hash_password("rahasia")
    monkeypatch.setattr(settings, "secret_key", "secret-key-benar-benar-berbeda")
    assert verify_password("rahasia", stored)
    assert not verify_password("salah", stored)


def test_os_environ_flag_helper_is_case_insensitive(monkeypatch: pytest.MonkeyPatch):
    from app.seed import _flag

    for value in ("1", "true", "TRUE", "yes", "on"):
        monkeypatch.setenv("SEED_DEMO", value)
        assert _flag("SEED_DEMO") is True, value
    for value in ("0", "false", "", "no"):
        monkeypatch.setenv("SEED_DEMO", value)
        assert _flag("SEED_DEMO") is False, value
