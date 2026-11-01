// Seeded randomness. dailySeed(gameId) comes from the UTC date, so everyone gets the same daily puzzle.

/** mulberry32: tiny, fast, good enough for games. Returns () => float in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a hash of a string. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "YYYY-MM-DD" in UTC. */
export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Seed for a game's daily puzzle on a UTC date (defaults to today). */
export function dailySeed(gameId, day = today()) {
  return hashString(`sqm|${gameId}|${day}`);
}

/** A seeded RNG for today's daily puzzle. */
export function dailyRng(gameId, day = today()) {
  return mulberry32(dailySeed(gameId, day));
}

/** Milliseconds until the next UTC midnight. */
export function msUntilReset(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

/** "5h 12m" until reset. */
export function timeUntilReset(now = Date.now()) {
  const m = Math.ceil(msUntilReset(now) / 60000);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Fisher–Yates shuffle with a supplied rng; returns a new array. */
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
