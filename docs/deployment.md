# Deployment

Tiga cara jalan, pilih satu:

| Cara | Perintah | Kapan |
|---|---|---|
| Runner lokal | `python run.py` | dev / demo tercepat (api:8000 + web:3000) |
| Compose | `python run.py docker` / `docker compose up --build` | VPS tanpa Coolify |
| **Coolify** | deploy repo sebagai **Dockerfile**, port **3000** | produksi termudah ✅ |

## Coolify (produksi, disarankan)

Image all-in-one (`./Dockerfile`): build widget + Next.js, lalu satu container
menjalankan FastAPI (internal :8000) + dashboard (port utama `$PORT`/3000).
Next me-proxy `/api/v1|/w|/embed` ke backend se-host → tanpa config CORS.

1. Coolify → New Resource → **Dockerfile** → pilih repo/branch ini.
2. Build Pack: Dockerfile · Exposed Port: **3000** · Healthcheck Path: abaikan
   (sudah ada `HEALTHCHECK` ke `/healthz` internal di Dockerfile).
3. Environment (wajib & disarankan):

| Var | Wajib | Contoh |
|---|---|---|
| `SECRET_KEY` | ✅ | `openssl rand -hex 32` |
| `DATABASE_URL` | – | default sqlite `/data/sapa.db`; Postgres: `postgresql+asyncpg://sapa:pw@host:5432/sapa` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | ganti password default |
| `OPENAI_API_KEY` (+`_BASE_URL`, `_MODEL`) | – | kosongkan = engine offline; isi untuk LLM asli (Groq/OpenRouter/Ollama bisa) |
| `APP_URL` | – | `https://domain-anda` (untuk snippet embed) |
| `SEED_DEMO` | – | default `0` di image; `1` bila ingin contoh data |
| `PORT` / `API_PORT` | – | default `3000`/`8000` |

4. Persistent Storage: mount volume ke **`/data`** (agar sqlite tidak hilang
   tiap redeploy). Bila pakai Postgres eksternal, volume tidak wajib.
5. Deploy. Cek: `https://domain/docs` (Swagger, via proxy? langsung `/api/v1/...`),
   `https://domain/embed/widget.js` (bundle widget), login dashboard.

## Compose lokal / VPS

```bash
npm run build:widget      # prasyarat 1x (bundle untuk backend)
docker compose up --build # api:8000 + web:3000
```

Semua env punya default ("magic env", lihat header `docker-compose.yml`);
override via `.env`/`shell`. Healthcheck API + `depends_on: healthy` membuat web
menunggu API siap. Profil Postgres opsional tersedia (komentar `db` + `--profile pg`).

## Database produksi

- **SQLite** (`sqlite+aiosqlite:////data/sapa.db`): cukup untuk mulai; backup =
  salin file `/data/sapa.db` dari volume.
- **Postgres**: buat DB (Coolify managed / Supabase / Neon), isi `DATABASE_URL`
  format `postgresql+asyncpg://...`. Tabel dibuat otomatis saat boot (`init_db`).

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `/embed/widget.js` 404 "belum di-build" | lokal/compose: `npm run build:widget` dulu (image Coolify sudah include) |
| Dashboard 500 di `/api/...` | `API_INTERNAL_URL` salah — compose: `http://api:8000`; all-in-one: `http://127.0.0.1:8000` |
| Login default gagal di prod | `ADMIN_*` hanya bootstrap DB kosong — reset volume/DB bila user sudah ada, atau login lalu ganti |
| Widget 403 origin | tambah origin situs ke *allowed origins* agent (tab Integrasi) |
| Dashboard kosong | `SEED_DEMO=1` (dev) atau buat agent + knowledge via builder |
| Port bentrok lokal | `python run.py --web-port 3100 --api-port 8100` |
| Diagnose cepat | `python run.py check` (versi, env, port, widget) |
