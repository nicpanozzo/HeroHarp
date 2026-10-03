// Trasforma l'Area 1 del percorso didattico (percorso.json, scritto nel thread dei contenuti)
// nei nemici giocabili. Le frasi restano in intavolatura: valgono per qualunque tonalità.

import percorso from "./percorso.json";
import type { Tab } from "../harp";

type L10n = { it: string; en: string };

interface RawNote {
  hole: number;
  dir: "blow" | "draw";
  bend: number;
}
interface RawEvent {
  type: string;
  start: number;
  dur: number;
  notes: RawNote[];
}
interface RawPhrase {
  id: string;
  tab: string;
  beatsPerBar: number;
  lengthBeats: number;
  events: RawEvent[];
}

export interface PhraseNote {
  tab: Tab;
  /** Inizio e durata in battiti, dall'inizio della frase. */
  start: number;
  dur: number;
}

export interface Phrase {
  id: string;
  /** Battiti, sempre un multiplo di 4 (battute intere). */
  beats: number;
  notes: PhraseNote[];
}

export interface EnemyPhase {
  /** Ogni voce è una frase completa, già divisa in pezzi di al massimo due battute. */
  phrases: Phrase[][];
  bpm: [number, number];
  description?: L10n;
}

export interface EnemyDef {
  id: string;
  /** Prefisso degli sprite (nemici-<sprite>-idle, -attacco, -colpito, -sconfitto). */
  sprite: string;
  name: L10n;
  trains: L10n;
  hp: number;
  /** Danno per ogni colpo non parato. */
  attack: number;
  volleySize: number;
  phases: EnemyPhase[];
  boss?: boolean;
  /** Il Silenzio recupera vita se smetti di suonare durante la risposta. */
  healsOnSilence?: boolean;
}

export interface AreaDef {
  id: string;
  name: L10n;
  technique: L10n;
  goal: L10n;
  tips: L10n[];
  enemies: EnemyDef[];
}

const MAX_SEGMENT_BEATS = 8;

function toTab(n: RawNote): Tab {
  return { hole: n.hole, draw: n.dir === "draw", bend: n.bend };
}

/** Divide una frase lunga in pezzi di al massimo due battute, per poterla ripetere a memoria. */
export function segment(raw: RawPhrase): Phrase[] {
  const notes = raw.events
    .filter((e) => e.notes.length > 0)
    // accordi e ottave non sono ancora gestiti: si usa la nota più bassa
    .map((e) => ({ tab: toTab(e.notes[0]), start: e.start, dur: e.dur }));
  const total = Math.ceil(raw.lengthBeats / 4) * 4;
  const out: Phrase[] = [];
  for (let from = 0; from < total; from += MAX_SEGMENT_BEATS) {
    const to = Math.min(total, from + MAX_SEGMENT_BEATS);
    const part = notes.filter((n) => n.start >= from && n.start < to).map((n) => ({ ...n, start: n.start - from }));
    if (part.length)
      out.push({ id: `${raw.id}${total > MAX_SEGMENT_BEATS ? `.${from / MAX_SEGMENT_BEATS + 1}` : ""}`, beats: Math.ceil((to - from) / 4) * 4, notes: part });
  }
  return out;
}

const SPRITES: Record<string, string> = { draft: "spiffero", sigh: "sospiro", bellows: "mantice", silence: "silenzio" };

function buildArea1(): AreaDef {
  const a = (percorso as any).areas[0];
  const bpm = a.bpm as [number, number];
  const normal: EnemyDef[] = a.enemies.map((e: any, i: number) => ({
    id: e.id,
    sprite: SPRITES[e.id] ?? e.id,
    name: e.name,
    trains: e.trains,
    hp: 60 + i * 10,
    attack: 8 + i,
    volleySize: 3 + i,
    phases: [{ phrases: e.phrases.map(segment), bpm: [bpm[0], bpm[0] + 10] }],
  }));
  const b = a.boss;
  const boss: EnemyDef = {
    id: b.id,
    sprite: SPRITES[b.id] ?? b.id,
    name: b.name,
    trains: b.description,
    hp: 150,
    attack: 12,
    volleySize: 5,
    boss: true,
    healsOnSilence: b.id === "silence",
    phases: b.phases.map((p: any) => ({ phrases: p.phrases.map(segment), bpm: p.bpm, description: p.description })),
  };
  return { id: a.id, name: a.name, technique: a.technique, goal: a.goal, tips: a.tips, enemies: [...normal, boss] };
}

export const AREA1 = buildArea1();
export const enemyById = (id: string): EnemyDef => AREA1.enemies.find((e) => e.id === id)!;
