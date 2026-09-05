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
2. Build Pack: **Dockerfile** (⚠️ *bukan* Docker Compose — lihat catatan di bawah) ·
   Exposed Port: **3000** · Healthcheck Path: `/healthz` (opsional, image sudah
   punya `HEALTHCHECK` sendiri).
3. Environment (wajib & disarankan):

| Var | Wajib | Contoh |
|---|---|---|
| `SECRET_KEY` | ✅ | `openssl rand -hex 32` |
| `DATABASE_URL` | – | default sqlite `/data/sapa.db`; Postgres: `postgresql+asyncpg://sapa:pw@host:5432/sapa` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | – | ganti password default |
| `RESET_ADMIN_PASSWORD` | – | `1` sekali untuk memaksa password admin = `ADMIN_PASSWORD` (bila lupa), lalu `0` lagi |
| `OPENAI_API_KEY` (+`_BASE_URL`, `_MODEL`) | – | kosongkan = engine offline; isi untuk LLM asli (Groq/OpenRouter/Ollama bisa) |
| `APP_URL` | ✅ disarankan | `https://sapa.zasya.id` (dipakai snippet embed & cookie Secure) |
| `SEED_DEMO` | – | default `0` di image; `1` bila ingin contoh data |
| `PORT` / `API_PORT` | – | default `3000`/`8000`; Coolify meng-inject `PORT` sendiri |
| `API_INTERNAL_URL` | – | default `http://127.0.0.1:8000` (all-in-one). **Jangan** pakai `localhost` |

4. Persistent Storage: mount volume ke **`/data`** (agar sqlite tidak hilang
   tiap redeploy). Bila pakai Postgres eksternal, volume tidak wajib.
5. Deploy, lalu **verifikasi**:

```bash
BASE=https://sapa.zasya.id npm run verify
# atau manual:
curl -s https://sapa.zasya.id/healthz          # {"status":"ok","api":{"ok":true,...}}
curl -sI https://sapa.zasya.id/embed/widget.js # 200, content-type javascript
```

6. Cek di browser: `/login` → `/` (dashboard) → `/agents` → Builder → tab
   Integrasi → salin key → buka **`/landing?key=pk_…`** untuk melihat chatbot
   hidup di sebuah landing page.

> **Catatan build pack.** Repo ini punya `docker-compose.yml` di root. Coolify
> bisa saja menawarkan *Docker Compose* sebagai build pack. Keduanya didukung,
> tetapi untuk Coolify pilih **Dockerfile** (all-in-one) — lebih sederhana dan
> hanya butuh satu port. Bila tetap memakai compose, service `web` sudah benar
> karena proxy membaca `API_INTERNAL_URL=http://api:8000` saat runtime.

## Verifikasi cepat setelah deploy

`npm run verify` (script `scripts/verify-deploy.mjs`) menjalankan alur nyata
persis seperti browser + widget:

1. `POST /api/v1/auth/login` → cek 200, cookie sesi, flag `Secure`
2. `GET /api/v1/agents` → ambil agent & `public_key` widget
3. `GET /embed/widget.js` → bundle ter-serve
4. `GET /w/{pk}/config` → widget bisa mount
5. `POST /w/{pk}/chat` ×4 → **SSE streaming** + jawaban dari knowledge/rules
6. `GET /w/{pk}/history`, `POST /api/v1/conversations/{id}/feedback`
7. `GET /api/v1/agents/{id}/conversations` → percakapan muncul di dashboard
8. `GET /api/v1/auth/me` lewat **cookie saja** (tanpa Bearer)

Interpretasi bila gagal:

| Output | Artinya |
|---|---|
| `502 {"detail":"Backend API tidak dapat dihubungi", ...}` | proxy tidak mencapai uvicorn → cek `API_INTERNAL_URL` / proses API mati |
| `401 {"detail":"Email atau password salah"}` | backend hidup, kredensialnya yang tidak cocok → lihat bagian *Login gagal* |
| `404` pada `/api/v1/*` | dashboard tidak mem-proxy (build lama / route handler hilang) |
| `503` pada `/healthz` | sama seperti 502, tapi terdeteksi lebih dini |

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
| **Login gagal padahal deploy sukses** | Buka `https://domain/healthz`. `api.ok:false` → masalah proxy (bukan kredensial). `api.ok:true` tapi tetap 401 → lihat baris *Login 401* di bawah |
| **Login 401 "Email atau password salah"** | admin bootstrap dijamin ada setiap boot; bila password tak diketahui set `RESET_ADMIN_PASSWORD=1` + `ADMIN_PASSWORD=baru`, redeploy, lalu matikan lagi flag-nya. Cek juga log container: baris `[bootstrap]` menjelaskan apa yang terjadi |
| `/api/v1/*` balas 502 `ECONNREFUSED` | `API_INTERNAL_URL` menunjuk host yang salah, atau memakai `localhost` yang resolve ke IPv6 `::1` padahal uvicorn listen IPv4 → pakai `http://127.0.0.1:8000` (all-in-one) / `http://api:8000` (compose) |
| `API_INTERNAL_URL` seperti diabaikan | pastikan image dibangun dari commit yang sudah memakai route handler proxy; build lama masih memakai `rewrites()` yang dibekukan saat build sehingga env runtime tidak berlaku |
| Sesi hilang setelah refresh di HTTPS | cookie harus `Secure` di balik TLS — sudah otomatis via `x-forwarded-proto`; pastikan reverse proxy meneruskan header itu |
| `/embed/widget.js` 404 "belum di-build" | lokal/compose: `npm run build:widget` dulu (image Coolify sudah include) |
| Widget tidak muncul di landing page | `/landing?key=pk_…` butuh public key; ambil di Builder → tab Integrasi. Lihat juga *allowed origins* |
| Widget 403 origin | tambah origin situs ke *allowed origins* agent (tab Integrasi) |
| Dashboard kosong | `SEED_DEMO=1` (dev) atau buat agent + knowledge via builder |
| Container restart berulang | `start.sh` sengaja mematikan container bila salah satu proses (API/web) mati, agar Coolify me-restart. Baca log untuk pesan `[start] FATAL` |
| Port bentrok lokal | `python run.py --web-port 3100 --api-port 8100` |
| Diagnose cepat | `python run.py check` (versi, env, port, widget) lalu `npm run verify` |
