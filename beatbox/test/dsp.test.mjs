import test from 'node:test';
import assert from 'node:assert/strict';
import { detectOnsets, extractFeatures, fft } from '../js/dsp.js';
import { Classifier, heuristic, looAccuracy, CLASSES } from '../js/classify.js';
import { buildPattern } from '../js/pattern.js';
import { buildMidi } from '../js/exporters.js';
import { renderVoice, GROOVE } from './synth-voice.mjs';

const SR = 48000;

test('fft finds a pure tone', () => {
  const N = 1024, re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = Math.sin((2 * Math.PI * 50 * i) / N);
  fft(re, im);
  let best = 0;
  for (let k = 1; k < N / 2; k++) if (re[k] ** 2 + im[k] ** 2 > re[best] ** 2 + im[best] ** 2) best = k;
  assert.equal(best, 50);
});

function grooveHits(bpm, bars, offset, jitter = 0) {
  const sd = 60 / bpm / 4;
  const hits = [];
  for (let b = 0; b < bars; b++)
    for (const [s, type] of GROOVE) hits.push({ type, step: b * 16 + s, time: offset + (b * 16 + s) * sd + jitter * Math.sin(s * 7.1 + b) });
  return hits;
}

test('detects every hit within 8 ms and nothing extra', () => {
  const truth = grooveHits(100, 2, 0.5);
  const x = renderVoice(truth, 0.5 + 2 * 2.4 + 0.5, SR);
  const on = detectOnsets(x, SR);
  assert.equal(on.length, truth.length, `found ${on.length}, expected ${truth.length}`);
  on.forEach((s, i) => assert.ok(Math.abs(s / SR - truth[i].time) < 0.008, `hit ${i} off by ${((s / SR - truth[i].time) * 1000).toFixed(1)} ms`));
});

test('silence gives no hits', () => {
  assert.deepEqual(detectOnsets(renderVoice([], 2, SR, { noise: 0.001 }), SR), []);
});

test('built-in heuristic labels synthetic kick/snare/hat', () => {
  const truth = grooveHits(90, 1, 0.3);
  const x = renderVoice(truth, 3.5, SR);
  const on = detectOnsets(x, SR);
  const labels = on.map((s) => heuristic(extractFeatures(x, SR, s)));
  assert.deepEqual(labels, truth.map((h) => h.type));
});

test('trained kNN classifies, and quiet hits still land', () => {
  const samples = {};
  for (const c of CLASSES) {
    const hits = [0, 1, 2, 3, 4].map((i) => ({ type: c, time: 0.2 + i * 0.4, gain: 0.3 + 0.1 * i }));
    const x = renderVoice(hits, 2.5, SR, { seed: 3 });
    samples[c] = detectOnsets(x, SR).map((s) => Array.from(extractFeatures(x, SR, s).vec));
    assert.equal(samples[c].length, 5);
  }
  assert.ok(looAccuracy(samples) >= 0.9);
  const clf = new Classifier(samples);
  const truth = grooveHits(90, 1, 0.3).map((h, i) => ({ ...h, gain: i % 2 ? 0.25 : 0.7 }));
  const x = renderVoice(truth, 3.5, SR, { seed: 99 });
  const labels = detectOnsets(x, SR).map((s) => clf.classify(extractFeatures(x, SR, s)).label);
  assert.deepEqual(labels, truth.map((h) => h.type));
});

test('quantizes sloppy timing back onto the grid', () => {
  const bpm = 95, loopStart = 1.0, latency = 0.03;
  // Human timing: up to ±25 ms, plus the system latency.
  const truth = grooveHits(bpm, 2, loopStart + latency, 0.025);
  const hits = truth.map((h) => ({ time: h.time, label: h.type, peak: 0.5 }));
  hits.push({ time: loopStart - 0.5, label: 'kick', peak: 0.5 }); // count-in noise
  const p = buildPattern(hits, { bpm, bars: 2, loopStart, latency });
  assert.equal(p.steps, 32);
  for (const h of truth) assert.ok(p.tracks[h.type][h.step] > 0, `${h.type} missing at step ${h.step}`);
  const total = CLASSES.reduce((n, c) => n + p.tracks[c].filter((v) => v > 0).length, 0);
  assert.equal(total, truth.length);
});

test('a rushed downbeat at the very end wraps to step 0', () => {
  const p = buildPattern([{ time: 2.0 + 1.95, label: 'kick', peak: 1 }], { bpm: 120, bars: 2, loopStart: 0 + 0, latency: 0 });
  // loop = 2 bars at 120 = 4 s; 3.95 s rounds to step 32 -> wraps.
  assert.equal(p.tracks.kick[0] > 0, true);
});

test('MIDI file is well formed', () => {
  const p = buildPattern(grooveHits(90, 1, 0).map((h) => ({ time: h.time, label: h.type, peak: 1 })), { bpm: 90, bars: 1, loopStart: 0 });
  const m = buildMidi(p, 90);
  assert.equal(String.fromCharCode(...m.slice(0, 4)), 'MThd');
  assert.equal(String.fromCharCode(...m.slice(14, 18)), 'MTrk');
  const len = (m[18] << 24) | (m[19] << 16) | (m[20] << 8) | m[21];
  assert.equal(m.length, 22 + len);
  assert.deepEqual([...m.slice(-3)], [0xff, 0x2f, 0x00]);
  const noteOns = [...m].filter((b, i) => b === 0x99 && i > 22).length;
  assert.equal(noteOns, GROOVE.length);
});
