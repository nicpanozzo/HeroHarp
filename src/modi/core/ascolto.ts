// Copiato da modes/src/core/ascolto.ts con scripts/sync-content.mjs, non modificare qui.
// Ascolto unificato: microfono (YIN del gioco) oppure tastiera, con un "bend simulato"
// sulla tastiera così anche le modalità basate sull'intonazione si provano senza armonica.
//
//  1..0 = fori 1..10 soffiati, Q..P = fori 1..10 aspirati.
//  Tenendo premuto Spazio (o ↓) mentre suoni un foro, la nota si piega gradualmente.

import { getEngine, type AudioEngine } from "../../audio/engine";
import type { Onset } from "../../audio/tracker";
import { keyById, maxBend, tabToMidi, type Tab } from "../../harp";
import { impostazioni } from "./impostazioni";

const SOFFIO = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ASPIRO = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
/** Semitoni al secondo del bend simulato. */
const VELOCITA_BEND = 5;

export type Sorgente = "microfono" | "tastiera" | "nessuna";

export class Ascolto {
  readonly engine: AudioEngine = getEngine();
  /** Altezza continua (MIDI con i centesimi), null in silenzio. */
  midiF: number | null = null;
  /** Nota intera stabile. */
  midi: number | null = null;
  sorgente: Sorgente = "nessuna";

  private tasto: string | null = null;
  private foroTasto: Tab | null = null;
  private bendTasto = 0;
  private piega = false;
  private ultimoArrotondato: number | null = null;
  private oraTasto: number | null = null;

  constructor() {
    window.addEventListener("keydown", (ev) => this.giu(ev));
    window.addEventListener("keyup", (ev) => this.su(ev));
    window.addEventListener("blur", () => this.rilascia());
  }

  get micAcceso() { return this.engine.micStatus === "on"; }
  get livello() { return this.engine.level; }
  /**
   * L'istante che si sta *sentendo* adesso, sull'orologio audio, interpolato con performance.now().
   * ctx.currentTime avanza a scatti (10 ms su un buon computer, anche 250 ms su alcuni dispositivi):
   * per giudicare il tempo serve un orologio liscio.
   */
  get ora() {
    const ctx = this.engine.ctx;
    const ts = ctx.getOutputTimestamp?.();
    let t = ctx.currentTime;
    if (ts && ts.performanceTime && ts.contextTime !== undefined) t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    if (t < this.ultimaOra) t = this.ultimaOra;
    return (this.ultimaOra = t);
  }
  private ultimaOra = 0;

  async accendiMicrofono() {
    await this.engine.resume();
    if (this.engine.micStatus !== "on") await this.engine.startMic();
    return this.engine.micStatus;
  }

  /** Ogni nuova nota (attacco) sentita, dal microfono o dalla tastiera. */
  suNota(cb: (o: Onset) => void): () => void {
    return this.engine.tracker.onOnset(cb);
  }

  /** Da chiamare a ogni frame. */
  aggiorna(dt: number) {
    if (this.foroTasto) {
      const max = maxBend(this.foroTasto.hole, this.foroTasto.draw);
      const meta = this.piega ? max : 0;
      const passo = VELOCITA_BEND * dt;
      this.bendTasto += Math.max(-passo, Math.min(passo, meta - this.bendTasto));
      const base = tabToMidi({ ...this.foroTasto, bend: 0 }, keyById(impostazioni.tonalita));
      this.midiF = base - this.bendTasto;
      const r = Math.round(this.midiF);
      if (r !== this.ultimoArrotondato) {
        // il primo attacco vale dall'istante del tasto, non dal frame successivo
        const quando = this.ultimoArrotondato === null && this.oraTasto !== null ? this.oraTasto : this.ora;
        this.ultimoArrotondato = r;
        this.oraTasto = null;
        this.engine.tracker.force(quando, r);
      }
      this.midi = r;
      this.sorgente = "tastiera";
      return;
    }
    this.engine.poll();
    const s = this.engine.tracker.state;
    this.midi = s.midi;
    this.midiF = s.midi === null ? null : s.midiF;
    this.sorgente = this.micAcceso ? "microfono" : "nessuna";
  }

  private giu(ev: KeyboardEvent) {
    const k = ev.key.toLowerCase();
    if (k === " " || k === "arrowdown") { this.piega = true; ev.preventDefault(); return; }
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const b = SOFFIO.indexOf(k), a = ASPIRO.indexOf(k);
    if (b < 0 && a < 0) return;
    this.engine.resume();
    this.tasto = k;
    this.foroTasto = { hole: (b >= 0 ? b : a) + 1, draw: a >= 0, bend: 0 };
    this.bendTasto = 0;
    this.ultimoArrotondato = null;
    this.oraTasto = this.ora;
    this.engine.keyboardHeld = true;
  }

  private su(ev: KeyboardEvent) {
    const k = ev.key.toLowerCase();
    if (k === " " || k === "arrowdown") { this.piega = false; return; }
    if (k === this.tasto) this.rilascia();
  }

  private rilascia() {
    if (!this.foroTasto) return;
    this.tasto = null;
    this.foroTasto = null;
    this.midiF = null;
    this.midi = null;
    this.engine.keyboardHeld = false;
    this.engine.tracker.force(this.ora, null);
  }
}

let ascolto: Ascolto | null = null;
export const prendiAscolto = () => (ascolto ??= new Ascolto());
