// Maiden records from games/assets/manifest.json, with URLs resolved and an accent-coloured
// placeholder for anything missing, so games run before (or without) the CardForge art.

const ASSETS = new URL("../assets/", import.meta.url);
const MANIFEST = new URL("manifest.json", ASSETS);

// Used when the manifest itself can't be loaded. Order is the default companion order.
const FALLBACK_CAST = [
  { id: "nova", name: "Nova", station: "Morning Focus", accent: "#FF8A1F", bpm: [80, 90] },
  { id: "briar", name: "Briar", station: "Rainfall", accent: "#7EC13A", bpm: [70, 80] },
  { id: "vega", name: "Vega", station: "Neon Signal", accent: "#16D9E3", bpm: [85, 100] },
];

/** Placeholder shapes per asset kind: [width, height]. */
const KIND_SIZE = {
  card: [750, 1050],
  scene: [1920, 1080],
  avatar: [512, 512],
  cutout: [512, 1024],
  wallpaper_phone: [1170, 2532],
  wallpaper_desktop: [2560, 1440],
};

/** Which placeholder shape a file key falls back to. */
function kindOf(key) {
  if (key.startsWith("card")) return "card";
  if (key.startsWith("scene")) return "scene";
  if (key === "avatar") return "avatar";
  if (key === "cutout" || key.startsWith("chibi")) return "cutout";
  if (key in KIND_SIZE) return key;
  return "card";
}

/** An SVG silhouette in the Maiden's accent: head and shoulders, or full figure for cutouts. */
export function placeholder(maiden, kind = "card") {
  const [w, h] = KIND_SIZE[kind] || KIND_SIZE.card;
  const c = maiden?.accent || "#FF3E8A";
  const transparent = kind === "cutout";
  const s = Math.min(w, h);
  const cx = kind === "scene" || kind === "wallpaper_desktop" ? w * 0.62 : w / 2;
  let figure;
  if (transparent) {
    // full-body silhouette for cutouts
    figure = `<circle cx="${w / 2}" cy="${h * 0.13}" r="${w * 0.16}"/><path d="M${w * 0.22} ${h * 0.98} L${w * 0.3} ${h * 0.3} Q${w / 2} ${h * 0.24} ${w * 0.7} ${h * 0.3} L${w * 0.78} ${h * 0.98} Z"/>`;
  } else {
    const r = s * 0.16;
    const headY = h * 0.42;
    figure = `<circle cx="${cx}" cy="${headY}" r="${r}"/><path d="M${cx - r * 2.6} ${h} Q${cx - r * 2.4} ${headY + r * 1.4} ${cx} ${headY + r * 1.3} Q${cx + r * 2.4} ${headY + r * 1.4} ${cx + r * 2.6} ${h} Z"/>`;
  }
  const bg = transparent
    ? ""
    : `<defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="#0B0E16"/></radialGradient></defs><rect width="100%" height="100%" fill="#10141F"/><rect width="100%" height="100%" fill="url(#g)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg}<g fill="${c}" opacity="${transparent ? 0.9 : 0.75}">${figure}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveFiles(id, files) {
  const base = new URL(`maidens/${id}/`, ASSETS);
  const out = {};
  if (Array.isArray(files)) {
    // CardForge fragment style: ["cutout.png", "card.webp", …]; the key is the filename stem.
    for (const name of files) out[name.replace(/\.[^.]+$/, "")] = new URL(name, base).href;
  } else if (files && typeof files === "object") {
    for (const [key, path] of Object.entries(files)) out[key] = new URL(path, path.startsWith("/") ? location.origin : base).href;
  }
  return out;
}

function toMaiden(raw) {
  const files = resolveFiles(raw.id, raw.files);
  return {
    id: raw.id,
    name: raw.name,
    station: raw.station || "",
    accent: raw.accent || "#FF3E8A",
    bpm: raw.bpm || [80, 90],
    files,
    /** URL for the first of `keys` that exists, else null. */
    file(...keys) {
      for (const k of keys) if (files[k]) return files[k];
      return null;
    },
    /** URL for the first of `keys` that exists, else a placeholder shaped like the first key. */
    art(...keys) {
      return this.file(...keys) || placeholder(this, kindOf(keys[0]));
    },
  };
}

let cache = null;

/**
 * Loads the cast. Never rejects: a missing or broken manifest gives the built-in fallback cast
 * with no files, so every image comes back as a placeholder. `fromManifest` says which happened.
 */
export function loadMaidens() {
  if (!cache) {
    cache = fetch(MANIFEST, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`manifest ${r.status}`))))
      .then((m) => {
        const list = (m.maidens || []).filter((x) => x && x.id && x.name).map(toMaiden);
        if (!list.length) throw new Error("empty manifest");
        return Object.assign(list, { fromManifest: true });
      })
      .catch(() => Object.assign(FALLBACK_CAST.map(toMaiden), { fromManifest: false }));
  }
  return cache;
}

/** One Maiden by id (falls back to the first in the cast). */
export async function getMaiden(id) {
  const list = await loadMaidens();
  return list.find((m) => m.id === id) || list[0];
}

/**
 * Loads an image element for a Maiden, trying `keys` in order. If the listed file 404s or fails
 * to decode, resolves with the placeholder instead. Never rejects.
 */
export function loadImage(maiden, ...keys) {
  const url = maiden.file(...keys);
  const fallback = placeholder(maiden, kindOf(keys[0] || "card"));
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (img.src === fallback) return resolve(img);
      img.dataset.placeholder = "true";
      img.src = fallback;
    };
    if (!url) img.dataset.placeholder = "true";
    img.src = url || fallback;
  });
}

/**
 * Sets an <img> to a Maiden's art and swaps in the placeholder if the file fails to load.
 * For markup-driven pages that don't want to await.
 */
export function setImage(el, maiden, ...keys) {
  const fallback = placeholder(maiden, kindOf(keys[0] || "card"));
  el.onerror = () => {
    el.onerror = null;
    el.dataset.placeholder = "true";
    el.src = fallback;
  };
  const url = maiden.file(...keys);
  if (!url) el.dataset.placeholder = "true";
  el.src = url || fallback;
  if (!el.alt) el.alt = maiden.name;
  return el;
}
