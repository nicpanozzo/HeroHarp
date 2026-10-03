// Copiato da modes/src/riff/partitura.ts con scripts/sync-content.mjs, non modificare qui.
// Logica pura della Strada dei Riff: quando arriva ogni nota, come si giudica un attacco,
// combo e moltiplicatore "in fiamme". Nessuna grafica: testata in tests/riff.test.ts.

export const FINESTRA_PERFETTO = 0.075;
export const FINESTRA_BENE = 0.2;

export type Giudizio = "perfetto" | "bene" | "mancata";

export interface NotaInGioco {
  i: number;
  midi: number;
  foro: string;
  /** Istante (secondi, orologio della canzone) in cui va suonata. */
  t: number;
  durata: number;
  giudizio: Giudizio | null;
  /** Per le note lunghe: secondi tenuti dopo l'attacco. */
  tenuta: number;
}

export interface Esito { nota: NotaInGioco; giudizio: Giudizio; scarto: number; punti: number }

export const moltiplicatoreCombo = (combo: number) => (combo >= 30 ? 4 : combo >= 20 ? 3 : combo >= 10 ? 2 : 1);

export class Partitura {
  combo = 0;
  comboMax = 0;
  punti = 0;
  conteggio = { perfetto: 0, bene: 0, mancata: 0 };

  constructor(readonly note: NotaInGioco[]) {}

  get totale() { return this.note.length; }
  get finita() { return this.note.every((n) => n.giudizio !== null); }
  /** 0..1: perfetto vale 1, bene 0.7. */
  get precisione() {
    const fatte = this.conteggio.perfetto + this.conteggio.bene + this.conteggio.mancata;
    return fatte ? (this.conteggio.perfetto + this.conteggio.bene * 0.7) / fatte : 0;
  }
  get stelle() { const p = this.precisione; return p >= 0.95 ? 3 : p >= 0.8 ? 2 : p >= 0.6 ? 1 : 0; }

  /** Prossima nota ancora da giudicare. */
  prossima(): NotaInGioco | undefined { return this.note.find((n) => n.giudizio === null); }

  /**
   * Un attacco del giocatore all'istante t (orologio della canzone).
   * Prende la nota più vicina nel tempo con la stessa altezza, dentro la finestra.
   * `senzaTempo` (modalità Prova): basta la nota giusta, il tempo non conta.
   */
  attacco(midi: number, t: number, senzaTempo = false): Esito | null {
    let migliore: NotaInGioco | null = null;
    for (const n of this.note) {
      if (n.giudizio !== null || n.midi !== midi) continue;
      if (senzaTempo) { if (n === this.prossima()) migliore = n; break; }
      if (Math.abs(n.t - t) <= FINESTRA_BENE && (!migliore || Math.abs(n.t - t) < Math.abs(migliore.t - t))) migliore = n;
      if (n.t - t > FINESTRA_BENE) break;
    }
    if (!migliore) return null;
    const scarto = senzaTempo ? 0 : t - migliore.t;
    const giudizio: Giudizio = Math.abs(scarto) <= FINESTRA_PERFETTO ? "perfetto" : "bene";
    migliore.giudizio = giudizio;
    this.conteggio[giudizio]++;
    this.combo++;
    this.comboMax = Math.max(this.comboMax, this.combo);
    const punti = (giudizio === "perfetto" ? 100 : 60) * moltiplicatoreCombo(this.combo);
    this.punti += punti;
    return { nota: migliore, giudizio, scarto, punti };
  }

  /** Note lunghe: punti extra mentre la nota resta quella giusta. */
  tieni(midi: number | null, dt: number, t: number): number {
    let extra = 0;
    for (const n of this.note) {
      if (n.giudizio === null || n.giudizio === "mancata" || n.durata < 0.6) continue;
      if (t < n.t || t > n.t + n.durata) continue;
      if (midi === n.midi) { n.tenuta += dt; extra += dt * 40 * moltiplicatoreCombo(this.combo); }
    }
    this.punti += extra;
    return extra;
  }

  /** Segna come mancate le note passate da troppo tempo. Restituisce quelle appena mancate. */
  scadute(t: number): NotaInGioco[] {
    const out: NotaInGioco[] = [];
    for (const n of this.note) {
      if (n.giudizio === null && t - n.t > FINESTRA_BENE) {
        n.giudizio = "mancata";
        this.conteggio.mancata++;
        this.combo = 0;
        out.push(n);
      }
    }
    return out;
  }
}
