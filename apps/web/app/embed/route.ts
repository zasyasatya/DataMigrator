import { proxyHandlers } from "@/lib/proxy";

/** `/embed` (tanpa sub-path) → halaman dokumentasi integrasi dari FastAPI. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = proxyHandlers.GET;
export const HEAD = proxyHandlers.HEAD;
