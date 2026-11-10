// Copiato da modes/src/brano/analisi.ts con scripts/sync-content.mjs, non modificare qui.
// Impara un brano: l'ascolto della traccia che carica il giocatore.
// Tutto qui è puro (niente Web Audio, niente Phaser): si prova con vitest su audio sintetico.
//
// 1. tracciaAltezze: segue l'armonica nel missaggio (passa-alto, YIN ristretto all'estensione dell'armonica).
// 2. estraiNote: dalle altezze alle note suonabili sull'armonica scelta (con i bend), con inizio e durata.
// 3. dividiFrasi: le pause dell'armonica diventano i confini delle frasi da imparare.
// 4. GiudiceFrase: confronta quello che suoni con le note della frase, mentre la traccia scorre.

import { yin } from "../../audio/yin";
import { keyById, midiToTabs, type Tab } from "../../harp";
import type { TonalitaArmonica } from "../../style/basi";
import { foroPerMidi } from "../core/armonica";

/** Frequenza a cui si analizza: l'armonica sta tutta sotto i 2,5 kHz di fondamentale. */
export const SR_ANALISI = 11025;
/** Passo tra un frame e l'altro (11,6 ms a 11025 Hz). */
export const PASSO = 128;
const FINESTRA = 512;

export interface Traccia {
  /** Secondi tra un frame e l'altro. */
  passo: number;
  /** Altezza (MIDI con i centesimi) per frame, NaN dove l'armonica tace. */
  midi: Float32Array;
  /** Volume (RMS dopo il passa-alto) per frame: distingue una nota ripetuta da un colpo di rullante. */
  livello?: Float32Array;
}

/** Passa-alto del secondo ordine (RBJ): via basso e cassa, che confondono la ricerca dell'altezza. */
export function passaAlto(x: Float32Array, sr: number, fc = 200): Float32Array {
  const w = (2 * Math.PI * fc) / sr, q = Math.SQRT1_2;
  const a = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/**
 * Segue l'altezza dell'armonica frame per frame. `campioni` deve essere già a SR_ANALISI (mono):
 * nel browser lo fa un OfflineAudioContext, nei test il generatore della traccia di prova.
 * `avanzamento` riceve 0..1 e può restituire una promessa per lasciare respirare l'interfaccia.
 */
export async function tracciaAltezze(campioni: Float32Array, tonalita: TonalitaArmonica = "C",
  avanzamento?: (p: number) => void | Promise<void>): Promise<Traccia> {
  const x = passaAlto(campioni, SR_ANALISI);
  const n = Math.max(0, Math.floor((x.length - FINESTRA) / PASSO) + 1);
  const midi = new Float32Array(n).fill(NaN);
  const livelli = new Float32Array(n);
  // estensione dell'armonica scelta: sotto il foro 1 soffiato YIN scambierebbe gli accordi della band
  // (o un multiplo del periodo) per l'armonica
  const minHz = 440 * Math.pow(2, (keyById(tonalita).root - 69) / 12) * 0.96, maxHz = 2700;
  const buf = new Float32Array(FINESTRA);
  for (let f = 0; f < n; f++) {
    const o = f * PASSO;
    let e = 0;
    for (let i = 0; i < FINESTRA; i++) { const v = x[o + i]; buf[i] = v; e += v * v; }
    livelli[f] = Math.sqrt(e / FINESTRA);
    const r = yin(buf, SR_ANALISI, 0.35, minHz, maxHz);
    if (r && r.clarity >= 0.62) midi[f] = 69 + 12 * Math.log2(r.hz / 440);
    if (avanzamento && f % 2000 === 1999) await avanzamento(f / n);
  }
  // soglia di volume: sotto un quinto del picco tipico è coda di riverbero o rumore
  const ordinati = Float32Array.from(livelli).sort();
  const picco = ordinati[Math.floor(ordinati.length * 0.95)] ?? 0;
  for (let f = 0; f < n; f++) if (livelli[f] < picco * 0.18) midi[f] = NaN;
  await avanzamento?.(1);
  return { passo: PASSO / SR_ANALISI, midi, livello: livelli };
}

export interface NotaBrano {
  /** Inizio e durata in secondi, sul tempo della traccia. */
  t: number;
  durata: number;
  midi: number;
  tab: Tab;
  /** Le note brevissime (abbellimenti) si vedono ma non contano nel punteggio. */
  conta: boolean;
}

const suonabile = (midi: number, k: TonalitaArmonica) => midiToTabs(midi, keyById(k)).length > 0;

/** Dalle altezze alle note: arrotonda, toglie i salti di un frame, tiene solo quello che l'armonica può suonare. */
export function estraiNote(tr: Traccia, tonalita: TonalitaArmonica): NotaBrano[] {
  const n = tr.midi.length;
  const grezzo: (number | null)[] = new Array(n);
  for (let f = 0; f < n; f++) {
    const v = tr.midi[f];
    if (Number.isNaN(v)) { grezzo[f] = null; continue; }
    const r = Math.round(v);
    // le note crescenti o calanti di poco si accettano; quelle "in mezzo" (bend in corso) restano al semitono vicino
    grezzo[f] = suonabile(r, tonalita) ? r : null;
  }
  // moda su 5 frame: via i salti di ottava e i frame isolati
  const liscio: (number | null)[] = new Array(n);
  for (let f = 0; f < n; f++) {
    const conta = new Map<number | null, number>();
    for (let d = -2; d <= 2; d++) { const v = grezzo[f + d] ?? null; conta.set(v, (conta.get(v) ?? 0) + 1); }
    let meglio: number | null = grezzo[f], max = 0;
    for (const [v, c] of conta) if (c > max || (c === max && v === grezzo[f])) { meglio = v; max = c; }
    liscio[f] = meglio;
  }
  const note: { f0: number; f1: number; midi: number }[] = [];
  const liv = tr.livello;
  const cala = (a: number, b: number) => {
    if (!liv) return true;
    const rif = Math.min(liv[a] ?? 0, liv[b] ?? 0);
    for (let k = a + 1; k < b; k++) if (liv[k] < rif * 0.55) return true;
    return false;
  };
  let f = 0;
  while (f < n) {
    const v = liscio[f];
    if (v === null) { f++; continue; }
    let g = f;
    while (g + 1 < n && liscio[g + 1] === v) g++;
    if (g - f + 1 >= 5) {
      const prima = note[note.length - 1];
      // stessa nota spezzata da un buco breve: è una nota sola, a meno che il volume non cali (nota ribattuta).
      // Un colpo di rullante o un accordo della band coprono l'armonica senza abbassare il volume.
      if (prima && prima.midi === v && (f - prima.f1 <= 4 || (f - prima.f1 <= 20 && !cala(prima.f1, f)))) prima.f1 = g;
      else note.push({ f0: f, f1: g, midi: v });
    }
    f = g + 1;
  }
  // Gli attacchi: la band (un accordo, il rullante) spesso copre i primi frame della nota, o fa scegliere
  // a YIN un multiplo del periodo (l'ottava sotto). Si recupera l'inizio vero all'indietro.
  const sotto = (a: number, b: number) => a === b - 12 || a === b - 19 || a === b - 24;
  for (let i = 0; i < note.length; i++) {
    const x = note[i];
    const prima = note[i - 1];
    if (prima && sotto(prima.midi, x.midi) && x.f0 - prima.f1 <= 3 && (prima.f1 - prima.f0 + 1) * tr.passo < 0.32) {
      x.f0 = prima.f0; note.splice(i - 1, 1); i--; continue;
    }
    const limite = Math.max(prima ? prima.f1 + 2 : 0, x.f0 - 22);
    let k = x.f0 - 1;
    while (k >= limite) {
      const v = tr.midi[k];
      const vuoto = Number.isNaN(v) || sotto(Math.round(v), x.midi) || Math.round(v) === x.midi;
      if (!vuoto || (liv && liv[k] < (liv[x.f0] ?? 0) * 0.5)) break;
      k--;
    }
    x.f0 = k + 1;
  }
  // Note fantasma all'ottava sotto (o alla dodicesima) attaccate a una nota vera: sono la stessa nota.
  for (let i = 0; i < note.length; i++) {
    const x = note[i];
    if ((x.f1 - x.f0 + 1) * tr.passo >= 0.4) continue;
    const vicina = [note[i - 1], note[i + 1]].find((y) => y && sotto(x.midi, y.midi) && Math.min(Math.abs(y.f0 - x.f1), Math.abs(x.f0 - y.f1)) <= 14);
    if (!vicina) continue;
    vicina.f0 = Math.min(vicina.f0, x.f0); vicina.f1 = Math.max(vicina.f1, x.f1);
    note.splice(i, 1); i--;
  }
  return note.map((x) => {
    const durata = (x.f1 - x.f0 + 1) * tr.passo;
    return { t: x.f0 * tr.passo, durata, midi: x.midi, tab: foroPerMidi(x.midi, tonalita)!, conta: durata >= 0.085 };
  });
}

export interface Frase {
  /** Indici (estremi inclusi) delle note della frase. */
  da: number;
  a: number;
  /** Inizio e fine della frase sulla traccia, con un filo di margine. */
  inizio: number;
  fine: number;
}

/**
 * Le pause dell'armonica diventano confini. Poi si sistemano le frasi troppo corte (unite alla vicina
 * più stretta) e quelle troppo lunghe (spezzate nella pausa più ampia), così ognuna si impara in un fiato.
 */
export function dividiFrasi(note: NotaBrano[], pausa = 0.5, minima = 1.4, massima = 8): Frase[] {
  if (!note.length) return [];
  const fine = (i: number) => note[i].t + note[i].durata;
  let gruppi: [number, number][] = [];
  let da = 0;
  for (let i = 1; i < note.length; i++) {
    if (note[i].t - fine(i - 1) >= pausa) { gruppi.push([da, i - 1]); da = i; }
  }
  gruppi.push([da, note.length - 1]);
  const lungh = (g: [number, number]) => fine(g[1]) - note[g[0]].t;
  // spezza le frasi troppo lunghe nella pausa più grande
  const spezza = (g: [number, number]): [number, number][] => {
    if (lungh(g) <= massima || g[1] - g[0] < 3) return [g];
    let migliore = g[0] + 1, buco = -1;
    for (let i = g[0] + 1; i <= g[1]; i++) {
      const b = note[i].t - fine(i - 1);
      // a parità di pausa, meglio a metà
      const centro = 1 - Math.abs((note[i].t - note[g[0]].t) / lungh(g) - 0.5);
      if (b + centro * 0.05 > buco) { buco = b + centro * 0.05; migliore = i; }
    }
    return [...spezza([g[0], migliore - 1]), ...spezza([migliore, g[1]])];
  };
  gruppi = gruppi.flatMap(spezza);
  // unisci le frasi troppo corte alla vicina più stretta
  let cambiato = true;
  while (cambiato && gruppi.length > 1) {
    cambiato = false;
    for (let k = 0; k < gruppi.length; k++) {
      const g = gruppi[k];
      if (lungh(g) >= minima && g[1] - g[0] >= 2) continue;
      const prima = k > 0 ? note[g[0]].t - fine(gruppi[k - 1][1]) : Infinity;
      const dopo = k < gruppi.length - 1 ? note[gruppi[k + 1][0]].t - fine(g[1]) : Infinity;
      if (prima === Infinity && dopo === Infinity) break;
      const j = prima <= dopo ? k - 1 : k + 1;
      const unito: [number, number] = [Math.min(g[0], gruppi[j][0]), Math.max(g[1], gruppi[j][1])];
      if (lungh(unito) > massima * 1.25) continue;
      gruppi.splice(Math.min(k, j), 2, unito);
      cambiato = true;
      break;
    }
  }
  return gruppi.map(([a, b]) => ({ da: a, a: b, inizio: Math.max(0, note[a].t - 0.12), fine: fine(b) + 0.2 }));
}

/**
 * Su quale armonica è suonato il brano? Si prova ogni tonalità: vince quella in cui le altezze
 * cadono più spesso su note senza bend. A parità, conta il punto d'appoggio della seconda posizione.
 */
export function indovinaTonalita(tr: Traccia): TonalitaArmonica[] {
  const conti = new Map<number, number>();
  for (const v of tr.midi) if (!Number.isNaN(v)) { const r = Math.round(v); conti.set(r, (conti.get(r) ?? 0) + 1); }
  const TON: TonalitaArmonica[] = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#"];
  const punti = TON.map((k) => {
    const key = keyById(k);
    let p = 0;
    for (const [m, c] of conti) {
      const tabs = midiToTabs(m, key);
      p += c * (tabs.some((x) => x.bend === 0) ? 1 : tabs.length ? 0.25 : -1.2);
    }
    // seconda posizione: il 2 aspirato (la tonica del blues) è spesso la nota più suonata
    const due = key.root + 7;
    let appoggio = 0;
    for (const [m, c] of conti) if ((((m - due) % 12) + 12) % 12 === 0) appoggio += c;
    return { k, p: p + appoggio * 0.15 };
  });
  return punti.sort((a, b) => b.p - a.p).map((x) => x.k);
}

/** Le stelle della frase a ogni gradino: con la tab, tab a scomparsa, a memoria. */
export const SOGLIE = [0.6, 0.7, 0.75] as const;

export type Esito = "preso" | "perso" | null;

/**
 * Giudica una frase mentre scorre. I tempi sono sempre sul tempo della traccia (secondi),
 * `tolleranza` anche: chi rallenta la traccia la passa già convertita.
 */
export class GiudiceFrase {
  readonly esiti: Esito[];
  constructor(readonly note: NotaBrano[], public tolleranza = 0.3) {
    this.esiti = note.map(() => null);
  }

  private apre(i: number) { return this.note[i].t - this.tolleranza; }
  private chiude(i: number) { const n = this.note[i]; return n.t + Math.max(this.tolleranza, n.durata * 0.8); }

  /** Un attacco: prende la prima nota ancora aperta con la stessa altezza. Restituisce l'indice o -1. */
  attacco(t: number, midi: number): number {
    for (let i = 0; i < this.note.length; i++) {
      if (this.esiti[i] !== null || this.note[i].midi !== midi) continue;
      if (t >= this.apre(i) && t <= this.chiude(i)) { this.esiti[i] = "preso"; return i; }
    }
    return -1;
  }

  /** La nota tenuta (senza un nuovo attacco) prende la nota attesa se è la stessa e l'hai già iniziata. */
  tenuta(t: number, midi: number | null): number {
    if (midi === null) return -1;
    for (let i = 0; i < this.note.length; i++) {
      if (this.esiti[i] !== null || this.note[i].midi !== midi) continue;
      if (t >= this.note[i].t - 0.05 && t <= this.chiude(i)) { this.esiti[i] = "preso"; return i; }
    }
    return -1;
  }

  /** Chiude le note ormai passate. Restituisce gli indici appena persi. */
  aggiorna(t: number): number[] {
    const persi: number[] = [];
    for (let i = 0; i < this.note.length; i++) {
      if (this.esiti[i] === null && t > this.chiude(i) + 0.05) { this.esiti[i] = "perso"; persi.push(i); }
    }
    return persi;
  }

  /** Quota di note prese, contando solo quelle che valgono (niente abbellimenti). */
  get precisione() {
    let tot = 0, presi = 0;
    this.note.forEach((n, i) => { if (!n.conta) return; tot++; if (this.esiti[i] === "preso") presi++; });
    return tot ? presi / tot : 1;
  }

  /** Stella guadagnata al gradino `passo` (0, 1, 2), o 0. */
  stelleAl(passo: number) { return this.precisione >= SOGLIE[passo] ? passo + 1 : 0; }
}
