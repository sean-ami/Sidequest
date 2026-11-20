// Synthesized drum kit. Works on a live AudioContext and an OfflineAudioContext (for WAV export).
// Kits are plain parameter objects so phase 2 can add more (acoustic, lo-fi…) without new code.

export const KITS = {
  maiden808: {
    name: 'Maiden 808',
    kick: { f0: 165, f1: 44, pitchDecay: 0.08, decay: 0.55, click: 0.5, level: 1.0 },
    snare: { tone: 190, toneDecay: 0.09, noiseDecay: 0.2, hp: 1400, toneLevel: 0.45, noiseLevel: 0.75 },
    hat: { hp: 7200, bp: 10000, decay: 0.05, level: 0.4 },
  },
};

const noiseCache = new WeakMap();
function noise(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function env(ctx, t, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

function noiseBurst(ctx, t, dur) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
  return src;
}

export function playDrum(ctx, out, type, t, vel = 1, kit = KITS.maiden808) {
  if (type === 'kick') {
    const p = kit.kick;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(p.f0, t);
    o.frequency.exponentialRampToValueAtTime(p.f1, t + p.pitchDecay);
    const g = env(ctx, t, vel * p.level, p.decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + p.decay + 0.05);
    const n = noiseBurst(ctx, t, 0.015);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    n.connect(hp).connect(env(ctx, t, vel * p.click * 0.3, 0.012)).connect(out);
  } else if (type === 'snare') {
    const p = kit.snare;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(p.tone * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(p.tone, t + 0.03);
    o.connect(env(ctx, t, vel * p.toneLevel, p.toneDecay)).connect(out);
    o.start(t);
    o.stop(t + p.toneDecay + 0.05);
    const n = noiseBurst(ctx, t, p.noiseDecay);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = p.hp;
    n.connect(hp).connect(env(ctx, t, vel * p.noiseLevel, p.noiseDecay)).connect(out);
  } else if (type === 'hat') {
    const p = kit.hat;
    const n = noiseBurst(ctx, t, p.decay);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = p.hp;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = p.bp;
    bp.Q.value = 0.8;
    n.connect(hp).connect(bp).connect(env(ctx, t, vel * p.level * 2.2, p.decay)).connect(out);
  }
}

/** Metronome tick; `accent` marks the downbeat. */
export function click(ctx, out, t, accent = false) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1175;
  o.connect(env(ctx, t, accent ? 0.35 : 0.22, 0.04)).connect(out);
  o.start(t);
  o.stop(t + 0.06);
}
