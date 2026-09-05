"""Password hashing + HMAC-signed session tokens (no extra deps)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from app.core.config import settings

_PBKDF2_ROUNDS = 120_000


def hash_password(password: str) -> str:
    salt = hashlib.sha256(f"{settings.secret_key}:salt".encode()).hexdigest()[:16]
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ROUNDS)
    return f"pbkdf2${_PBKDF2_ROUNDS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), int(rounds)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, TypeError):
        return False


def _sign(body: str) -> str:
    return hmac.new(settings.secret_key.encode(), body.encode(), hashlib.sha256).hexdigest()


def create_session_token(subject: str, hours: int | None = None) -> str:
    hours = hours or settings.session_hours
    payload = {"sub": subject, "iat": int(time.time()), "exp": int(time.time()) + hours * 3600}
    body = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode()
    # Padding "=" dibuang: kalau tidak, Starlette meng-quote nilai Set-Cookie
    # (sapa_session="...") dan sebagian proxy/browser mengirim ulang quote-nya
    # apa adanya sehingga token gagal diverifikasi.
    return f"{body.rstrip('=')}.{_sign(body.rstrip('='))}"


def decode_session_token(token: str) -> str | None:
    """Return subject if valid & unexpired, else None.

    Toleran terhadap token lama (dengan padding "=") dan terhadap cookie yang
    tiba masih terbungkus quote ganda.
    """
    try:
        token = token.strip().strip('"').strip("'").strip()
        body, sig = token.rsplit(".", 1)
        # Terima signature yang dihitung atas body dengan/tanpa padding.
        if not (
            hmac.compare_digest(sig, _sign(body))
            or hmac.compare_digest(sig, _sign(body.rstrip("=")))
        ):
            return None
        padded = body + "=" * (-len(body) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode()))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return str(payload.get("sub"))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def is_secure_request(request) -> bool:
    """True bila klien mengakses lewat HTTPS.

    Di produksi aplikasi berada di balik Cloudflare/Coolify Traefik yang
    men-terminate TLS, sehingga skema yang terlihat uvicorn adalah `http`.
    Header `x-forwarded-proto` (ditambahkan proxy Next.js & reverse proxy)
    adalah satu-satunya sinyal yang benar — tanpanya cookie `Secure` tidak
    pernah terpasang dan sesi bisa hilang/ditolak browser.
    """
    try:
        xfp = request.headers.get("x-forwarded-proto", "")
        if xfp:
            return xfp.split(",")[0].strip().lower() == "https"
        if str(request.headers.get("x-forwarded-ssl", "")).lower() == "on":
            return True
        return request.url.scheme == "https"
    except Exception:  # pragma: no cover - defensif
        return False
