// Web Audio station player + tiny SFX. Nothing plays until the first user gesture.
// Mute is persisted (sqm:audio:muted) and shared by every game.

import { Ambience } from "./ambience.js";
import { loadJSON } from "./assets.js";
import { store } from "./store.js";

const prefs = store("audio");
let ctx = null;
let master = null;
let musicGain = null;
let current = null; // { src, buffer, node }
let wanted = null; // { src, music } requested before the gesture
let ambience = null; // procedural fallback when there is no station_loop.mp3
const buffers = new Map();
const listeners = new Set();

export const isMuted = () => prefs.get("muted", false);
export const getVolume = () => prefs.get("volume", 0.7);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = isMuted() ? 0 : getVolume();
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.8;
  musicGain.connect(master);
  return ctx;
}

let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  ensure();
  ctx?.resume?.();
  if (wanted) playStation(wanted.src, wanted.music);
}
// Arm unlock on the first real gesture only (never autoplay).
for (const ev of ["pointerdown", "keydown", "touchend"]) {
  window.addEventListener(ev, unlock, { once: true, capture: true, passive: true });
}

export function onMuteChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setMuted(m) {
  prefs.set("muted", !!m);
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : getVolume(), ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn(!!m));
}
export const toggleMute = () => setMuted(!isMuted());

export function setVolume(v) {
  v = Math.max(0, Math.min(1, v));
  prefs.set("volume", v);
  if (master && ctx && !isMuted()) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

/** Music level relative to master, e.g. 0.4 during a focus break. */
export function setMusicLevel(v) {
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
}

async function load(src) {
  if (buffers.has(src)) return buffers.get(src);
  const p = fetch(src)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
    .then((b) => ctx.decodeAudioData(b));
  buffers.set(src, p);
  return p;
}

/**
 * Loop a station gaplessly (AudioBufferSourceNode.loop, no <audio> gap). Safe to call before the
 * first gesture: it starts once the player interacts. If the file is missing or fails, and `music`
 * (the manifest's { bpm, key, mood }) is given, the procedural ambience plays instead.
 * Accepts a Maiden record too: playStation(maiden).
 */
export async function playStation(src, music = null) {
  if (src && typeof src === "object") {
    music = src.music || null;
    src = src.files?.station_loop || null;
  }
  const key = src || (music ? `ambience:${JSON.stringify(music)}` : null);
  wanted = { src, music, key };
  if (!unlocked || !ensure() || !key) return;
  if (current?.key === key) return;
  stopStation();
  const req = wanted;
  if (src) {
    try {
      const buffer = await load(src);
      if (wanted !== req) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
      node.connect(g).connect(musicGain);
      node.start();
      current = { key, node, g };
      return;
    } catch {
      if (wanted !== req) return;
    }
  }
  if (music) {
    ambience ||= new Ambience(ctx, musicGain);
    ambience.play(music);
    current = { key, ambience: true };
  } else {
    current = null; // no station audio yet: the game runs silent
  }
}

export function stopStation() {
  if (!current || !ctx) return;
  if (current.ambience) ambience?.stop();
  else {
    const { node, g } = current;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => { try { node.stop(); } catch { /* already stopped */ } }, 800);
  }
  current = null;
}

/** True once the first gesture has unlocked audio. */
export const isUnlocked = () => unlocked;

/**
 * Plays games/assets/sfx/<name>.mp3 when the manifest lists it ("sfx": ["chime", ...]),
 * else a generated tone. Listing files avoids probing for ones that don't exist.
 */
const fileSfx = new Map();
let sfxList = null;
export async function sfx(name, { pitch = 1, gain = 0.5 } = {}) {
  if (!unlocked || !ensure()) return;
  sfxList ||= loadJSON("assets/manifest.json").then((j) => new Set(j?.sfx || []));
  let buf = null;
  if ((await sfxList).has(name)) {
    const url = new URL(`../assets/sfx/${name}.mp3`, import.meta.url).href;
    if (!fileSfx.has(url)) fileSfx.set(url, load(url).catch(() => null));
    buf = await fileSfx.get(url);
  }
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(master);
  if (buf) {
    const n = ctx.createBufferSource();
    n.buffer = buf;
    n.playbackRate.value = pitch;
    n.connect(out);
    n.start();
    return;
  }
  (SYNTH[name] || SYNTH.pop)(out, pitch);
}

const t0 = () => ctx.currentTime;
function tone(out, { type = "sine", f0, f1 = f0, dur = 0.2, attack = 0.005 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0());
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0() + dur);
  g.gain.setValueAtTime(0, t0());
  g.gain.linearRampToValueAtTime(1, t0() + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0() + dur);
  o.connect(g).connect(out);
  o.start();
  o.stop(t0() + dur + 0.02);
}
function noise(out, { dur = 0.5, from = 800, to = 200, q = 1 }) {
  const len = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = ctx.createBufferSource();
  n.buffer = b;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0());
  f.frequency.exponentialRampToValueAtTime(to, t0() + dur);
  n.connect(f).connect(out);
  n.start();
}
const SYNTH = {
  chime: (o, p) => { tone(o, { f0: 880 * p, dur: 0.6 }); tone(o, { f0: 1320 * p, dur: 0.5 }); },
  pop: (o, p) => tone(o, { f0: 600 * p, f1: 180 * p, dur: 0.09 }),
  whoosh: (o, p) => noise(o, { dur: 0.35, from: 400 * p, to: 3000 * p, q: 0.7 }),
  pour: (o, p) => noise(o, { dur: 0.6, from: 900 * p, to: 500 * p, q: 3 }),
  thunder: (o) => noise(o, { dur: 2.2, from: 180, to: 40, q: 0.5 }),
};
