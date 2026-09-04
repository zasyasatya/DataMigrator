# Frontend (Next.js Dashboard)

`apps/web`: Next.js 16 App Router + Tailwind v4 + React 19.

## Rute

| Rute | Fungsi |
|---|---|
| `/login` | autentikasi workspace (token → localStorage) |
| `/` | dashboard: hero live, KPI, aktivitas, percakapan |
| `/agents` | daftar agent |
| `/agents/[id]` | **builder + simulator**: tab instruksi/knowledge/perilaku/tampilan/integrasi/percakapan/analitik/channels, panel simulasi kanan |
| `/settings` | API keys, integrasi, provider LLM |
| `/demo` | toko pelanggan palsu untuk uji popup widget sungguhan |

Struktur: `app/(shell)/` (layout sidebar+topbar) · `components/{builder,chat,dashboard,shell}` ·
`lib/api.ts` (client) + `lib/types.ts`.

## Design system

Mengikuti mock referensi: kanvas lavender *aurora* + panel kaca (glassmorphism),
aksen violet `#7C5CF6`, kartu putih radius 20px, hero *dark-violet* dengan orb +
waveform live, KPI ber-progress-bar, feed aktivitas ber-icon-tile. Widget popup
memakai bahasa visual yang sama (header gradasi violet, bubble membulat, launcher
gelap). **Mobile-responsive**: sidebar jadi drawer, simulator jadi overlay
fullscreen, widget fullscreen di HP.

## Client API (`lib/api.ts`)

- `api(path, init)` — `fetch` ke `/api/v1` + `Authorization: Bearer` dari
  localStorage; 401 → hapus token & redirect `/login`; error → `ApiError(status, detail)`.
- `streamChat(path, body, {onMeta,onDelta,onDone,onError})` — POST lalu konsumsi
  SSE (`event: meta/delta/done/engine_fallback`) via `ReadableStream` reader.

## Proxy same-origin (runtime, `lib/proxy.ts`)

```
app/api/v1/[...path]/route.ts  →  API_INTERNAL_URL/api/v1/*
app/w/[...path]/route.ts       →  API_INTERNAL_URL/w/*        (SSE widget)
app/embed/[...path]/route.ts   →  API_INTERNAL_URL/embed/*    (widget.js)
app/embed/route.ts             →  API_INTERNAL_URL/embed      (dok integrasi)
app/healthz/route.ts           →  diagnostik web + keterjangkauan API
```

`API_INTERNAL_URL` default `http://127.0.0.1:8000` (lokal/all-in-one) atau
`http://api:8000` (compose). Karena same-origin, tanpa setup CORS/cookie di sisi
pelanggan.

> **Jangan kembalikan ke `rewrites()` di `next.config.ts`.** `rewrites()` dibekukan
> saat `next build`, jadi `API_INTERNAL_URL` runtime diabaikan dan container selalu
> mem-proxy ke `http://localhost:8000` → di compose tidak ada backend di sana, dan
> di all-in-one `localhost` bisa resolve ke IPv6 `::1` (uvicorn hanya listen IPv4).
> Gejala keduanya sama: **login gagal walau deploy sukses**. Route handler membaca env
> setiap request, menormalkan `localhost`→`127.0.0.1`, meneruskan `Set-Cookie` &
> `x-forwarded-proto`, serta men-*stream* SSE tanpa buffering.

## Landing page contoh (`/landing`)

`app/landing/page.tsx` adalah **server component** murni: hero, produk, keunggulan,
testimoni, FAQ (`<details>` bawaan HTML → tetap jalan tanpa JS), CTA, dan footer —
sehingga HTML-nya lengkap untuk SEO & first paint. Hanya dua komponen kecil yang
client-side:

| Komponen | Tanggung jawab |
|---|---|
| `components/landing/ChatbotEmbed.tsx` | baca key dari `?key=`/`localStorage`, suntik `<script src="/embed/widget.js?k=…">`, pasang bridge `window.SapaAsk(text)`, tampilkan petunjuk bila key belum ada |
| `components/landing/AskButton.tsx` | tombol "Tanya" → buka chat + kirim pesan; fallback ke `/agents` bila widget belum aktif |

> `useSearchParams()` di dalam Suspense membuat seluruh halaman bailout ke CSR bila
> dipasang di page utama — itulah sebabnya pembacaan query diisolasi ke
> `ChatbotEmbed`, bukan di `page.tsx`.

Buka `/landing?key=pk_…` (key dari Builder → tab Integrasi). Untuk situs eksternal
tanpa build, pakai `examples/landing/index.html` (satu file, dukung `?key=` & `?host=`).

## Integrasi ke website pelanggan (satu baris)

```html
<script src="https://domain-anda/embed/widget.js" data-sapa-key="pk_..." defer></script>
```

Varian: query param `.../widget.js?k=pk_...` · komponen React/Next inject-script
(snippet di tab Integrasi) · server-to-server SSE `POST /w/{pk}/chat`
(`event: meta/delta/done`) · CMS (WordPress/Shopify/Wix) via footer/custom-HTML.
Lihat `examples/standalone.html` untuk halaman uji tanpa framework.

API JS widget: `window.SapaChat.open() / .close() / .send(text) /
.identify(name, email) / .on('open|close|message', cb)`.
