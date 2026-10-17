// Edge API for sidequestmaidens.com. Static pages never hit this file (see run_worker_first in wrangler.jsonc).
// Future home of the Shopify Storefront proxy, so the storefront token stays server-side.

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "sidequestmaidens", time: new Date().toISOString() });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
