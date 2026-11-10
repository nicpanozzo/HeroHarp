// Copiato da modes/src/brano/archivio.ts con scripts/sync-content.mjs, non modificare qui.
// I brani caricati restano sul dispositivo: il file audio e l'ascolto dell'armonica in IndexedDB,
// i progressi (stelle per frase, tonalità) nel localStorage. Niente esce dal telefono.

import type { TonalitaArmonica } from "../../style/basi";
import type { Traccia } from "./analisi";

export interface BranoSalvato {
  id: string;
  titolo: string;
  /** Il file audio originale (non c'è per il brano di prova, che si genera). */
  file?: Blob;
  durata: number;
  traccia: Traccia;
  /** Tonalità usata per l'ascolto (l'estensione dell'armonica guida YIN). */
  tonalita: TonalitaArmonica;
  creato: number;
}

export interface Progresso {
  tonalita?: TonalitaArmonica;
  /** Stelle per frase o catena: chiave "da-a" (indici delle frasi). */
  stelle: { [chiave: string]: number };
  /** Precisione migliore per frase o catena. */
  meglio: { [chiave: string]: number };
  velocita: number;
}

const DB = "heroharp-brani";
const NEGOZIO = "brani";
const CHIAVE_PROGRESSI = "heroharp-brani-progressi";

function apri(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === "undefined") return ko(new Error("IndexedDB non disponibile"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(NEGOZIO, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function operazione<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await apri();
  return new Promise((ok, ko) => {
    const tx = db.transaction(NEGOZIO, modo);
    const r = fn(tx.objectStore(NEGOZIO));
    r.onsuccess = () => ok(r.result as T);
    r.onerror = () => ko(r.error);
    tx.oncomplete = () => db.close();
  });
}

export const salvaBrano = (b: BranoSalvato) => operazione<void>("readwrite", (s) => s.put(b)).catch(() => undefined);
export const caricaBrano = (id: string) => operazione<BranoSalvato | undefined>("readonly", (s) => s.get(id)).catch(() => undefined);
export const eliminaBrano = (id: string) => operazione<void>("readwrite", (s) => s.delete(id)).catch(() => undefined);

/** I brani salvati, senza il file audio (per la lista). */
export async function elencoBrani(): Promise<Pick<BranoSalvato, "id" | "titolo" | "durata" | "creato">[]> {
  try {
    const tutti = await operazione<BranoSalvato[]>("readonly", (s) => s.getAll());
    return tutti.map(({ id, titolo, durata, creato }) => ({ id, titolo, durata, creato })).sort((a, b) => b.creato - a.creato);
  } catch { return []; }
}

let progressi: { [id: string]: Progresso } = {};
try { progressi = JSON.parse(localStorage.getItem(CHIAVE_PROGRESSI) ?? "{}"); } catch { /* si parte da zero */ }

export function progresso(id: string): Progresso {
  return (progressi[id] ??= { stelle: {}, meglio: {}, velocita: 1 });
}

export function salvaProgressi() {
  try { localStorage.setItem(CHIAVE_PROGRESSI, JSON.stringify(progressi)); } catch { /* ignorato */ }
}

export function dimenticaProgressi(id: string) { delete progressi[id]; salvaProgressi(); }

/** Chiave di una frase (da = a) o di una catena di frasi. */
export const chiave = (da: number, a: number) => `${da}-${a}`;
