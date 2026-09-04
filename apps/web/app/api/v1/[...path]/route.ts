import { proxyHandlers } from "@/lib/proxy";

/**
 * `/api/v1/*` → FastAPI.
 * Target dibaca dari env `API_INTERNAL_URL` **setiap request** (lihat lib/proxy.ts),
 * bukan di-bake saat build — sehingga image yang sama jalan di compose, Coolify,
 * maupun all-in-one tanpa rebuild.
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
