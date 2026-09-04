# Sapa AI — all-in-one image (Coolify-ready).
#
# Satu container menjalankan backend FastAPI (:8000 internal) + dashboard
# Next.js (:3000 / $PORT). Coolify cukup deploy repo ini sebagai "Dockerfile"
# dan expose port 3000 — tidak perlu docker-compose di sisi Coolify.
#
# Build lokal:
#   docker build -t sapa-ai:all-in-one .
#   docker run --rm -p 3000:3000 -e SECRET_KEY=... -v sapa-data:/data sapa-ai:all-in-one
#
# Catatan arsitektur:
# - Widget popup (packages/widget) di-build di dalam image -> tidak ada
#   prasyarat `npm run build:widget` di host saat deploy via image ini.
# - Next.js me-rewrite /api/v1/*, /w/*, /embed/* ke API_INTERNAL_URL
#   (default http://127.0.0.1:8000, satu host yang sama -> bebas drama CORS).
# - SQLite default di /data/sapa.db (VOLUME /data). Untuk Postgres, isi
#   DATABASE_URL=postgresql+asyncpg://... saat deploy.

# ---- stage 1: build widget + dashboard ---------------------------------------
FROM node:22-bookworm-slim AS webbuild

WORKDIR /repo

# Install deps dulu (cache-friendly) — workspaces: @sapa/web + @sapa/widget.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/widget/package.json packages/widget/package.json
RUN npm ci --no-audit --no-fund

# Build widget popup (satu file IIFE) — dibutuhkan backend saat serve /embed/widget.js.
COPY packages/widget ./packages/widget
RUN npm run build --workspace @sapa/widget

# Build dashboard Next.js production.
COPY apps/web ./apps/web
RUN npm run build --workspace @sapa/web

# ---- stage 2: runtime python + node -------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    PORT=3000 \
    API_PORT=8000 \
    WIDGET_BUNDLE=/srv/widget.js

# curl untuk debug; node+npm disalin dari image node resmi (glibc cocok).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node:22-bookworm-slim /usr/local /usr/local

WORKDIR /srv

# Backend deps.
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Backend code + widget bundle hasil build stage 1.
COPY apps/api/app ./app
COPY --from=webbuild /repo/packages/widget/dist/widget.js ./widget.js

# Dashboard hasil build + node_modules hoisted (next start resolving ke /srv/node_modules).
COPY --from=webbuild /repo/apps/web/.next ./web/.next
COPY --from=webbuild /repo/apps/web/package.json ./web/package.json
COPY --from=webbuild /repo/apps/web/next.config.ts ./web/next.config.ts
COPY --from=webbuild /repo/node_modules ./node_modules
COPY --from=webbuild /repo/package.json ./package.json

# Startup script (jalan dua proses: uvicorn + next start).
COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh \
    && mkdir -p /data \
    && node --version && npm --version && python --version \
    && ls -la /srv/widget.js /srv/web/.next

VOLUME ["/data"]

# 3000 = dashboard (port utama untuk Coolify), 8000 = API (healthcheck/internal).
EXPOSE 3000 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('API_PORT','8000')+'/healthz',timeout=8).read()" || exit 1

CMD ["./start.sh"]
