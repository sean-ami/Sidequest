// WAV (rendered offline with the same synth) and Standard MIDI File export.

import { CLASSES } from './classify.js';
import { playDrum, KITS } from './drums.js';

export async function renderWav(pattern, bpm, { repeats = 4, kit = KITS.maiden808, sampleRate = 44100 } = {}) {
  const stepDur = 60 / bpm / 4;
  const loopDur = pattern.steps * stepDur;
  const length = Math.ceil((loopDur * repeats + 0.8) * sampleRate);
  const oc = new OfflineAudioContext(2, length, sampleRate);
  const master = oc.createGain();
  master.gain.value = 0.8;
  master.connect(oc.destination);
  for (let r = 0; r < repeats; r++) {
    for (let s = 0; s < pattern.steps; s++) {
      for (const c of CLASSES) {
        const v = pattern.tracks[c][s];
        if (v > 0) playDrum(oc, master, c, r * loopDur + s * stepDur + 0.001, v, kit);
      }
    }
  }
  return encodeWav(await oc.startRendering());
}

/** 16-bit PCM WAV from an AudioBuffer-like { numberOfChannels, sampleRate, length, getChannelData }. */
export function encodeWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, 'data');
  data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data.buffer], { type: 'audio/wav' });
}

// General MIDI drum notes on channel 10.
export const GM_NOTES = { kick: 36, snare: 38, hat: 42 };

export function buildMidi(pattern, bpm, { ppq = 480, name = 'Beatbox beat' } = {}) {
  const stepTicks = ppq / 4;
  const events = [];
  for (const c of CLASSES) {
    for (let s = 0; s < pattern.steps; s++) {
      const v = pattern.tracks[c][s];
      if (v <= 0) continue;
      const tick = s * stepTicks;
      const vel = Math.max(1, Math.min(127, Math.round(v * 127)));
      events.push({ tick, order: 1, bytes: [0x99, GM_NOTES[c], vel] });
      events.push({ tick: tick + stepTicks / 2, order: 0, bytes: [0x89, GM_NOTES[c], 0] });
    }
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track = [];
  const vlq = (n) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  const tempo = Math.round(60000000 / bpm);
  const nameBytes = Array.from(new TextEncoder().encode(name));
  track.push(0, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes);
  track.push(0, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);
  track.push(0, 0xff, 0x58, 0x04, 4, 2, 24, 8);
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  // End the track at the end of the loop so DAWs loop it cleanly.
  const endTick = pattern.steps * stepTicks;
  track.push(...vlq(Math.max(0, endTick - last)), 0xff, 0x2f, 0x00);

  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff];
  const len = track.length;
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff];
  return new Uint8Array([...header, ...trackHeader, ...track]);
}
