import { proxyToApi } from "@/lib/proxy";

/** Integration snippet page served by the backend (`GET /embed` with no sub-path). */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return proxyToApi(request, "/embed");
}
