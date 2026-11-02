// Pomodoro state machine. Pure: every function takes `now` (ms) and returns new state, so the UI,
// the Node test and background catch-up all share one source of truth. Timing is by timestamps
// (endsAt), never by counting intervals, so it stays right in background tabs and after sleep.

export const PHASES = { focus: "Focus", short: "Break", long: "Long break" };

export const DEFAULT_SETTINGS = {
  focus: 25, // minutes
  short: 5,
  long: 15,
  every: 4, // long break after this many focus sessions
  auto: true, // start the next phase automatically
};

/** If a phase ended more than this long ago (tab asleep, laptop closed), don't chain into more. */
export const AWAY_MS = 2 * 60 * 1000;

export const durationMs = (phase, s) => Math.max(1, Number(s[phase]) || DEFAULT_SETTINGS[phase]) * 60000;

export function initial(settings = DEFAULT_SETTINGS) {
  return { id: 0, phase: "focus", running: false, endsAt: null, remaining: durationMs("focus", settings), cycle: 0 };
}

export function remainingMs(st, now) {
  return st.running ? Math.max(0, st.endsAt - now) : st.remaining;
}

export function start(st, now) {
  if (st.running) return st;
  return { ...st, id: st.id + 1, running: true, endsAt: now + st.remaining };
}

export function pause(st, now) {
  if (!st.running) return st;
  return { ...st, id: st.id + 1, running: false, remaining: Math.max(0, st.endsAt - now), endsAt: null };
}

/** Reset the current phase to its full length (paused). */
export function reset(st, settings) {
  return { ...st, id: st.id + 1, running: false, endsAt: null, remaining: durationMs(st.phase, settings) };
}

/** Phase that follows `st.phase`, and the cycle count after it. Skipping focus doesn't count it. */
function nextPhase(st, settings, completedFocus) {
  if (st.phase !== "focus") return { phase: "focus", cycle: st.cycle };
  if (!completedFocus) return { phase: "short", cycle: st.cycle };
  const cycle = st.cycle + 1;
  return cycle >= settings.every ? { phase: "long", cycle: 0 } : { phase: "short", cycle };
}

/** Skip to the next phase now. A skipped focus session doesn't count. */
export function skip(st, now, settings) {
  const n = nextPhase(st, settings, false);
  const dur = durationMs(n.phase, settings);
  const run = st.running || settings.auto;
  return { ...st, id: st.id + 1, phase: n.phase, cycle: n.cycle, running: run, endsAt: run ? now + dur : null, remaining: dur };
}

/**
 * Advances through every phase that has ended by `now`.
 * Returns { state, events: [{ type: "complete", phase, at, next }] }.
 * A focus "complete" event is one finished session, dated by its own end time.
 */
export function advance(st, now, settings) {
  const events = [];
  let s = st;
  let guard = 0;
  while (s.running && now >= s.endsAt && guard++ < 50) {
    const endedAt = s.endsAt;
    const n = nextPhase(s, settings, true);
    const dur = durationMs(n.phase, settings);
    events.push({ type: "complete", phase: s.phase, at: endedAt, next: n.phase });
    // Chain only if auto-start is on and the player wasn't away long past the end.
    const chain = settings.auto && now - endedAt < AWAY_MS;
    s = { ...s, id: s.id + 1, phase: n.phase, cycle: n.cycle, running: chain, endsAt: chain ? endedAt + dur : null, remaining: dur };
  }
  return { state: s, events };
}

/** "18:42" (or "1:02:03" past an hour). */
export function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? `${h}:` : "") + `${mm.padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
