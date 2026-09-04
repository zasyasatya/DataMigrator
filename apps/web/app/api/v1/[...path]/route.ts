import { proxyToApi } from "@/lib/proxy";

/**
 * Runtime proxy for the backend so the dashboard/widget stay same-origin without
 * relying on build-time `rewrites()` (see lib/proxy.ts for why).
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

function target(path: string[]): string {
  return "/api/v1/" + path.map(encodeURIComponent).join("/");
}

async function handle(request: Request, { params }: Context): Promise<Response> {
  const { path } = await params;
  return proxyToApi(request, target(path));
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
