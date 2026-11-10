// Copiato da modes/src/brano/lettore.ts con scripts/sync-content.mjs, non modificare qui.
// Il lettore della traccia: suona un pezzo del brano, anche rallentato senza cambiare intonazione,
// e sa "nascondere" l'armonica originale.
//
// Come si nasconde l'armonica senza avere le tracce separate: l'ascolto (analisi.ts) sa già quale nota
// suona l'armonica in ogni istante. Una fila di filtri notch segue quella nota e le sue armoniche e le
// scava via dal missaggio, frame per frame. La band resta, l'armonica diventa un'ombra lontana.

import { getEngine } from "../../audio/engine";
import type { Traccia } from "./analisi";

/** Armoniche scavate (la fondamentale e le prime due due volte, per un taglio più profondo). */
const ARMONICHE = [1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8];
const PARCHEGGIO = 20000;

export class Lettore {
  readonly ctx = getEngine().ctx;
  readonly el: HTMLAudioElement;
  private sorgente: MediaElementAudioSourceNode | null = null;
  private dritto: GainNode;
  private nascosto: GainNode;
  readonly uscita: GainNode;
  private notch: BiquadFilterNode[] = [];
  private fine = Infinity;
  private ultimaNota = -1;
  private silenzioDa = 0;
  /** true mentre i filtri scavano l'armonica. */
  nascondi = false;
  suFine: (() => void) | null = null;
  /** Cresce a ogni "suona": una pausa programmata non ferma un pezzo partito dopo. */
  private giro = 0;
  /** true tra il comando di suonare e il primo frame nella posizione giusta. */
  private daRiposizionare = false;
  private da = 0;

  constructor(url: string, private traccia: Traccia) {
    this.el = new Audio();
    this.el.src = url;
    this.el.preload = "auto";
    this.el.crossOrigin = "anonymous";
    const pp = this.el as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };
    pp.preservesPitch = true; pp.webkitPreservesPitch = true; pp.mozPreservesPitch = true;
    this.uscita = this.ctx.createGain();
    this.uscita.connect(this.ctx.destination);
    this.dritto = this.ctx.createGain();
    this.nascosto = this.ctx.createGain();
    this.nascosto.gain.value = 0;
    this.dritto.connect(this.uscita);
    this.nascosto.connect(this.uscita);
    let prima: AudioNode | null = null;
    for (const k of ARMONICHE) {
      const f = this.ctx.createBiquadFilter();
      f.type = "notch";
      f.frequency.value = PARCHEGGIO;
      f.Q.value = k === 1 ? 5 : 7;
      if (prima) prima.connect(f);
      prima = f;
      this.notch.push(f);
    }
    prima!.connect(this.nascosto);
    try {
      this.sorgente = this.ctx.createMediaElementSource(this.el);
      this.sorgente.connect(this.dritto);
      this.sorgente.connect(this.notch[0]);
    } catch { /* senza Web Audio la traccia suona com'è */ }
  }

  get pronto() { return this.el.readyState >= 2; }

  /** Attende che il file sia leggibile (metadati e primi dati). */
  attendi(): Promise<void> {
    if (this.pronto) return Promise.resolve();
    return new Promise((ok) => {
      const via = () => { this.el.removeEventListener("canplay", via); ok(); };
      this.el.addEventListener("canplay", via);
      setTimeout(via, 4000);
    });
  }

  /** Il punto della traccia che si sta suonando (secondi). */
  get tempo() { return this.el.currentTime; }
  get velocita() { return this.el.playbackRate; }

  /** Suona da `da` a `a` (secondi della traccia), alla velocità scelta, con o senza armonica. */
  async suona(da: number, a: number, velocita: number, nascondi: boolean) {
    this.giro++;
    this.fine = a;
    this.da = da;
    this.daRiposizionare = true;
    await this.ctx.resume();
    this.nascondi = nascondi;
    const ora = this.ctx.currentTime;
    this.dritto.gain.setTargetAtTime(nascondi ? 0 : 1, ora, 0.02);
    this.nascosto.gain.setTargetAtTime(nascondi ? 1.15 : 0, ora, 0.02);
    this.el.playbackRate = velocita;
    this.el.currentTime = Math.max(0, da);
    // entrata morbida: niente clic se si parte a metà di un colpo di batteria
    this.uscita.gain.cancelScheduledValues(ora);
    this.uscita.gain.setValueAtTime(0, ora);
    this.uscita.gain.linearRampToValueAtTime(1, ora + 0.08);
    try { await this.el.play(); } catch { /* il browser vuole un gesto: il prossimo tocco farà partire */ }
  }

  /** Vero quando la traccia suona davvero il pezzo chiesto (non sta ancora cercando la posizione). */
  get inPosizione() {
    if (this.daRiposizionare && !this.el.seeking && !this.el.paused && Math.abs(this.el.currentTime - this.da) < 1.5) this.daRiposizionare = false;
    return !this.daRiposizionare;
  }

  ferma() {
    const ora = this.ctx.currentTime;
    this.uscita.gain.setTargetAtTime(0, ora, 0.03);
    const giro = this.giro;
    setTimeout(() => { if (giro === this.giro) this.el.pause(); }, 120);
    this.fine = Infinity;
  }

  /** Da chiamare a ogni frame: muove i filtri sulla nota dell'armonica e si ferma alla fine del pezzo. */
  aggiorna() {
    const t = this.el.currentTime;
    if (!this.inPosizione) return;
    if (t >= this.fine) {
      this.fine = Infinity;
      this.ferma();
      this.suFine?.();
      return;
    }
    if (!this.nascondi) return;
    // un filo d'anticipo: il filtro deve essere già lì quando la nota arriva alle casse
    const nota = this.notaA(t + 0.03);
    const ora = this.ctx.currentTime;
    if (nota === null) {
      // la coda della nota (riverbero) resta scavata per un attimo
      if (this.ultimaNota >= 0 && ora - this.silenzioDa > 0.12) { this.parcheggia(); this.ultimaNota = -1; }
      return;
    }
    this.silenzioDa = ora;
    if (Math.abs(nota - this.ultimaNota) < 0.08) return;
    this.ultimaNota = nota;
    const hz = 440 * Math.pow(2, (nota - 69) / 12), nyq = this.ctx.sampleRate / 2 - 200;
    this.notch.forEach((f, i) => {
      const fr = hz * ARMONICHE[i];
      f.frequency.setTargetAtTime(fr < nyq ? fr : PARCHEGGIO, ora, 0.006);
    });
  }

  /** L'altezza dell'armonica (MIDI) in un punto della traccia, o null se tace. */
  notaA(t: number): number | null {
    const i = Math.round(t / this.traccia.passo);
    const v = this.traccia.midi[i];
    if (v !== undefined && !Number.isNaN(v)) return v;
    // un frame vuoto in mezzo a una nota (un colpo di rullante) non deve far scattare i filtri
    for (const d of [-2, 2, -4, 4]) { const w = this.traccia.midi[i + d]; if (w !== undefined && !Number.isNaN(w)) return w; }
    return null;
  }

  private parcheggia() {
    const ora = this.ctx.currentTime;
    for (const f of this.notch) f.frequency.setTargetAtTime(PARCHEGGIO, ora, 0.02);
  }

  distruggi() {
    this.el.pause();
    try { this.sorgente?.disconnect(); this.uscita.disconnect(); } catch { /* già scollegato */ }
    this.el.removeAttribute("src");
    this.el.load();
  }
}
