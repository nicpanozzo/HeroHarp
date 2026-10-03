// Copiato da modes/src/jam/giudice.ts con scripts/sync-content.mjs, non modificare qui.
// Il "pubblico" della Jam Libera: ascolta le note e premia le cose che rendono bello un assolo blues.
// Nessuna nota è "sbagliata": il gioco premia il fraseggio, i bend, le note lunghe,
// il cambio d'accordo preso bene, il ritmo e i lick riconosciuti. Logica pura, testata in tests/.

import { foroMidi, soloConBend } from "../core/armonica";
import type { TonalitaArmonica } from "../../style/basi";
import { LICK, type Lick } from "./lick";

export type TipoEvento =
  | "cambio" | "bend" | "blue" | "lunga" | "fiato" | "frase" | "risolta" | "eco" | "tasca"
  | "lick" | "lickNuovo" | "risposta" | "copia" | "consiglioSilenzio" | "consiglioRespira" | "estensione";

export interface EventoJam {
  tipo: TipoEvento;
  punti: number;
  hype: number;
  t: number;
  lick?: Lick;
}

/** Intervalli (semitoni sopra la tonica della base) delle note di ogni accordo di settima. */
const ACCORDO: Record<number, number[]> = { 0: [0, 4, 7, 10], 5: [5, 9, 0, 3], 7: [7, 11, 2, 5] };
const BLUE = [3, 6];

export interface OrologioJam {
  /** Durata di un battito in secondi. */
  battito: number;
  /** Battuta (assoluta) che contiene l'istante t, con il suo inizio e il grado dell'accordo. */
  battuta(t: number): { n: number; inizio: number; grado: number } | null;
}

export interface OpzioniGiudice {
  tonalita: TonalitaArmonica;
  /** Tonica della base (MIDI). */
  tonica: number;
  orologio: OrologioJam;
  /** Lick già scoperti in sessioni precedenti. */
  scoperti?: Iterable<string>;
}

export const LIVELLI_HYPE = [0, 25, 50, 75, 95];
export const livelloHype = (h: number) => LIVELLI_HYPE.filter((l) => h >= l).length - 1;
export const moltiplicatore = (h: number) => [1, 1, 2, 2, 3][livelloHype(h)];

interface NotaSuonata { midi: number; inizio: number; fine: number | null }

export class GiudiceJam {
  hype = 10;
  hypeMax = 10;
  punti = 0;
  readonly statistiche = { note: 0, frasi: 0, bend: 0, cambi: 0, cambiTotali: 0, lick: new Set<string>(), nuoviLick: new Set<string>() };
  readonly scoperti: Set<string>;

  private note: NotaSuonata[] = [];
  private fraseCorrente: NotaSuonata[] = [];
  private frasePrecedente: number[] | null = null;
  private corrente: NotaSuonata | null = null;
  private premiLunga = 0;
  private serieTasca = 0;
  private ultimaFine = -Infinity;
  private ultimoSuono = -Infinity;
  private inizioFlusso: number | null = null;
  private consigliatoRespira = false;
  private consigliatoSilenzio = -Infinity;
  private registriUsati = new Set<"basso" | "alto">();
  private premiatoEstensione = false;
  private licks: { lick: Lick; midi: number[] }[];
  private premioLick = new Map<string, number>();
  private battuteCambio = new Set<number>();
  private battutePremiate = new Set<number>();
  private eventi: EventoJam[] = [];
  /** Finestra di "botta e risposta": [inizio, fine, note della chiamata]. */
  private chiamata: { inizio: number; fine: number; midi: number[]; note: number[]; premiata: boolean } | null = null;

  constructor(readonly o: OpzioniGiudice) {
    this.scoperti = new Set(o.scoperti ?? []);
    this.licks = LICK.map((lick) => ({ lick, midi: lick.fori.map((f) => foroMidi(f, o.tonalita)) }));
  }

  private intervallo(midi: number) { return (((midi - this.o.tonica) % 12) + 12) % 12; }
  private notaAccordo(midi: number, grado: number) { return ACCORDO[grado].includes(this.intervallo(midi)); }

  private evento(tipo: TipoEvento, punti: number, hype: number, t: number, lick?: Lick) {
    const m = moltiplicatore(this.hype);
    this.punti += punti * m;
    // più il pubblico è caldo, più è difficile scaldarlo ancora: la LEGGENDA si guadagna
    this.hype = Math.max(0, Math.min(100, this.hype + (hype > 0 ? hype * (1 - this.hype / 140) : hype)));
    this.hypeMax = Math.max(this.hypeMax, this.hype);
    this.eventi.push({ tipo, punti: punti * m, hype, t, lick });
  }

  /** Eventi accumulati dall'ultima chiamata (da mostrare a schermo). */
  raccogli(): EventoJam[] { const e = this.eventi; this.eventi = []; return e; }

  /** La base segnala l'inizio di una battuta: serve per sapere quando cambia l'accordo. */
  battuta(n: number, grado: number, gradoPrima: number) {
    if (grado !== gradoPrima) { this.battuteCambio.add(n); this.statistiche.cambiTotali++; }
  }

  /** Zia Mae ha suonato una chiamata: la risposta del giocatore va da `fine` a `fine + durata`. */
  apriRisposta(midiChiamata: number[], fineChiamata: number, durata: number) {
    this.chiamata = { inizio: fineChiamata, fine: fineChiamata + durata, midi: midiChiamata, note: [], premiata: false };
  }

  /** Un nuovo attacco di nota. */
  attacco(midi: number, t: number) {
    const ore = this.o.orologio;
    // legato: la nota precedente suonava ancora, quindi nessuna pausa
    const legato = this.corrente !== null && this.corrente.fine === null;
    if (legato) this.corrente!.fine = t;
    const nota: NotaSuonata = { midi, inizio: t, fine: null };
    const pausa = legato ? 0 : t - this.ultimaFine;
    if (this.fraseCorrente.length && pausa >= ore.battito * 0.9) this.chiudiFrase(t);
    if (this.inizioFlusso === null || pausa >= ore.battito * 0.9) { this.inizioFlusso = t; this.consigliatoRespira = false; }
    this.corrente = nota;
    this.note.push(nota);
    this.fraseCorrente.push(nota);
    this.premiLunga = 0;
    this.ultimoSuono = t;
    this.statistiche.note++;

    // Bend e blue note
    if (soloConBend(midi, this.o.tonalita)) { this.statistiche.bend++; this.evento("bend", 6, 4, t); }
    else if (BLUE.includes(this.intervallo(midi))) this.evento("blue", 3, 1, t);

    // Cambio d'accordo preso: nota dell'accordo nuovo appena dopo l'inizio della battuta
    const b = ore.battuta(t + 0.12);
    if (b && this.battuteCambio.has(b.n) && !this.battutePremiate.has(b.n)
        && t >= b.inizio - 0.12 && t <= b.inizio + ore.battito * 0.75 && this.notaAccordo(midi, b.grado)) {
      this.battutePremiate.add(b.n);
      this.statistiche.cambi++;
      this.evento("cambio", 10, 8, t);
    }

    // Ritmo: attacchi vicini alla griglia delle crome shuffle (1 e la terzina finale del battito)
    const bb = ore.battuta(t);
    if (bb) {
      const pos = (t - bb.inizio) / ore.battito;
      const frazione = pos - Math.floor(pos);
      const scarto = Math.min(frazione, Math.abs(frazione - 2 / 3), 1 - frazione) * ore.battito;
      if (scarto < 0.06) {
        if (++this.serieTasca >= 4) { this.serieTasca = 0; this.evento("tasca", 6, 4, t); }
      } else this.serieTasca = 0;
    }

    // Tutta l'armonica: grave e acuto nella stessa jam
    const relativo = midi - foroMidi("1↑", this.o.tonalita);
    if (relativo <= 7) this.registriUsati.add("basso");
    if (relativo >= 24) this.registriUsati.add("alto");
    if (!this.premiatoEstensione && this.registriUsati.size === 2) { this.premiatoEstensione = true; this.evento("estensione", 8, 6, t); }

    // Lick riconosciuti (le ultime note suonate, in ordine)
    const ultime = this.note.slice(-8).map((n) => n.midi);
    for (const { lick, midi: m } of this.licks) {
      if (ultime.length < m.length) continue;
      const coda = ultime.slice(-m.length);
      const ultimoPremio = this.premioLick.get(lick.id) ?? -Infinity;
      if (coda.every((x, i) => x === m[i]) && this.note.length - ultimoPremio >= m.length) {
        this.premioLick.set(lick.id, this.note.length);
        this.statistiche.lick.add(lick.id);
        if (!this.scoperti.has(lick.id)) {
          this.scoperti.add(lick.id);
          this.statistiche.nuoviLick.add(lick.id);
          this.evento("lickNuovo", 20, 12, t, lick);
        } else this.evento("lick", 8, 6, t, lick);
      }
    }

    // Botta e risposta
    if (this.chiamata && t >= this.chiamata.inizio - 0.1 && t <= this.chiamata.fine) this.chiamata.note.push(midi);
  }

  /** Fine della nota corrente (silenzio). */
  rilascio(t: number) {
    if (this.corrente && this.corrente.fine === null) this.corrente.fine = t;
    this.ultimaFine = t;
  }

  /** Da chiamare spesso (ogni frame): note lunghe, frasi, consigli, calo naturale del pubblico. */
  passo(t: number, dt: number, suona: boolean) {
    const battito = this.o.orologio.battito;
    if (suona) this.ultimoSuono = t;
    // Nota tenuta: il pubblico apprezza le note lunghe (più di tutto dopo un bend)
    if (this.corrente && this.corrente.fine === null && suona) {
      const durata = (t - this.corrente.inizio) / battito;
      if (durata >= 1.5 && this.premiLunga === 0) { this.premiLunga = 1; this.evento("lunga", 5, 4, t); }
      if (durata >= 3 && this.premiLunga === 1) { this.premiLunga = 2; this.evento("fiato", 10, 7, t); }
    }
    // Frase finita: almeno un battito di pausa
    if (!suona && this.fraseCorrente.length && t - this.ultimaFine >= battito * 0.9) this.chiudiFrase(t);
    // Troppe note senza respirare (più di 4 battute di fila)
    if (suona && this.inizioFlusso !== null && t - this.inizioFlusso > battito * 16 && !this.consigliatoRespira) {
      this.consigliatoRespira = true;
      this.evento("consiglioRespira", 0, -6, t);
    }
    // Silenzio lungo: il pubblico si distrae
    if (!suona && t - this.ultimoSuono > battito * 8 && t - this.consigliatoSilenzio > battito * 16) {
      this.consigliatoSilenzio = t;
      this.evento("consiglioSilenzio", 0, 0, t);
    }
    // Risposta conclusa
    if (this.chiamata && t > this.chiamata.fine) this.valutaRisposta(t);
    // Il pubblico si raffredda piano piano, di più se è già molto caldo
    const calo = (suona ? 1 : 1.8) + (this.hype / 100) * 3.5 + (this.consigliatoRespira ? 2 : 0);
    this.hype = Math.max(0, this.hype - calo * dt);
  }

  private chiudiFrase(t: number) {
    const frase = this.fraseCorrente;
    this.fraseCorrente = [];
    if (frase.length < 2) return;
    this.statistiche.frasi++;
    this.evento("frase", Math.min(frase.length, 8), 3, t);
    const ultima = frase[frase.length - 1];
    const b = this.o.orologio.battuta(ultima.inizio);
    if (b && this.notaAccordo(ultima.midi, b.grado) && this.intervallo(ultima.midi) === (b.grado % 12)) this.evento("risolta", 5, 3, t);
    // Eco: stessa forma della frase precedente (stessi salti tra le note), anche trasposta
    const forma = frase.slice(1).map((n, i) => n.midi - frase[i].midi);
    if (this.frasePrecedente && forma.length >= 2 && Math.abs(forma.length - this.frasePrecedente.length) <= 1) {
      const k = Math.min(3, forma.length, this.frasePrecedente.length);
      if (forma.slice(0, k).every((x, i) => x === this.frasePrecedente![i])) this.evento("eco", 8, 6, t);
    }
    this.frasePrecedente = forma;
  }

  private valutaRisposta(t: number) {
    const c = this.chiamata!;
    this.chiamata = null;
    if (c.note.length < 2) return;
    const k = Math.min(c.midi.length, c.note.length);
    let uguali = 0;
    for (let i = 0; i < k; i++) if (c.note[i] === c.midi[i]) uguali++;
    if (uguali >= Math.max(2, c.midi.length - 1)) this.evento("copia", 12, 8, t);
    else this.evento("risposta", 8, 6, t);
  }
}
