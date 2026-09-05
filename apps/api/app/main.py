"""Sapa AI — FastAPI application entrypoint."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import agents, analytics, auth, channels, conversations, embed, keys, knowledge, simulate, widget
from app.api.routers import settings as settings_router
from app.core.config import settings
from app.core.db import SessionLocal, init_db
from app.seed import ensure_admin, seed

# Log bootstrap (admin/workspace/db) harus terlihat di `docker logs` / log Coolify,
# karena di situlah penyebab "deploy sukses tapi tidak bisa login" paling cepat ketahuan.
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("sapa.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "boot: env=%s db=%s app_url=%s widget=%s",
        settings.environment,
        settings.database_url,
        settings.app_url,
        settings.widget_bundle,
    )
    await init_db()
    async with SessionLocal() as db:
        # 1) seed penuh (agent + knowledge + keys) hanya saat DB benar-benar kosong
        await seed(db)
        # 2) jaminan admin: jalan setiap boot, memperbaiki DB produksi yang sudah
        #    terisi (admin hilang / ADMIN_* diubah / workspace dangling)
        await ensure_admin(db)
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

for r in (auth, agents, knowledge, conversations, simulate, analytics, keys, widget, embed, settings_router, channels):
    app.include_router(r.router)


@app.get("/healthz", tags=["meta"])
async def healthz():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0"}


@app.get("/", include_in_schema=False)
async def root():
    from fastapi.responses import RedirectResponse

    return RedirectResponse("/docs")
