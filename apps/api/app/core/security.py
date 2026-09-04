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
    return f"{body}.{_sign(body)}"


def decode_session_token(token: str) -> str | None:
    """Return subject if valid & unexpired, else None."""
    try:
        body, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body.encode()))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return str(payload.get("sub"))
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
