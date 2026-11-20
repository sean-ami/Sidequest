// Synthetic "beatbox" sounds with known timings: the demo groove, and test input.
// Rough stand-ins for a mouth: kick = low thump + breath, snare = mid-band noise burst, hat = short hiss.

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
}

export function voiceHit(type, sr, seed = 1, gain = 0.6) {
  const r = rng(seed);
  const len = Math.round(sr * (type === 'kick' ? 0.18 : type === 'snare' ? 0.14 : 0.06));
  const out = new Float32Array(len);
  let lp = 0, lp2 = 0, hpPrev = 0, hpOut = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const n = r();
    let v = 0;
    if (type === 'kick') {
      const f = 55 + 90 * Math.exp(-t / 0.03);
      lp += 0.05 * (n - lp);
      v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.06) + 0.4 * lp * Math.exp(-t / 0.02);
    } else if (type === 'snare') {
      // band-pass-ish: low-pass then subtract a slower low-pass
      lp += 0.45 * (n - lp);
      lp2 += 0.06 * (lp - lp2);
      v = (lp - lp2) * 1.6 * Math.exp(-t / 0.045);
    } else {
      hpOut = 0.6 * (hpOut + n - hpPrev);
      hpPrev = n;
      v = hpOut * Math.exp(-t / 0.015);
    }
    out[i] = v * gain;
  }
  return out;
}

/** Mix hits [{ type, time }] into a buffer of `dur` seconds with a little room noise. */
export function renderVoice(hits, dur, sr, { noise = 0.002, seed = 7 } = {}) {
  const x = new Float32Array(Math.ceil(dur * sr));
  const r = rng(seed);
  for (let i = 0; i < x.length; i++) x[i] = r() * noise;
  hits.forEach((h, k) => {
    const s = voiceHit(h.type, sr, k + 11, h.gain ?? 0.6);
    const o = Math.round(h.time * sr);
    for (let i = 0; i < s.length && o + i < x.length; i++) x[o + i] += s[i];
  });
  return x;
}

/** Classic boom-bap: K . H . S . H . | K K H . S . H H  (16ths) */
export const GROOVE = [
  [0, 'kick'], [2, 'hat'], [4, 'snare'], [6, 'hat'],
  [8, 'kick'], [10, 'kick'], [12, 'snare'], [14, 'hat'], [15, 'hat'],
];
