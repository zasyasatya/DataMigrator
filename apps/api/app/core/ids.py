"""Prefixed, URL-safe ids."""

from __future__ import annotations

import secrets

_PREFIXES = {
    "workspace": "ws",
    "user": "usr",
    "agent": "agt",
    "document": "doc",
    "chunk": "chk",
    "conversation": "cnv",
    "message": "msg",
    "key": "key",
    "feedback": "fbk",
}


def new_id(kind: str) -> str:
    return f"{_PREFIXES[kind]}_{secrets.token_urlsafe(12)}"


def new_public_key() -> str:
    return f"pk_{secrets.token_urlsafe(18)}"


def new_secret_key() -> str:
    return f"sk_{secrets.token_urlsafe(24)}"
