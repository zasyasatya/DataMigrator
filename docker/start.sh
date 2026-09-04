#!/bin/sh
# Sapa AI — all-in-one startup: FastAPI (internal) + Next.js (port utama).
# Semua env punya default waras ("magic env"): container jalan tanpa .env,
# cukup override SECRET_KEY (+ DATABASE_URL/OPENAI_*) saat produksi.
set -e

export API_PORT="${API_PORT:-8000}"
export PORT="${PORT:-3000}"
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:${API_PORT}}"
export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:////data/sapa.db}"
export WIDGET_BUNDLE="${WIDGET_BUNDLE:-/srv/widget.js}"
export APP_URL="${APP_URL:-http://localhost:${PORT}}"
export SEED_DEMO="${SEED_DEMO:-0}"

mkdir -p /data ./data

echo "[start] api  0.0.0.0:${API_PORT}  (health: /healthz)"
echo "[start] web  0.0.0.0:${PORT}  -> proxy API ${API_INTERNAL_URL}"
echo "[start] db   ${DATABASE_URL}"

# Backend di background; dashboard di background; tunggu keduanya.
uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT}" &
API_PID=$!

cd /srv/web
./../node_modules/.bin/next start -H 0.0.0.0 -p "${PORT}" &
WEB_PID=$!
cd /srv

_term() {
  echo "[start] shutdown..."
  kill "${API_PID}" "${WEB_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap _term TERM INT

wait "${API_PID}" "${WEB_PID}"
