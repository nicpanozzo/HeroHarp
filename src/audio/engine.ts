// Motore audio: un solo AudioContext che fa da orologio per tutto il gioco.
// Qui c'è l'ascolto del microfono; base musicale ed effetti vengono da style/ (thread dello stile).

import { hzToMidi } from "../harp";
import { GeneratoreBasi } from "../style/basi";
import { EffettiSonori } from "../style/effetti";
import { yin, rms } from "./yin";
import { NoteTracker } from "./tracker";

export type MicStatus = "off" | "on" | "denied" | "unsupported";

// soglie tarate sul banco di prova (tests/suggerimenti-rilevatore.md nella cartella del progetto)
const GATE = 0.002;
const MIN_CLARITY = 0.7;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly tracker = new NoteTracker();
  private master: GainNode;
  readonly basi: GeneratoreBasi;
  readonly fx: EffettiSonori;
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
    this.basi = new GeneratoreBasi(this.ctx, this.master);
    this.fx = new EffettiSonori(this.ctx, this.master);
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
    this.tracker.feed(t, p && p.clarity > MIN_CLARITY ? hzToMidi(p.hz) : null, this.level);
  }

  private noise: AudioBuffer | null = null;

  /** Conteggio iniziale: un colpo di rumore filtrato, senza altezza, così il microfono non lo scambia per una nota. */
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
}

let engine: AudioEngine | null = null;
export const getEngine = (): AudioEngine => (engine ??= new AudioEngine());
