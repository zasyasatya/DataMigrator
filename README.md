# Sapa AI — Platform AI Agent Chatbot untuk Customer Service

Platform *no-code* untuk membuat, **training**, dan **embed** AI agent chatbot layanan pelanggan:
atur instruksi/persona, knowledge base, rules & guardrails, tampilan widget — lalu uji langsung di
**simulator sebelah kanan**, dan pasang ke website pelanggan sebagai **popup chat** dengan **satu baris script**.

Terinspirasi alur kerja Cekat AI & Halo AI: *train → simulate → deploy ke channel pelanggan*.

---

## Arsitektur

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
│        │  rewrites same-origin: /api/v1/*, /w/*, /embed/*             │
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

**Kenapa integrasinya *flawless*:** dashboard Next.js me-*proxy* `/api/v1/*`, `/w/*`, dan
`/embed/widget.js` ke FastAPI (same-origin). Widget membaca origin dari `src` script-nya sendiri,
sehingga di situs pelanggan pun semua request pergi ke satu host yang sama → **tanpa konfigurasi
CORS, cookie, atau CORS-preflight tambahan**. Origin tetap bisa dibatasi per-agent lewat
*allowed origins* (dienforce server-side).

## Quickstart (sandbox / lokal)

```bash
# 1) deps
make install            # venv python + npm workspaces
#    atau manual:
#    cd apps/api && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
#    npm install

# 2) build widget popup (1 file JS)
npm run build:widget

# 3) jalankan backend (http://localhost:8000, docs di /docs)
make dev-api            # uvicorn --reload

# 4) jalankan dashboard (http://localhost:3000)
make dev-web
```

Login default: **admin@sapa.ai / admin123** (ubah lewat `ADMIN_PASSWORD`).
Seed otomatis membuat workspace *Acme Store*, agent *Sara* + 4 dokumen knowledge + key widget.

### Produksi cepat

```bash
docker compose up --build     # api:8000 + web:3000 (proxy otomatis)
```

**Deploy ke Coolify** (disarankan untuk produksi): deploy repo ini sebagai
*Dockerfile* (image all-in-one: API + dashboard satu container), expose port
**3000**, isi `SECRET_KEY`, mount volume ke `/data`. Detail + tabel env +
troubleshooting: [`docs/deployment.md`](docs/deployment.md).

## Integrasi ke website pelanggan (cara termudah)

Tempel **satu baris** sebelum `</body>` (key dari Builder → tab **Integrasi**):

```html
<script src="https://domain-anda/embed/widget.js" data-sapa-key="pk_..." defer></script>
```

Opsi lain yang didukung:

| Cara | Contoh |
|---|---|
| Atribut `data-sapa-key` | seperti di atas (disarankan) |
| Query param | `<script src=".../embed/widget.js?k=pk_...">` |
| React/Next.js | komponen `useEffect` inject script (snippet tersedia di tab Integrasi) |
| Server-to-server SSE | `POST /w/{pk}/chat` → stream `event: meta/delta/done` |
| CMS (WordPress/Shopify/Wix) | tempel snippet di bagian footer/custom-html |

API widget JS untuk situs Anda: `window.SapaChat.open() / .close() / .send(text) / .identify(name, email) / .on('message', cb)`.

Lihat `examples/standalone.html` untuk halaman uji tanpa framework, dan rute `/demo` di dashboard
untuk toko contoh yang memuat widget sungguhan.

## Provider LLM (OpenAI)

Isi dari dashboard **Settings → Provider LLM** (tersimpan per-workspace, override env):
API key, base URL (OpenAI/Groq/OpenRouter/Ollama/vLLM), dan model default — lengkap dengan tombol
**Tes koneksi** yang melakukan panggilan nyata dan melaporkan latency. Agent dengan `engine: auto`
otomatis memakai provider ini bila key tersedia; bila tidak, engine offline yang menjawab.

## Channel WhatsApp & Instagram

- Daftarkan callback URL `https://domain/api/v1/channels/webhook/whatsapp` (atau `.../instagram`)
  di Meta App; verify token diambil dari tab **Channels** pada builder.
- Pesan masuk → engine yang sama (rules → retrieval → LLM) → balasan dikirim via Graph API
  (`{phone_number_id}/messages` / `me/messages`) bila access token diisi.
- **Mode dry-run**: tanpa token, balasan tetap diproses & dikembalikan di response webhook —
  alur bisa diuji penuh, plus tombol *Simulasikan WhatsApp/Instagram* di dashboard.

## Analitik mendalam per agent

Tab **Analitik** di builder + `GET /api/v1/analytics/agents/{id}`:
percakapan 14 hari, distribusi channel (widget/simulator/whatsapp/instagram), histogram jam sibuk,
top knowledge sources yang dikutip, split engine, CSAT & resolusi, rata-rata latency.

## Cara kerja engine AI

1. **Rules (jika→maka)** — dicek pertama; cocok untuk promo, jam operasional, dsb.
2. **Retrieval** — knowledge base di-chunk (~700 karakter) dan di-index **BM25**; chunk terkait
   disuntikkan ke prompt + ditampilkan sebagai *sources* di simulator & widget.
3. **LLM** — `engine: auto` memakai provider **OpenAI-compatible** bila `OPENAI_API_KEY` terisi
   (bisa diarahkan ke Groq/OpenRouter/Ollama/vLLM lewat `OPENAI_BASE_URL`); bila tidak, engine
   **offline** (extractive + penyesuaian tone) menjawab sehingga platform tetap berfungsi & teruji
   tanpa API key. Bila provider error saat runtime, otomatis fallback ke offline (`event: engine_fallback`).
4. **Guardrails & tone** — digabung ke system prompt; tone memengaruhi pembuka/penutup jawaban.

## Design system

Mengikuti mock referensi: kanvas lavender *aurora* + panel kaca (glassmorphism), aksen violet
`#7C5CF6`, kartu putih radius 20px, hero banner *dark-violet* dengan orb bercahaya + waveform live,
kartu KPI ber-progress-bar, feed aktivitas ber-icon-tile, dan panel kanan bergaya jadwal.
Widget popup memakai bahasa visual yang sama (header gradasi violet, bubble membulat, launcher gelap).
Seluruh dashboard **mobile-responsive**: sidebar menjadi drawer + topbar, simulator menjadi overlay
fullscreen di layar kecil, dan widget popup otomatis fullscreen di perangkat mobile.

## Environment variables

Lihat `.env.example`. Inti:

| Var | Default | Fungsi |
|---|---|---|
| `DATABASE_URL` | sqlite lokal | ganti `postgresql+asyncpg://...` untuk Postgres |
| `SECRET_KEY` | dev | tanda tangan token sesi |
| `ADMIN_EMAIL/PASSWORD` | admin@sapa.ai/admin123 | bootstrap login |
| `OPENAI_API_KEY` | kosong | isi untuk mengaktifkan LLM asli |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | api.openai.com / gpt-4o-mini | provider OpenAI-compatible |
| `APP_URL` | http://localhost:3000 | URL dashboard |
| `SEED_DEMO` | 1 (dev) | contoh percakapan untuk dashboard |
| `WIDGET_BUNDLE` | packages/widget/dist/widget.js | path bundle (dipakai Docker) |

## Pengujian

```bash
make test        # pytest backend (15 test: auth, CRUD, retrieval+SSE, rules,
                 # widget e2e, origin allowlist, analytics, keys, embed,
                 # settings LLM, channel dry-run + webhook Meta)
make typecheck   # tsc web + widget
npm run build:web  # build production Next.js
```

Status di sandbox: ✅ 15/15 pytest lulus · ✅ typecheck web & widget · ✅ `next build` sukses ·
✅ E2E via proxy (login → simulate SSE → widget SSE → feedback → history).

## Struktur repo

```
apps/api      FastAPI: models, schemas, routers, services (retrieval/llm/chat/analytics), seed, tests
apps/web      Next.js dashboard (design system mock)
packages/widget  widget popup embeddable (TS → IIFE, Shadow DOM)
examples/     standalone.html
docs/         architecture, ai-engine, backend, frontend, deployment
Dockerfile (+ docker/start.sh)  image all-in-one Coolify-ready (port 3000)
docker-compose.yml (magic env), run.py (one-command runner), Makefile, .env.example
```
