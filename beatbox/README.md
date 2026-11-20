# Beatbox → Beats

Beatbox into your mic and get a real drum loop back. Plain HTML + JS (no build step, no dependencies); everything runs in the browser and no audio leaves the device.

It lives outside the site's `src/` and `public/`, so `npm run build` / `deploy` ignore it. To put it live at `sidequestmaidens.com/beatbox/`, copy this folder into `public/beatbox/` (minus `test/`).

## Run it

The mic needs a secure page, and `localhost` counts:

```bash
cd beatbox
python3 -m http.server 8765   # then open http://localhost:8765
```

## Tests

```bash
node --test beatbox/test/dsp.test.mjs
```

These cover onset timing (within 8 ms), silence, both classifiers, quantizing sloppy timing, and MIDI validity, all against synthetic beatbox sounds (`test/synth-voice.mjs`). `test/make-groove-wav.mjs` writes the same groove as a WAV, which Chromium can use as a fake mic (`--use-file-for-fake-audio-capture=groove.wav`) for an end-to-end run.

## How it works

| Step | File | What happens |
|---|---|---|
| Capture | `js/audio-io.js` | AudioWorklet records raw mic audio (echo cancellation, noise suppression and AGC off, since they smear transients) and timestamps it on the AudioContext clock. |
| Detect | `js/dsp.js` → `detectOnsets` | Log spectral flux with an adaptive threshold and a loudness gate, then each hit is refined to its attack on a 64-sample envelope. |
| Describe | `js/dsp.js` → `extractFeatures` | 46 ms after each onset: 12 log band energies, spectral centroid, flatness, zero-crossing rate, and decay. Loudness-independent. |
| Classify | `js/classify.js` | Untrained: deep = kick, mostly air = hat, else snare. Trained (all 3 pads): 3-nearest-neighbours on z-scored features. Leave-one-out accuracy gives the "% distinguishable" readout. |
| Quantize | `js/pattern.js` | Subtracts output + input latency (plus the timing-offset slider), snaps to 16ths, drops count-in hits, and wraps a rushed final downbeat to step 1. Velocity is relative to the loudest hit of the same drum. |
| Play/export | `js/drums.js`, `js/exporters.js` | Synthesized 808-style kit (no sample files). WAV is rendered offline with the same synth, about 8 bars long. MIDI is a type-0 file on GM drum channel 10 (kick 36, snare 38, closed hat 42). |

Training samples are kept in `localStorage` per browser. A missing or blocked store just means re-training.

## Phase 2 ideas

- Editable step sequencer: click cells to fix or add hits (the grid is already rendered per step).
- More kits: `KITS` in `js/drums.js` is plain parameters. Add an acoustic or lo-fi entry plus a picker, or load real one-shot samples.
- Free-tempo mode: detect the BPM from the recording instead of a count-in.
- More sounds: open hat, rimshot, toms. Add a pad, a class in `CLASSES`, a synth voice and a GM note.
