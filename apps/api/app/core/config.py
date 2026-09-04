"""Application settings (pydantic-settings, env driven)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]  # .../apps/api
REPO_ROOT = API_DIR.parent.parent  # repository root


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(API_DIR / ".env", REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- core -------------------------------------------------------------
    app_name: str = "Sapa AI"
    environment: str = "development"
    secret_key: str = "dev-secret-change-me-0123456789abcdef"
    database_url: str = f"sqlite+aiosqlite:///{API_DIR / 'data' / 'sapa.db'}"

    # --- bootstrap admin --------------------------------------------------
    admin_email: str = "admin@sapa.ai"
    admin_password: str = "admin123"
    admin_name: str = "Admin Sapa"
    workspace_name: str = "Acme Store"

    # --- llm provider (OpenAI-compatible: OpenAI / Groq / OpenRouter / Ollama) ---
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    # --- urls / cors ------------------------------------------------------
    app_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["*"]
    session_cookie: str = "sapa_session"
    session_hours: int = 12 * 30

    # --- widget bundle ----------------------------------------------------
    widget_bundle: Path = REPO_ROOT / "packages" / "widget" / "dist" / "widget.js"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
