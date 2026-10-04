// Trasforma il percorso didattico (percorso.json, scritto nel thread dei contenuti) nelle tappe giocabili.
// Le frasi restano in intavolatura: valgono per qualunque tonalità.
// La grafica viene da style/assets/manifest.json (thread dello stile): un'area senza grafica è "in arrivo".

import percorso from "./percorso.json";
import manifest from "../assets/manifest.json";
import { BLOW, DRAW, type Tab } from "../harp";
import { AREA_DA_PERCORSO, type Area as PresetBase } from "../style/basi";
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
  /** Jam: il nemico suona questa nota, tu rispondi a tempo con una qualsiasi delle note permesse (semitones). */
  free?: boolean;
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

/** Le note che si possono usare in una jam (aree del club). */
export interface JamRules {
  allowed: Tab[];
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
  /** Modalità non ancora giocabili: il nemico si vede ma non si sfida. */
  comingSoon?: boolean;
  /** Nemici del club: improvvisi a tempo con le note permesse invece di ripetere la frase. */
  jam?: JamRules;
  /** Allenamento mirato (stats/drill.ts): non conta per il viaggio né per i record. */
  drill?: { weaknessId: string };
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

// ---------- jam: frasi generate dalle note permesse ----------

/** "3↓''" → foro 3 aspirato, bend di 2 semitoni. */
export function parseTab(s: string): Tab {
  const m = /^(\d+)([↑↓])('*)$/.exec(s.trim());
  if (!m) throw new Error(`intavolatura non valida: ${s}`);
  return { hole: Number(m[1]), draw: m[2] === "↓", bend: m[3].length };
}
const semitoneOfTab = (t: Tab) => (t.draw ? DRAW[t.hole - 1] : BLOW[t.hole - 1]) - t.bend;

/** Ritmi in battiti dentro due battute: [inizio, durata]. */
const RHYTHMS: Record<string, [number, number][][]> = {
  easy: [
    [
      [0, 1],
      [1, 1],
      [2, 2],
      [4, 1],
      [5, 1],
      [6, 2],
    ],
    [
      [0, 2],
      [2, 2],
      [4, 2],
      [6, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 4],
    ],
  ],
  medium: [
    [
      [0, 1],
      [1, 0.5],
      [1.5, 0.5],
      [2, 2],
      [4, 1],
      [5, 0.5],
      [5.5, 0.5],
      [6, 2],
    ],
    [
      [0, 0.5],
      [0.5, 0.5],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2],
      [6, 2],
    ],
    [
      [0, 1.5],
      [1.5, 0.5],
      [2, 2],
      [4, 1.5],
      [5.5, 0.5],
      [6, 2],
    ],
  ],
  hard: [
    [
      [0, 0.5],
      [0.5, 0.5],
      [1, 0.5],
      [1.5, 0.5],
      [2, 1],
      [3, 1],
      [4, 0.5],
      [4.5, 0.5],
      [5, 1],
      [6, 2],
    ],
    [
      [0, 1],
      [1, 0.5],
      [1.5, 0.5],
      [2, 0.5],
      [2.5, 0.5],
      [3, 1],
      [4, 1],
      [5, 0.5],
      [5.5, 0.5],
      [6, 0.5],
      [6.5, 1.5],
    ],
  ],
  // stop time: la band si ferma, tu suoni nei buchi
  stop: [
    [
      [0, 2],
      [4, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [4, 1],
      [5, 1],
    ],
    [
      [1, 1],
      [2, 2],
      [5, 1],
      [6, 2],
    ],
  ],
};

/** Generatore deterministico: le stesse frasi a ogni partita, come un repertorio. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Frasi da jam: il nemico improvvisa un lick con le note permesse, a passi vicini, e chiude sulla nota più bassa. */
function jamPhrases(id: string, allowed: Tab[], rhythms: string[]): { phrases: Phrase[][]; tiers: number[] } {
  const rnd = seeded(id);
  const notes = [...allowed].sort((a, b) => semitoneOfTab(a) - semitoneOfTab(b));
  const semis = notes.map(semitoneOfTab);
  const phrases: Phrase[][] = [];
  const tiers: number[] = [];
  for (const tier of rhythms)
    RHYTHMS[tier].forEach((rhythm, k) => {
      let i = Math.floor(rnd() * notes.length);
      const out: PhraseNote[] = rhythm.map(([start, dur], j) => {
        if (j === rhythm.length - 1) i = 0;
        else if (j > 0) i = Math.max(0, Math.min(notes.length - 1, i + [-1, 1, 1, -2, 2][Math.floor(rnd() * 5)]));
        const tab = notes[i];
        return { tab, semitones: [semis[i], ...semis.filter((x) => x !== semis[i])], holes: [tab.hole], kind: "note", free: true, start, dur };
      });
      phrases.push([{ id: `${id}.${tier}${k + 1}`, beats: 8, notes: out }]);
      tiers.push(TIERS[tier] ?? (tier === "stop" ? 1 : 0));
    });
  return { phrases, tiers };
}

// ---------- costruzione delle tappe ----------

function phaseFrom(phrases: RawPhrase[], bpm: [number, number], description?: L10n): EnemyPhase {
  // dal facile al difficile: la difficoltà adattiva sale di livello in livello
  const sorted = [...phrases].sort((a, b) => (TIERS[a.tier ?? "easy"] ?? 0) - (TIERS[b.tier ?? "easy"] ?? 0));
  return { phrases: sorted.map(segment), tiers: sorted.map((p) => TIERS[p.tier ?? "easy"] ?? 0), bpm, description };
}

// note "sicure" della seconda posizione: niente fori 1, 7-9 per tenere poche corsie
const JAM_CORE = ["2↓", "3↓'", "4↑", "4↓", "5↓", "6↑", "6↓"];

/** Il club di Chicago: il batterista e il chitarrista ti fanno improvvisare, il bassista ti insegna i cambi d'accordo. */
function jamArea(a: any): { enemies: Record<string, { phases: EnemyPhase[]; jam?: JamRules }>; boss: EnemyPhase[] } {
  const bpm = a.bpm as [number, number];
  const easyBpm: [number, number] = [bpm[0], bpm[0] + 10];
  const free = (id: string, notes: string[], rhythms: string[], range: [number, number], description?: L10n) => {
    const allowed = notes.map(parseTab);
    const { phrases, tiers } = jamPhrases(id, allowed, rhythms);
    return { phase: { phrases, tiers, bpm: range, description } as EnemyPhase, jam: { allowed } };
  };
  const tipNotes = (e: any) => ((e?.tip?.it ?? "").split(":")[1] ?? "").trim().split(/\s+/).filter(Boolean);
  const drummer = a.enemies.find((e: any) => e.id === "drummer");
  const dr = free("drummer", tipNotes(drummer).length ? tipNotes(drummer) : ["2↓", "3↓'", "4↑"], ["easy", "medium"], easyBpm);
  const gt = free("guitarist", JAM_CORE, ["medium", "hard"], [bpm[0] + 5, bpm[0] + 15]);
  // il bassista: la nota di base di ogni accordo (I = 2↓, IV = 4↑, V = 4↓), da ripetere esattamente
  const ROOT: Record<string, string> = { I: "2↓", IV: "4↑", V: "4↓" };
  // prima le minime (facili), poi le semiminime
  const lines: [string, string, number][] = [
    ["I", "V", 2],
    ["V", "I", 2],
    ["I", "IV", 1],
    ["IV", "I", 1],
    ["V", "IV", 1],
  ];
  const bassPhrases = lines.map(([c1, c2, step], k): Phrase[] => {
    const notes: PhraseNote[] = [];
    for (const [bar, chord] of [c1, c2].entries())
      for (let b = 0; b < 4; b += step) {
        const tab = parseTab(ROOT[chord]);
        notes.push({ tab, semitones: [semitoneOfTab(tab)], holes: [tab.hole], kind: "note", start: bar * 4 + b, dur: step });
      }
    return [{ id: `bassist.${k + 1}`, beats: 8, notes }];
  });
  const bass: EnemyPhase = { phrases: bassPhrases, tiers: lines.map(([, , step]) => (step === 2 ? 0 : 1)), bpm: easyBpm };
  const desc = (mode: string) => a.boss.phases?.find((p: any) => p.mode === mode);
  const phaseBpm = (mode: string): [number, number] => desc(mode)?.bpm ?? bpm;
  const boss = [
    free("stage-boss.trade", JAM_CORE, ["easy", "medium"], phaseBpm("jam_trade"), desc("jam_trade")?.description).phase,
    free("stage-boss.stop", ["2↓", "3↓'", "4↑", "4↓"], ["stop"], phaseBpm("jam_stop_time"), desc("jam_stop_time")?.description).phase,
    free("stage-boss.solo", [...JAM_CORE, "3↓''"], ["medium", "hard"], phaseBpm("jam_solo"), desc("jam_solo")?.description).phase,
  ];
  return {
    enemies: { drummer: { phases: [dr.phase], jam: dr.jam }, bassist: { phases: [bass] }, guitarist: { phases: [gt.phase], jam: gt.jam } },
    boss,
  };
}

function buildArea(a: any): AreaDef {
  const o: number = a.order;
  const extra = a.id === "after-hours";
  const bpm = a.bpm as [number, number];
  const sprite = (id: string) => SPRITES.get(id) ?? id;
  const timbre = (id: string): Timbro => (TIMBRES.includes(sprite(id) as Timbro) ? (sprite(id) as Timbro) : "normale");
  const backdrop = backdropFor(a.id);
  const hasArt = (id: string) => SPRITES.has(id);
  const jam = a.jam ? jamArea(a) : null;
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
    phases: jam?.enemies[e.id]?.phases ?? [phaseFrom(e.phrases, [bpm[0], Math.min(bpm[1], bpm[0] + 10)])],
    jam: jam?.enemies[e.id]?.jam,
    comingSoon: (e.phrases.length === 0 && !jam?.enemies[e.id]) || !hasArt(e.id),
  }));
  const b = a.boss;
  const playable = jam
    ? jam.boss
    : (b.phases ?? []).length
      ? (b.phases ?? []).filter((p: any) => p.phrases.length > 0).map((p: any) => phaseFrom(p.phrases, p.bpm, p.description))
      : // un boss ancora senza frasi proprie (il Fischio di Mezzanotte): rimette in fila le tecniche dei suoi allievi
        a.enemies.filter((e: any) => e.phrases.length).map((e: any) => phaseFrom(e.phrases, [bpm[0], bpm[0] + 10], e.trains));
  const allPhases = jam || !(b.phases ?? []).length ? playable.length : (b.phases ?? []).length;
  const boss: EnemyDef = {
    id: b.id,
    areaId: a.id,
    sprite: sprite(b.id),
    timbre: timbre(b.id),
    name: b.name,
    trains: b.description,
    hp: 120 + (o - 1) * 22,
    // i boss durano di più ma colpiscono piano: vince chi suona bene, non solo chi suona perfetto
    attack: 9 + Math.floor((o - 1) / 2),
    volleySize: 5,
    boss: true,
    healsOnSilence: b.id === "silence",
    phases: playable,
    jam: jam ? { allowed: JAM_CORE.map(parseTab) } : undefined,
    comingSoon: playable.length === 0 || playable.length < allPhases || !hasArt(b.id),
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
    music: AREA_DA_PERCORSO[a.id] ?? "portico",
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
/** Nemici costruiti al volo (l'allenamento mirato), cercati prima di quelli del viaggio. */
const EXTRA_ENEMIES = new Map<string, EnemyDef>();
export const registerEnemy = (e: EnemyDef): void => void EXTRA_ENEMIES.set(e.id, e);
export const enemyById = (id: string): EnemyDef => EXTRA_ENEMIES.get(id) ?? AREAS.flatMap((a) => a.enemies).find((e) => e.id === id)!;
