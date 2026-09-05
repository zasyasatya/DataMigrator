import { proxyHandlers } from "@/lib/proxy";

/**
 * `/embed/*` → bundle widget (`/embed/widget.js`) & halaman dokumentasi integrasi.
 * Inilah satu-satunya file yang perlu di-tempel di situs pelanggan.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = proxyHandlers.GET;
export const POST = proxyHandlers.POST;
export const OPTIONS = proxyHandlers.OPTIONS;
export const HEAD = proxyHandlers.HEAD;
