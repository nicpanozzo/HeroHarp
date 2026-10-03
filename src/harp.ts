// Modello dell'armonica diatonica con accordatura Richter.
// Tutto il contenuto del gioco è scritto in intavolatura (fori), non in note:
// la tonalità scelta trasforma i fori nelle note attese.

/** Semitoni sopra la nota del foro 1 soffiato, per i fori 1..10. */
export const BLOW = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36] as const;
export const DRAW = [2, 7, 11, 14, 17, 21, 23, 26, 29, 33] as const;

export interface HarpKey {
  id: string;
  /** Nome in notazione italiana, usato anche in inglese tramite i18n. */
  it: string;
  en: string;
  /** Nota MIDI del foro 1 soffiato. */
  root: number;
}

/** Le 12 tonalità standard, dal Sol (la più grave) al Fa# (la più acuta). */
export const KEYS: HarpKey[] = [
  { id: "G", it: "Sol", en: "G", root: 55 },
  { id: "Ab", it: "Lab", en: "A♭", root: 56 },
  { id: "A", it: "La", en: "A", root: 57 },
  { id: "Bb", it: "Sib", en: "B♭", root: 58 },
  { id: "B", it: "Si", en: "B", root: 59 },
  { id: "C", it: "Do", en: "C", root: 60 },
  { id: "Db", it: "Reb", en: "D♭", root: 61 },
  { id: "D", it: "Re", en: "D", root: 62 },
  { id: "Eb", it: "Mib", en: "E♭", root: 63 },
  { id: "E", it: "Mi", en: "E", root: 64 },
  { id: "F", it: "Fa", en: "F", root: 65 },
  { id: "F#", it: "Fa#", en: "F♯", root: 66 },
];

export const keyById = (id: string): HarpKey => KEYS.find((k) => k.id === id) ?? KEYS[5];

/**
 * Una nota in intavolatura standard: "4" = foro 4 soffiato, "-4" = foro 4 aspirato,
 * "-3'" = foro 3 aspirato con un semitono di bending ("-3''" due, ecc.).
 */
export interface Tab {
  hole: number;
  draw: boolean;
  bend: number;
}

export function parseTab(s: string): Tab {
  const m = /^(-?)(10|[1-9])('*)$/.exec(s.trim());
  if (!m) throw new Error(`Intavolatura non valida: ${s}`);
  const tab = { draw: m[1] === "-", hole: Number(m[2]), bend: m[3].length };
  if (tab.bend > maxBend(tab.hole, tab.draw)) throw new Error(`Bending impossibile: ${s}`);
  return tab;
}

export function formatTab(t: Tab): string {
  return `${t.hole}${t.draw ? "↓" : "↑"}${"'".repeat(t.bend)}`;
}

/** Semitoni di bending possibili su un foro (0 se non si piega in quella direzione). */
export function maxBend(hole: number, draw: boolean): number {
  const b = BLOW[hole - 1];
  const d = DRAW[hole - 1];
  return Math.max(0, draw ? d - b - 1 : b - d - 1);
}

export function tabToMidi(t: Tab, key: HarpKey): number {
  const base = t.draw ? DRAW[t.hole - 1] : BLOW[t.hole - 1];
  return key.root + base - t.bend;
}

/** Tutte le intavolature che producono una certa nota (es. 2↓ e 3↑ sono la stessa). */
export function midiToTabs(midi: number, key: HarpKey): Tab[] {
  const out: Tab[] = [];
  for (let hole = 1; hole <= 10; hole++) {
    for (const draw of [false, true]) {
      for (let bend = 0; bend <= maxBend(hole, draw); bend++) {
        const t = { hole, draw, bend };
        if (tabToMidi(t, key) === midi) out.push(t);
      }
    }
  }
  return out;
}

const NAMES_IT = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"];
const NAMES_EN = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function noteName(midi: number, lang: "it" | "en"): string {
  const names = lang === "it" ? NAMES_IT : NAMES_EN;
  return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
