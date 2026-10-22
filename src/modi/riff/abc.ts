// Copiato da modes/src/riff/abc.ts con scripts/sync-content.mjs, non modificare qui.
// Un piccolo lettore di notazione ABC, la scrittura delle raccolte di musica tradizionale
// (O'Neill, Ryan's Mammoth...). Serve ai brani irlandesi della Strada dei Riff: la melodia resta
// scritta come nella fonte, qui si trasporta e si trasforma in intavolatura per l'armonica.
// Copre quello che usano i brani: tonalità e modi, note, alterazioni, ottave, durate, ritmo puntato
// (> e <), terzine, legature di valore e pause. Abbellimenti, accordi e diteggiature si ignorano.
// Le ripetizioni non si leggono: i brani si scrivono già "srotolati", nell'ordine in cui si suonano.

import { midiToTabs, keyById } from "../../harp";
import { scriviForo, type Tab } from "../core/armonica";

export interface NotaAbc { midi: number; inizio: number; durata: number }

/** Semitoni del modo dalla tonica (scala di sette note). */
const MODI: Record<string, number[]> = {
  maj: [0, 2, 4, 5, 7, 9, 11], ion: [0, 2, 4, 5, 7, 9, 11],
  min: [0, 2, 3, 5, 7, 8, 10], aeo: [0, 2, 3, 5, 7, 8, 10], m: [0, 2, 3, 5, 7, 8, 10],
  dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10],
};
const LETTERE = "CDEFGAB";
const NATURALI = [0, 2, 4, 5, 7, 9, 11];

/** Alterazione di ogni lettera nella tonalità: "G" → F diesis, "Edor" → F e C diesis, "Amix" → F, C diesis. */
export function armatura(k: string): Record<string, number> {
  const m = /^([A-G])([#b]?)\s*([A-Za-z]*)$/.exec(k.trim());
  if (!m) throw new Error(`Tonalità ABC non valida: ${k}`);
  const modo = MODI[m[3].toLowerCase().slice(0, 3) || "maj"] ?? MODI[m[3].toLowerCase()];
  if (!modo) throw new Error(`Modo ABC non valido: ${k}`);
  const l0 = LETTERE.indexOf(m[1]);
  const tonica = NATURALI[l0] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const out: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const l = (l0 + i) % 7;
    let d = (tonica + modo[i] - NATURALI[l]) % 12;
    if (d > 6) d -= 12;
    if (d < -6) d += 12;
    out[LETTERE[l]] = d;
  }
  return out;
}

const frazione = (s: string): number => { const [a, b] = s.split("/").map(Number); return b ? a / b : a; };

/**
 * Legge la melodia. `unita` è la nota base (L:, es. "1/8"), `battito` quanto dura un battito del gioco
 * (es. "3/8" per una giga: un battito ogni tre crome). Le durate tornano in battiti.
 */
export function leggiAbc(musica: string, o: { tonalita: string; unita: string; battito: string; semitoni?: number }): NotaAbc[] {
  const arm = armatura(o.tonalita);
  const perBattito = frazione(o.battito) / frazione(o.unita);
  const note: NotaAbc[] = [];
  // tolti abbellimenti {..}, accordi e testi "..", decorazioni !..! e +..+
  const s = musica.replace(/\{[^}]*\}/g, "").replace(/"[^"]*"/g, "").replace(/![^!]*!|\+[^+]*\+/g, "");
  let t = 0, i = 0, inBattuta: Record<string, number> = {};
  let terzina = { fattore: 1, restanti: 0 }, legata = false, puntato: { verso: ">" | "<"; n: number } | null = null;
  while (i < s.length) {
    const c = s[i];
    if (c === "|") { inBattuta = {}; i++; continue; }
    if (c === "(" && /\d/.test(s[i + 1] ?? "")) {
      // (3 = tre note nel tempo di due, (2 = due nel tempo di tre
      const p = Number(s[i + 1]);
      terzina = { fattore: p === 2 ? 3 / 2 : p === 3 ? 2 / 3 : (p - 1) / p, restanti: p };
      i += 2; continue;
    }
    if (c === "-") { legata = true; i++; continue; }
    if (c === ">" || c === "<") {
      // ritmo puntato: la nota prima si allunga (>) o si accorcia (<), quella dopo il contrario
      let n = 0;
      while (s[i] === c) { n++; i++; }
      const prima = note[note.length - 1] ?? null;
      const k = 1 - Math.pow(0.5, n);
      if (prima) { const d = prima.durata * (c === ">" ? k : -k); prima.durata += d; t += d; }
      puntato = { verso: c, n };
      continue;
    }
    const m = /^([_^=]*)([A-Ga-gzx])([',]*)(\d*\/*\d*)/.exec(s.slice(i));
    if (!m) { i++; continue; }
    i += m[0].length;
    let d = 1;
    if (m[4]) {
      const [num, ...resto] = m[4].split("/");
      d = num ? Number(num) : 1;
      if (resto.length) {
        const den = resto[resto.length - 1];
        d /= den ? Number(den) : Math.pow(2, resto.length);
      }
    }
    if (terzina.restanti > 0) { d *= terzina.fattore; terzina.restanti--; }
    if (puntato) { const k = 1 - Math.pow(0.5, puntato.n); d *= puntato.verso === ">" ? 1 - k : 1 + k; puntato = null; }
    const durata = d / perBattito;
    if (m[2] === "z" || m[2] === "x") { t += durata; legata = false; continue; }
    const lettera = m[2].toUpperCase();
    let alt = arm[lettera];
    if (m[1]) {
      alt = m[1] === "=" ? 0 : [...m[1]].reduce((a, ch) => a + (ch === "^" ? 1 : -1), 0);
      inBattuta[lettera + (m[2] === lettera ? "" : "'")] = alt;
    } else if (inBattuta[lettera + (m[2] === lettera ? "" : "'")] !== undefined) alt = inBattuta[lettera + (m[2] === lettera ? "" : "'")];
    let midi = 60 + NATURALI[LETTERE.indexOf(lettera)] + alt + (m[2] === lettera ? 0 : 12);
    for (const ch of m[3]) midi += ch === "'" ? 12 : -12;
    midi += o.semitoni ?? 0;
    const prima = note[note.length - 1];
    if (legata && prima && prima.midi === midi) prima.durata += durata;
    else note.push({ midi, inizio: t, durata });
    legata = false;
    t += durata;
  }
  // niente errori di arrotondamento dalle terzine: i tempi si fermano al millesimo di battito
  return note.map((n) => ({ midi: n.midi, inizio: Math.round(n.inizio * 1000) / 1000, durata: Math.round(n.durata * 1000) / 1000 }));
}

/**
 * Dalla melodia (già trasportata per l'armonica in Do) all'intavolatura: solo fori senza bend,
 * e tra due fori possibili (il Sol: 2 aspirato o 3 soffiato) quello più vicino alla nota prima.
 * Lancia un errore se una nota si può suonare solo piegando: i brani devono restare facili da prendere.
 */
export function inIntavolatura(note: NotaAbc[]): { foro: string; inizio: number; durata: number }[] {
  const doMaggiore = keyById("C");
  let prima = 4;
  return note.map((n) => {
    const fori = midiToTabs(n.midi, doMaggiore).filter((x: Tab) => x.bend === 0);
    if (!fori.length) throw new Error(`Nota senza foro libero: midi ${n.midi} a battito ${n.inizio}`);
    const scelto = [...fori].sort((a, b) => Math.abs(a.hole - prima) - Math.abs(b.hole - prima) || Number(a.draw) - Number(b.draw))[0];
    prima = scelto.hole;
    return { foro: scriviForo(scelto), inizio: n.inizio, durata: n.durata };
  });
}
