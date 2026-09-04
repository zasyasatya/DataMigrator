"""Sapa AI — FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import agents, analytics, auth, conversations, embed, keys, knowledge, simulate, widget
from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with SessionLocal() as db:
        await seed(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="No-code AI agent platform: train, simulate, and embed customer-support chatbots.",
    lifespan=lifespan,
)

# Widget endpoints enforce their own per-agent origin allowlist (see core.deps.check_origin);
# admin APIs authenticate with Bearer tokens, so a permissive CORS policy is safe here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

for r in (auth, agents, knowledge, conversations, simulate, analytics, keys, widget, embed):
    app.include_router(r.router)


@app.get("/healthz", tags=["meta"])
async def healthz():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0"}


@app.get("/", include_in_schema=False)
async def root():
    from fastapi.responses import RedirectResponse

    return RedirectResponse("/docs")
