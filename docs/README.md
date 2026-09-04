# Dokumentasi Sapa AI

Platform *no-code* AI agent chatbot untuk customer service:
atur instruksi/persona, knowledge base, rules & guardrails, tampilan widget —
uji di **simulator**, lalu embed ke website pelanggan dengan **satu baris script**.

| Dokumen | Isi |
|---|---|
| [architecture.md](architecture.md) | Diagram monorepo, alur request (dashboard / widget / channel), model data, auth & kunci API |
| [ai-engine.md](ai-engine.md) | Pipeline rules → retrieval BM25 → LLM OpenAI-compatible → offline fallback, SSE events |
| [backend.md](backend.md) | Struktur FastAPI, tabel router, env, database/migrasi/seed, pengujian |
| [frontend.md](frontend.md) | Rute Next.js, design system, proxy same-origin, snippet integrasi widget |
| [deployment.md](deployment.md) | Deploy Coolify (Dockerfile all-in-one), compose lokal, Postgres, troubleshooting |

Mulai tercepat (satu command):

```bash
python run.py          # api:8000 + web:3000, widget auto-build, .env auto-dibuat
```

Login default: **admin@sapa.ai / admin123**.
