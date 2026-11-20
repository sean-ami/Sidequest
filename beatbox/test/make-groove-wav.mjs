// Writes a synthetic beatbox groove as a 16-bit WAV, used as a fake microphone in the browser test.
// Usage: node test/make-groove-wav.mjs out.wav [bpm]
import { writeFileSync } from 'node:fs';
import { renderVoice, GROOVE } from './synth-voice.mjs';

const out = process.argv[2] || 'groove.wav';
const bpm = Number(process.argv[3] || 90);
const sr = 48000, sd = 60 / bpm / 4, bars = 8;
const hits = [];
for (let b = 0; b < bars; b++) for (const [s, type] of GROOVE) hits.push({ type, time: 0.05 + (b * 16 + s) * sd });
const x = renderVoice(hits, bars * 16 * sd, sr);

const buf = Buffer.alloc(44 + x.length * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + x.length * 2, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(x.length * 2, 40);
x.forEach((v, i) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
writeFileSync(out, buf);
console.log(`wrote ${out}: ${hits.length} hits, ${(x.length / sr).toFixed(2)} s`);
