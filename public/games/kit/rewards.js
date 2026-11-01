// Per-player rewards: in-game cosmetics and the Maiden card Collection. Nothing here is a download.
// The site never offers wallpapers at any resolution (they are Patreon-only); do not add them here.

import { store } from "./store.js";

const s = store("rewards");

/** Every cosmetic any game can unlock. Games unlock by id; the hub lists them in Collection. */
export const COSMETICS = [
  // card backs (Maiden Memory, Gem Merge)
  { id: "back-nova", kind: "card-back", name: "Nova card back", how: "3-star clear on Hard in Maiden Memory" },
  { id: "back-briar", kind: "card-back", name: "Briar card back", how: "3-star clear on Hard in Maiden Memory" },
  { id: "back-vega", kind: "card-back", name: "Vega card back", how: "3-star clear on Hard in Maiden Memory" },
  { id: "back-foil", kind: "card-back", name: "Foil shimmer", how: "3-day streak in Maiden Memory dailies" },
  // vial skins (Potion Sort)
  { id: "vial-moth-glass", kind: "vial-skin", name: "Moth-glass vials", how: "Clear level 20 in Briar's Potion Sort" },
  { id: "bg-midnight-greenhouse", kind: "background", name: "Midnight greenhouse", how: "Solve 7 Potion Sort dailies" },
  // scarf trails (Nova's Dash)
  { id: "scarf-sunrise-gold", kind: "scarf-trail", name: "Sunrise gold scarf", how: "Run 1,000 m in Nova's Dash" },
  { id: "scarf-comet", kind: "scarf-trail", name: "Comet scarf trail", how: "A chain of 20 in Nova's Dash" },
  // timer backgrounds (Focus)
  { id: "timer-golden-hour", kind: "timer-bg", name: "Golden hour", how: "7-day Focus streak" },
  { id: "station-briar", kind: "station", name: "Briar's station in Focus", how: "4 focus sessions total" },
  { id: "station-vega", kind: "station", name: "Vega's station in Focus", how: "4 focus sessions total" },
];

const byId = new Map(COSMETICS.map((c) => [c.id, c]));

export const isUnlocked = (id) => !!s.get("unlocked", {})[id];

/** Unlocks a cosmetic. Returns the cosmetic if it was newly unlocked, else null. */
export function unlock(id) {
  const u = s.get("unlocked", {});
  if (u[id] || !byId.has(id)) return null;
  u[id] = new Date().toISOString().slice(0, 10);
  s.set("unlocked", u);
  return byId.get(id);
}

export function unlocked() {
  const u = s.get("unlocked", {});
  return COSMETICS.filter((c) => u[c.id]).map((c) => ({ ...c, on: u[c.id] }));
}

/** Selected cosmetic per kind (e.g. which card back is in use). */
export const selected = (kind) => s.get(`sel:${kind}`, null);
export const select = (kind, id) => s.set(`sel:${kind}`, id);

/** Maiden cards met in games (view-only Collection). variant: "card" | "card_eyes". */
export function meet(maidenId, variant = "card", game = "") {
  const c = s.get("collection", {});
  const key = `${maidenId}:${variant}`;
  if (c[key]) return false;
  c[key] = { maiden: maidenId, variant, game, on: new Date().toISOString().slice(0, 10) };
  s.set("collection", c);
  return true;
}
export const collection = () => Object.values(s.get("collection", {}));
export const hasMet = (maidenId, variant = "card") => !!s.get("collection", {})[`${maidenId}:${variant}`];

/**
 * Discount codes: OFF and a stub only.
 * When enabled later, codes must come from a backend pool of Shopify single-use codes
 * (a table served by the Worker, handed out one per voter per day, only after a daily quest).
 * Never put a code, shared or otherwise, in page source.
 */
export const codesEnabled = false;
