// Downmixes to mono, resamples to 16 kHz and emits 16-bit PCM in ~100 ms frames.
const TARGET_RATE = 16000;
const FRAME_SAMPLES = 1600;

class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE;
    this.pos = 0;
    this.acc = 0;
    this.accN = 0;
    this.out = new Int16Array(FRAME_SAMPLES);
    this.n = 0;
    this.peak = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;
    const len = channels[0].length;

    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let c = 0; c < channels.length; c++) s += channels[c][i];
      s /= channels.length;
      const a = Math.abs(s);
      if (a > this.peak) this.peak = a;

      // Box-filter average over each output sample's window (cheap anti-aliasing).
      this.acc += s;
      this.accN += 1;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.acc / this.accN));
        this.acc = 0;
        this.accN = 0;
        this.out[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.n === FRAME_SAMPLES) {
          this.port.postMessage({ pcm: this.out.buffer, level: this.peak }, [this.out.buffer]);
          this.out = new Int16Array(FRAME_SAMPLES);
          this.n = 0;
          this.peak = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
