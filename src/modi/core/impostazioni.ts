// Copiato da modes/src/core/impostazioni.ts con scripts/sync-content.mjs, non modificare qui.
// Impostazioni condivise con il gioco principale (lingua e tonalità dell'armonica)
// e record delle modalità del Juke Joint. Tutto nel localStorage, con riserva in memoria.

import type { TonalitaArmonica } from "../../style/basi";

export type Lingua = "it" | "en";

interface SalvataggioGioco { lang?: Lingua; keyId?: string }

export interface Record {
  /** Punteggio migliore per riff (id → punti) e stelle. */
  riff: { [id: string]: { punti: number; stelle: number; precisione: number } };
  /** Stelle migliori per livello del volo. */
  volo: { [id: string]: { punti: number; stelle: number } };
  jam: { punti: number; hype: number; jam: number; minuti: number };
  /** Lick scoperti nella jam (id). */
  lick: string[];
  tutorialVisti: string[];
  /** Con le cuffie la band suona piena; con le casse si abbassano gli strumenti medi per non confondere il microfono. */
  cuffie: boolean;
}

const CHIAVE_GIOCO = "duello-dance-save";
const CHIAVE_MODI = "duello-dance-juke-joint";

function leggi<T>(chiave: string, riserva: T): T {
  try {
    const raw = localStorage.getItem(chiave);
    if (raw) return { ...riserva, ...JSON.parse(raw) };
  } catch { /* niente archiviazione: si gioca senza salvataggi */ }
  return riserva;
}
function scrivi(chiave: string, valore: unknown) {
  try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch { /* ignorato */ }
}

const gioco = leggi<SalvataggioGioco>(CHIAVE_GIOCO, {});
const TONALITA: TonalitaArmonica[] = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#"];

export const impostazioni = {
  lingua: (gioco.lang === "en" ? "en" : "it") as Lingua,
  tonalita: (TONALITA.includes(gioco.keyId as TonalitaArmonica) ? gioco.keyId : "C") as TonalitaArmonica,
};

export const record: Record = leggi<Record>(CHIAVE_MODI, {
  riff: {}, volo: {}, jam: { punti: 0, hype: 0, jam: 0, minuti: 0 }, lick: [], tutorialVisti: [], cuffie: false,
});

export function salva() {
  // Lingua e tonalità restano allineate con il gioco: si sceglie una volta sola.
  const attuale = leggi<{ [k: string]: unknown }>(CHIAVE_GIOCO, {});
  scrivi(CHIAVE_GIOCO, { ...attuale, lang: impostazioni.lingua, keyId: impostazioni.tonalita });
  scrivi(CHIAVE_MODI, record);
}

export { TONALITA };
