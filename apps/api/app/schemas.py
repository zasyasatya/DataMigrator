"""Pydantic schemas for the admin + widget APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- auth
class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORMModel):
    id: str
    email: str
    name: str
    role: str


class LoginOut(BaseModel):
    token: str
    user: UserOut
    workspace: "WorkspaceOut"


class WorkspaceOut(ORMModel):
    id: str
    name: str
    slug: str


# -------------------------------------------------------------------------- keys
class KeyCreateIn(BaseModel):
    label: str = "Default"
    kind: Literal["public", "secret"] = "public"


class KeyOut(ORMModel):
    id: str
    label: str
    kind: str
    public_key: str | None
    prefix: str
    revoked: bool
    created_at: datetime


class KeyCreatedOut(KeyOut):
    secret: str | None = None  # only returned once on creation


# ------------------------------------------------------------------------- agents
class RuleIn(BaseModel):
    trigger: str
    response: str


class AgentCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    role_title: str = "Asisten pelanggan"
    emoji: str = "✨"
    instructions: str = ""
    tone: Literal["friendly", "formal", "casual", "playful"] = "friendly"
    language: Literal["id", "en"] = "id"


class AgentUpdateIn(BaseModel):
    name: str | None = None
    role_title: str | None = None
    emoji: str | None = None
    instructions: str | None = None
    tone: str | None = None
    language: str | None = None
    rules: list[RuleIn] | None = None
    guardrails: list[str] | None = None
    engine: Literal["auto", "openai", "offline"] | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)
    retrieval_top_k: int | None = Field(default=None, ge=1, le=10)
    greeting: str | None = None
    starter_prompts: list[str] | None = None
    fallback_message: str | None = None
    handoff_enabled: bool | None = None
    handoff_message: str | None = None
    theme: dict[str, Any] | None = None
    allowed_origins: list[str] | None = None

    @field_validator("starter_prompts", "guardrails", "allowed_origins", mode="before")
    @classmethod
    def _strip_empty(cls, v: Any) -> Any:
        if isinstance(v, list):
            return [x for x in v if isinstance(x, str) and x.strip()]
        return v


class AgentOut(ORMModel):
    id: str
    name: str
    role_title: str
    emoji: str
    status: str
    instructions: str
    tone: str
    language: str
    rules: list[RuleIn] = []
    guardrails: list[str] = []
    engine: str
    model: str | None
    temperature: float
    retrieval_top_k: int
    greeting: str
    starter_prompts: list[str] = []
    fallback_message: str
    handoff_enabled: bool
    handoff_message: str
    theme: dict[str, Any]
    allowed_origins: list[str] = []
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    document_count: int = 0
    conversation_count: int = 0
    public_key: str | None = None


class AgentStatsOut(BaseModel):
    conversations_today: int
    conversations_total: int
    messages_today: int
    resolution_rate: float
    avg_response_s: float
    csat: float
    live_now: int
    top_sources: list[dict[str, Any]] = []


# --------------------------------------------------------------------- knowledge
class DocumentIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = ""
    source: Literal["text", "file", "faq"] = "text"


class DocumentOut(ORMModel):
    id: str
    title: str
    source: str
    content: str
    created_at: datetime
    updated_at: datetime
    chunk_count: int = 0


# ------------------------------------------------------------------ conversations
class MessageOut(ORMModel):
    id: str
    role: str
    content: str
    latency_ms: int | None
    sources: list[Any] = []
    engine: str
    created_at: datetime
    feedback: list["FeedbackOut"] = []


class FeedbackOut(ORMModel):
    id: str
    rating: str
    comment: str


class ConversationOut(ORMModel):
    id: str
    channel: str
    visitor_name: str | None
    visitor_email: str | None
    origin: str | None
    status: str
    started_at: datetime
    last_message_at: datetime
    message_count: int = 0
    last_message: str = ""


class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut] = []


class FeedbackIn(BaseModel):
    message_id: str
    rating: Literal["up", "down"]
    comment: str = ""


# ------------------------------------------------------------------------ widget
class WidgetChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    visitor_id: str | None = None
    visitor_name: str | None = None
    visitor_email: str | None = None
    origin: str | None = None


class WidgetSessionOut(BaseModel):
    conversation_id: str
    greeting: str
    starter_prompts: list[str] = []


class WidgetConfigOut(BaseModel):
    agent_id: str
    name: str
    role_title: str
    emoji: str
    greeting: str
    starter_prompts: list[str] = []
    language: str
    theme: dict[str, Any]
    handoff_enabled: bool
    powered_by: str = "Sapa AI"


# --------------------------------------------------------------------- analytics
class ActivityItem(BaseModel):
    id: str
    kind: str  # message | conversation | publish
    icon: str
    title: str
    detail: str
    agent: str
    ago: str
    created_at: datetime


class OverviewOut(BaseModel):
    greeting: str
    agents_live: int
    agents_total: int
    tasks_now: int
    conversations_today: int
    conversations_done: int
    conversations_todo: int
    messages_today: int
    resolution_rate: float
    avg_response_s: float
    csat: float
    time_saved_h: float
    activity: list[ActivityItem] = []
    recent_conversations: list[ConversationOut] = []
    week_series: list[int] = []
