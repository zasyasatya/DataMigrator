/**
 * Proxy API runtime (Next.js App Router route handlers).
 *
 * ── Kenapa bukan `rewrites()` di next.config.ts? ─────────────────────────────
 * Next.js mengevaluasi `rewrites()` pada saat **build** lalu menyimpan hasilnya
 * di `.next/routes-manifest.json`. Akibatnya `API_INTERNAL_URL` yang di-set saat
 * **runtime** (docker compose service `web`, Coolify, dsb.) DIABAIKAN dan proxy
 * selalu menuju host hasil build — biasanya `http://localhost:8000`.
 *
 * Dua kegagalan produksi yang ditimbulkan:
 *   1. Container web & api terpisah (compose): `localhost:8000` di dalam
 *      container `web` tidak ada apa-apa → semua `/api/v1/*` 502 → **login gagal**.
 *   2. `localhost` di container sering resolve ke IPv6 `::1` lebih dulu, sementara
 *      uvicorn bind `0.0.0.0` (IPv4 saja) → `ECONNREFUSED`.
 *
 * Route handler ini membaca `process.env.API_INTERNAL_URL` **setiap request**,
 * jadi satu image bisa dipakai untuk semua topologi tanpa rebuild.
 */

/** Header yang tidak boleh diteruskan apa adanya (RFC 7230 §6.1 + yang di-regenerate fetch). */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
  "accept-encoding",
]);

/**
 * Base URL backend FastAPI.
 *
 * `localhost` sengaja dinormalkan ke `127.0.0.1`: di container Docker baris
 * `::1 localhost` pada /etc/hosts membuat Node mencoba IPv6 lebih dulu, dan
 * uvicorn (`--host 0.0.0.0`) tidak listen di sana → ECONNREFUSED.
 */
export function apiBaseUrl(): string {
  const raw = (process.env.API_INTERNAL_URL || "http://127.0.0.1:8000").trim();
  return raw.replace(/\/+$/, "").replace(/\/\/localhost([:/])/, "//127.0.0.1$1");
}

function forwardedProto(req: Request): string {
  const xfp = req.headers.get("x-forwarded-proto");
  if (xfp) return xfp.split(",")[0].trim().toLowerCase();
  try {
    return new URL(req.url).protocol.replace(":", "");
  } catch {
    return "http";
  }
}

function jsonError(status: number, detail: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ detail, ...extra }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Teruskan request apa adanya ke FastAPI, termasuk body streaming (upload
 * multipart) dan respons SSE (`text/event-stream`) tanpa buffering.
 */
export async function proxyToApi(req: Request): Promise<Response> {
  const base = apiBaseUrl();
  const incoming = new URL(req.url);
  const target = `${base}${incoming.pathname}${incoming.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  // Metadata proxy supaya backend tahu URL publik aslinya (scheme https di balik
  // Cloudflare/Coolify, host domain pelanggan) — dipakai utk cookie Secure & APP_URL.
  headers.set("x-forwarded-proto", forwardedProto(req));
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-uri", `${incoming.pathname}${incoming.search}`);
  if (!req.headers.get("x-real-ip")) {
    const ip = req.headers.get("x-forwarded-for");
    if (ip) headers.set("x-real-ip", ip.split(",")[0].trim());
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Stream body apa adanya (duplex wajib saat body berupa ReadableStream).
    if (req.body) {
      init.body = req.body;
      init.duplex = "half";
    } else {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 0) init.body = buf;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const cause = (err as { cause?: { code?: string } })?.cause?.code || "";
    console.error(
      `[proxy] gagal menghubungi API ${target} (${err instanceof Error ? err.message : String(err)}${cause ? ` ${cause}` : ""})`
    );
    return jsonError(502, "Backend API tidak dapat dihubungi", {
      api: base,
      code: cause || undefined,
      hint: "Pastikan API_INTERNAL_URL benar dan proses uvicorn hidup.",
    });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    // undici sudah men-decompress body → content-encoding/length lama tidak valid.
    if (k === "content-encoding" || k === "content-length") return;
    if (HOP_BY_HOP.has(k) && k !== "content-length") return;
    out.set(key, value);
  });

  // Set-Cookie bisa lebih dari satu; Headers.getSetCookie() menjaga tiap entri.
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === "function") {
    out.delete("set-cookie");
    for (const c of getSetCookie.call(upstream.headers)) out.append("set-cookie", c);
  }

  const ctype = upstream.headers.get("content-type") || "";
  if (ctype.includes("text/event-stream")) {
    // Cegah buffering oleh proxy di depan (nginx/Cloudflare) & cache browser.
    out.set("cache-control", "no-store, no-transform");
    out.set("x-accel-buffering", "no");
    out.delete("content-length");
  }

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

/** Handler seragam untuk semua method pada satu prefix. */
export const proxyHandlers = {
  GET: proxyToApi,
  POST: proxyToApi,
  PUT: proxyToApi,
  PATCH: proxyToApi,
  DELETE: proxyToApi,
  OPTIONS: proxyToApi,
  HEAD: proxyToApi,
};
