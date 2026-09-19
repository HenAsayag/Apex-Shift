export class AudioSystem {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.phase = 0;
    this.nextNote = 0;
  }
  start() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineGain.connect(this.master);
      this.engine = this.ctx.createOscillator();
      this.engine.type = "sawtooth";
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      this.engine.connect(filter);
      filter.connect(this.engineGain);
      this.engine.start();
      this.noiseBuffer = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate,
        this.ctx.sampleRate,
      );
      const d = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const nf = this.ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = 1300;
      noise.connect(nf);
      nf.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      noise.start();
    }
    this.ctx.resume().catch(() => {});
  }
  tone(
    freq,
    duration = 0.15,
    volume = 0.15,
    type = "sine",
    delay = 0,
    bus = "sfx",
  ) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      at = this.ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(volume * this.settings[bus], at);
    g.gain.exponentialRampToValueAtTime(0.001, at + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(at);
    o.stop(at + duration + 0.02);
  }
  play(name) {
    if (!this.ctx) return;
    if (name === "countdown") this.tone(550, 0.12, 0.4);
    else if (name === "go") {
      this.tone(1100, 0.35, 0.4);
    } else if (name === "checkpoint") {
      this.tone(880, 0.15, 0.2);
      this.tone(1320, 0.25, 0.2, "sine", 0.08);
    } else if (name === "finish") {
      [523, 659, 784, 1046].forEach((f, i) =>
        this.tone(f, 0.6, 0.4, "triangle", i * 0.14),
      );
    } else if (name === "defeat") {
      [392, 330, 262].forEach((f, i) =>
        this.tone(f, 0.4, 0.25, "triangle", i * 0.15),
      );
    } else if (name === "collision" || name === "land") {
      this.tone(65, 0.15, name === "land" ? 0.22 : 0.5, "sawtooth");
    } else if (name === "respawn") this.tone(180, 0.25, 0.35, "triangle");
    else this.tone(740, 0.055, 0.09, "triangle");
  }
  update(racer, dt, active = true) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(
      active && racer ? this.settings.engine * 0.12 : 0,
      now,
      0.12,
    );
    this.noiseGain.gain.setTargetAtTime(
      active && racer
        ? (racer.drifting ? 0.09 : racer.boosting ? 0.05 : 0) *
            this.settings.sfx
        : 0,
      now,
      0.08,
    );
    if (racer)
      this.engine.frequency.setTargetAtTime(
        38 + racer.speed * 2.3 + (racer.speed % 18) * 1.3,
        now,
        0.1,
      );
    if (now > this.nextNote) {
      const notes = [55, 55, 82.41, 65.41, 55, 73.42, 82.41, 65.41];
      this.tone(notes[this.phase % 8], 0.32, 0.25, "triangle", 0, "music");
      if (this.phase % 2 === 0)
        this.tone(notes[this.phase % 8] * 4, 0.15, 0.05, "sine", 0, "music");
      this.phase++;
      this.nextNote = now + 0.28;
    }
  }
}
