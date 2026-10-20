// Unlock registry. Rewards are things to keep (wallpapers, card backs, Focus backgrounds), and
// Maidens are what they celebrate: copy says "Briar's wallpaper is yours", never ranks anyone.
//
// Ids: wallpaper:<maiden>:phone · wallpaper:<maiden>:desktop · cardback:<maiden> · background:<maiden>
// Games unlock by id and then announce it with ui.toast / ui.results.

import { createStore } from "./store.js";
import { loadMaidens } from "./assets.js";
import { config } from "./config.js";

const store = createStore("rewards");
const extra = new Map(); // rewards a game registers itself

/** Build the catalogue from the cast. Every Maiden gets the same four reward slots. */
function catalogueFor(maidens) {
  const list = [];
  for (const m of maidens) {
    list.push(
      {
        id: `wallpaper:${m.id}:phone`,
        type: "wallpaper",
        maiden: m,
        label: `${m.name} phone wallpaper`,
        href: m.file("wallpaper_phone"),
        preview: m.art("card", "scene"),
      },
      {
        id: `wallpaper:${m.id}:desktop`,
        type: "wallpaper",
        maiden: m,
        label: `${m.name} desktop wallpaper`,
        href: m.file("wallpaper_desktop"),
        preview: m.art("scene", "card"),
      },
      { id: `cardback:${m.id}`, type: "cardback", maiden: m, label: `${m.name} card back`, accent: m.accent },
      {
        id: `background:${m.id}`,
        type: "background",
        maiden: m,
        label: `${m.station || m.name} focus background`,
        preview: m.art("scene", "card"),
      },
    );
  }
  for (const r of extra.values()) list.push(r);
  for (const r of list) {
    // a wallpaper whose file hasn't been exported yet is still unlockable; the download appears later
    if (r.type === "wallpaper") r.pending = !r.href;
  }
  return list;
}

/** Register a game-specific reward, e.g. { id: "trail:comet", type: "cosmetic", label: "Comet scarf trail" }. */
export function define(reward) {
  extra.set(reward.id, reward);
}

/** All rewards, with `unlocked` and `unlockedAt` filled in. */
export async function catalogue() {
  const owned = store.get("unlocked", {});
  return catalogueFor(await loadMaidens()).map((r) => ({
    ...r,
    unlocked: !!owned[r.id],
    unlockedAt: owned[r.id]?.at || null,
    source: owned[r.id]?.source || null,
  }));
}

export async function get(id) {
  return (await catalogue()).find((r) => r.id === id) || null;
}

export function isUnlocked(id) {
  return !!store.get("unlocked", {})[id];
}

/**
 * Unlocks a reward. Returns { reward, isNew, code }. `code` is only set when codes are enabled
 * and the reward names one (config.rewards.codes[reward.code]).
 */
export async function unlock(id, { source = "" } = {}) {
  const owned = store.get("unlocked", {});
  const isNew = !owned[id];
  if (isNew) {
    owned[id] = { at: new Date().toISOString(), source };
    store.set("unlocked", owned);
  }
  const reward = (await get(id)) || { id, label: id, unlocked: true };
  const code = config.rewards.codesEnabled && reward.code ? config.rewards.codes[reward.code] || null : null;
  return { reward, isNew, code };
}

/** Unlocked rewards, newest first. */
export async function unlocked() {
  return (await catalogue()).filter((r) => r.unlocked).sort((a, b) => (b.unlockedAt || "").localeCompare(a.unlockedAt || ""));
}

/** Maidens with at least one unlocked reward, i.e. who's in the player's collection. */
export async function collectedMaidenIds() {
  return [...new Set((await unlocked()).filter((r) => r.maiden).map((r) => r.maiden.id))];
}

export const codesEnabled = () => config.rewards.codesEnabled;
