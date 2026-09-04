/**
 * Same-origin proxy to the FastAPI backend, resolved at REQUEST time.
 *
 * Why not `rewrites()` in next.config.ts? Next.js evaluates `rewrites()` during
 * `next build` and bakes the result into `.next/routes-manifest.json`. At runtime
 * (`next start`, Docker, Coolify) the baked destination is used and the env var is
 * ignored — so `API_INTERNAL_URL=http://api:8000` set on the container never takes
 * effect and every `/api/v1/*` call (login included) dies with a bare HTTP 500.
 * Route handlers are re-read per request, so the env var works in dev and prod.
 */

/** Headers that must not be forwarded verbatim between the two hops. */
const SKIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "accept-encoding",
]);

const SKIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "set-cookie", // re-appended individually so multiple cookies survive
]);

export function apiBase(): string {
  const raw = process.env.API_INTERNAL_URL?.trim() || "http://127.0.0.1:8000";
  return raw.replace(/\/+$/, "");
}

export async function proxyToApi(request: Request, pathname: string): Promise<Response> {
  const incoming = new URL(request.url);
  const target = `${apiBase()}${pathname}${incoming.search}`;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (SKIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.append(key, value);
  }
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "follow",
    cache: "no-store",
  };
  if (request.body && request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // Required by undici when forwarding a stream as a request body (file uploads).
    (init as RequestInit & { duplex: "half" }).duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const detail =
      `Backend API tidak terjangkau di ${target}. ` +
      `Set API_INTERNAL_URL (docker compose / Coolify) atau jalankan "python run.py". ` +
      `(${(err as Error)?.message ?? "network error"})`;
    return Response.json({ detail }, { status: 502 });
  }

  const outHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
    outHeaders.append(key, value);
  }
  const headersWithCookies = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const cookies =
    typeof headersWithCookies.getSetCookie === "function"
      ? headersWithCookies.getSetCookie()
      : [];
  for (const cookie of cookies) {
    outHeaders.append("set-cookie", cookie);
  }

  // Body is streamed through untouched: keeps chat SSE (`/w/:key/chat`) and the
  // widget bundle flowing instead of buffering the whole response.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}
