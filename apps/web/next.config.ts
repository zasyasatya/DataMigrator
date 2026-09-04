import type { NextConfig } from "next";

/**
 * CATATAN PENTING — jangan pakai `rewrites()` untuk proxy ke backend.
 *
 * `rewrites()` dievaluasi Next.js pada saat **build** dan hasilnya dibekukan ke
 * `.next/routes-manifest.json`. `API_INTERNAL_URL` yang di-set saat runtime
 * (docker compose / Coolify) lalu diabaikan, dan proxy selalu menuju host hasil
 * build (`http://localhost:8000`) → di container terpisah atau saat `localhost`
 * resolve ke IPv6 `::1`, semua `/api/v1/*` gagal dan **login tidak bisa**.
 *
 * Proxy sekarang dijalankan lewat route handler yang membaca env tiap request:
 *   app/api/v1/[...path]/route.ts   → /api/v1/*
 *   app/w/[...path]/route.ts        → /w/*      (API publik widget, SSE)
 *   app/embed/[...path]/route.ts    → /embed/*  (bundle widget.js)
 *   app/healthz/route.ts            → cek backend + diagnostik
 * Semua memakai helper bersama di `lib/proxy.ts`.
 */
const nextConfig: NextConfig = {
  // Env yang dibaca saat runtime oleh lib/proxy.ts (bukan build-time):
  //   API_INTERNAL_URL  default http://127.0.0.1:8000
  // Tidak ada konfigurasi build-time yang dibutuhkan untuk proxy.
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
