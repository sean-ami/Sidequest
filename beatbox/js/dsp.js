// Pure DSP: FFT, onset detection and per-hit features. No browser APIs, so it runs in Node tests too.

const hannCache = new Map();
function hann(N) {
  let w = hannCache.get(N);
  if (!w) {
    w = new Float64Array(N);
    for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    hannCache.set(N, w);
  }
  return w;
}

/** In-place iterative radix-2 FFT. re/im lengths must be the same power of two. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Find the sample index where each percussive hit starts.
 * Log-compressed spectral flux with an adaptive threshold, gated by loudness,
 * then refined to the attack on a 64-sample envelope.
 * sensitivity: 0 (only loud, clear hits) .. 1 (catch everything).
 */
export function detectOnsets(x, sr, { sensitivity = 0.6 } = {}) {
  const N = 1024, hop = 256, w = hann(N);
  const nFrames = x.length >= N ? Math.floor((x.length - N) / hop) + 1 : 0;
  if (nFrames < 3) return [];
  const maxBin = Math.min(N / 2, Math.round((16000 / sr) * N));
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float64Array(maxBin), cur = new Float64Array(maxBin);
  const flux = new Float64Array(nFrames), rms = new Float64Array(nFrames);

  for (let f = 0; f < nFrames; f++) {
    const off = f * hop;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = x[off + i];
      re[i] = v * w[i];
      im[i] = 0;
      e += v * v;
    }
    rms[f] = Math.sqrt(e / N);
    fft(re, im);
    let fl = 0;
    for (let k = 1; k < maxBin; k++) {
      const m = Math.log1p(10 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
      cur[k] = m;
      const d = m - prev[k];
      if (d > 0) fl += d;
    }
    flux[f] = f === 0 ? 0 : fl;
    const t = prev; prev = cur; cur = t;
  }

  let maxFlux = 0, maxRms = 0;
  for (let f = 0; f < nFrames; f++) {
    if (flux[f] > maxFlux) maxFlux = flux[f];
    if (rms[f] > maxRms) maxRms = rms[f];
  }
  // Silence (or a muted mic): nothing to find.
  if (maxRms < 0.003 || maxFlux === 0) return [];
  for (let f = 0; f < nFrames; f++) flux[f] /= maxFlux;

  const s = Math.min(1, Math.max(0, sensitivity));
  const gate = Math.max(0.002, maxRms * (0.03 + (1 - s) * 0.14));
  const delta = 0.015 + (1 - s) * 0.1;
  const W = 12;

  const est = [];
  for (let f = 1; f < nFrames; f++) {
    const v = flux[f];
    if (v <= delta) continue;
    let isPeak = true;
    for (let j = Math.max(0, f - 3); j <= Math.min(nFrames - 1, f + 3); j++) {
      if (j < f ? flux[j] >= v : flux[j] > v) { isPeak = false; break; }
    }
    if (!isPeak) continue;
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, f - W); j <= Math.min(nFrames - 1, f + W); j++) { sum += flux[j]; cnt++; }
    if (v < delta + sum / cnt) continue;
    let loud = 0;
    for (let j = f; j <= Math.min(nFrames - 1, f + 4); j++) if (rms[j] > loud) loud = rms[j];
    if (loud < gate) continue;
    est.push(f * hop + N / 2);
  }

  const minGap = Math.round(0.05 * sr);
  const out = [];
  for (const e of est) {
    const s0 = refineOnset(x, e);
    if (out.length && s0 - out[out.length - 1] < minGap) continue;
    out.push(s0);
  }
  return out;
}

/** Walk back from the loudest 64-sample block near `est` to where the attack begins. */
function refineOnset(x, est) {
  const B = 64;
  const lo = Math.max(0, est - 768);
  const hi = Math.min(x.length, est + 768);
  const nb = Math.floor((hi - lo) / B);
  if (nb < 2) return est;
  const env = new Float64Array(nb);
  let p = 0;
  for (let b = 0; b < nb; b++) {
    let m = 0;
    const o = lo + b * B;
    for (let i = 0; i < B; i++) { const a = Math.abs(x[o + i]); if (a > m) m = a; }
    env[b] = m;
    if (m > env[p]) p = b;
  }
  const thr = 0.2 * env[p];
  let b = p;
  while (b > 0 && env[b - 1] >= thr) b--;
  return lo + b * B;
}

// Band edges (Hz) for the spectral-shape part of the feature vector.
const BANDS = [40, 90, 160, 250, 400, 650, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
export const FEATURE_VERSION = 1;
export const FEATURE_SIZE = BANDS.length - 1 + 4;

/**
 * Describe one hit starting at sample `s`. Loudness-independent, so a quiet kick
 * and a loud kick land in the same place.
 * Returns { vec, centroid (Hz), low (share <250 Hz), high (share >5 kHz), peak }.
 */
export function extractFeatures(x, sr, s) {
  const N = 2048;
  const re = new Float64Array(N), im = new Float64Array(N);
  const fadeIn = 32, fadeOutStart = Math.floor(N * 0.75);
  let peak = 0, e1 = 0, e2 = 0, zc = 0, last = 0;
  for (let i = 0; i < N; i++) {
    const v = s + i < x.length ? x[s + i] : 0;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (i < N / 2) e1 += v * v; else e2 += v * v;
    if (i < 1024 && i > 0 && (v >= 0) !== (last >= 0)) zc++;
    last = v;
    let g = 1;
    if (i < fadeIn) g = i / fadeIn;
    else if (i >= fadeOutStart) g = 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeOutStart)) / (N - fadeOutStart));
    re[i] = v * g;
  }
  fft(re, im);

  const binHz = sr / N;
  const top = Math.min(N / 2, Math.floor(16000 / binHz));
  let total = 1e-12, cen = 0, low = 0, high = 0, logSum = 0;
  const bandE = new Float64Array(BANDS.length - 1);
  for (let k = 1; k < top; k++) {
    const P = re[k] * re[k] + im[k] * im[k];
    const hz = k * binHz;
    total += P;
    cen += hz * P;
    logSum += Math.log(P + 1e-12);
    if (hz < 250) low += P;
    if (hz > 5000) high += P;
    for (let b = 0; b < bandE.length; b++) {
      if (hz >= BANDS[b] && hz < BANDS[b + 1]) { bandE[b] += P; break; }
    }
  }
  const centroid = cen / total;
  const nb = top - 1;
  const flatness = Math.exp(logSum / nb) / (total / nb);

  const vec = new Float64Array(FEATURE_SIZE);
  for (let b = 0; b < bandE.length; b++) vec[b] = 10 * Math.log10(bandE[b] / total + 1e-6) / 10;
  let i = bandE.length;
  vec[i++] = Math.log2(Math.max(centroid, 20)) - 10; // ~ -5 .. 4
  vec[i++] = Math.log10(flatness + 1e-6);
  vec[i++] = (zc / 1024) * 10;
  vec[i++] = Math.log10((e2 + 1e-9) / (e1 + 1e-9));

  return { vec, centroid, low: low / total, high: high / total, peak };
}
