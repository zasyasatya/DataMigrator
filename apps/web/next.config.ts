import type { NextConfig } from "next";

/**
 * API proxying lives in runtime route handlers (app/api/v1, app/w, app/embed)
 * that read API_INTERNAL_URL per request — NOT in `rewrites()` here, because Next
 * bakes `rewrites()` into .next/routes-manifest.json at build time, which makes the
 * container's env var a no-op in production and breaks login with HTTP 500.
 *
 * API_INTERNAL_URL defaults to http://127.0.0.1:8000 (see lib/proxy.ts); override it
 * when the backend runs elsewhere (docker-compose: http://api:8000).
 */
const nextConfig: NextConfig = {};

export default nextConfig;
