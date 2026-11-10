// Copiato da modes/src/brano/sessione.ts con scripts/sync-content.mjs, non modificare qui.
// Il brano aperto: file audio, ascolto dell'armonica, note e frasi nella tonalità scelta.
// Si passa tra il menu e lo studio senza ricaricare niente.

import { getEngine } from "../../audio/engine";
import type { TonalitaArmonica } from "../../style/basi";
import { SR_ANALISI, dividiFrasi, estraiNote, indovinaTonalita, tracciaAltezze, type Frase, type NotaBrano, type Traccia } from "./analisi";
import { caricaBrano, progresso, salvaBrano, type BranoSalvato } from "./archivio";
import { DEMO_ID, generaDemo, wav } from "./demo";

export interface BranoAperto {
  id: string;
  titolo: string;
  url: string;
  durata: number;
  traccia: Traccia;
  tonalita: TonalitaArmonica;
  /** Le tonalità più probabili, dalla migliore. */
  consigliate: TonalitaArmonica[];
  note: NotaBrano[];
  frasi: Frase[];
  demo: boolean;
}

let aperto: BranoAperto | null = null;
export const branoAperto = () => aperto;

/** Rifà note e frasi in un'altra tonalità (le altezze ascoltate restano quelle). */
export function cambiaTonalita(b: BranoAperto, k: TonalitaArmonica) {
  b.tonalita = k;
  b.note = estraiNote(b.traccia, k);
  b.frasi = dividiFrasi(b.note);
  const p = progresso(b.id);
  if (p.tonalita !== k) { p.tonalita = k; p.stelle = {}; p.meglio = {}; }
}

function prepara(id: string, titolo: string, url: string, durata: number, traccia: Traccia, tonalita: TonalitaArmonica, demo: boolean): BranoAperto {
  if (aperto && aperto.url !== url && !aperto.demo) URL.revokeObjectURL(aperto.url);
  const note = estraiNote(traccia, tonalita);
  aperto = { id, titolo, url, durata, traccia, tonalita, consigliate: indovinaTonalita(traccia), note, frasi: dividiFrasi(note), demo };
  return aperto;
}

type Avanzamento = (p: number) => void | Promise<void>;
const respira = () => new Promise<void>((ok) => setTimeout(ok, 0));

/** Il brano di prova, generato al volo (uno slow blues originale, armonica in Do). */
let demoUrl: string | null = null;
let demoTraccia: Traccia | null = null;
export async function apriDemo(avanzamento?: Avanzamento): Promise<BranoAperto> {
  if (!demoUrl || !demoTraccia) {
    await avanzamento?.(0.05);
    await respira();
    const d = generaDemo(22050);
    demoUrl = URL.createObjectURL(wav(d.campioni, d.sr));
    // per l'ascolto basta metà frequenza: si prende un campione su due dopo una media
    const meta = new Float32Array(d.campioni.length >> 1);
    for (let i = 0; i < meta.length; i++) meta[i] = (d.campioni[2 * i] + d.campioni[2 * i + 1]) / 2;
    demoTraccia = await tracciaAltezze(meta, "C", (p) => avanzamento?.(0.1 + p * 0.9));
  }
  const p = progresso(DEMO_ID);
  return prepara(DEMO_ID, "Slow blues di prova", demoUrl, demoTraccia.midi.length * demoTraccia.passo, demoTraccia, p.tonalita ?? "C", true);
}

export async function apriSalvato(id: string): Promise<BranoAperto | null> {
  const b = await caricaBrano(id);
  if (!b?.file) return null;
  const p = progresso(id);
  return prepara(b.id, b.titolo, URL.createObjectURL(b.file), b.durata, b.traccia, p.tonalita ?? b.tonalita, false);
}

/**
 * Un file scelto dal giocatore: si decodifica, si porta a 11 kHz mono e si ascolta l'armonica.
 * La prima tonalità provata è quella dell'armonica in uso; se l'ascolto ne suggerisce un'altra
 * con decisione, si riascolta con quella (l'estensione dell'armonica guida la ricerca delle note).
 */
export async function apriFile(file: File, tonalita: TonalitaArmonica, avanzamento?: Avanzamento): Promise<BranoAperto> {
  await avanzamento?.(0.02);
  const ctx = getEngine().ctx;
  const dati = await file.arrayBuffer();
  const audio = await ctx.decodeAudioData(dati.slice(0));
  await avanzamento?.(0.1);
  const lunghezza = Math.ceil(audio.duration * SR_ANALISI);
  const off = new OfflineAudioContext(1, lunghezza, SR_ANALISI);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const mono = (await off.startRendering()).getChannelData(0);
  await avanzamento?.(0.18);
  let traccia = await tracciaAltezze(mono, tonalita, (p) => avanzamento?.(0.18 + p * 0.6));
  const migliore = indovinaTonalita(traccia)[0];
  if (migliore !== tonalita) {
    const prova = await tracciaAltezze(mono, migliore, (p) => avanzamento?.(0.78 + p * 0.2));
    traccia = prova; tonalita = migliore;
  }
  const titolo = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 48) || "Brano";
  const id = `brano-${Date.now().toString(36)}`;
  const salvato: BranoSalvato = { id, titolo, file, durata: audio.duration, traccia, tonalita, creato: Date.now() };
  await salvaBrano(salvato);
  progresso(id).tonalita = tonalita;
  await avanzamento?.(1);
  return prepara(id, titolo, URL.createObjectURL(file), audio.duration, traccia, tonalita, false);
}

/** Le note di un pezzo (frase o catena di frasi). */
export function notePezzo(b: BranoAperto, da: number, a: number) {
  return b.note.slice(b.frasi[da].da, b.frasi[a].a + 1);
}
