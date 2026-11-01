// Edge API for sidequestmaidens.com: /api/* and /admin/* only. Static pages never hit this file (see run_worker_first in wrangler.jsonc).
// Future home of the Shopify Storefront proxy, so the storefront token stays server-side.

import { DurableObject } from "cloudflare:workers";

interface Env {
  ASSETS: Fetcher;
  STATS: DurableObjectNamespace<StatsCounter>;
  VOTES: DurableObjectNamespace<VoteBox>;
  /** Salt for hashing voter ids and IPs in the vote store. Set as a secret (see public/games/README.md). */
  VOTE_SALT?: string;
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
const voteBox = (env: Env) => env.VOTES.get(env.VOTES.idFromName("global"));

// ---------------------------------------------------------------------------------------------
// Side Quest Vote. Finishing a game's daily side quest earns one vote (1 per game per UTC day) on
// which Maiden opens her station next. Completion is verified client-side only, so votes are
// low-stakes signals: unique-voter counts are the number to trust. No raw IP, user agent or email
// is stored; voter ids and IPs are salted SHA-256 hashes.
// ---------------------------------------------------------------------------------------------

const SET_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const OPTION_ID = /^[a-z0-9][a-z0-9_-]{0,15}$/;
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const VOTER = /^[A-Za-z0-9-]{8,64}$/;
/** Max votes one IP may cast per UTC day (shared households, schools). */
const IP_DAY_CAP = 25;

type VoteSet = {
  set_id: string;
  kind?: string;
  question?: string;
  options: { id: string; label?: string; name?: string }[];
  opens: string;
  closes: string;
  winner: string | null;
  closed: string | null;
};

type Tally = Record<string, number>;

/** Votes live in one SQLite-backed Durable Object (same pattern as StatsCounter; no dashboard setup). */
export class VoteBox extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY,
        set_id TEXT NOT NULL, option_id TEXT NOT NULL, game TEXT NOT NULL,
        day TEXT NOT NULL, voter TEXT NOT NULL, ip_day TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(set_id, game, day, voter));
      CREATE INDEX IF NOT EXISTS votes_set ON votes(set_id);
      CREATE INDEX IF NOT EXISTS votes_ip ON votes(ip_day, day);
    `);
  }

  private tally(setId: string, options: string[]): Tally {
    const rows = this.ctx.storage.sql
      .exec(`SELECT option_id, COUNT(*) AS n FROM votes WHERE set_id = ? GROUP BY option_id`, setId)
      .toArray() as { option_id: string; n: number }[];
    const total = rows.reduce((a, r) => a + Number(r.n), 0);
    const out: Tally = {};
    for (const o of options) {
      const n = Number(rows.find((r) => r.option_id === o)?.n ?? 0);
      out[o] = total ? Math.round((n / total) * 1000) / 10 : 0;
    }
    return out;
  }

  cast(v: { set_id: string; option_id: string; game: string; day: string; voter: string; ip_day: string }, options: string[]) {
    const sql = this.ctx.storage.sql;
    const dup = sql
      .exec(`SELECT option_id FROM votes WHERE set_id = ? AND game = ? AND day = ? AND voter = ?`, v.set_id, v.game, v.day, v.voter)
      .toArray();
    if (dup.length) return { ok: true, already: true, tally: this.tally(v.set_id, options) };
    const used = Number(sql.exec(`SELECT COUNT(*) AS n FROM votes WHERE ip_day = ? AND day = ?`, v.ip_day, v.day).one().n);
    if (used >= IP_DAY_CAP) return { ok: false, error: "rate_limited" };
    sql.exec(
      `INSERT INTO votes (set_id, option_id, game, day, voter, ip_day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      v.set_id, v.option_id, v.game, v.day, v.voter, v.ip_day, new Date().toISOString(),
    );
    return { ok: true, already: false, tally: this.tally(v.set_id, options) };
  }

  /** The tally is only returned to a voter who has voted in this set. */
  status(setId: string, voter: string, day: string, options: string[]) {
    const sql = this.ctx.storage.sql;
    const games = sql
      .exec(`SELECT game FROM votes WHERE set_id = ? AND voter = ? AND day = ?`, setId, voter, day)
      .toArray()
      .map((r) => String(r.game));
    const last = sql
      .exec(`SELECT option_id FROM votes WHERE set_id = ? AND voter = ? ORDER BY id DESC LIMIT 1`, setId, voter)
      .toArray();
    const voted = last.length ? String(last[0].option_id) : null;
    return { voted_today_games: games, voted_option: voted, tally: voted ? this.tally(setId, options) : null };
  }

  /** Private stats for /admin/votes: totals and per option, game and day, as votes and unique voters. */
  stats() {
    const sql = this.ctx.storage.sql;
    const q = (s: string) => sql.exec(s).toArray();
    return {
      sets: q(`SELECT set_id, COUNT(*) AS votes, COUNT(DISTINCT voter) AS voters, MIN(day) AS first, MAX(day) AS last FROM votes GROUP BY set_id ORDER BY last DESC`),
      options: q(`SELECT set_id, option_id, COUNT(*) AS votes, COUNT(DISTINCT voter) AS voters FROM votes GROUP BY set_id, option_id`),
      games: q(`SELECT set_id, game, COUNT(*) AS votes, COUNT(DISTINCT voter) AS voters FROM votes GROUP BY set_id, game`),
      days: q(`SELECT set_id, day, COUNT(*) AS votes, COUNT(DISTINCT voter) AS voters FROM votes GROUP BY set_id, day ORDER BY day`),
    };
  }
}

async function sha256(s: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function assetJSON<T>(env: Env, request: Request, path: string): Promise<T | null> {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const loadSet = (env: Env, request: Request, id: string) => assetJSON<VoteSet>(env, request, `/games/votes/${id}/set.json`);

/** Open on [opens, closes) UTC; the closes date is announcement day. */
const isOpen = (s: VoteSet, day: string) => !s.winner && !s.closed && day >= s.opens && day < s.closes;

const noStore = { "cache-control": "no-store" };

async function handleVote(request: Request, env: Env, url: URL): Promise<Response> {
  const day = new Date().toISOString().slice(0, 10); // server UTC date; any client date is ignored
  const salt = env.VOTE_SALT ?? "";

  if (request.method === "GET") {
    const setId = url.searchParams.get("set_id") ?? "";
    const voterRaw = url.searchParams.get("voter") ?? "";
    if (!SET_ID.test(setId) || !VOTER.test(voterRaw)) return Response.json({ error: "invalid" }, { status: 400 });
    const set = await loadSet(env, request, setId);
    if (!set) return Response.json({ error: "unknown_set" }, { status: 404 });
    const voter = await sha256(salt + voterRaw);
    const res = await voteBox(env).status(setId, voter, day, set.options.map((o) => o.id));
    return Response.json(res, { headers: noStore });
  }

  if (request.method !== "POST") return Response.json({ error: "method" }, { status: 405 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const setId = String(body.set_id ?? "");
  const optionId = String(body.option_id ?? "");
  const game = String(body.game ?? "");
  const voterRaw = String(body.voter ?? "");
  if (!SET_ID.test(setId) || !OPTION_ID.test(optionId) || !GAME_ID.test(game) || !VOTER.test(voterRaw)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const [set, gamesDoc] = await Promise.all([
    loadSet(env, request, setId),
    assetJSON<{ games: { id: string }[] }>(env, request, "/games/games.json"),
  ]);
  if (!set) return Response.json({ error: "unknown_set" }, { status: 404 });
  if (!isOpen(set, day)) return Response.json({ error: "closed" }, { status: 409 });
  const options = set.options.map((o) => o.id);
  if (!options.includes(optionId)) return Response.json({ error: "invalid_option" }, { status: 400 });
  if (!gamesDoc?.games?.some((g) => g.id === game)) return Response.json({ error: "invalid_game" }, { status: 400 });

  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const res = await voteBox(env).cast(
    {
      set_id: setId, option_id: optionId, game, day,
      voter: await sha256(salt + voterRaw),
      ip_day: await sha256(salt + day + ip),
    },
    options,
  );
  if (!res.ok) return Response.json(res, { status: 429, headers: noStore });
  return Response.json(res, { headers: noStore });
}

/** Private vote stats page. Protect /admin/* with Cloudflare Access too (public/games/README.md). */
const ADMIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Vote stats</title><link rel="stylesheet" href="/games/kit/theme.css">
<style>body{padding:16px}table{border-collapse:collapse;width:100%;margin:8px 0 20px}td,th{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left}td.n{font-family:var(--mono);text-align:right}section{margin-bottom:28px}</style></head>
<body><main class="wrap"><p class="eyebrow">Side Quest Vote</p><h1>Vote stats</h1>
<form id="f" class="panel" style="display:flex;gap:8px;flex-wrap:wrap"><label class="sr-only" for="k">Stats key</label><input id="k" type="password" placeholder="STATS_KEY" style="flex:1;min-height:44px;padding:0 12px;background:var(--navy-3);color:var(--ink);border:1px solid var(--line);border-radius:8px"><button class="btn btn--primary">Load</button></form>
<p class="dim">Unique voters are the number to trust: completion is checked in the browser only.</p><div id="out"></div></main>
<script type="module">
const out=document.getElementById("out"),k=document.getElementById("k");
try{k.value=sessionStorage.getItem("sqm-stats-key")||""}catch{}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const table=(head,rows)=>"<table><tr>"+head.map(h=>"<th>"+h+"</th>").join("")+"</tr>"+rows.map(r=>"<tr>"+r.map((c,i)=>i?'<td class="n">'+esc(c)+"</td>":"<td>"+esc(c)+"</td>").join("")+"</tr>").join("")+"</table>";
async function load(){
  try{sessionStorage.setItem("sqm-stats-key",k.value)}catch{}
  const r=await fetch("/api/vote/stats",{headers:{authorization:"Bearer "+k.value}});
  if(!r.ok){out.textContent="Error: "+r.status;return}
  const s=await r.json();let html="";
  if(!s.sets.length)html="<p>No votes yet.</p>";
  for(const set of s.sets){
    const meta=await fetch("/games/votes/"+set.set_id+"/set.json").then(r=>r.ok?r.json():null).catch(()=>null);
    const label=id=>meta?.options?.find(o=>o.id===id)?.label||id;
    const f=a=>a.filter(x=>x.set_id===set.set_id);
    html+="<section class='panel'><h2>"+esc(meta?.question||set.set_id)+"</h2><p class='mono dim'>"+esc(set.set_id)+(meta?.winner?" · winner: "+esc(label(meta.winner)):"")+"</p>";
    html+=table(["Total","Votes","Unique voters"],[["All",set.votes,set.voters]]);
    html+=table(["Option","Votes","Unique voters"],f(s.options).map(o=>[label(o.option_id),o.votes,o.voters]));
    html+=table(["Game","Votes","Unique voters"],f(s.games).map(o=>[o.game,o.votes,o.voters]));
    html+=table(["Day","Votes","Unique voters"],f(s.days).map(o=>[o.day,o.votes,o.voters]));
    html+="</section>";
  }
  out.innerHTML=html;
}
document.getElementById("f").addEventListener("submit",e=>{e.preventDefault();load()});
if(k.value)load();
</script></body></html>`;

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

    if (url.pathname === "/api/vote") return handleVote(request, env, url);

    // GET /api/vote/stats with "Authorization: Bearer <STATS_KEY>" (same key as /api/stats).
    if (url.pathname === "/api/vote/stats" && request.method === "GET") {
      if (!env.STATS_KEY) return Response.json({ error: "stats_key_not_set" }, { status: 503 });
      if (request.headers.get("authorization") !== `Bearer ${env.STATS_KEY}`) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      return Response.json(await voteBox(env).stats(), { headers: noStore });
    }

    if (url.pathname === "/admin/votes" || url.pathname === "/admin/votes/") {
      return new Response(ADMIN_HTML, {
        headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", ...noStore },
      });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
