import { proxyHandlers } from "@/lib/proxy";

/**
 * `/w/*` → API publik widget (config, session, chat SSE, history).
 * Same-origin dengan dashboard sehingga widget di situs pelanggan tidak butuh
 * konfigurasi CORS/cookie tambahan.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = proxyHandlers.GET;
export const POST = proxyHandlers.POST;
export const PUT = proxyHandlers.PUT;
export const PATCH = proxyHandlers.PATCH;
export const DELETE = proxyHandlers.DELETE;
export const OPTIONS = proxyHandlers.OPTIONS;
export const HEAD = proxyHandlers.HEAD;
