// Snap detected hits onto a 16th-note grid.

import { CLASSES } from './classify.js';

/**
 * hits: [{ time (s, in recording), label, peak }]
 * loopStart: when the loop's first downbeat happens, in recording seconds
 * latency: seconds to subtract from each hit (output + input delay)
 * Returns { steps, stepsPerBar, tracks: { kick: Float32Array, ... }, placed: [{ hit, step }] }
 */
export function buildPattern(hits, { bpm, bars, loopStart, latency = 0, stepsPerBeat = 4, beatsPerBar = 4 }) {
  const stepsPerBar = stepsPerBeat * beatsPerBar;
  const steps = stepsPerBar * bars;
  const stepDur = 60 / bpm / stepsPerBeat;
  const tracks = Object.fromEntries(CLASSES.map((c) => [c, new Float32Array(steps)]));
  const placed = [];

  const maxPeak = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  const cands = [];
  for (const hit of hits) {
    const t = hit.time - latency - loopStart;
    let step = Math.round(t / stepDur);
    if (step < 0) continue; // count-in
    if (step > steps) continue; // after the loop
    if (step === steps) {
      // A hit right on the next downbeat: an early "one", so it wraps, unless the one is already taken.
      if (hits.some((h) => h !== hit && h.label === hit.label && Math.round((h.time - latency - loopStart) / stepDur) === 0)) continue;
      step = 0;
    }
    cands.push({ hit, step });
    if (hit.peak > maxPeak[hit.label]) maxPeak[hit.label] = hit.peak;
  }

  for (const { hit, step } of cands) {
    // Velocity is relative to the loudest hit of the same drum, so a soft hat still reads.
    const v = 0.45 + 0.55 * (hit.peak / (maxPeak[hit.label] || 1));
    const track = tracks[hit.label];
    if (v > track[step]) track[step] = Math.min(1, v);
    placed.push({ hit, step });
  }
  return { steps, stepsPerBar, bars, tracks, placed };
}

export function countHits(pattern) {
  const out = {};
  for (const c of CLASSES) out[c] = pattern.tracks[c].reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
  return out;
}
