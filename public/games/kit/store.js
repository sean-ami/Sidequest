// Namespaced localStorage ("sqm:<ns>:<key>") that never throws. If storage is blocked
// (private mode, disabled site data, sandboxed preview) it falls back to memory for the session.

const memory = new Map();
let ls = null;
try {
  const t = "sqm:__test";
  window.localStorage.setItem(t, "1");
  window.localStorage.removeItem(t);
  ls = window.localStorage;
} catch {
  ls = null;
}

export const persistent = () => ls !== null;

function rawGet(k) {
  try { if (ls) return ls.getItem(k); } catch { /* fall through */ }
  return memory.has(k) ? memory.get(k) : null;
}
function rawSet(k, v) {
  memory.set(k, v);
  try { if (ls) ls.setItem(k, v); } catch { /* quota or blocked: memory copy still holds it */ }
}
function rawDel(k) {
  memory.delete(k);
  try { if (ls) ls.removeItem(k); } catch { /* ignore */ }
}

/** store("gem-merge").get("best", 0) */
export function store(ns) {
  const key = (k) => `sqm:${ns}:${k}`;
  return {
    get(k, fallback = null) {
      const v = rawGet(key(k));
      if (v === null) return fallback;
      try { return JSON.parse(v); } catch { return fallback; }
    },
    set(k, v) { rawSet(key(k), JSON.stringify(v)); return v; },
    del(k) { rawDel(key(k)); },
    update(k, fn, fallback = null) { return this.set(k, fn(this.get(k, fallback))); },
  };
}

/** Best score helper: keeps the max (or min with lower=true). Returns true on a new record. */
export function recordBest(ns, k, value, { lower = false } = {}) {
  const s = store(ns);
  const prev = s.get(k, null);
  if (prev === null || (lower ? value < prev : value > prev)) { s.set(k, value); return true; }
  return false;
}

/**
 * Daily streaks. Call markDaily(ns, day) when today's daily is done.
 * Returns { streak, best, already } where already=true if today was already marked.
 */
export function markDaily(ns, day, result = true) {
  const s = store(ns);
  const daily = s.get("daily", {});
  const already = day in daily;
  if (!already) daily[day] = result;
  s.set("daily", daily);
  const last = s.get("streak_last", null);
  let streak = s.get("streak", 0);
  if (!already) {
    const y = new Date(Date.parse(day + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    streak = last === y ? streak + 1 : last === day ? streak : 1;
    s.set("streak", streak);
    s.set("streak_last", day);
  }
  const best = s.update("streak_best", (b) => Math.max(b || 0, streak), 0);
  return { streak, best, already };
}
