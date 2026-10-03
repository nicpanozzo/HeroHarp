// Copiato da modes/src/core/suono.ts con scripts/sync-content.mjs, non modificare qui.
// Audio delle modalità: un solo bus che va alle casse e, quando serve, al registratore.
// Basi ed effetti sono quelli dello stile (style/src), sullo stesso AudioContext del microfono.

import { GeneratoreBasi, type Strumento } from "../../style/basi";
import { EffettiSonori } from "../../style/effetti";
import { getEngine } from "../../audio/engine";

export class Suono {
  readonly ctx = getEngine().ctx;
  readonly bus: GainNode;
  /** Volume della band, separato dagli effetti: si abbassa mentre suoni (con le cuffie). */
  readonly volumeBand: GainNode;
  readonly basi: GeneratoreBasi;
  readonly effetti: EffettiSonori;
  private sganci: (() => void)[] = [];

  constructor() {
    this.bus = this.ctx.createGain();
    this.bus.connect(this.ctx.destination);
    this.volumeBand = this.ctx.createGain();
    this.volumeBand.connect(this.bus);
    this.basi = new GeneratoreBasi(this.ctx, this.volumeBand);
    this.effetti = new EffettiSonori(this.ctx, this.bus);
  }

  /** Iscrive un ascoltatore alla base e lo ricorda, così `pulisci()` lo toglie a fine scena. */
  suBattuta(cb: (n: number, t: number) => void) { this.sganci.push(this.basi.suBattuta(cb)); }
  suBattito(cb: (n: number, t: number) => void) { this.sganci.push(this.basi.suBattito(cb)); }

  /** Cambia i musicisti al volo (la band cresce con il pubblico). Vale dalla croma successiva. */
  impostaBand(band: string[]) {
    this.basi.impostaBand(band as Strumento[]);
  }

  /**
   * Quali musicisti possono suonare. Con le casse restano solo i tamburi (senza altezza):
   * il banco di prova del gioco ha misurato che una base intonata dagli altoparlanti
   * confonde il riconoscimento, perché contiene le stesse note dell'armonica.
   */
  bandSicura(band: string[], cuffie: boolean): Strumento[] {
    if (cuffie) return band as Strumento[];
    const tamburi = band.filter((s) => s === "piede" || s === "spazzole" || s === "batteria" || s === "treno") as Strumento[];
    return tamburi.length ? tamburi : ["piede"];
  }

  /** Con le cuffie la band fa un passo indietro mentre suoni, e torna piena nelle pause. */
  abbassaBand(suoni: boolean, cuffie: boolean) {
    const meta = cuffie && suoni ? 0.4 : 1;
    this.volumeBand.gain.setTargetAtTime(meta, this.ctx.currentTime, suoni ? 0.03 : 0.25);
  }

  pulisci() {
    this.sganci.forEach((f) => f());
    this.sganci = [];
    this.basi.ferma(0.3);
  }
}

let suono: Suono | null = null;
export const prendiSuono = () => (suono ??= new Suono());

/**
 * Registra quello che esce (base + effetti) insieme al microfono, senza mandare il microfono alle casse.
 * Risultato: un file audio dell'assolo con la band, da riascoltare o scaricare.
 */
export class Registratore {
  private rec: MediaRecorder | null = null;
  private pezzi: Blob[] = [];
  private micStream: MediaStream | null = null;
  url: string | null = null;
  tipo = "audio/webm";

  static disponibile() { return typeof MediaRecorder !== "undefined"; }

  async avvia(conMicrofono: boolean) {
    const { ctx, bus } = prendiSuono();
    const dest = ctx.createMediaStreamDestination();
    bus.connect(dest);
    if (conMicrofono) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
        const src = ctx.createMediaStreamSource(this.micStream);
        const g = ctx.createGain(); g.gain.value = 1.6;
        src.connect(g).connect(dest);
      } catch { /* senza microfono si registra solo la band */ }
    }
    const tipi = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    this.tipo = tipi.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
    this.rec = new MediaRecorder(dest.stream, this.tipo ? { mimeType: this.tipo } : undefined);
    this.pezzi = [];
    this.rec.ondataavailable = (e) => e.data.size && this.pezzi.push(e.data);
    this.rec.start(500);
    this.sgancia = () => { try { bus.disconnect(dest); } catch { /* già scollegato */ } };
  }

  private sgancia = () => {};

  ferma(): Promise<string | null> {
    return new Promise((ok) => {
      if (!this.rec || this.rec.state === "inactive") return ok(this.url);
      this.rec.onstop = () => {
        this.sgancia();
        this.micStream?.getTracks().forEach((t) => t.stop());
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = this.pezzi.length ? URL.createObjectURL(new Blob(this.pezzi, { type: this.tipo || "audio/webm" })) : null;
        ok(this.url);
      };
      this.rec.stop();
    });
  }

  get estensione() { return this.tipo.includes("mp4") ? "m4a" : this.tipo.includes("ogg") ? "ogg" : "webm"; }
}
