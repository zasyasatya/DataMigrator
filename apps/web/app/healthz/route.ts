import { apiBaseUrl } from "@/lib/proxy";

/**
 * `/healthz` di sisi dashboard — dipakai untuk healthcheck Coolify dan untuk
 * mendiagnosis "login gagal": bila `api.ok` false berarti proxy ke backend
 * yang bermasalah (API_INTERNAL_URL / uvicorn), bukan kredensialnya.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const base = apiBaseUrl();
  let apiOk = false;
  let apiDetail: unknown = null;
  const started = Date.now();

  try {
    const res = await fetch(`${base}/healthz`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    apiOk = res.ok;
    apiDetail = res.ok ? await res.json().catch(() => null) : `HTTP ${res.status}`;
  } catch (err) {
    apiDetail = `${err instanceof Error ? err.message : String(err)}${
      (err as { cause?: { code?: string } })?.cause?.code
        ? ` (${(err as { cause?: { code?: string } }).cause!.code})`
        : ""
    }`;
  }

  return new Response(
    JSON.stringify(
      {
        status: apiOk ? "ok" : "degraded",
        web: "ok",
        api: { url: base, ok: apiOk, latency_ms: Date.now() - started, detail: apiDetail },
      },
      null,
      2
    ),
    {
      status: apiOk ? 200 : 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    }
  );
}
