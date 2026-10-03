// Motore audio: un solo AudioContext che fa da orologio per tutto il gioco,
// ascolto del microfono, voce del nemico (un'armonica sintetica) e metronomo.

import { midiToHz, hzToMidi } from "../harp";
import { yin, rms } from "./yin";
import { NoteTracker } from "./tracker";

export type MicStatus = "off" | "on" | "denied" | "unsupported";

const GATE = 0.008;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly tracker = new NoteTracker();
  private master: GainNode;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(2048);
  micStatus: MicStatus = "off";
  /** Ritardo stimato tra il suono reale e la sua analisi (secondi). */
  inputLatency = 0.05;
  level = 0;
  /** Vero mentre si suona con la tastiera: il microfono non sovrascrive la nota. */
  keyboardHeld = false;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  async startMic(): Promise<MicStatus> {
    if (!navigator.mediaDevices?.getUserMedia) return (this.micStatus = "unsupported");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
      const src = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);
      this.buf = new Float32Array(this.analyser.fftSize);
      return (this.micStatus = "on");
    } catch {
      return (this.micStatus = "denied");
    }
  }

  /** Da chiamare a ogni frame: analizza l'ultimo pezzo di audio dal microfono. */
  poll(): void {
    if (!this.analyser || this.keyboardHeld) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    this.level = rms(this.buf);
    const t = this.now - this.inputLatency;
    if (this.level < GATE) return this.tracker.feed(t, null, this.level);
    const p = yin(this.buf, this.ctx.sampleRate);
    this.tracker.feed(t, p && p.clarity > 0.8 ? hzToMidi(p.hz) : null, this.level);
  }

  /** Una nota del nemico: timbro ad ancia con un leggero vibrato. */
  playNote(midi: number, when: number, dur: number, gain = 0.22): void {
    const ctx = this.ctx;
    const hz = midiToHz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.03);
    env.gain.setValueAtTime(gain, when + Math.max(0.04, dur - 0.06));
    env.gain.linearRampToValueAtTime(0, when + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.min(6000, hz * 5);
    filter.Q.value = 2;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibGain = ctx.createGain();
    vibGain.gain.value = hz * 0.004;
    vib.connect(vibGain);
    for (const [type, detune] of [["sawtooth", -4], ["square", 4]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz;
      o.detune.value = detune;
      vibGain.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = type === "square" ? 0.4 : 0.6;
      o.connect(g).connect(filter);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
    vib.start(when);
    vib.stop(when + dur + 0.05);
    filter.connect(env).connect(this.master);
  }

  private noise: AudioBuffer | null = null;

  /** Metronomo: un colpo di rumore filtrato, senza altezza, così il microfono non lo scambia per una nota. */
  click(when: number, accent: boolean): void {
    if (!this.noise) {
      this.noise = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 3000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.5 : 0.25, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    src.connect(f).connect(g).connect(this.master);
    src.start(when);
  }

  /** Un colpo sordo di cassa per dare il groove "a treno". */
  kick(when: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(0.35, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    o.connect(g).connect(this.master);
    o.start(when);
    o.stop(when + 0.2);
  }

  /** Effetti brevi per colpi e danni. */
  sfx(kind: "hit" | "hurt" | "win" | "lose", when = this.now): void {
    const seq: Record<typeof kind, number[]> = {
      hit: [84, 91],
      hurt: [50, 45],
      win: [72, 76, 79, 84],
      lose: [67, 63, 60],
    };
    seq[kind].forEach((m, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = kind === "hurt" ? "sawtooth" : "triangle";
      o.frequency.value = midiToHz(m);
      const t = when + i * 0.08;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.14);
    });
  }
}

let engine: AudioEngine | null = null;
export const getEngine = (): AudioEngine => (engine ??= new AudioEngine());
