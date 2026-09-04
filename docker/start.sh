#!/bin/sh
# Sapa AI — all-in-one startup: FastAPI (internal) + Next.js (port utama).
# Semua env punya default waras ("magic env"): container jalan tanpa .env,
# cukup override SECRET_KEY (+ DATABASE_URL/OPENAI_*) saat produksi.
set -e

export API_PORT="${API_PORT:-8000}"
export PORT="${PORT:-3000}"
# PENTING: 127.0.0.1, bukan `localhost`. Di container Docker baris
# `::1 localhost` pada /etc/hosts membuat Node mencoba IPv6 lebih dulu,
# sedangkan uvicorn di bawah hanya listen IPv4 (0.0.0.0) -> ECONNREFUSED
# dan seluruh /api/v1/* (termasuk login) 502.
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:${API_PORT}}"
case "${API_INTERNAL_URL}" in
  *//localhost:*)
    _fixed=$(printf '%s' "${API_INTERNAL_URL}" | sed 's#//localhost:#//127.0.0.1:#')
    echo "[start] API_INTERNAL_URL memakai 'localhost' -> dinormalkan ke ${_fixed} (hindari IPv6 ::1)"
    export API_INTERNAL_URL="${_fixed}"
    ;;
esac
export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:////data/sapa.db}"
export WIDGET_BUNDLE="${WIDGET_BUNDLE:-/srv/widget.js}"
export APP_URL="${APP_URL:-http://localhost:${PORT}}"
export SEED_DEMO="${SEED_DEMO:-0}"

mkdir -p /data ./data

echo "[start] ============================================================"
echo "[start] Sapa AI all-in-one"
echo "[start]   web (dashboard)  0.0.0.0:${PORT}   <- port untuk Coolify"
echo "[start]   api (internal)   0.0.0.0:${API_PORT}  health: /healthz"
echo "[start]   proxy target     ${API_INTERNAL_URL}  (dibaca runtime oleh Next)"
echo "[start]   database         ${DATABASE_URL}"
echo "[start]   app url          ${APP_URL}"
echo "[start]   widget bundle    ${WIDGET_BUNDLE}"
echo "[start] ============================================================"

if [ ! -f "${WIDGET_BUNDLE}" ]; then
  echo "[start] PERINGATAN: ${WIDGET_BUNDLE} tidak ada -> /embed/widget.js akan 404."
fi

# --- backend ------------------------------------------------------------------
uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT}" &
API_PID=$!

# --- dashboard ----------------------------------------------------------------
cd /srv/web
../node_modules/.bin/next start -H 0.0.0.0 -p "${PORT}" &
WEB_PID=$!
cd /srv

# Tunggu API siap supaya request pertama user (mis. login) tidak kena 502.
i=0
while [ "$i" -lt 60 ]; do
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    echo "[start] FATAL: proses API mati saat startup (lihat log di atas)."
    kill "${WEB_PID}" 2>/dev/null || true
    exit 1
  fi
  if curl -fsS -m 3 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
    echo "[start] API siap setelah ${i}s."
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$i" -ge 60 ]; then
  echo "[start] PERINGATAN: API belum menjawab /healthz setelah 60s — tetap melanjutkan."
fi

# --- supervisi: bila salah satu mati, matikan yang lain agar container restart -
shutdown() {
  echo "[start] shutdown..."
  trap - TERM INT
  kill "${API_PID}" "${WEB_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

while :; do
  if ! kill -0 "${API_PID}" 2>/dev/null; then
    echo "[start] FATAL: API mati tak terduga -> menghentikan container."
    kill "${WEB_PID}" 2>/dev/null || true
    exit 1
  fi
  if ! kill -0 "${WEB_PID}" 2>/dev/null; then
    echo "[start] FATAL: dashboard mati tak terduga -> menghentikan container."
    kill "${API_PID}" 2>/dev/null || true
    exit 1
  fi
  sleep 5
done
