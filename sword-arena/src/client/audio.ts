/** Tiny synthesized sound effects — no audio files to download. */

export type Sfx = 'throw' | 'clash' | 'hit' | 'bighit' | 'pickup' | 'death' | 'dash' | 'heal' | 'crate' | 'beep' | 'go' | 'kill' | 'stick';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  /** Browsers only allow audio after a user gesture, so call this from one. */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** `vol` is 0..1, already scaled by distance from the listener. */
  play(name: Sfx, vol = 1): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out || this.muted || vol <= 0.02) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'throw': this.noise(t, 0.16, 900, 3200, 0.5 * vol, 'bandpass'); break;
      case 'dash': this.noise(t, 0.14, 500, 1800, 0.35 * vol, 'bandpass'); break;
      case 'clash':
        this.tone(t, 'triangle', 1500 + Math.random() * 300, 1400, 0.18, 0.28 * vol);
        this.tone(t, 'sine', 2350 + Math.random() * 200, 2300, 0.12, 0.16 * vol);
        break;
      case 'stick': this.tone(t, 'square', 220, 140, 0.06, 0.12 * vol); this.noise(t, 0.05, 2000, 2000, 0.2 * vol, 'highpass'); break;
      case 'hit': this.tone(t, 'sine', 180, 60, 0.12, 0.6 * vol); this.noise(t, 0.08, 1200, 400, 0.35 * vol, 'lowpass'); break;
      case 'bighit': this.tone(t, 'sine', 140, 40, 0.2, 0.8 * vol); this.noise(t, 0.14, 1600, 300, 0.5 * vol, 'lowpass'); break;
      case 'pickup': this.tone(t, 'square', 660, 990, 0.08, 0.12 * vol); this.tone(t + 0.06, 'square', 990, 1320, 0.08, 0.1 * vol); break;
      case 'heal': this.tone(t, 'sine', 520, 780, 0.15, 0.25 * vol); this.tone(t + 0.08, 'sine', 780, 1040, 0.15, 0.2 * vol); break;
      case 'crate': this.noise(t, 0.1, 700, 300, 0.4 * vol, 'lowpass'); this.tone(t, 'triangle', 160, 90, 0.08, 0.3 * vol); break;
      case 'death': this.tone(t, 'sawtooth', 420, 60, 0.4, 0.3 * vol); this.noise(t, 0.3, 1500, 200, 0.4 * vol, 'lowpass'); break;
      case 'kill': this.tone(t, 'square', 523, 523, 0.08, 0.14 * vol); this.tone(t + 0.08, 'square', 784, 784, 0.12, 0.14 * vol); break;
      case 'beep': this.tone(t, 'square', 440, 440, 0.12, 0.15 * vol); break;
      case 'go': this.tone(t, 'square', 880, 880, 0.3, 0.18 * vol); break;
    }
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, f0: number, f1: number, vol: number, type: BiquadFilterType): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
