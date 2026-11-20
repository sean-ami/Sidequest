// Microphone capture with sample-accurate timestamps (AudioWorklet), so hits line up with the click.

const WORKLET = `
class BBRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false; this.buf = new Float32Array(4096); this.n = 0; this.t0 = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.n = 0; }
      else if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); }
    };
  }
  flush() {
    if (this.n) { this.port.postMessage({ t: this.t0, d: this.buf.slice(0, this.n) }); this.n = 0; }
  }
  process(inputs) {
    if (this.on) {
      const ch = inputs[0] && inputs[0][0];
      if (this.n === 0) this.t0 = currentTime;
      const len = ch ? ch.length : 128;
      if (ch) this.buf.set(ch, this.n); else this.buf.fill(0, this.n, this.n + len);
      this.n += len;
      if (this.n + 128 > this.buf.length) this.flush();
    }
    return true;
  }
}
registerProcessor('bb-recorder', BBRecorder);
`;

export class Mic {
  constructor(ctx) {
    this.ctx = ctx;
    this.inputLatency = 0.01;
  }

  async open() {
    if (this.node) return;
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
    this.stream = await navigator.mediaDevices.getUserMedia({
      // Voice processing smears and gates the transients we need, so ask for raw audio.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    const src = this.ctx.createMediaStreamSource(this.stream);
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.node = new AudioWorkletNode(this.ctx, 'bb-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    this.node.port.onmessage = (e) => this.onMessage(e.data);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(this.node).connect(mute).connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    this.levelBuf = new Float32Array(this.analyser.fftSize);
    const s = this.stream.getAudioTracks()[0].getSettings?.() || {};
    if (typeof s.latency === 'number') this.inputLatency = s.latency;
  }

  /** 0..1 peak level of the last few milliseconds, for a live meter. */
  level() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let m = 0;
    for (const v of this.levelBuf) m = Math.max(m, Math.abs(v));
    return m;
  }

  start() {
    this.chunks = [];
    this.startTime = null;
    this.node.port.postMessage('start');
  }

  /** Resolves with { data: Float32Array, sr, startTime } where startTime is the AudioContext time of data[0]. */
  stop() {
    return new Promise((resolve) => {
      this.resolveStop = resolve;
      this.node.port.postMessage('stop');
    });
  }

  onMessage(m) {
    if (m.done) {
      const total = this.chunks.reduce((n, c) => n + c.length, 0);
      const data = new Float32Array(total);
      let o = 0;
      for (const c of this.chunks) { data.set(c, o); o += c.length; }
      this.resolveStop?.({ data, sr: this.ctx.sampleRate, startTime: this.startTime ?? this.ctx.currentTime });
      this.resolveStop = null;
      return;
    }
    if (this.startTime === null) this.startTime = m.t;
    this.chunks.push(m.d);
  }
}
