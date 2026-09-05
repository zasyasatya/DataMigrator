# Backend (FastAPI)

`apps/api`: FastAPI 0.141 + SQLAlchemy 2 async + Pydantic v2 + pydantic-settings.

```
apps/api/
├─ app/
│  ├─ main.py            # lifespan (init_db + seed + ensure_admin), CORS, router, /healthz
│  ├─ models.py          # Workspace/User/ApiKey/Agent/Knowledge*/Conversation/Message/Feedback
│  ├─ schemas.py         # validasi I/O Pydantic
│  ├─ seed.py            # bootstrap idempoten: seed() + ensure_admin() (lihat bawah)
│  ├─ core/              # config (env), db (engine+sesi), deps (auth/origin),
│  │                     # ids (new_id/pk/sk), security (HMAC+hash), migrate
│  ├─ services/          # chat (orkestrasi+SSE), retrieval (BM25),
│  │                     # knowledge (chunk+index), analytics, text,
│  │                     # llm/{offline,openai_compat}
│  └─ api/routers/       # endpoint (tabel bawah)
└─ tests/                # conftest (DB sqlite tmp) + test_platform.py (15 test)
```

## Router & endpoint

| Prefix | Router | Fungsi |
|---|---|---|
| `/api/v1/auth` | `auth.py` | login, me, (logout/cookie) |
| `/api/v1/agents` | `agents.py` | CRUD agent, publish, rotate key |
| `/api/v1/agents/{id}/knowledge` | `knowledge.py` | CRUD dokumen + chunk + reindex |
| `/api/v1/agents/{id}/simulate` | `simulate.py` | SSE streaming simulator (auth) |
| `/api/v1/keys` | `keys.py` | kelola public/secret keys |
| `/api/v1/settings` | `settings.py` | provider LLM per-workspace + tes koneksi |
| `/api/v1/channels/...` | `channels.py` | webhook WhatsApp/Instagram + dry-run |
| `/api/v1/analytics/...` | `analytics.py` | analitik per-agent (14 hari, channel, jam, sources, CSAT, latency) |
| `/api/v1` | `conversations.py` | riwayat percakapan dashboard |
| `/w/{pk}/...` | `widget.py` | config/session/chat(SSE)/history/feedback publik |
| `/embed/widget.js` | `embed.py` | serve bundle widget + halaman snippet integrasi |

Docs interaktif otomatis: **`/docs`** (Swagger) saat API jalan.

## Konfigurasi (env → `app/core/config.py`)

| Var | Default | Fungsi |
|---|---|---|
| `DATABASE_URL` | sqlite lokal `apps/api/data/sapa.db` | ganti `postgresql+asyncpg://user:pass@host:5432/db` untuk Postgres |
| `SECRET_KEY` | dev | tanda tangan token sesi — **wajib ganti di produksi** |
| `ADMIN_EMAIL/PASSWORD/NAME`, `WORKSPACE_NAME` | admin@sapa.ai/admin123/... | bootstrap login & workspace |
| `RESET_ADMIN_PASSWORD` | `0` | `1` = sekali jalan, samakan password admin dengan `ADMIN_PASSWORD` |
| `API_INTERNAL_URL` | `http://127.0.0.1:8000` | tujuan proxy dashboard (dibaca runtime oleh Next) |
| `LOG_LEVEL` | `INFO` | baris `[bootstrap]`/`[start]` menjelaskan status admin & proxy saat boot |
| `OPENAI_API_KEY` (+`_BASE_URL`, `_MODEL`) | kosong / api.openai.com / gpt-4o-mini | provider LLM (bisa Groq/OpenRouter/Ollama) |
| `APP_URL` | http://localhost:3000 | URL dashboard (link snippet embed) |
| `CORS_ORIGINS` | `["*"]` | lihat catatan keamanan di architecture.md |
| `SEED_DEMO` | 1 (dev) | isi contoh percakapan agar dashboard tidak kosong |
| `WIDGET_BUNDLE` | `packages/widget/dist/widget.js` | path bundle (`/srv/widget.js` di Docker) |

## Database, migrasi, seed

- `init_db()` membuat tabel (`Base.metadata.create_all`) + `ensure_columns()`
  (tambah kolom baru tanpa hapus DB — migrasi ringan).
- SQLite default **zero-config** (direktori dibuat otomatis); produksi → Postgres.
- `seed.py` **idempoten**: workspace *Acme Store*, admin, agent *Sara* + 4 dokumen
  knowledge + key widget. Aman dijalankan ulang (cek eksistensi dulu).
- `seed()` hanya mengisi DB yang **benar-benar kosong**. Karena itu ada
  `ensure_admin()` yang jalan **setiap boot** (dipanggil `main.py` sesudah `seed`):
  menjamin workspace ada, membuat ulang admin bila hilang, memperbaiki
  `workspace_id` yang dangling, dan — hanya bila `RESET_ADMIN_PASSWORD=1` —
  menyamakan password admin dengan `ADMIN_PASSWORD`.
  Tanpa ini, DB produksi yang volume-nya sudah terisi membuat `ADMIN_*` tidak
  pernah berpengaruh lagi: gejala klasiknya *"deploy sukses tapi tidak bisa login"*.
  Setiap aksinya dicatat sebagai baris `[bootstrap]` di log container.

### Sesi & cookie (di balik reverse proxy)

- Token = base64url(payload) + HMAC-SHA256(`SECRET_KEY`), **tanpa padding `=`**.
  Padding memaksa Starlette meng-quote nilai `Set-Cookie` (`sapa_session="…"`),
  dan sebagian klien mengirim ulang quote-nya apa adanya sehingga token gagal
  diverifikasi. `decode_session_token()` tetap menerima token lama berpadding
  maupun nilai yang tiba ter-quote.
- Cookie dipasang `HttpOnly`, `SameSite=lax`, `Path=/`, dan **`Secure` hanya bila
  request asli HTTPS**. Cloudflare/Coolify Traefik men-terminate TLS, jadi skema
  yang terlihat uvicorn adalah `http`; sinyal yang benar adalah
  `x-forwarded-proto` (ditambahkan proxy Next.js) — lihat
  `core/security.py::is_secure_request`.
- Dua jalur auth diterima `deps.py::get_current_user`: header
  `Authorization: Bearer` (dipakai dashboard) **atau** cookie sesi; nama cookie
  diambil dari `settings.session_cookie`, bukan hardcode.
- `SECRET_KEY` boleh diganti tanpa mengunci semua user: salt password disimpan di
  dalam hash, jadi `verify_password()` tidak bergantung pada `SECRET_KEY` saat ini.
  Yang terpengaruh hanya token sesi lama (perlu login ulang).

## Pengujian

```bash
python run.py test          # pytest backend (27 test)
python run.py test --full   # + typecheck web & widget
npm run verify              # smoke test E2E ke URL hidup (BASE=https://domain npm run verify)
```

`tests/conftest.py` memakai **DB sqlite sementara per-run** (`SEED_DEMO=0`) +
`httpx.ASGITransport`, jadi test tidak mengotori DB dev. 15 test mencakup:
health, login sukses/gagal, guard auth, CRUD+publish agent, guard simulate,
retrieval+SSE, rules, widget e2e, origin allowlist, analytics overview,
manajemen keys, serve embed, settings LLM (save/mask/test), channel dry-run +
webhook Meta, analitik per-agent.

`tests/test_production_auth.py` (+12 test) mengunci regresi produksi:
cookie `Secure` hanya di HTTPS & parsing `x-forwarded-proto` multi-hop, token
tanpa padding + toleransi token lama/ter-quote + tolak signature palsu, auth
cookie-only seperti browser, `logout` menghapus cookie dengan atribut yang sama,
`ensure_admin` idempoten / membuat ulang admin yang hilang / menghormati
`RESET_ADMIN_PASSWORD`, hash password tetap terverifikasi saat `SECRET_KEY`
berganti, dan helper flag env yang case-insensitive.
