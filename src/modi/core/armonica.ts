// Copiato da modes/src/core/armonica.ts con scripts/sync-content.mjs, non modificare qui.
// Ponte tra l'intavolatura con le frecce usata nei contenuti ("4↓", "3↓''", "8↑'")
// e il modello dell'armonica del gioco (game/src/harp.ts).

import { keyById, maxBend, midiToTabs, tabToMidi, type Tab } from "../../harp";
import type { TonalitaArmonica } from "../../style/basi";

export type { Tab };

/** "4↓'" → { hole: 4, draw: true, bend: 1 }. Accetta anche la forma con il meno ("-4'"). */
export function leggiForo(s: string): Tab {
  const x = s.replace(/\s/g, "");
  let m = /^(10|[1-9])([↑↓])('*)$/.exec(x);
  if (m) return controlla({ hole: Number(m[1]), draw: m[2] === "↓", bend: m[3].length }, s);
  m = /^(-?)(10|[1-9])('*)$/.exec(x);
  if (m) return controlla({ hole: Number(m[2]), draw: m[1] === "-", bend: m[3].length }, s);
  throw new Error(`Foro non valido: ${s}`);
}

function controlla(t: Tab, s: string): Tab {
  if (t.bend > maxBend(t.hole, t.draw)) throw new Error(`Bend impossibile: ${s}`);
  return t;
}

export const scriviForo = (t: Tab) => `${t.hole}${t.draw ? "↓" : "↑"}${"'".repeat(t.bend)}`;

export const foroMidi = (foro: string | Tab, tonalita: TonalitaArmonica) =>
  tabToMidi(typeof foro === "string" ? leggiForo(foro) : foro, keyById(tonalita));

/**
 * Il foro più naturale per una nota: prima le note senza bend, poi l'aspirato
 * (2↓ invece di 3↑, come si insegna in seconda posizione). null se la nota non c'è.
 */
export function foroPerMidi(midi: number, tonalita: TonalitaArmonica): Tab | null {
  const tutti = midiToTabs(midi, keyById(tonalita));
  if (!tutti.length) return null;
  return [...tutti].sort((a, b) => a.bend - b.bend || Number(b.draw) - Number(a.draw) || a.hole - b.hole)[0];
}

/** Vero se la nota si può suonare solo piegando (è un "bend"). */
export function soloConBend(midi: number, tonalita: TonalitaArmonica): boolean {
  const tutti = midiToTabs(midi, keyById(tonalita));
  return tutti.length > 0 && tutti.every((t) => t.bend > 0);
}

/** Nota più grave e più acuta dell'armonica (senza overblow). */
export const estensione = (tonalita: TonalitaArmonica) => {
  const k = keyById(tonalita);
  return { min: k.root, max: k.root + 36 };
};
