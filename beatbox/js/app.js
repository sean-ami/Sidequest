import { detectOnsets, extractFeatures, FEATURE_VERSION } from './dsp.js';
import { Classifier, CLASSES, looAccuracy } from './classify.js';
import { buildPattern, countHits } from './pattern.js';
import { playDrum, click } from './drums.js';
import { renderWav, buildMidi, makeZip } from './exporters.js';
import { Mic } from './audio-io.js';
import { renderVoice, GROOVE } from './synth-voice.js';

const $ = (s) => document.querySelector(s);
const COLORS = { kick: '#ff3e8a', snare: '#3dd6c8', hat: '#ffc857' };
const NAMES = { kick: 'kick', snare: 'snare', hat: 'hi-hat' };
const STORE_KEY = 'beatbox2beats.samples';
const TEACH_SECONDS = 4;

const state = {
  ctx: null,
  mic: null,
  player: null,
  samples: loadSamples(),
  classifier: null,
  busy: false,
  bpm: 90,
  bars: 2,
  sens: 0.6,
  offsetMs: 0,
  rec: null,
  analysis: null,
};

// ---------- storage (per-browser convenience; works without it) ----------
function loadSamples() {
  try {
    const o = JSON.parse(localStorage.getItem(STORE_KEY));
    if (o && o.v === FEATURE_VERSION && o.samples) return { kick: [], snare: [], hat: [], ...o.samples };
  } catch {}
  return { kick: [], snare: [], hat: [] };
}
function saveSamples() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: FEATURE_VERSION, samples: state.samples })); } catch {}
}

// ---------- audio setup ----------
async function ensureCtx() {
  if (!state.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    state.ctx = new AC({ latencyHint: 'interactive' });
    state.mic = new Mic(state.ctx);
    state.player = new LoopPlayer(state.ctx);
  }
  await state.ctx.resume();
}

async function ensureAudio() {
  await ensureCtx();
  await state.mic.open();
  hideAlert();
}

function micError(e) {
  const name = e?.name || '';
  let msg = 'Could not open the microphone.';
  if (name === 'NotAllowedError' || name === 'SecurityError') msg = 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.';
  else if (name === 'NotFoundError') msg = 'No microphone found. Plug one in or check your input device.';
  else if (name === 'InsecureContext') msg = 'Microphone access needs a secure page (https or localhost).';
  if (inClaude) msg = 'The mic isn’t available inside the Claude app. Try “Hear a demo groove”, or open the app in a regular browser to record.';
  showAlert(msg);
  console.error(e);
}

// Inside the Claude app the page can't use the mic and may only save certain file types.
const inClaude = typeof window.claude?.use === 'function';
function showAlert(msg) { const a = $('#alert'); a.textContent = msg; a.hidden = false; }
function hideAlert() { $('#alert').hidden = true; }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function latencyEstimate() {
  const ctx = state.ctx;
  return (ctx.outputLatency || ctx.baseLatency || 0) + (state.mic.inputLatency || 0);
}

// ---------- step 1: teach ----------
function refreshTeach() {
  state.classifier = new Classifier(state.samples);
  let trained = 0;
  document.querySelectorAll('.pad').forEach((pad) => {
    const n = state.samples[pad.dataset.class].length;
    if (n) trained++;
    pad.classList.toggle('trained', n > 0);
    pad.querySelector('.count').textContent = n ? `✓ ${n} samples` : 'not trained';
  });
  const st = $('#teachStatus');
  st.className = 'status';
  $('#resetTeach').hidden = trained === 0;
  if (state.classifier.ready) {
    const acc = looAccuracy(state.samples);
    if (acc === null) {
      st.textContent = 'Trained on your sounds.';
      st.classList.add('good');
    } else if (acc >= 0.8) {
      st.textContent = `Trained. Your three sounds are ${Math.round(acc * 100)}% distinguishable.`;
      st.classList.add('good');
    } else {
      st.textContent = `Trained, but only ${Math.round(acc * 100)}% distinguishable. Try a deeper kick, a sharper hat, and re-teach the pad that's off.`;
      st.classList.add('warn');
    }
  } else if (trained) {
    st.textContent = `${trained}/3 trained. Teach all three pads to switch on your custom sound model.`;
  } else {
    st.textContent = 'Not trained yet. Built-in guesses are in use.';
  }
}

async function teach(pad) {
  if (state.busy) return;
  try { await ensureAudio(); } catch (e) { return micError(e); }
  const cls = pad.dataset.class;
  state.busy = true;
  setBusyUI(true);
  pad.classList.add('live');
  const st = $('#teachStatus');
  st.className = 'status';
  st.textContent = `Go! Do your ${NAMES[cls]} sound 4–6 times…`;
  const bar = pad.querySelector('.bar i');
  state.mic.start();
  const t0 = performance.now();
  let raf;
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / (TEACH_SECONDS * 1000));
    bar.style.width = `${p * 100}%`;
    pad.classList.toggle('flash', state.mic.level() > 0.15);
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  tick();
  await wait(TEACH_SECONDS * 1000);
  cancelAnimationFrame(raf);
  const rec = await state.mic.stop();
  pad.classList.remove('live', 'flash');
  bar.style.width = '0';

  const feats = detectOnsets(rec.data, rec.sr, { sensitivity: 0.6 })
    .map((s) => extractFeatures(rec.data, rec.sr, s))
    .sort((a, b) => b.peak - a.peak)
    .slice(0, 8);
  state.busy = false;
  setBusyUI(false);
  if (feats.length < 2) {
    refreshTeach();
    st.className = 'status warn';
    st.textContent = feats.length ? 'Only heard one. Try again and do it a few more times.' : 'Didn’t hear anything. Get a bit closer to the mic and try again.';
    return;
  }
  state.samples[cls] = feats.map((f) => Array.from(f.vec, (v) => Math.round(v * 1e4) / 1e4));
  saveSamples();
  refreshTeach();
  if (state.rec) analyze();
}

// ---------- step 2: record ----------
function buildBeatDots(n) {
  const el = $('#beatDots');
  el.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    if (i % 4 === 0) d.classList.add('down');
    el.appendChild(d);
  }
}

async function record() {
  if (state.busy) return;
  try { await ensureAudio(); } catch (e) { return micError(e); }
  state.player.stop();
  updatePlayBtn();
  state.busy = true;
  setBusyUI(true);
  const btn = $('#recBtn');
  btn.classList.add('recording');
  btn.lastChild.textContent = 'Recording…';

  const ctx = state.ctx;
  const { bpm, bars } = state;
  const spb = 60 / bpm;
  const totalBeats = bars * 4;
  const clickOut = ctx.destination;
  state.mic.start();
  const t0 = ctx.currentTime + 0.3;
  const loopStart = t0 + 4 * spb;
  const loopEnd = loopStart + totalBeats * spb;
  for (let i = 0; i < 4; i++) click(ctx, clickOut, t0 + i * spb, i === 0);
  if ($('#clickDuring').checked) for (let i = 0; i < totalBeats; i++) click(ctx, clickOut, loopStart + i * spb, i % 4 === 0);

  buildBeatDots(totalBeats);
  const dots = [...$('#beatDots').children];
  const big = $('#bigCount'), label = $('#stageLabel'), prog = $('#recProgress'), meter = $('#meter');
  let lastShown = null, raf;
  const show = (text, go) => {
    if (text === lastShown) return;
    lastShown = text;
    big.textContent = text;
    big.classList.toggle('go', !!go);
    big.classList.remove('pulse');
    void big.offsetWidth;
    big.classList.add('pulse');
  };
  const frame = () => {
    const now = ctx.currentTime;
    meter.style.width = `${Math.min(100, state.mic.level() * 140)}%`;
    if (now < t0) {
      label.textContent = 'Get ready';
      show('…');
    } else if (now < loopStart) {
      label.textContent = 'Count-in';
      show(String(4 - Math.floor((now - t0) / spb)));
    } else if (now < loopEnd) {
      const beat = Math.floor((now - loopStart) / spb);
      label.textContent = `Bar ${Math.floor(beat / 4) + 1} of ${bars} · beatbox!`;
      show(String((beat % 4) + 1), true);
      dots.forEach((d, i) => { d.classList.toggle('on', i === beat); d.classList.toggle('past', i < beat); });
      prog.style.width = `${((now - loopStart) / (loopEnd - loopStart)) * 100}%`;
    }
    raf = requestAnimationFrame(frame);
  };
  frame();

  await wait((loopEnd - ctx.currentTime + 0.4) * 1000);
  cancelAnimationFrame(raf);
  const rec = await state.mic.stop();
  label.textContent = 'Got it';
  show('✓');
  meter.style.width = '0';
  prog.style.width = '100%';
  dots.forEach((d) => d.classList.remove('on'));
  btn.classList.remove('recording');
  btn.lastChild.textContent = 'Record again';
  state.busy = false;
  setBusyUI(false);

  showResult({ ...rec, bpm, bars, loopStartRec: loopStart - rec.startTime, autoLatency: latencyEstimate() });
}

/** A built-in boom-bap, beatboxed by a (synthetic) mouth with human timing, through the same pipeline. */
async function demo() {
  if (state.busy) return;
  await ensureCtx();
  state.player.stop();
  const { bpm, bars } = state;
  const sr = state.ctx.sampleRate, spb = 60 / bpm, sd = spb / 4;
  const loopStartRec = 0.3 + 4 * spb;
  const hits = [];
  for (let b = 0; b < bars; b++) {
    for (const [s, type] of GROOVE) {
      const sloppy = 0.022 * Math.sin(s * 5.3 + b * 2.1); // up to ±22 ms off the grid
      hits.push({ type, time: loopStartRec + (b * 16 + s) * sd + sloppy, gain: 0.45 + 0.2 * Math.abs(Math.sin(s + b)) });
    }
  }
  const data = renderVoice(hits, loopStartRec + bars * 4 * spb + 0.4, sr, { seed: Date.now() % 1000 });
  $('#stageLabel').textContent = 'Demo groove loaded';
  $('#bigCount').textContent = '♪';
  showResult({ data, sr, startTime: 0, bpm, bars, loopStartRec, autoLatency: 0, demo: true });
}

function showResult(rec) {
  state.rec = rec;
  analyze();
  const res = $('#result');
  res.hidden = false;
  res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (state.analysis.hits.length) {
    state.player.start();
    updatePlayBtn();
  }
}

function setBusyUI(busy) {
  document.querySelectorAll('.pad, #recBtn, #demoBtn, #resetTeach, #playBtn, #wavBtn, #midiBtn, #zipBtn').forEach((b) => (b.disabled = busy));
}

// ---------- step 3: analyze + show ----------
function analyze() {
  const r = state.rec;
  if (!r) return;
  const latency = r.autoLatency + state.offsetMs / 1000;
  const hits = detectOnsets(r.data, r.sr, { sensitivity: state.sens }).map((s) => {
    const f = extractFeatures(r.data, r.sr, s);
    const c = state.classifier.classify(f);
    return { sample: s, time: s / r.sr, label: c.label, peak: f.peak };
  });
  const pattern = buildPattern(hits, { bpm: r.bpm, bars: r.bars, loopStart: r.loopStartRec, latency });
  const loopDur = r.bars * 4 * (60 / r.bpm);
  state.analysis = { hits, pattern, latency, loopDur };

  // The voice, cut to the loop, so "My voice" / "Both" line up with the beat.
  const start = Math.max(0, Math.round((r.loopStartRec + latency) * r.sr));
  const len = Math.round(loopDur * r.sr);
  const voice = state.ctx.createBuffer(1, len, r.sr);
  const vd = voice.getChannelData(0);
  let peak = 1e-4;
  for (let i = 0; i < len && start + i < r.data.length; i++) { vd[i] = r.data[start + i]; peak = Math.max(peak, Math.abs(vd[i])); }
  for (let i = 0; i < len; i++) vd[i] *= 0.9 / peak;

  state.player.load(pattern, r.bpm, voice);
  drawSummary(hits);
  drawWave();
  drawGrid();
}

function drawSummary() {
  const { pattern } = state.analysis;
  const n = countHits(pattern);
  const total = n.kick + n.snare + n.hat;
  const model = state.rec.demo
    ? 'from the demo groove. Switch to “Both” to hear the sloppy mouth version against the clean beat'
    : state.classifier.ready ? 'using your trained sounds' : 'using built-in guesses (train step 1 for better results)';
  $('#summary').textContent = total
    ? `${n.kick} kicks · ${n.snare} snares · ${n.hat} hats at ${state.rec.bpm} BPM, ${model}.`
    : 'Didn’t catch any hits in the loop. Get closer to the mic, or raise the sensitivity below.';
}

function drawWave() {
  const cv = $('#wave');
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  const r = state.rec, { latency, loopDur, hits, pattern } = state.analysis;
  const t0 = r.loopStartRec + latency;
  const x = (t) => ((t - t0) / loopDur) * W;

  const beats = r.bars * 4;
  for (let b = 0; b <= beats; b++) {
    g.fillStyle = b % 4 === 0 ? 'rgba(184,192,208,0.35)' : 'rgba(184,192,208,0.12)';
    g.fillRect(Math.round((b / beats) * W), 0, 1, H);
  }

  const mid = H / 2 + 8;
  const s0 = Math.round(t0 * r.sr), n = Math.round(loopDur * r.sr);
  let peak = 1e-4;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(r.data[s0 + i] || 0));
  g.fillStyle = 'rgba(184,192,208,0.45)';
  const per = n / W;
  for (let px = 0; px < W; px++) {
    let lo = 0, hi = 0;
    const a = s0 + Math.floor(px * per), bnd = s0 + Math.floor((px + 1) * per);
    for (let i = a; i < bnd; i++) { const v = r.data[i] || 0; if (v < lo) lo = v; if (v > hi) hi = v; }
    const sc = (H / 2 - 14) / peak;
    g.fillRect(px, mid - hi * sc, 1, Math.max(1, (hi - lo) * sc));
  }

  const placed = new Set(pattern.placed.map((p) => p.hit));
  for (const h of hits) {
    const px = x(h.time);
    if (px < -2 || px > W + 2) continue;
    const on = placed.has(h);
    g.fillStyle = COLORS[h.label];
    g.globalAlpha = on ? 1 : 0.3;
    g.fillRect(px - 1, 14, 2, H - 14);
    g.beginPath();
    g.arc(px, 9, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

let gridCells = [];
function drawGrid() {
  const { pattern } = state.analysis;
  const el = $('#grid');
  el.innerHTML = '';
  gridCells = Array.from({ length: pattern.steps }, () => []);
  for (let b = 0; b < pattern.bars; b++) {
    const block = document.createElement('div');
    block.className = 'bar-block';
    block.setAttribute('aria-label', `Bar ${b + 1}`);
    for (const c of CLASSES) {
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = c === 'hat' ? 'hat' : c;
      block.appendChild(lbl);
      for (let s = 0; s < 16; s++) {
        const step = b * 16 + s;
        const cell = document.createElement('span');
        const v = pattern.tracks[c][step];
        cell.className = `cell row-${c}${s % 4 === 0 ? ' beat' : ''}${v > 0 ? ' on' : ''}`;
        if (v > 0) cell.style.setProperty('--v', (0.35 + 0.65 * v).toFixed(2));
        block.appendChild(cell);
        gridCells[step].push(cell);
      }
    }
    el.appendChild(block);
  }
}

let nowStep = -1;
function animatePlayhead() {
  const step = state.player?.playing ? state.player.currentStep() : -1;
  if (step !== nowStep) {
    gridCells[nowStep]?.forEach((c) => c.classList.remove('now'));
    gridCells[step]?.forEach((c) => c.classList.add('now'));
    nowStep = step;
  }
  requestAnimationFrame(animatePlayhead);
}

// ---------- playback ----------
class LoopPlayer {
  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.85;
    this.out.connect(ctx.destination);
    this.playing = false;
    this.mode = 'beat';
    this.queue = [];
    this.sources = [];
  }
  load(pattern, bpm, voice) { this.p = pattern; this.bpm = bpm; this.voice = voice; }
  start() {
    if (!this.p) return;
    this.stop();
    this.playing = true;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }
  stop() {
    this.playing = false;
    clearInterval(this.timer);
    for (const s of this.sources) { try { s.stop(); } catch {} }
    this.sources = [];
    this.queue = [];
  }
  tick() {
    const sd = 60 / this.bpm / 4;
    while (this.next < this.ctx.currentTime + 0.12) {
      const s = this.step % this.p.steps;
      if (this.mode !== 'voice') {
        for (const c of CLASSES) { const v = this.p.tracks[c][s]; if (v > 0) playDrum(this.ctx, this.out, c, this.next, v); }
      }
      if (s === 0 && this.mode !== 'beat' && this.voice) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.voice;
        const g = this.ctx.createGain();
        g.gain.value = this.mode === 'both' ? 0.6 : 1;
        src.connect(g).connect(this.out);
        src.start(this.next);
        this.sources = this.sources.slice(-2).concat(src);
      }
      this.queue.push({ step: s, time: this.next });
      this.next += sd;
      this.step = s + 1;
    }
  }
  currentStep() {
    const now = this.ctx.currentTime;
    while (this.queue.length > 1 && this.queue[1].time <= now) this.queue.shift();
    return this.queue.length && this.queue[0].time <= now ? this.queue[0].step : -1;
  }
}

function updatePlayBtn() {
  $('#playBtn').textContent = state.player?.playing ? '■ Stop' : '▶ Play';
}

// ---------- export ----------
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportWav() {
  const btn = $('#wavBtn');
  btn.disabled = true;
  btn.textContent = 'Rendering…';
  try {
    const repeats = Math.max(1, Math.round(8 / state.rec.bars));
    const blob = await renderWav(state.analysis.pattern, state.rec.bpm, { repeats });
    download(blob, `beatbox-beat-${state.rec.bpm}bpm.wav`);
  } catch (e) {
    showAlert('Could not render the WAV in this browser.');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ WAV';
  }
}

function exportMidi() {
  const bytes = buildMidi(state.analysis.pattern, state.rec.bpm);
  download(new Blob([bytes], { type: 'audio/midi' }), `beatbox-beat-${state.rec.bpm}bpm.mid`);
}

/** Claude app: WAV + MIDI in one .zip, offered through the viewer's save prompt. */
async function exportZip() {
  const btn = $('#zipBtn');
  btn.disabled = true;
  btn.textContent = 'Rendering…';
  try {
    const name = `beatbox-beat-${state.rec.bpm}bpm`;
    const repeats = Math.max(1, Math.round(8 / state.rec.bars));
    const wav = new Uint8Array(await (await renderWav(state.analysis.pattern, state.rec.bpm, { repeats })).arrayBuffer());
    const mid = buildMidi(state.analysis.pattern, state.rec.bpm);
    const zip = makeZip([{ name: `${name}.wav`, bytes: wav }, { name: `${name}.mid`, bytes: mid }]);
    await state.downloads.save({ filename: `${name}.zip`, data: new Blob([zip]) });
  } catch (e) {
    if (e?.code === 'declined') return;
    if (e?.code === 'rate_limited') showAlert('A save prompt is already open. Finish that one first.');
    else showAlert('Saving isn’t available in this view. Open the app in a browser to export.');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ WAV + MIDI (.zip)';
  }
}

// ---------- wiring ----------
function seg(el, onPick) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    onPick(b.dataset.v);
  });
}

let reTimer;
function reanalyzeSoon() {
  clearTimeout(reTimer);
  reTimer = setTimeout(analyze, 120);
}

function setBpm(v) {
  const n = Math.max(60, Math.min(160, Math.round(Number(v) || 90)));
  state.bpm = n;
  $('#bpm').value = n;
  $('#bpmRange').value = n;
}

document.querySelectorAll('.pad').forEach((pad) => pad.addEventListener('click', () => teach(pad)));
$('#resetTeach').addEventListener('click', () => {
  state.samples = { kick: [], snare: [], hat: [] };
  saveSamples();
  refreshTeach();
  if (state.rec) analyze();
});
$('#bpmRange').addEventListener('input', (e) => setBpm(e.target.value));
$('#bpm').addEventListener('change', (e) => setBpm(e.target.value));
seg($('#bars'), (v) => (state.bars = Number(v)));
$('#recBtn').addEventListener('click', record);
$('#playBtn').addEventListener('click', async () => {
  await state.ctx.resume();
  if (state.player.playing) state.player.stop(); else state.player.start();
  updatePlayBtn();
});
seg($('#listen'), (v) => {
  state.player.mode = v;
  if (state.player.playing) state.player.start();
});
$('#wavBtn').addEventListener('click', exportWav);
$('#midiBtn').addEventListener('click', exportMidi);
$('#sens').addEventListener('input', (e) => {
  state.sens = Number(e.target.value);
  $('#sensVal').textContent = `${Math.round(state.sens * 100)}%`;
  reanalyzeSoon();
});
$('#offset').addEventListener('input', (e) => {
  state.offsetMs = Number(e.target.value);
  $('#offVal').textContent = `${state.offsetMs > 0 ? '+' : ''}${state.offsetMs} ms`;
  reanalyzeSoon();
});
window.addEventListener('resize', () => state.analysis && drawWave());

$('#demoBtn').addEventListener('click', demo);
$('#zipBtn').addEventListener('click', exportZip);

if (inClaude) {
  $('#micNote').hidden = false;
  $('#wavBtn').hidden = true;
  $('#midiBtn').hidden = true;
  window.claude.use('downloads').then((d) => {
    state.downloads = d;
    $('#zipBtn').hidden = !d;
  });
}

$('#sensVal').textContent = '60%';
$('#offVal').textContent = '0 ms';
buildBeatDots(8);
refreshTeach();
requestAnimationFrame(animatePlayhead);

// Hooks for automated tests.
window.__beatbox = { state, analyze };
