# Arsitektur

Monorepo tiga paket: dashboard Next.js, backend FastAPI, widget vanilla-TS.

```
┌─────────────────────────── repo (monorepo) ───────────────────────────┐
│                                                                       │
│  apps/web            Next.js 16 (App Router, Tailwind v4, React 19)   │
│   ├─ /login          autentikasi workspace                            │
│   ├─ /               dashboard (hero live, KPI, activity, percakapan) │
│   ├─ /agents         daftar agent                                     │
│   ├─ /agents/[id]    BUILDER: tab instruksi/knowledge/perilaku/       │
│   │                  tampilan/integrasi/percakapan  +  SIMULATOR kanan│
│   ├─ /settings       API keys, integrasi, & provider LLM (OpenAI)     │
│   └─ /demo           situs pelanggan palsu utk uji popup widget       │
│        │  proxy same-origin (runtime): /api/v1/*, /w/*, /embed/*      │
│        ▼                                                              │
│  apps/api            FastAPI 0.141 + SQLAlchemy 2 async               │
│   ├─ /api/v1/auth    login JWT-ish (HMAC) + cookie                    │
│   ├─ /api/v1/agents  CRUD, publish, rotate key                        │
│   ├─ /api/v1/agents/{id}/knowledge   chunking + index BM25            │
│   ├─ /api/v1/agents/{id}/simulate    SSE streaming (dashboard)        │
│   ├─ /api/v1/settings/llm            provider OpenAI: simpan & test   │
│   ├─ /api/v1/channels/webhook/{whatsapp|instagram}  webhook Meta      │
│   ├─ /api/v1/analytics/agents/{id}   analitik mendalam per agent      │
│   ├─ /w/{pk}/config|session|chat|history   API publik widget (SSE)    │
│   ├─ /embed/widget.js   bundle popup chat (1 file, shadow DOM)        │
│   └─ engine: rules → retrieval(BM25) → OpenAI-compatible / offline    │
│                                                                       │
│  packages/widget     vanilla TS → IIFE 18KB, Shadow DOM, SSE stream   │
└───────────────────────────────────────────────────────────────────────┘
```

## Kenapa integrasi *flawless*

Dashboard Next.js me-*proxy* `/api/v1/*`, `/w/*`, dan `/embed/widget.js` ke
FastAPI (**same-origin**, lihat `apps/web/next.config.ts`). Widget membaca origin
dari `src` script-nya sendiri, sehingga di situs pelanggan pun semua request pergi
ke satu host yang sama → **tanpa konfigurasi CORS, cookie, atau preflight tambahan**.
Origin tetap bisa dibatasi per-agent lewat *allowed origins* (dienforce server-side
di `app/core/deps.py::check_origin` — origin tak dikenal ditolak 403).

## Alur request

1. **Dashboard → backend.** Browser memanggil `/api/v1/...` (same-origin) dengan
   header `Authorization: Bearer <token>`; route handler Next (`app/api/v1/[...path]`
   + `lib/proxy.ts`) meneruskannya ke `API_INTERNAL_URL` per request — bukan
   `rewrites()` yang dipanggang saat build, supaya env container benar-benar dipakai.
   Backend tak terjangkau → 502 + detail, bukan 500 kosong.
   Token 401 → frontend menghapus token & redirect ke `/login` (`apps/web/lib/api.ts`).
2. **Widget publik → backend.** `GET /w/{pk}/config` → `POST /w/{pk}/session` →
   `POST /w/{pk}/chat` (SSE: `meta/delta/done`) → `GET /w/{pk}/history`.
   Auth memakai **public key** (`pk_...`, boleh terekspos di browser), bukan token user.
3. **Simulator dashboard → backend.** `POST /api/v1/agents/{id}/simulate` (SSE,
   butuh Bearer token) — engine yang sama persis dengan widget.
4. **Channel Meta → backend.** `GET` verify + `POST` pesan di
   `/api/v1/channels/webhook/{whatsapp|instagram}` → engine yang sama → balasan via
   Graph API bila access token diisi, atau **dry-run** (balasan di response) bila tidak.

## Model data (inti)

`Workspace 1—* User | Agent | ApiKey` · `Agent 1—* KnowledgeDocument 1—* KnowledgeChunk` ·
`Agent 1—* Conversation 1—* Message` · `Message 1—* Feedback`.

- **Agent** menyimpan seluruh "training": `instructions`, `tone`, `rules`
  (`[{trigger, response}]`), `guardrails`, `engine` (`auto|openai|offline`), `model`,
  `temperature`, `retrieval_top_k`, `greeting`, `fallback_message`, tampilan widget
  (`theme`, `starter_prompts`), dan `allowed_origins`.
- **ApiKey** dua jenis: `public` (disimpan jelas, `pk_...` untuk browser) dan
  `secret` (disimpan sebagai hash SHA-256, prefix `sk_...` untuk server-to-server).

## Auth & keamanan

- Login workspace (`ADMIN_EMAIL/PASSWORD` bootstrap) → token HMAC
  (`app/core/security.py`) + cookie sesi. Semua endpoint `/api/v1/*` di-scope ke
  workspace user.
- Kunci widget bisa di-*rotate* dan asal request dibatasi per-agent.
- CORS backend sengaja permisif (`["*"]` default) karena endpoint admin butuh Bearer
  token dan endpoint widget punya allowlist sendiri — lihat komentar di `app/main.py`.
