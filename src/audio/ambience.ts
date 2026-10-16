// A tiny procedural lo-fi engine for the site: pads, sparse keys, soft drums, vinyl and rain,
// in each station's key and tempo. Not the channel's music engine, just a taste of each station.

import type { Maiden } from "../data/maidens";

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 3, 5, 7, 8, 10], // chords borrow natural minor; melody uses the pentatonic subset
};
const PENTA = [0, 3, 5, 7, 10];
const PROGRESSION = [0, 5, 1, 4];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx: AudioContext, seconds: number, kind: "white" | "pink" | "crackle") {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else if (kind === "pink") {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    } else d[i] = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.8 : w * 0.004;
  }
  return buf;
}

export class Ambience {
  private ctx: AudioContext;
  private master: GainNode;
  private bus: GainNode | null = null;
  private timer: number | null = null;
  private maiden: Maiden | null = null;
  private step = 0;
  private nextTime = 0;
  private white: AudioBuffer;
  private pink: AudioBuffer;
  private crackle: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(comp).connect(this.ctx.destination);
    this.white = noiseBuffer(this.ctx, 2, "white");
    this.pink = noiseBuffer(this.ctx, 4, "pink");
    this.crackle = noiseBuffer(this.ctx, 3, "crackle");
  }

  async play(m: Maiden) {
    await this.ctx.resume();
    if (this.maiden?.slug === m.slug && this.bus) return;
    this.fadeOutBus();
    this.maiden = m;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0, this.ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);
    bus.connect(this.master);
    this.bus = bus;
    this.loop(this.crackle, 0.5, 3000, "highpass");
    if (m.mood === "rain" || m.mood === "moon") this.loop(this.pink, m.mood === "rain" ? 1.1 : 0.35, 2600, "lowpass");
    if (m.mood === "dust") this.loop(this.pink, 0.25, 600, "bandpass");
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 30);
  }

  stop() {
    this.fadeOutBus();
    this.maiden = null;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  thunder() {
    if (!this.bus) return;
    const t = this.ctx.currentTime + 0.4 + Math.random() * 0.6;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pink;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(60, t + 3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(2.2, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
    src.connect(lp).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5, 3.6);
  }

  pop() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
    this.ctx.resume();
  }

  private fadeOutBus() {
    if (!this.bus) return;
    const old = this.bus;
    const t = this.ctx.currentTime;
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + 1.2);
    window.setTimeout(() => old.disconnect(), 1400);
    this.bus = null;
  }

  private loop(buf: AudioBuffer, gain: number, freq: number, type: BiquadFilterType) {
    if (!this.bus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.bus);
    src.start();
  }

  // 16th-note step sequencer with lookahead scheduling.
  private schedule() {
    const m = this.maiden;
    if (!m || !this.bus) return;
    const bpm = (m.bpm[0] + m.bpm[1]) / 2;
    const sixteenth = 60 / bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const s = this.step % 16;
      const swing = s % 2 === 1 ? sixteenth * 0.18 : 0;
      this.tick(m, this.step, this.nextTime + swing, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private tick(m: Maiden, step: number, t: number, sixteenth: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const scale = SCALES[m.key.mode];
    const degree = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
    const drums = m.mood !== "stars" && m.mood !== "moon";

    if (s === 0 && bar % 2 === 0) {
      const chord = [0, 2, 4, 6].map((i) => {
        const idx = degree + i;
        return m.key.root + scale[idx % 7] + 12 * Math.floor(idx / 7);
      });
      chord.forEach((n) => this.pad(mtof(n), t, sixteenth * 32, m.mood === "pixel" ? "square" : "triangle"));
      this.pad(mtof(chord[0] - 12), t, sixteenth * 32, "sine", 0.22);
    }

    if (drums) {
      if (s === 0 || s === 10) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.05 : 0.025);
    }

    // sparse melody: each 8th has a chance, more often in brighter moods
    const density = m.mood === "sun" || m.mood === "city" || m.mood === "pixel" ? 0.35 : 0.18;
    if (s % 2 === 0 && Math.random() < density) {
      const pool = m.key.mode === "pentatonic" ? PENTA : scale;
      const n = m.key.root + 24 + pool[Math.floor(Math.random() * pool.length)];
      this.pluck(mtof(n), t, m.mood === "pixel" ? "square" : "sine");
    }
  }

  private pad(freq: number, t: number, dur: number, type: OscillatorType, vol = 0.07) {
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.8);
    g.gain.setValueAtTime(vol, t + dur - 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(g).connect(this.bus!);
    for (const detune of [-7, 7]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private pluck(freq: number, t: number, type: OscillatorType) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(type === "square" ? 0.025 : 0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + 1.2);
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + 0.4);
  }

  private snare(t: number) {
    this.noiseHit(t, 0.12, 1800, "bandpass", 0.18);
  }

  private hat(t: number, vol: number) {
    this.noiseHit(t, 0.04, 7000, "highpass", vol);
  }

  private noiseHit(t: number, dur: number, freq: number, type: BiquadFilterType, vol: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.white;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.bus!);
    src.start(t, Math.random(), dur + 0.02);
  }
}
