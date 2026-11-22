/**
 * Background music, generated live with the Web Audio API (no audio files).
 * A few "stations" with chords, bass and drums.
 */
export type Station = 'chill' | 'pop' | 'night' | 'party';

interface Song { bpm: number; chords: number[][]; bass: boolean; kick: number[]; snare: number[]; hat: number[]; arp: boolean; pad: OscillatorType; bright: number }

const SONGS: Record<Station, Song> = {
  chill: { bpm: 82, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], bass: true, kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], arp: false, pad: 'triangle', bright: 1400 },
  pop: { bpm: 112, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], bass: true, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], arp: true, pad: 'sawtooth', bright: 2200 },
  night: { bpm: 70, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64]], bass: true, kick: [0], snare: [8], hat: [4, 12], arp: true, pad: 'sine', bright: 900 },
  party: { bpm: 126, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], bass: true, kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14, 15], arp: true, pad: 'sawtooth', bright: 3000 },
};

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  station: Station = (localStorage.getItem('music.station') as Station) || 'chill';
  volume = Number(localStorage.getItem('music.volume') ?? 0.35);
  on = localStorage.getItem('music.on') !== 'false';
  private override: Station | null = null;

  /** Browsers only allow audio after a tap/click, so call this from one. */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = n;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    } catch { /* no audio */ }
  }

  set(opts: { station?: Station; volume?: number; on?: boolean }): void {
    if (opts.station) { this.station = opts.station; localStorage.setItem('music.station', opts.station); }
    if (opts.volume !== undefined) { this.volume = opts.volume; localStorage.setItem('music.volume', String(opts.volume)); }
    if (opts.on !== undefined) { this.on = opts.on; localStorage.setItem('music.on', String(opts.on)); }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.on ? this.volume : 0, this.ctx.currentTime, 0.1);
  }

  stop(): void { clearInterval(this.timer); this.ctx?.close(); this.ctx = null; }

  /** Temporarily play another station (e.g. during a party). */
  setOverride(s: Station | null): void { this.override = s; }

  /** A firework pop. */
  boom(): void {
    if (!this.ctx || !this.master || !this.noise || !this.on) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.8);
  }

  private schedule(): void {
    const ctx = this.ctx!;
    const song = SONGS[this.override ?? this.station];
    const stepLen = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      if (this.on) this.playStep(song, this.step, this.nextTime, stepLen);
      this.nextTime += stepLen;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(song: Song, step: number, t: number, len: number): void {
    const ctx = this.ctx!, out = this.master!;
    const s16 = step % 16;
    const chord = song.chords[Math.floor(step / 16) % song.chords.length];
    if (s16 === 0) {
      for (const n of chord) this.tone(hz(n), t, len * 15, song.pad, 0.05, song.bright);
    }
    if (song.bass && s16 % 4 === 0) this.tone(hz(chord[0] - 24), t, len * 3, 'triangle', 0.16, 600);
    if (song.arp && s16 % 2 === 0) this.tone(hz(chord[(s16 / 2) % chord.length] + 12), t, len * 1.5, 'square', 0.025, song.bright);
    if (song.kick.includes(s16)) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.22);
    }
    if (song.snare.includes(s16)) this.hit(t, 1800, 0.18, 0.14);
    if (song.hat.includes(s16)) this.hit(t, 7000, 0.05, 0.04);
  }

  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private hit(t: number, freq: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = freq > 4000 ? 'highpass' : 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t); src.stop(t + dur + 0.02);
  }
}
