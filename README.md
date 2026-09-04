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
│   ├─ /demo           situs pelanggan palsu utk uji popup widget       │
│   ├─ /landing        LANDING PAGE contoh + chatbot terintegrasi (SSR) │
│   ├─ /healthz        diagnostik: web ok? proxy ke API ok?             │
│   └─ proxy RUNTIME   /api/v1/*, /w/*, /embed/* → API_INTERNAL_URL     │
│        │             (route handler, dibaca tiap request)             │
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

> **Proxy-nya dibaca saat runtime, bukan saat build.** Dulu proxy memakai `rewrites()` di
> `next.config.ts`, yang Next.js bekukan ke `.next/routes-manifest.json` ketika `next build`.
> Akibatnya `API_INTERNAL_URL` di container **diabaikan** dan request selalu menuju
> `http://localhost:8000` — di compose (container terpisah) tidak ada apa-apa di sana, dan di
> all-in-one `localhost` bisa resolve ke IPv6 `::1` sementara uvicorn hanya listen IPv4.
> Gejalanya persis: *deploy sukses, halaman login terbuka, tetapi tidak bisa login*.
> Sekarang proxy dijalankan route handler (`apps/web/app/{api/v1,w,embed}/[...path]/route.ts`
> → `lib/proxy.ts`) yang membaca env **setiap request**, menormalkan `localhost`→`127.0.0.1`,
> meneruskan `Set-Cookie`/`x-forwarded-proto`, dan me-*stream* SSE tanpa buffering.

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

### Landing page siap pakai (contoh nyata)

Rute **`/landing?key=pk_…`** adalah landing page lengkap (hero, produk, keunggulan,
testimoni, FAQ, CTA, footer) dengan chatbot sudah terpasang — dipakai untuk membuktikan
alur *train → embed → chat* benar-benar jalan di situs sungguhan:

```
https://domain-anda/landing?key=pk_XXXXXXXX
```

Isi halamannya di-render sebagai **server component** (HTML lengkap → SEO & first paint cepat);
hanya `components/landing/ChatbotEmbed.tsx` yang client-side, dan itu pun cuma menyuntikkan satu
tag `<script>`. Tombol-tombol "Tanya" memakai `window.SapaAsk(text)` → membuka chat dan langsung
mengirim pertanyaan, sedangkan FAQ memakai `<details>` bawaan HTML sehingga tetap berfungsi tanpa JS.

| Berkas | Untuk apa |
|---|---|
| `apps/web/app/landing/page.tsx` | landing page di dalam app (Next.js, SSR) |
| `apps/web/components/landing/ChatbotEmbed.tsx` | pemasang widget + bridge `window.SapaAsk` |
| `examples/landing/index.html` | **satu file HTML mandiri** untuk situs eksternal (tanpa build): buka dengan `?key=pk_…`, atau ganti `PK_ANDA` |
| `examples/standalone.html` | halaman uji minimal |
| rute `/demo` di dashboard | toko contoh + panel kontrol widget |

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
| `ADMIN_EMAIL/PASSWORD` | admin@sapa.ai/admin123 | bootstrap login (dijamin ada tiap boot) |
| `RESET_ADMIN_PASSWORD` | `0` | `1` = paksa password admin disamakan dengan `ADMIN_PASSWORD` sekali jalan |
| `API_INTERNAL_URL` | `http://127.0.0.1:8000` | tujuan proxy dashboard (dibaca **runtime**); compose: `http://api:8000` |
| `OPENAI_API_KEY` | kosong | isi untuk mengaktifkan LLM asli |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | api.openai.com / gpt-4o-mini | provider OpenAI-compatible |
| `APP_URL` | http://localhost:3000 | URL publik (snippet embed + cookie Secure) |
| `SEED_DEMO` | 1 (dev) | contoh percakapan untuk dashboard |
| `WIDGET_BUNDLE` | packages/widget/dist/widget.js | path bundle (dipakai Docker) |
| `LOG_LEVEL` | INFO | level log; baris `[bootstrap]` menjelaskan status admin saat boot |

## Pengujian

```bash
make test        # pytest backend (27 test: auth, CRUD, retrieval+SSE, rules,
                 # widget e2e, origin allowlist, analytics, keys, embed,
                 # settings LLM, channel dry-run + webhook Meta,
                 # + regresi produksi: cookie Secure di balik proxy, token tanpa
                 #   padding, auth cookie-only, ensure_admin & RESET_ADMIN_PASSWORD)
make typecheck   # tsc web + widget
npm run build:web  # build production Next.js
npm run verify   # smoke test E2E terhadap URL yang sudah hidup
                 # BASE=https://domain-anda npm run verify
```

Status di sandbox: ✅ 27/27 pytest lulus · ✅ typecheck web & widget · ✅ `next build` sukses ·
✅ E2E via proxy runtime (login → cookie Secure → agents → widget bundle → config → chat SSE ×4 →
history → feedback → muncul di dashboard → auth cookie-only) · ✅ landing page `/landing` SSR penuh.

## Struktur repo

```
apps/api      FastAPI: models, schemas, routers, services (retrieval/llm/chat/analytics), seed, tests
apps/web      Next.js dashboard (design system mock) + proxy runtime (lib/proxy.ts) + /landing
packages/widget  widget popup embeddable (TS → IIFE, Shadow DOM)
examples/     standalone.html, landing/index.html (landing page mandiri 1 file)
scripts/      verify-deploy.mjs (smoke test E2E untuk deployment)
docs/         architecture, ai-engine, backend, frontend, deployment
Dockerfile (+ docker/start.sh)  image all-in-one Coolify-ready (port 3000)
docker-compose.yml (magic env), run.py (one-command runner), Makefile, .env.example
```
