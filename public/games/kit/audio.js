// Web Audio for the arcade: a station player that loops a Maiden's station_loop.mp3 gaplessly,
// a persisted master volume and mute, and short generated SFX.
//
// Nothing makes sound before the first user gesture: the AudioContext is created on the first
// pointerdown/keydown/touchend, and anything asked for earlier is started then.

import { kitStore } from "./store.js";
import { config } from "./config.js";

const SFX_BASE = new URL("../assets/sfx/", import.meta.url);

let ctx = null;
let master = null;
let stationBus = null;
let sfxBus = null;
let unlocked = false;
const pendingOnUnlock = [];
const muteListeners = new Set();

let muted = !!kitStore.get("muted", false);
let volume = clamp(kitStore.get("volume", 0.8), 0, 1);

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, Number(v) || 0));
}

function masterLevel() {
  return muted ? 0 : volume;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = masterLevel();
  master.connect(ctx.destination);
  stationBus = ctx.createGain();
  stationBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.7;
  sfxBus.connect(master);
  return ctx;
}

function onGesture() {
  if (!ctx && !build()) return;
  if (ctx.state === "suspended") ctx.resume();
  if (unlocked) return;
  unlocked = true;
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.removeEventListener(ev, onGesture, true);
  while (pendingOnUnlock.length) pendingOnUnlock.shift()();
}
for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, onGesture, true);

/** Runs `fn` now if audio is unlocked, else on the first user gesture. */
function whenUnlocked(fn) {
  if (unlocked && ctx) fn();
  else pendingOnUnlock.push(fn);
}

// ---------- master ----------

export function isMuted() {
  return muted;
}
export function setMuted(value) {
  muted = !!value;
  kitStore.set("muted", muted);
  if (master) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.03);
  muteListeners.forEach((fn) => fn(muted));
}
export function toggleMute() {
  setMuted(!muted);
  return muted;
}
/** Subscribe to mute changes (for toggles). Returns an unsubscribe function. */
export function onMuteChange(fn) {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}
export function getVolume() {
  return volume;
}
export function setVolume(value) {
  volume = clamp(value, 0, 1);
  kitStore.set("volume", volume);
  if (master) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.03);
}

// ---------- station player ----------

const buffers = new Map(); // url -> Promise<AudioBuffer|null>
let current = null; // { id, stop() }
let stationLevel = 1;

function loadBuffer(url) {
  if (!buffers.has(url)) {
    buffers.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)))
        .catch(() => null),
    );
  }
  return buffers.get(url);
}

/** Quiet procedural pad used until a Maiden's station_loop.mp3 exists. */
function startPad(maiden) {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.22, ctx.currentTime, 1.2);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.connect(out);
  out.connect(stationBus);
  // root from the id so each Maiden gets her own colour; major-ish triad with a 9th
  let h = 0;
  for (const ch of maiden.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const root = 45 + (h % 10);
  const notes = [root, root + 7, root + 16, root + 14];
  const oscs = [];
  notes.forEach((n, i) => {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.35 : 0.12;
      // slow breathing, out of phase per voice
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = g.gain.value * 0.5;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(lp);
      o.start();
      lfo.start();
      oscs.push(o, lfo);
    }
  });
  return () => {
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => oscs.forEach((o) => o.stop()), 1500);
  };
}

async function startLoop(maiden) {
  const url = maiden.file("station_loop");
  const buffer = url ? await loadBuffer(url) : null;
  if (!buffer) return { stop: startPad(maiden), fallback: true };
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  // AudioBufferSourceNode looping is sample-accurate, so a loop with a crossfaded seam is gapless.
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
  src.connect(g).connect(stationBus);
  src.start();
  return {
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      src.stop(ctx.currentTime + 1.5);
    },
    fallback: false,
  };
}

/**
 * Plays a Maiden's station (deferred until the first gesture). Switching Maidens crossfades.
 * Calling it again for the same Maiden is a no-op.
 */
export function playStation(maiden) {
  if (current && current.id === maiden.id) return;
  const token = { id: maiden.id, stop: () => {} };
  if (current) current.stop();
  current = token;
  whenUnlocked(async () => {
    if (current !== token) return;
    const handle = await startLoop(maiden);
    if (current !== token) return handle.stop();
    token.stop = handle.stop;
    token.fallback = handle.fallback;
  });
}

export function stopStation() {
  if (current) current.stop();
  current = null;
}

/** Station loudness relative to master, 0–1 (e.g. 0.4 during a Pomodoro break). */
export function setStationLevel(level, seconds = 0.6) {
  stationLevel = clamp(level, 0, 1);
  whenUnlocked(() => stationBus.gain.setTargetAtTime(stationLevel, ctx.currentTime, seconds / 3));
}

// ---------- SFX ----------

function noise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(g, t, attack, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

const GENERATED = {
  /** Bell-ish chime. `pitch` in semitones above A5 (so merge tiers can climb). */
  chime({ pitch = 0 } = {}) {
    const t = ctx.currentTime;
    const f = 880 * Math.pow(2, pitch / 12);
    for (const [mult, amp] of [[1, 0.3], [2.76, 0.08], [5.4, 0.03]]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      env(g, t, 0.005, amp, 0.9 / mult + 0.25);
      o.connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 1.3);
    }
  },
  pop() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    const g = ctx.createGain();
    env(g, t, 0.003, 0.4, 0.1);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + 0.15);
  },
  whoosh() {
    const t = ctx.currentTime;
    const n = noise(0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
    const g = ctx.createGain();
    env(g, t, 0.08, 0.35, 0.35);
    n.connect(bp).connect(g).connect(sfxBus);
    n.start(t);
  },
  /** Liquid glugs: a few quick falling blips through a resonant filter. */
  pour({ count = 4 } = {}) {
    const t0 = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const t = t0 + i * 0.07 + Math.random() * 0.02;
      const o = ctx.createOscillator();
      o.type = "sine";
      const f = 420 + Math.random() * 260;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.05);
      const g = ctx.createGain();
      env(g, t, 0.004, 0.16, 0.06);
      o.connect(g).connect(sfxBus);
      o.start(t);
      o.stop(t + 0.1);
    }
  },
  /** Low rolling rumble. */
  thunder() {
    const t = ctx.currentTime;
    const n = noise(3);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(380, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 2.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    n.connect(lp).connect(g).connect(sfxBus);
    n.start(t);
  },
};

/**
 * Plays a short effect: "chime" (opts.pitch), "pop", "whoosh", "pour", "thunder".
 * Silent until the first gesture (SFX are never queued). A file listed in config.sfxFiles wins.
 */
export function sfx(name, opts = {}) {
  if (!unlocked || !ctx || muted) return;
  const file = config.sfxFiles[name];
  if (file) {
    loadBuffer(new URL(file, SFX_BASE).href).then((buf) => {
      if (!buf) return GENERATED[name]?.(opts);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (opts.pitch) src.playbackRate.value = Math.pow(2, opts.pitch / 12);
      src.connect(sfxBus);
      src.start();
    });
    return;
  }
  GENERATED[name]?.(opts);
}

/** True once a gesture has started audio. */
export function isUnlocked() {
  return unlocked;
}
