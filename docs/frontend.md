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

## Proxy same-origin (`next.config.ts`)

```ts
rewrites: /api/v1/:path* → API_INTERNAL_URL/api/v1/:path*
          /w/:path*        → API_INTERNAL_URL/w/:path*
          /embed/:path*    → API_INTERNAL_URL/embed/:path*
```

`API_INTERNAL_URL` default `http://localhost:8000` (lokal) / `http://api:8000`
(compose) / `http://127.0.0.1:8000` (image all-in-one). Karena same-origin,
tanpa setup CORS/cookie di sisi pelanggan.

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
