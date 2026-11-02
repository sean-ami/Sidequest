// node tests/focus-timer.test.mjs : pure tests for the Focus Pomodoro state machine.
import assert from "node:assert/strict";
import * as T from "../public/games/focus/timer.js";

const S = { ...T.DEFAULT_SETTINGS };
const MIN = 60000;
let st = T.initial(S);
assert.equal(T.remainingMs(st, 0), 25 * MIN);
st = T.start(st, 0);

// 10 minutes in the background: time is from timestamps, not ticks
assert.equal(T.remainingMs(st, 10 * MIN), 15 * MIN);

// focus -> short break
let r = T.advance(st, 25 * MIN, S);
assert.deepEqual(r.events.map((e) => [e.phase, e.next]), [["focus", "short"]]);
st = r.state;
assert.equal(st.phase, "short");
assert.equal(st.endsAt, 30 * MIN);

// run three more cycles with ticks; 4th focus leads to the long break
let t = 25 * MIN;
const seen = [];
while (t < 4 * 30 * MIN) {
  t += 1000;
  const a = T.advance(st, t, S);
  st = a.state;
  seen.push(...a.events.map((e) => `${e.phase}>${e.next}`));
}
assert.deepEqual(seen, ["short>focus", "focus>short", "short>focus", "focus>short", "short>focus", "focus>long"]);
assert.equal(st.phase, "long");
assert.equal(st.cycle, 0);
assert.equal(T.durationMs("long", S), 15 * MIN);

// pause / resume keeps remaining
st = T.initial(S);
st = T.start(st, 0);
st = T.pause(st, 5 * MIN);
assert.equal(T.remainingMs(st, 999 * MIN), 20 * MIN);
st = T.start(st, 100 * MIN);
assert.equal(T.remainingMs(st, 101 * MIN), 19 * MIN);

// away long past the end: completes that phase, then waits instead of chaining
st = T.start(T.initial(S), 0);
r = T.advance(st, 3 * 60 * MIN, S);
assert.equal(r.events.length, 1);
assert.equal(r.state.running, false);
assert.equal(r.state.phase, "short");

// skip doesn't count a focus session
st = T.start(T.initial(S), 0);
st = T.skip(st, MIN, S);
assert.equal(st.phase, "short");
assert.equal(st.cycle, 0);

// auto off: stops at the next phase
st = T.start(T.initial(S), 0);
r = T.advance(st, 25 * MIN, { ...S, auto: false });
assert.equal(r.state.running, false);
assert.equal(r.state.remaining, 5 * MIN);

assert.equal(T.fmt(25 * MIN), "25:00");
assert.equal(T.fmt(61 * MIN + 2000), "1:01:02");
assert.equal(T.fmt(999), "00:01");
console.log("focus timer: all tests passed");
