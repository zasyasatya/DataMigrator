"""SQLAlchemy ORM models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.ids import new_id


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("workspace"))
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    # OpenAI-compatible provider overrides (fallback ke env bila kosong)
    llm_api_key: Mapped[str | None] = mapped_column(String(255), default=None)
    llm_base_url: Mapped[str | None] = mapped_column(String(255), default=None)
    llm_model: Mapped[str | None] = mapped_column(String(120), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="workspace")
    agents: Mapped[list["Agent"]] = relationship(back_populates="workspace")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="workspace")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("user"))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="owner")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspace: Mapped[Workspace] = relationship(back_populates="users")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("key"))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    agent_id: Mapped[str | None] = mapped_column(String, index=True, default=None)
    label: Mapped[str] = mapped_column(String(120), default="Default")
    kind: Mapped[str] = mapped_column(String(16), default="public")  # public | secret
    # public keys are stored in clear (they ship to browsers); secret keys hashed.
    public_key: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    secret_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    prefix: Mapped[str] = mapped_column(String(12), default="")
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    workspace: Mapped[Workspace] = relationship(back_populates="api_keys")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("agent"))
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    role_title: Mapped[str] = mapped_column(String(160), default="Asisten pelanggan")
    emoji: Mapped[str] = mapped_column(String(16), default="✨")
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)  # draft | live

    # --- behaviour / training --------------------------------------------
    instructions: Mapped[str] = mapped_column(Text, default="")
    tone: Mapped[str] = mapped_column(String(24), default="friendly")  # friendly|formal|casual|playful
    language: Mapped[str] = mapped_column(String(8), default="id")
    rules: Mapped[list[Any]] = mapped_column(JSON, default=list)  # [{trigger, response}]
    guardrails: Mapped[list[Any]] = mapped_column(JSON, default=list)  # [str]
    engine: Mapped[str] = mapped_column(String(16), default="auto")  # auto|openai|offline
    model: Mapped[str | None] = mapped_column(String(80), default=None)
    temperature: Mapped[float] = mapped_column(Float, default=0.4)
    retrieval_top_k: Mapped[int] = mapped_column(Integer, default=3)

    # --- conversation ux --------------------------------------------------
    greeting: Mapped[str] = mapped_column(Text, default="Halo! Ada yang bisa saya bantu?")
    starter_prompts: Mapped[list[Any]] = mapped_column(JSON, default=list)
    fallback_message: Mapped[str] = mapped_column(
        Text, default="Maaf, saya belum punya informasi itu. Boleh dijelaskan lagi?"
    )
    handoff_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    handoff_message: Mapped[str] = mapped_column(
        Text, default="Baik, saya sambungkan ke tim kami. Tim akan menghubungi Anda segera."
    )

    # --- appearance / widget ----------------------------------------------
    theme: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=lambda: {
            "primary": "#7C5CF6",
            "radius": 20,
            "position": "right",
            "launcher_label": "Chat",
        },
    )
    allowed_origins: Mapped[list[Any]] = mapped_column(JSON, default=list)
    # channel config: {"whatsapp": {enabled, phone_number_id, access_token, verify_token},
    #                  "instagram": {enabled, page_id, access_token, verify_token}}
    channels: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    workspace: Mapped[Workspace] = relationship(back_populates="agents")
    documents: Mapped[list["KnowledgeDocument"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("document"))
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(16), default="text")  # text|file|faq
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    agent: Mapped[Agent] = relationship(back_populates="documents")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("chunk"))
    agent_id: Mapped[str] = mapped_column(String, index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("knowledge_documents.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    tokens: Mapped[str] = mapped_column(Text, default="")  # pre-normalized token string

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("conversation"))
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    channel: Mapped[str] = mapped_column(String(16), default="widget")  # widget|simulator|api
    visitor_id: Mapped[str | None] = mapped_column(String(64), index=True)
    visitor_name: Mapped[str | None] = mapped_column(String(120), default=None)
    visitor_email: Mapped[str | None] = mapped_column(String(180), default=None)
    origin: Mapped[str | None] = mapped_column(String(255), default=None)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open|resolved
    satisfaction: Mapped[float | None] = mapped_column(Float, default=None)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    agent: Mapped[Agent] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("message"))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    agent_id: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String(16))  # user|assistant
    content: Mapped[str] = mapped_column(Text, default="")
    latency_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    sources: Mapped[list[Any]] = mapped_column(JSON, default=list)
    engine: Mapped[str] = mapped_column(String(24), default="offline")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    feedback: Mapped[list["Feedback"]] = relationship(back_populates="message")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("feedback"))
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(String, index=True)
    rating: Mapped[str] = mapped_column(String(8))  # up|down
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    message: Mapped[Message] = relationship(back_populates="feedback")
