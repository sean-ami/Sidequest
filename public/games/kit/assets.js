// Maiden records from games/assets/manifest.json. If the manifest or a file is missing,
// games still work: art() returns an accent-coloured silhouette placeholder.

const BASE = new URL("../assets/", import.meta.url);

// Fallback cast so games run before the manifest exists. Accents match src/data/maidens.ts.
const FALLBACK = [
  { id: "nova", name: "Nova", station: "Morning Focus", accent: "#FF9A3D" },
  { id: "briar", name: "Briar", station: "Rainfall", accent: "#8E6CFF" },
  { id: "vega", name: "Vega", station: "Neon Signal", accent: "#FF3E8A" },
];

let cache = null;

function resolve(path) {
  if (!path) return null;
  if (/^(https?:)?\//.test(path)) return path; // absolute (e.g. /art/nova/scene.webp)
  return new URL(path, BASE).href;
}

/**
 * Returns [{ id, name, station, accent, files: { cutout, avatar, card, card_eyes, scene, scene_bg, chibi, station_loop } }]
 * with absolute URLs. Relative manifest paths resolve against games/assets/.
 */
export async function loadMaidens() {
  if (cache) return cache;
  let list = FALLBACK.map((m) => ({ ...m, files: {} }));
  try {
    const r = await fetch(new URL("manifest.json", BASE), { cache: "no-cache" });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.maidens) && j.maidens.length) list = j.maidens;
    }
  } catch {
    // offline or missing: fallback cast
  }
  cache = list.map((m) => {
    const files = {};
    for (const [k, v] of Object.entries(m.files || {})) files[k] = resolve(v);
    return { ...m, files };
  });
  return cache;
}

export async function maiden(id) {
  return (await loadMaidens()).find((m) => m.id === id) || null;
}

/**
 * An element for one of a Maiden's images: <img> if the file exists and loads, otherwise a
 * placeholder silhouette in her accent. kind = "card" | "scene" | "avatar" | "cutout" | ...
 * Falls back through `alts` (e.g. ["card", "scene"]) before using the placeholder.
 */
export function art(m, kind, { alts = [], alt = "" } = {}) {
  const box = document.createElement("div");
  box.className = "art";
  box.style.cssText = "width:100%;height:100%";
  box.style.setProperty("--c", m?.accent || "#3DD6C8");
  const queue = [kind, ...alts].map((k) => m?.files?.[k]).filter(Boolean);
  const placeholder = () => {
    box.replaceChildren();
    const ph = document.createElement("div");
    ph.className = "ph";
    ph.setAttribute("role", "img");
    ph.setAttribute("aria-label", alt || (m ? m.name : "Maiden"));
    box.append(ph);
  };
  const tryNext = () => {
    const src = queue.shift();
    if (!src) return placeholder();
    const img = new Image();
    img.alt = alt || (m ? m.name : "");
    img.decoding = "async";
    img.loading = "lazy";
    img.style.cssText = "width:100%;height:100%;object-fit:cover";
    img.onerror = tryNext;
    img.src = src;
    box.replaceChildren(img);
  };
  tryNext();
  return box;
}

/** Shared JSON loader for games/ files (config.json, games.json, votes/...). Returns null on failure. */
export async function loadJSON(rel) {
  try {
    const r = await fetch(new URL(`../${rel}`, import.meta.url), { cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** games/config.json with every key present (empty string = feature hidden). */
export async function loadConfig() {
  const c = (await loadJSON("config.json")) || {};
  return { whatnot_url: "", patreon_url: "", newsletter_url: "", shop_url: "", ...c };
}
