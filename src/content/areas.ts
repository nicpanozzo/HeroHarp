// Trasforma il percorso didattico (percorso.json, scritto nel thread dei contenuti) nelle tappe giocabili.
// Le frasi restano in intavolatura: valgono per qualunque tonalità.
// La grafica viene da style/assets/manifest.json (thread dello stile): un'area senza grafica è "in arrivo".

import percorso from "./percorso.json";
import manifest from "../assets/manifest.json";
import { BLOW, DRAW, type Tab } from "../harp";
import type { Area as PresetBase } from "../style/basi";
import type { Timbro } from "../style/effetti";

export type L10n = { it: string; en: string };

interface RawNote {
  hole: number;
  dir: "blow" | "draw";
  bend: number;
  /** Semitoni sopra il foro 1 soffiato: vale anche per overblow e overdraw. */
  semitone?: number;
  technique?: string;
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
  tier?: string;
  events: RawEvent[];
}

export interface PhraseNote {
  /** Nota principale (la più bassa di un accordo). */
  tab: Tab;
  /** Semitoni sopra il foro 1 soffiato, per ogni nota dell'evento (accordo = più note). */
  semitones: number[];
  /** Fori dell'evento, per l'etichetta (es. 4-5-6 soffiati). */
  holes: number[];
  /** "chord" per accordi, ottave, trilli e glissati: basta una delle loro note. */
  kind: "note" | "chord";
  technique?: string;
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
  /** Difficoltà di ogni frase: 0 facile, 1 media, 2 difficile (stesso ordine di phrases). */
  tiers: number[];
  bpm: [number, number];
  description?: L10n;
}

export interface EnemyDef {
  id: string;
  areaId: string;
  /** Prefisso degli sprite (nemici-<sprite>-idle, -attacco, -colpito, -sconfitto). */
  sprite: string;
  timbre: Timbro;
  name: L10n;
  trains: L10n;
  tip?: L10n;
  hp: number;
  /** Danno per ogni colpo non parato. */
  attack: number;
  volleySize: number;
  phases: EnemyPhase[];
  boss?: boolean;
  /** Il Silenzio recupera vita se smetti di suonare durante la risposta. */
  healsOnSilence?: boolean;
  /** Modalità non ancora giocabili (jam): il nemico si vede ma non si sfida. */
  comingSoon?: boolean;
}

export interface Lesson {
  id: string;
  title: L10n;
  steps: L10n[];
  mistakes: { problem: L10n; fix: L10n }[];
}

export interface AreaDef {
  id: string;
  order: number;
  name: L10n;
  technique: L10n;
  goal: L10n;
  tips: L10n[];
  lessons: Lesson[];
  enemies: EnemyDef[];
  /** Prefisso degli sfondi (sfondi-<prefisso>-1-cielo…), null se la grafica non c'è ancora. */
  backdrop: string[] | null;
  /** Preset della base musicale. */
  music: PresetBase;
  /** Extra: si apre dopo il primo boss, fuori dal viaggio principale. */
  extra: boolean;
  comingSoon: boolean;
}

const MAX_SEGMENT_BEATS = 8;
const TIERS: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

function toTab(n: RawNote): Tab {
  return { hole: n.hole, draw: n.dir === "draw", bend: n.bend };
}

const semitoneOf = (n: RawNote) => n.semitone ?? (n.dir === "draw" ? DRAW[n.hole - 1] : BLOW[n.hole - 1]) - n.bend;

function toNote(e: RawEvent): PhraseNote {
  const notes = [...e.notes].sort((a, b) => semitoneOf(a) - semitoneOf(b));
  const low = notes[0];
  return {
    tab: toTab(low),
    semitones: notes.map(semitoneOf),
    holes: [...new Set(notes.map((n) => n.hole))].sort((a, b) => a - b),
    kind: notes.length > 1 ? "chord" : "note",
    technique: low.technique,
    start: e.start,
    dur: e.dur,
  };
}

/** Divide una frase lunga in pezzi di al massimo due battute, per poterla ripetere a memoria. */
export function segment(raw: RawPhrase): Phrase[] {
  const notes = raw.events.filter((e) => e.notes.length > 0).map(toNote);
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

// ---------- grafica e suono dal manifest dello stile ----------

interface ManifestFile {
  key: string;
  file: string;
  area?: string;
  nemico?: string;
  livello?: number;
}
const FILES = (manifest as { file: ManifestFile[] }).file;
const SPRITES = new Map<string, string>();
for (const f of FILES)
  if (f.nemico && !SPRITES.has(f.nemico)) SPRITES.set(f.nemico, f.file.replace(/^nemici\//, "").replace(/-(idle|attacco|colpito|sconfitto)\.svg$/, ""));

function backdropFor(areaId: string): string[] | null {
  const layers = FILES.filter((f) => f.area === areaId && f.livello)
    .sort((a, b) => a.livello! - b.livello!)
    .map((f) => f.key);
  return layers.length ? layers : null;
}

const TIMBRES: Timbro[] = ["spiffero", "sospiro", "mantice", "silenzio"];
/** Preset delle basi per area; dove manca si usa il più vicino per atmosfera. */
const MUSIC: Record<string, PresetBase> = {
  porch: "portico",
  station: "stazione",
  "freight-train": "treno",
  "juke-joint": "juke",
  "beale-street": "beale",
  "delta-crossroads": "crocevia",
  riverboat: "crocevia",
  "chicago-club": "chicago",
  "after-hours": "chicago",
};

// ---------- costruzione delle tappe ----------

function phaseFrom(phrases: RawPhrase[], bpm: [number, number], description?: L10n): EnemyPhase {
  // dal facile al difficile: la difficoltà adattiva sale di livello in livello
  const sorted = [...phrases].sort((a, b) => (TIERS[a.tier ?? "easy"] ?? 0) - (TIERS[b.tier ?? "easy"] ?? 0));
  return { phrases: sorted.map(segment), tiers: sorted.map((p) => TIERS[p.tier ?? "easy"] ?? 0), bpm, description };
}

function buildArea(a: any): AreaDef {
  const o: number = a.order;
  const extra = a.id === "after-hours";
  const bpm = a.bpm as [number, number];
  const sprite = (id: string) => SPRITES.get(id) ?? id;
  const timbre = (id: string): Timbro => (TIMBRES.includes(sprite(id) as Timbro) ? (sprite(id) as Timbro) : "normale");
  const backdrop = backdropFor(a.id);
  const hasArt = (id: string) => SPRITES.has(id);
  const normal: EnemyDef[] = a.enemies.map((e: any, i: number) => ({
    id: e.id,
    areaId: a.id,
    sprite: sprite(e.id),
    timbre: timbre(e.id),
    name: e.name,
    trains: e.trains,
    tip: e.tip,
    hp: 60 + i * 10 + (o - 1) * 10,
    attack: 8 + i + Math.floor((o - 1) / 2),
    volleySize: 3 + Math.min(i, 2) + (o >= 4 ? 1 : 0),
    phases: [phaseFrom(e.phrases, [bpm[0], Math.min(bpm[1], bpm[0] + 10)])],
    comingSoon: e.phrases.length === 0 || !hasArt(e.id),
  }));
  const b = a.boss;
  const playable = (b.phases ?? []).filter((p: any) => p.phrases.length > 0);
  const boss: EnemyDef = {
    id: b.id,
    areaId: a.id,
    sprite: sprite(b.id),
    timbre: timbre(b.id),
    name: b.name,
    trains: b.description,
    hp: 150 + (o - 1) * 20,
    attack: 12 + Math.floor((o - 1) / 2),
    volleySize: 5,
    boss: true,
    healsOnSilence: b.id === "silence",
    phases: playable.map((p: any) => phaseFrom(p.phrases, p.bpm, p.description)),
    comingSoon: playable.length === 0 || playable.length < (b.phases ?? []).length || !hasArt(b.id),
  };
  const lessons: Lesson[] = (a.lessons ?? []).map((l: any) => ({ id: l.id, title: l.title, steps: l.steps ?? [], mistakes: l.mistakes ?? [] }));
  const enemies = [...normal, boss];
  return {
    id: a.id,
    order: o,
    name: a.name,
    technique: a.technique,
    goal: a.goal,
    tips: a.tips ?? [],
    lessons,
    enemies,
    backdrop,
    music: MUSIC[a.id] ?? "portico",
    extra,
    comingSoon: !backdrop || enemies.every((e) => e.comingSoon),
  };
}

export const AREAS: AreaDef[] = (percorso as any).areas.map(buildArea).sort((x: AreaDef, y: AreaDef) => x.order - y.order);
export const ONBOARDING: Lesson[] = ((percorso as any).onboarding ?? []).map((l: any) => ({
  id: l.id,
  title: l.title,
  steps: l.steps ?? [],
  mistakes: l.mistakes ?? [],
}));

/** Il viaggio principale, senza l'Extra. */
export const JOURNEY = AREAS.filter((a) => !a.extra);
export const AREA1 = AREAS[0];
export const areaById = (id: string): AreaDef => AREAS.find((a) => a.id === id)!;
export const enemyById = (id: string): EnemyDef => AREAS.flatMap((a) => a.enemies).find((e) => e.id === id)!;
