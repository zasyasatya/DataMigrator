# Backend (FastAPI)

`apps/api`: FastAPI 0.141 + SQLAlchemy 2 async + Pydantic v2 + pydantic-settings.

```
apps/api/
├─ app/
│  ├─ main.py            # lifespan (init_db + seed), CORS, include router, /healthz
│  ├─ models.py          # Workspace/User/ApiKey/Agent/Knowledge*/Conversation/Message/Feedback
│  ├─ schemas.py         # validasi I/O Pydantic
│  ├─ seed.py            # bootstrap idempoten (lihat bawah)
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

## Pengujian

```bash
python run.py test          # pytest backend (15 test)
python run.py test --full   # + typecheck web & widget
```

`tests/conftest.py` memakai **DB sqlite sementara per-run** (`SEED_DEMO=0`) +
`httpx.ASGITransport`, jadi test tidak mengotori DB dev. 15 test mencakup:
health, login sukses/gagal, guard auth, CRUD+publish agent, guard simulate,
retrieval+SSE, rules, widget e2e, origin allowlist, analytics overview,
manajemen keys, serve embed, settings LLM (save/mask/test), channel dry-run +
webhook Meta, analitik per-agent.
