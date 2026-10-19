import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { MAIDENS, bySlug } from "../data/maidens";

/** Internal: per-video visits and clicks from /api/stats. Not linked; disallowed in robots.txt. */

type Row = { slug: string; src: string; event: string; hits: number; visitors: number };
type Line = { src: string; visits: number; visitors: number; plays: number; playlist: number; youtube: number; shop: number };

const KEY_STORE = "sqm-stats-key";
const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
};

function group(rows: Row[]) {
  const stations = new Map<string, Map<string, Line>>();
  for (const r of rows) {
    const lines = stations.get(r.slug) ?? new Map<string, Line>();
    stations.set(r.slug, lines);
    const l = lines.get(r.src) ?? { src: r.src, visits: 0, visitors: 0, plays: 0, playlist: 0, youtube: 0, shop: 0 };
    lines.set(r.src, l);
    if (r.event === "visit") {
      l.visits += r.hits;
      l.visitors += r.visitors;
    } else if (r.event === "video") l.plays += r.hits;
    else if (r.event === "playlist") l.playlist += r.hits;
    else if (r.event === "youtube") l.youtube += r.hits;
    else if (r.event === "shop") l.shop += r.hits;
  }
  return [...stations.entries()]
    .map(([slug, lines]) => ({ slug, lines: [...lines.values()].sort((a, b) => b.visits - a.visits) }))
    .sort((a, b) => sum(b.lines, "visits") - sum(a.lines, "visits"));
}

const sum = (lines: Line[], k: keyof Omit<Line, "src">) => lines.reduce((n, l) => n + l[k], 0);
const clicks = (l: Pick<Line, "plays" | "playlist" | "youtube" | "shop">) => l.plays + l.playlist + l.youtube + l.shop;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const srcLabel = (s: string) => (s === "direct" ? "Direct / typed" : s === "site" ? "From elsewhere on the site" : `Video ${s}`);

export function StudioStats() {
  const [key, setKey] = useState(readKey);
  const [draft, setDraft] = useState("");
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Studio · video stats";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setError("");
    fetch(`/api/stats?days=${days}`, { headers: { authorization: `Bearer ${key}` } })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.status === 401) {
          setError("That key doesn't match the STATS_KEY secret on the Worker.");
          setRows(null);
        } else if (r.status === 503) {
          setError("The STATS_KEY secret isn't set on the Worker yet. Add it in Cloudflare, then reload.");
          setRows(null);
        } else if (!r.ok) {
          setError(`Stats request failed (${r.status}).`);
        } else setRows(body.rows as Row[]);
      })
      .catch(() => !cancelled && setError("Couldn't reach /api/stats. Stats only work on the deployed site."));
    return () => {
      cancelled = true;
    };
  }, [key, days]);

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(KEY_STORE, draft);
    } catch {
      // key just won't be remembered
    }
    setKey(draft);
  };

  const stations = useMemo(() => (rows ? group(rows) : []), [rows]);

  return (
    <section className="page studio-stats">
      <div className="page__head">
        <span className="eyebrow">Studio</span>
        <h1>Video stats</h1>
        <p>
          Visits to each station page, split by the <code>?v=</code> tag on the link in each video's description, and what people
          clicked once they arrived. Compare visits with that video's views in YouTube Studio for clicks per 1,000 views.
        </p>
      </div>

      {!key ? (
        <form className="stats-key" onSubmit={saveKey}>
          <label htmlFor="stats-key">Stats key</label>
          <input id="stats-key" type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
          <button className="btn btn--primary" type="submit" disabled={!draft}>
            Show stats
          </button>
        </form>
      ) : (
        <div className="stats-bar">
          <div className="stats-range" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.days} className={days === r.days ? "is-active" : ""} onClick={() => setDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
          <button
            className="link-button"
            onClick={() => {
              try {
                localStorage.removeItem(KEY_STORE);
              } catch {
                // nothing stored
              }
              setKey("");
              setDraft("");
              setRows(null);
            }}
          >
            Forget key
          </button>
        </div>
      )}

      {error && <p className="stats-error">{error}</p>}

      {rows && stations.length === 0 && <p className="note">No visits recorded in this range yet.</p>}

      {stations.map(({ slug, lines }) => {
        const m = bySlug(slug);
        const visits = sum(lines, "visits");
        const totalClicks = lines.reduce((n, l) => n + clicks(l), 0);
        return (
          <article key={slug} className="stats-station" style={{ "--m": m?.color } as CSSProperties}>
            <header>
              <strong>{m ? `${m.station} · ${m.name}` : slug}</strong>
              <span className="mono">
                {visits} visits · {totalClicks} clicks · {pct(totalClicks, visits)} click-through
              </span>
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Visits</th>
                    <th>Visitors</th>
                    <th>Mix plays</th>
                    <th>Playlist</th>
                    <th>YouTube</th>
                    <th>Shop</th>
                    <th>Click-through</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.src}>
                      <td>{srcLabel(l.src)}</td>
                      <td>{l.visits}</td>
                      <td>{l.visitors}</td>
                      <td>{l.plays}</td>
                      <td>{l.playlist}</td>
                      <td>{l.youtube}</td>
                      <td>{l.shop}</td>
                      <td>{pct(clicks(l), l.visits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}

      <LinkBuilder />
    </section>
  );
}

function LinkBuilder() {
  const [slug, setSlug] = useState("briar");
  const m = bySlug(slug)!;
  const nextEp = `ep${(m.youtube?.videos.length ?? 0) + 1}`;
  const [tag, setTag] = useState("");
  const clean = (tag || nextEp).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const url = `https://sidequestmaidens.com/${slug}?v=${clean}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="link-builder">
      <h2>Description link builder</h2>
      <p className="note">Give every video its own tag. Use the same tag only for links in that one video.</p>
      <div className="link-builder__row">
        <label>
          Maiden
          <select id="lb-maiden" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {MAIDENS.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.name} · {x.station}
                {x.live ? "" : " (coming soon)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Video tag
          <input id="lb-tag" value={tag} placeholder={nextEp} onChange={(e) => setTag(e.target.value)} />
        </label>
      </div>
      <div className="link-builder__out">
        <code>{url}</code>
        <button className="btn" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {m.youtube && (
        <ul className="link-builder__known">
          {m.youtube.videos.map((v) => (
            <li key={v.id}>
              <span className="mono">{v.tag}</span> {v.title} → <code>sidequestmaidens.com/{slug}?v={v.tag}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
