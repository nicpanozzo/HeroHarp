// Copiato da modes/src/volo/voli.ts con scripts/sync-content.mjs, non modificare qui.
// I voli della lucciola: percorsi di luci da seguire con l'altezza della nota.
// Notazione: "foro" o "foro*2" tiene la nota (una scia di luci), "a>b*2" scivola da a a b (bend o rilascio),
// "-" = pausa. Le durate sono in battiti.

import { foroMidi, leggiForo, scriviForo } from "../core/armonica";
import type { TonalitaArmonica } from "../../style/basi";

export interface Tratto { da: string; a: string; inizio: number; durata: number }

export interface Volo {
  id: string;
  nome: { it: string; en: string };
  descr: { it: string; en: string };
  bpm: number;
  tratti: Tratto[];
  battiti: number;
}

export function leggiVolo(s: string): { tratti: Tratto[]; battiti: number } {
  const tratti: Tratto[] = [];
  let t = 0;
  for (const tok of s.split(/\s+/).filter((x) => x && x !== "|")) {
    const m = /^([^*/]+)(?:([*/])(\d+(?:\.\d+)?))?$/.exec(tok);
    if (!m) throw new Error(`Token non valido: ${tok}`);
    const d = m[2] === "*" ? Number(m[3]) : m[2] === "/" ? 1 / Number(m[3]) : 1;
    if (m[1] !== "-") {
      const [da, a] = m[1].split(">");
      tratti.push({ da: scriviForo(leggiForo(da)), a: scriviForo(leggiForo(a ?? da)), inizio: t, durata: d });
    }
    t += d;
  }
  return { tratti, battiti: t };
}

const DEF = [
  {
    id: "primo-volo", bpm: 84,
    nome: { it: "Primo volo", en: "First flight" },
    descr: { it: "Fori 4, 5 e 6: sali e scendi con note pulite.", en: "Holes 4, 5 and 6: climb and dive with clean notes." },
    tab: "4↑*2 5↑*2 6↑*2 - - | 6↑*2 5↑*2 4↑*2 - - | 4↓*2 5↓*2 6↓*2 - - | 4↑ 4↓ 5↑ 5↓ 6↑ 6↓ 6↑*2 - - | 6↓ 6↑ 5↓ 5↑ 4↓ 4↑*3",
  },
  {
    id: "salti", bpm: 88,
    nome: { it: "Salti nella notte", en: "Night leaps" },
    descr: { it: "Dal basso all'alto: tutta l'armonica.", en: "Low to high: the whole harp." },
    tab: "1↑*2 4↑*2 7↑*2 - - | 2↓*2 6↑*2 9↑*2 - - | 1↓*2 4↓*2 8↓*2 - - | 3↓ 6↓ 4↓ 8↓ 6↑*2 2↓*2",
  },
  {
    id: "ponte-4", bpm: 72,
    nome: { it: "Il ponte del 4", en: "The 4-hole bridge" },
    descr: { it: "Il primo bend: scendi di mezzo tono sul 4 aspirato e torna su.", en: "Your first bend: dip a half step on 4 draw and come back." },
    tab: "4↓*2 4↓>4↓'*2 4↓'*2 4↓'>4↓*2 - - | 4↓*2 4↓>4↓'*2 4↓'>4↓*2 4↓*2 - - | 4↓' 4↓ 4↓' 4↓ 4↓>4↓'*2 4↓'*2 - - | 4↓'*2 4↓'>4↓ 4↑*3",
  },
  {
    id: "palude-3", bpm: 66,
    nome: { it: "La palude del 3", en: "The 3-hole swamp" },
    descr: { it: "Il 3 aspirato scende di tre gradini: trova ognuno.", en: "3 draw goes down three steps: find each one." },
    tab: "3↓*2 3↓>3↓'*2 3↓'*2 - | 3↓'>3↓''*2 3↓''*2 - | 3↓''>3↓'''*2 3↓'''*2 3↓'''>3↓*3 - | 3↓ 3↓' 3↓'' 3↓' 3↓*2 - | 3↓>3↓''*2 3↓''>3↓'*2 2↓*3",
  },
  {
    id: "fondo-2", bpm: 66,
    nome: { it: "Il fondo del 2", en: "Down the 2-hole" },
    descr: { it: "Bend profondi sul 2 e sull'1: la voce del Delta.", en: "Deep bends on 2 and 1: the voice of the Delta." },
    tab: "2↓*2 2↓>2↓'*2 2↓'*2 2↓'>2↓''*2 2↓''*2 - | 2↓''>2↓*3 - | 1↓*2 1↓>1↓'*2 1↓'*2 1↓'>1↓*2 - | 2↓''>2↓*2 3↓'*2 2↓*3",
  },
  {
    id: "fischio-alto", bpm: 70,
    nome: { it: "Il fischio alto", en: "The high whistle" },
    descr: { it: "Bend in soffio sull'8, il 9 e il 10. Per esperti.", en: "Blow bends on 8, 9 and 10. For experts." },
    tab: "8↑*2 8↑>8↑'*2 8↑'*2 - | 9↑*2 9↑>9↑'*2 9↑'>9↑*2 - | 10↑*2 10↑>10↑'*2 10↑'>10↑''*2 10↑''*2 - | 10↑''>10↑*2 9↑*2 8↑*3",
  },
];

export const VOLI: Volo[] = DEF.map(({ tab, ...d }) => ({ ...d, ...leggiVolo(tab) }));

/** Le luci da raccogliere: una ogni `passo` battiti lungo ogni tratto, con l'altezza attesa. */
export interface Luce { t: number; midi: number; tratto: number; presa: boolean; persa: boolean; bend: boolean }

export function luciDelVolo(v: Volo, tonalita: TonalitaArmonica, durataBattito: number, passo = 0.25): Luce[] {
  const out: Luce[] = [];
  v.tratti.forEach((tr, i) => {
    const a = foroMidi(tr.da, tonalita), b = foroMidi(tr.a, tonalita);
    const n = Math.max(1, Math.round(tr.durata / passo));
    for (let k = 0; k < n; k++) {
      const f = n === 1 ? 0 : k / n;
      // le scivolate restano un attimo sulla nota di partenza e arrivano un po' prima della fine
      const g = a === b ? 0 : Math.min(1, Math.max(0, (f - 0.15) / 0.6));
      const bend = tr.da.includes("'") || tr.a.includes("'");
      out.push({ t: (tr.inizio + k * passo) * durataBattito, midi: a + (b - a) * g, tratto: i, presa: false, persa: false, bend });
    }
  });
  return out;
}

/** Tolleranza in semitoni per prendere una luce. */
export const TOLLERANZA = 0.45;
export const presa = (luce: Luce, midiF: number | null) => midiF !== null && Math.abs(midiF - luce.midi) <= TOLLERANZA;
