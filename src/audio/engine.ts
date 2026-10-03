// Motore audio: un solo AudioContext che fa da orologio per tutto il gioco.
// Qui c'è l'ascolto del microfono; base musicale ed effetti vengono da style/ (thread dello stile).

import { hzToMidi } from "../harp";
import { GeneratoreBasi } from "../style/basi";
import { EffettiSonori } from "../style/effetti";
import { yin, rms } from "./yin";
import { NoteTracker } from "./tracker";
import { createPitchNode, type PitchFrame } from "./pitchWorklet";

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
  /** Analisi nel thread audio (se disponibile): le misure arrivano qui e poll() le passa al tracker. */
  private pitchNode: AudioWorkletNode | null = null;
  private frames: PitchFrame[] = [];
  /** "worklet" o "analyser": come viene analizzato il microfono (per diagnosi). */
  detector: "worklet" | "analyser" | "none" = "none";
  private buf = new Float32Array(2048);
  micStatus: MicStatus = "off";
  /** Ritardo stimato tra il suono reale e la sua analisi (secondi). */
  /** Secondi da togliere agli attacchi sentiti dal microfono (vedi la calibrazione del ritardo). */
  inputLatency = DEFAULT_LATENCY;
  level = 0;
  /** Volume della base (opzioni) e quanto resta mentre suoni: un decimo con gli altoparlanti, 0.4 con le cuffie. */
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

  private clock = { ct: -1, perf: 0, last: 0 };
  /**
   * Orologio audio "liscio": currentTime avanza a scatti (decine di ms sui telefoni, 250 ms in Chromium
   * senza scheda audio), qui si interpola con performance.now() tra uno scatto e l'altro. Mai all'indietro.
   */
  get now(): number {
    const ct = this.ctx.currentTime;
    const perf = performance.now();
    if (ct !== this.clock.ct) {
      this.clock.ct = ct;
      this.clock.perf = perf;
    }
    const t = this.ctx.state === "running" ? ct + Math.min(0.3, (perf - this.clock.perf) / 1000) : ct;
    this.clock.last = Math.max(this.clock.last, t);
    return this.clock.last;
  }

  /** Ultima stima grezza dell'altezza (MIDI con i centesimi), senza attese: per seguire i bend. */
  lastPitch: number | null = null;

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
      try {
        this.pitchNode = await createPitchNode(this.ctx, (f) => {
          // se nessuna scena legge il microfono per un po', si tengono solo le misure recenti
          if (this.frames.push(f) > 200) this.frames.shift();
        });
      } catch (e) {
        // senza AudioWorklet si ripiega sull'analisi a ogni frame
        console.warn("AudioWorklet non disponibile:", e);
        this.pitchNode = null;
      }
      if (this.pitchNode) {
        src.connect(this.pitchNode);
        // il nodo va collegato all'uscita perché il browser lo faccia lavorare, ma in silenzio
        const mute = this.ctx.createGain();
        mute.gain.value = 0;
        this.pitchNode.connect(mute).connect(this.ctx.destination);
        this.pitchNode.port.postMessage({ gate: this.gate });
        this.detector = "worklet";
      } else {
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        src.connect(this.analyser);
        this.buf = new Float32Array(this.analyser.fftSize);
        this.detector = "analyser";
      }
      return (this.micStatus = "on");
    } catch {
      return (this.micStatus = "denied");
    }
  }

  private _gate = DEFAULT_GATE;
  /** Soglia di volume sotto cui il microfono è considerato in silenzio (tarata dalla calibrazione). */
  get gate(): number {
    return this._gate;
  }
  set gate(v: number) {
    this._gate = v;
    this.pitchNode?.port.postMessage({ gate: v });
  }

  /** Da chiamare a ogni frame: passa al tracker le misure arrivate dal microfono. */
  poll(): void {
    if (this.pitchNode) {
      const frames = this.frames;
      this.frames = [];
      if (this.keyboardHeld) return;
      for (const f of frames) {
        this.level = f.level;
        const t = f.time - this.inputLatency;
        const midi = f.level >= this._gate && f.hz && f.clarity > MIN_CLARITY ? hzToMidi(f.hz) : null;
        this.lastPitch = midi;
        this.tracker.feed(t, midi, f.level);
      }
      return;
    }
    if (!this.analyser || this.keyboardHeld) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    this.level = rms(this.buf);
    const t = this.now - this.inputLatency;
    const p = this.level < this._gate ? null : yin(this.buf, this.ctx.sampleRate);
    this.lastPitch = p && p.clarity > MIN_CLARITY ? hzToMidi(p.hz) : null;
    this.tracker.feed(t, this.lastPitch, this.level);
  }

  /**
   * Mentre il giocatore suona, la base tace e resta solo il metronomo (senza altezza).
   * Il banco di prova ha misurato che una base dagli altoparlanti, forte quanto l'armonica,
   * rende il riconoscimento inutilizzabile: contiene le stesse note dell'armonica.
   */
  duckBand(on: boolean, when = this.now): void {
    this.ducked = on;
    this.band.gain.setTargetAtTime(this.musicVolume * (on ? this.duckLevel : 1), when, 0.04);
    // mentre suoni restano solo basso e ritmo: meno note che il microfono può confondere con l'armonica
    this.basi.impostaRisposta(on, when);
  }

  /** Applica volume e modalità cuffie dalle opzioni. */
  configureMusic(volume: number, headphones: boolean): void {
    this.musicVolume = volume;
    // misurato dal banco di prova: base 20 dB sotto l'armonica (guadagno 0.1) non disturba il riconoscimento;
    // con le cuffie il microfono non la sente, quindi può restare più forte
    this.duckLevel = headphones ? 0.4 : 0.1;
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
