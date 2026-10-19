// Edge API for sidequestmaidens.com. Static pages never hit this file (see run_worker_first in wrangler.jsonc).
// Future home of the Shopify Storefront proxy, so the storefront token stays server-side.

import { DurableObject } from "cloudflare:workers";

interface Env {
  ASSETS: Fetcher;
  STATS: DurableObjectNamespace<StatsCounter>;
  /** Secret that unlocks GET /api/stats. Set it in the dashboard (Settings → Variables and Secrets). */
  STATS_KEY?: string;
}

// Station slugs (src/data/maidens.ts) and the events the site may send.
const SLUGS = new Set(["briar", "vega", "nova", "tsukiyo", "aurelia", "mara", "mimi", "jackie", "tilt"]);
const EVENTS = new Set(["visit", "playlist", "video", "youtube", "shop"]);
const TAG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|discord|whatsapp|telegram|headless/i;

type Hit = { slug: string; event: string; src: string; day: string; visitor: string };

/**
 * Per-video attribution: how many people arrive at each station page from each video description
 * (?v=<tag>), and what they click once there. One SQLite-backed Durable Object holds the counts;
 * visitors are stored only as a daily-rotating hash so no IP address or identifier is kept.
 */
export class StatsCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS hits (
        day TEXT NOT NULL, slug TEXT NOT NULL, event TEXT NOT NULL, src TEXT NOT NULL,
        n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, slug, event, src));
      CREATE TABLE IF NOT EXISTS uniq (
        day TEXT NOT NULL, slug TEXT NOT NULL, event TEXT NOT NULL, src TEXT NOT NULL, visitor TEXT NOT NULL,
        PRIMARY KEY (day, slug, event, src, visitor));
    `);
  }

  hit(h: Hit) {
    const sql = this.ctx.storage.sql;
    sql.exec(
      `INSERT INTO hits (day, slug, event, src, n) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT (day, slug, event, src) DO UPDATE SET n = n + 1`,
      h.day, h.slug, h.event, h.src,
    );
    sql.exec(`INSERT OR IGNORE INTO uniq VALUES (?, ?, ?, ?, ?)`, h.day, h.slug, h.event, h.src, h.visitor);
  }

  /** Totals per station × source × event, over the last `days` days (0 = all time). */
  report(days: number) {
    const since = days > 0 ? new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10) : "0000-00-00";
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT h.slug, h.src, h.event, SUM(h.n) AS hits,
                (SELECT COUNT(*) FROM uniq u WHERE u.slug = h.slug AND u.src = h.src AND u.event = h.event AND u.day >= ?) AS visitors
         FROM hits h WHERE h.day >= ? GROUP BY h.slug, h.src, h.event ORDER BY h.slug, hits DESC`,
        since, since,
      )
      .toArray();
    return { since, rows };
  }
}

async function visitorHash(request: Request, day: string) {
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}|${ua}`));
  return [...new Uint8Array(bytes).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const counter = (env: Env) => env.STATS.get(env.STATS.idFromName("global"));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "sidequestmaidens", time: new Date().toISOString() });
    }

    // POST /api/hit {slug, event, src}: sent by station pages with navigator.sendBeacon.
    if (url.pathname === "/api/hit" && request.method === "POST") {
      if (BOT.test(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
      let body: { slug?: unknown; event?: unknown; src?: unknown };
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "bad_json" }, { status: 400 });
      }
      const slug = String(body.slug ?? "").toLowerCase();
      const event = String(body.event ?? "");
      const src = String(body.src ?? "direct").toLowerCase();
      if (!SLUGS.has(slug) || !EVENTS.has(event) || !TAG.test(src)) {
        return Response.json({ error: "invalid" }, { status: 400 });
      }
      const day = new Date().toISOString().slice(0, 10);
      await counter(env).hit({ slug, event, src, day, visitor: await visitorHash(request, day) });
      return new Response(null, { status: 204 });
    }

    // GET /api/stats?days=30 with "Authorization: Bearer <STATS_KEY>".
    if (url.pathname === "/api/stats" && request.method === "GET") {
      if (!env.STATS_KEY) return Response.json({ error: "stats_key_not_set" }, { status: 503 });
      if (request.headers.get("authorization") !== `Bearer ${env.STATS_KEY}`) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const days = Math.max(0, Math.min(3650, Number(url.searchParams.get("days") ?? 30) || 0));
      return Response.json(await counter(env).report(days), { headers: { "cache-control": "no-store" } });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
