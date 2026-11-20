// Turns a hit's features into kick / snare / hat.
// Untrained: simple spectral rules. Trained: k-nearest-neighbours on the user's own sounds.

export const CLASSES = ['kick', 'snare', 'hat'];

/** Built-in guess: deep and boomy = kick, bright and hissy = hat, everything between = snare. */
export function heuristic(f) {
  if (f.low > 0.3 || f.centroid < 700) return 'kick';
  // A "psh" snare is bright too, so a hat has to be mostly air: most of its energy above 5 kHz.
  if (f.high > 0.6 || (f.centroid > 7000 && f.low < 0.1)) return 'hat';
  return 'snare';
}

export class Classifier {
  /** samples: { kick: number[][], snare: number[][], hat: number[][] } */
  constructor(samples) {
    this.ready = CLASSES.every((c) => (samples[c] || []).length >= 2);
    if (!this.ready) return;
    const all = CLASSES.flatMap((c) => samples[c]);
    const d = all[0].length;
    this.mean = new Float64Array(d);
    this.std = new Float64Array(d);
    for (const v of all) for (let i = 0; i < d; i++) this.mean[i] += v[i] / all.length;
    for (const v of all) for (let i = 0; i < d; i++) this.std[i] += (v[i] - this.mean[i]) ** 2 / all.length;
    for (let i = 0; i < d; i++) this.std[i] = Math.max(Math.sqrt(this.std[i]), 0.05);
    this.points = CLASSES.flatMap((c) => samples[c].map((v) => ({ c, z: this.norm(v) })));
  }

  norm(v) {
    const z = new Float64Array(v.length);
    for (let i = 0; i < v.length; i++) z[i] = (v[i] - this.mean[i]) / this.std[i];
    return z;
  }

  /** feat: output of extractFeatures. Returns { label, confidence, method }. */
  classify(feat) {
    if (!this.ready) return { label: heuristic(feat), confidence: null, method: 'heuristic' };
    const z = this.norm(feat.vec);
    const ds = this.points.map((p) => {
      let s = 0;
      for (let i = 0; i < z.length; i++) s += (z[i] - p.z[i]) ** 2;
      return { c: p.c, d: Math.sqrt(s) };
    });
    ds.sort((a, b) => a.d - b.d);
    const votes = { kick: 0, snare: 0, hat: 0 };
    let total = 0;
    for (const { c, d } of ds.slice(0, Math.min(3, ds.length))) {
      const w = 1 / (d + 1e-3);
      votes[c] += w;
      total += w;
    }
    const label = CLASSES.reduce((a, b) => (votes[b] > votes[a] ? b : a));
    return { label, confidence: votes[label] / total, method: 'trained' };
  }
}

/** Leave-one-out accuracy: how reliably the trained sounds can be told apart (0..1), or null. */
export function looAccuracy(samples) {
  if (!CLASSES.every((c) => (samples[c] || []).length >= 3)) return null;
  let right = 0, n = 0;
  for (const c of CLASSES) {
    for (let i = 0; i < samples[c].length; i++) {
      const rest = { ...samples, [c]: samples[c].filter((_, j) => j !== i) };
      const clf = new Classifier(rest);
      if (clf.classify({ vec: samples[c][i] }).label === c) right++;
      n++;
    }
  }
  return right / n;
}
