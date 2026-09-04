# AI Engine

Satu orkestrasi chat (`app/services/chat.py`) dipakai **semua channel**:
simulator dashboard, widget popup, WhatsApp, dan Instagram. Beda channel,
otak yang sama.

## Pipeline (berurutan)

```
pesan user
  │ 1. RULES (jika→maka) — cocok string pertama menang, mis. promo & jam operasional
  ▼
  │ 2. RETRIEVAL — knowledge di-chunk ±700 karakter, di-skor BM25, top-k
  │    disuntik ke system prompt + dikirim sebagai `sources`
  ▼
  │ 3. LLM — engine `auto` memakai provider OpenAI-compatible bila ada key,
  │    kalau tidak (atau provider error) FALLBACK ke engine offline
  ▼
  │ 4. GUARDRAILS & TONE — digabung ke system prompt; tone mengatur
  │    pembuka/penutup jawaban
  ▼
SSE → user (disimpan ke Conversation/Message untuk analitik)
```

## 1. Rules

Daftar `{trigger, response}` per-agent (tab Perilaku di builder). Dicek
case-insensitive sebelum hal lain — cocok untuk jawaban pasti (ongkir, promo,
jam buka). Tanpa aturan yang cocok → lanjut retrieval.

## 2. Retrieval BM25

- Index di `app/services/knowledge.py`: dokumen dipecah `chunk_text`
  (±700 karakter), tiap chunk di-tokenisasi (`app/services/text.py`).
- Skor di `app/services/retrieval.py`: **BM25 murni** (k1=1.5, b=0.75) —
  tanpa dependensi vektor/eksternal, deterministik, gampang diuji.
- `retrieval_top_k` (default 3) chunk terbaik masuk prompt sebagai
  `[n] (judul dokumen) isi...` dan dikembalikan sebagai *sources* di event
  `meta`/`done`, sehingga simulator & widget bisa menampilkan kutipan.

## 3. Provider LLM (OpenAI-compatible)

`app/services/llm/openai_compat.py` berbicara protokol `/chat/completions`
**streaming** (`data: ...` / `[DONE]`) — kompatibel dengan OpenAI, Groq,
OpenRouter, Ollama, vLLM, dsb. cukup arahkan `OPENAI_BASE_URL`.

Resolusi konfigurasi (`get_llm_config`): **override per-workspace**
(dashboard Settings → Provider LLM, ada tombol *Tes koneksi* yang mengukur
latency nyata) → fallback env `OPENAI_API_KEY/BASE_URL/MODEL`.

Mode `engine` per-agent: `auto` (pakai LLM bila key tersedia, else offline) |
`openai` (wajib LLM) | `offline` (selalu lokal).

## 4. Engine offline (tanpa API key)

`app/services/llm/offline.py` (`AgentBrain` + `OfflineProvider`) menjawab
deterministik: deteksi sapaan/terima-kasih/perpisahan/permintaan manusia,
lalu ekstraksi kalimat relevan dari chunk retrieval + penyesuaian tone
(`friendly|formal|casual|playful` → opener/lead/closer berbeda). Platform
tetap **berfungsi penuh & teruji tanpa API key**.

## Streaming SSE

Event dari `stream_chat`: `meta` (info awal) → `delta{t}` (potongan teks) →
`done` (ringkasan: `sources`, `latency_ms`, `engine`, `message_id`).
Bila provider runtime error: event **`engine_fallback`** + jawaban offline,
bukan error mentah ke user.

## Prompt yang dibangun (`build_system_prompt`)

Identitas + bahasa + gaya tone → instruksi pemilik → guardrails →
konteks retrieval → instruksi fallback persis (`fallback_message`) →
batas ~120 kata. `temperature`/`model` per-agent diteruskan via `GenParams`.
