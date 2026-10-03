// Motore audio: un solo AudioContext che fa da orologio per tutto il gioco.
// Qui c'è l'ascolto del microfono; base musicale ed effetti vengono da style/ (thread dello stile).

import { hzToMidi } from "../harp";
import { GeneratoreBasi } from "../style/basi";
import { EffettiSonori } from "../style/effetti";
import { yin, rms } from "./yin";
import { NoteTracker } from "./tracker";

export type MicStatus = "off" | "on" | "denied" | "unsupported";

// soglie tarate sul banco di prova (tests/suggerimenti-rilevatore.md nella cartella del progetto)
export const DEFAULT_GATE = 0.002;
/** Ritardo tipico tra suono e attacco riconosciuto, finché il giocatore non lo misura. */
export const DEFAULT_LATENCY = 0.05;
const MIN_CLARITY = 0.7;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly tracker = new NoteTracker();
  private master: GainNode;
  /** Volume della base: si azzera mentre suona il giocatore (vedi duckBand). */
  private band: GainNode;
  readonly basi: GeneratoreBasi;
  readonly fx: EffettiSonori;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(2048);
  micStatus: MicStatus = "off";
  /** Ritardo stimato tra il suono reale e la sua analisi (secondi). */
  /** Secondi da togliere agli attacchi sentiti dal microfono (vedi la calibrazione del ritardo). */
  inputLatency = DEFAULT_LATENCY;
  level = 0;
  /** Soglia di volume sotto cui il microfono è considerato in silenzio (tarata dalla calibrazione). */
  gate = DEFAULT_GATE;
  /** Volume della base (opzioni) e quanto resta mentre suoni: 0 con gli altoparlanti, un decimo con le cuffie. */
  musicVolume = 0.8;
  duckLevel = 0;
  private ducked = false;
  /** Vero mentre si suona con la tastiera: il microfono non sovrascrive la nota. */
  keyboardHeld = false;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.band = this.ctx.createGain();
    this.band.connect(this.master);
    this.basi = new GeneratoreBasi(this.ctx, this.band);
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
    if (this.level < this.gate) return this.tracker.feed(t, null, this.level);
    const p = yin(this.buf, this.ctx.sampleRate);
    this.tracker.feed(t, p && p.clarity > MIN_CLARITY ? hzToMidi(p.hz) : null, this.level);
  }

  /**
   * Mentre il giocatore suona, la base tace e resta solo il metronomo (senza altezza).
   * Il banco di prova ha misurato che una base dagli altoparlanti, forte quanto l'armonica,
   * rende il riconoscimento inutilizzabile: contiene le stesse note dell'armonica.
   */
  duckBand(on: boolean, when = this.now): void {
    this.ducked = on;
    this.band.gain.setTargetAtTime(this.musicVolume * (on ? this.duckLevel : 1), when, 0.04);
  }

  /** Applica volume e modalità cuffie dalle opzioni. */
  configureMusic(volume: number, headphones: boolean): void {
    this.musicVolume = volume;
    // misurato dal banco di prova: base 20 dB sotto l'armonica (guadagno 0.1) non disturba il riconoscimento
    this.duckLevel = headphones ? 0.1 : 0;
    this.duckBand(this.ducked);
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
