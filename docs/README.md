# Dokumentasi Sapa AI

Platform *no-code* AI agent chatbot untuk customer service:
atur instruksi/persona, knowledge base, rules & guardrails, tampilan widget —
uji di **simulator**, lalu embed ke website pelanggan dengan **satu baris script**.

| Dokumen | Isi |
|---|---|
| [architecture.md](architecture.md) | Diagram monorepo, alur request (dashboard / widget / channel), **proxy runtime vs build-time**, model data, auth & kunci API |
| [ai-engine.md](ai-engine.md) | Pipeline rules → retrieval BM25 → LLM OpenAI-compatible → offline fallback, SSE events |
| [backend.md](backend.md) | Struktur FastAPI, tabel router, env, database/migrasi/seed, **cookie & sesi di balik reverse proxy**, pengujian |
| [frontend.md](frontend.md) | Rute Next.js, design system, proxy same-origin, **landing page `/landing`**, snippet integrasi widget |
| [deployment.md](deployment.md) | Deploy Coolify (Dockerfile all-in-one), compose lokal, Postgres, **verifikasi pasca-deploy**, troubleshooting |

Mulai tercepat (satu command):

```bash
python run.py          # api:8000 + web:3000, widget auto-build, .env auto-dibuat
```

Login default: **admin@sapa.ai / admin123**.

Setelah deploy, pastikan semuanya benar-benar jalan:

```bash
BASE=https://domain-anda npm run verify   # smoke test E2E: login → widget → chat SSE → dashboard
curl -s https://domain-anda/healthz       # {"status":"ok","api":{"ok":true,...}}
```

Lalu lihat chatbot hidup di sebuah landing page: **`/landing?key=pk_…`**
(key dari Builder → tab Integrasi). Untuk situs eksternal tanpa build, pakai
`examples/landing/index.html`.
