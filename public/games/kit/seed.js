// Seeded randomness and the UTC day clock. Daily puzzles key off the UTC date, so every player
// worldwide gets the same puzzle and it resets at 00:00 UTC.

/** 32-bit string hash (FNV-1a with a final avalanche). */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for games. Returns a function giving floats in [0, 1). */
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

/** A PRNG with helpers. `seed` is a number or a string (hashed). */
export function createRng(seed) {
  const next = mulberry32(typeof seed === "string" ? hashString(seed) : seed);
  return {
    next,
    /** Integer in [min, max] inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    /** Fisher–Yates; returns a new array. */
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** "YYYY-MM-DD" for the UTC day containing `date`. */
export function todayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Whole UTC days since 1970-01-01. Handy for rotations ("which game is featured today"). */
export function dayNumber(date = new Date()) {
  return Math.floor(date.getTime() / 86400000);
}

/** The day's seed for a game: same for everyone on the same UTC date, different per game. */
export function dailySeed(gameId, date = new Date()) {
  return hashString(`sqm:${gameId}:${todayString(date)}`);
}

/** A ready-made PRNG for today's puzzle. */
export function dailyRng(gameId, date = new Date()) {
  return createRng(dailySeed(gameId, date));
}

/** Milliseconds until the next 00:00 UTC. */
export function msUntilReset(date = new Date()) {
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return next - date.getTime();
}

/** "5h 12m" / "12m" / "48s" until the daily reset. */
export function timeUntilReset(date = new Date()) {
  const s = Math.ceil(msUntilReset(date) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}
