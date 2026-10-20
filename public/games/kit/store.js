// Namespaced localStorage ("sqm:<game>:<key>"), JSON values, and an in-memory fallback when
// storage is blocked (private mode, disabled cookies, sandboxed iframes). Nothing here throws.

import { todayString } from "./seed.js";

const PREFIX = "sqm:";
const memory = new Map();

function probe() {
  try {
    const ls = window.localStorage;
    const k = PREFIX + "__probe";
    ls.setItem(k, "1");
    ls.removeItem(k);
    return ls;
  } catch {
    return null;
  }
}
const ls = probe();

/** False when progress will only last until the tab closes. Games can show a quiet note. */
export const persistent = ls !== null;

function rawGet(key) {
  if (ls) {
    try {
      return ls.getItem(key);
    } catch {
      /* fall through to memory */
    }
  }
  return memory.has(key) ? memory.get(key) : null;
}
function rawSet(key, value) {
  memory.set(key, value);
  if (ls) {
    try {
      ls.setItem(key, value);
    } catch {
      /* quota or blocked: memory copy still serves this session */
    }
  }
}
function rawRemove(key) {
  memory.delete(key);
  if (ls) {
    try {
      ls.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** A store scoped to one game (or "kit", "rewards"). */
export function createStore(namespace) {
  const ns = `${PREFIX}${namespace}:`;
  const store = {
    get(key, fallback = null) {
      const raw = rawGet(ns + key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        rawSet(ns + key, JSON.stringify(value));
      } catch {
        /* unserialisable value: ignore */
      }
      return value;
    },
    remove(key) {
      rawRemove(ns + key);
    },
    update(key, fn, fallback = null) {
      return store.set(key, fn(store.get(key, fallback)));
    },

    /** Saves `value` if it beats the stored best. Returns { best, isNew }. */
    best(key, value, { lower = false } = {}) {
      const prev = store.get(`best:${key}`);
      const isNew = prev == null || (lower ? value < prev : value > prev);
      if (isNew) store.set(`best:${key}`, value);
      return { best: isNew ? value : prev, isNew, previous: prev };
    },
    getBest(key) {
      return store.get(`best:${key}`);
    },

    /** Today's recorded daily result, or null. */
    getDaily(date = new Date()) {
      return store.get(`daily:${todayString(date)}`);
    },
    /**
     * Records the day's scored result once (later calls on the same day are ignored and come back
     * with scored: false) and advances the streak. Returns { result, scored, streak }.
     */
    recordDaily(result, date = new Date()) {
      const day = todayString(date);
      const existing = store.get(`daily:${day}`);
      if (existing) return { result: existing, scored: false, streak: store.getStreak(date) };
      store.set(`daily:${day}`, { ...result, day });
      const prev = store.get("streak", { count: 0, best: 0, last: null });
      const yesterday = todayString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1)));
      const count = prev.last === yesterday ? prev.count + 1 : 1;
      const streak = { count, best: Math.max(prev.best || 0, count), last: day };
      store.set("streak", streak);
      return { result: { ...result, day }, scored: true, streak };
    },
    /** Current streak; reads as 0 once a day has been missed. */
    getStreak(date = new Date()) {
      const s = store.get("streak", { count: 0, best: 0, last: null });
      const today = todayString(date);
      const yesterday = todayString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1)));
      const alive = s.last === today || s.last === yesterday;
      return { ...s, count: alive ? s.count : 0 };
    },
  };
  return store;
}

/** Kit-wide settings (mute, volume). */
export const kitStore = createStore("kit");
