// La Lunga Notte: le regole della run, senza grafica (testate in tests/roguelike.test.ts).
// Una notte = tre atti, uno per tappa del percorso didattico a partire da quella scelta.
// Ogni atto è una mappa a bivi: duelli, duelli duri, portico di Zia Mae, banco dei pegni, crocevia, boss.

import { JOURNEY, type AreaDef, type EnemyDef } from "../content/areas";
import { BASE_MODS, GEAR, GROOVES, MUSICIANS, EVENTS, gearById, musicianById, type GearId, type Groove, type Mods, type MusicianId } from "./data";
import type { Strumento } from "../style/basi";

export type NodeKind = "fight" | "elite" | "rest" | "shop" | "event" | "boss";

export interface MapNode {
  id: string;
  /** Colonna (0 = partenza, l'ultima è il boss) e corsia (0..2, dall'alto). */
  col: number;
  lane: number;
  kind: NodeKind;
  /** Nodi raggiungibili da qui, nella colonna successiva. */
  next: string[];
  enemyId?: string;
  eventId?: string;
}

export interface RunStats {
  fights: number;
  won: number;
  notesHit: number;
  notesExpected: number;
  perfect: number;
  parried: number;
  missed: number;
  bestStreak: number;
  score: number;
  /** Errori e note giuste per foro (etichetta 4↓, 3↓'…): diventano la pagella. */
  misses: Record<string, number>;
  hits: Record<string, number>;
}

export interface RunState {
  version: 1;
  seed: number;
  /** Aree dei tre atti (id del percorso). */
  acts: string[];
  act: number;
  /** Moltiplicatore dei dollari della strada scelta (sfida = di più). */
  coinBonus: number;
  map: MapNode[];
  /** Ultimo nodo completato nell'atto (null = all'inizio della mappa). */
  pos: string | null;
  visited: string[];
  hp: number;
  maxHp: number;
  coins: number;
  band: MusicianId[];
  gear: GearId[];
  groove: Groove;
  bpmShift: number;
  spareUsed: boolean;
  /** Atto di cui si è già vista la presentazione. */
  introSeen: number;
  stats: RunStats;
  lessonsSeen: string[];
  over?: "won" | "lost";
  /** Contatore del generatore casuale, per riprendere la run da dove era. */
  rngState: number;
}

export const START_HP = 100;
export const COLS = 6;

// ---------- casualità riproducibile ----------

/** mulberry32: piccolo, veloce e riproducibile da un numero. */
export function rngFrom(state: { rngState: number }): () => number {
  return () => {
    let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(rng: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- strade e atti ----------

const PLAYABLE = (): AreaDef[] => JOURNEY.filter((a) => !a.comingSoon && a.enemies.some((e) => !e.comingSoon && !e.boss));

/** Tre tappe consecutive giocabili a partire da `areaId` (si arretra se si è in fondo al viaggio). */
export function actsFrom(areaId: string): string[] {
  const list = PLAYABLE();
  let i = Math.max(
    0,
    list.findIndex((a) => a.id === areaId),
  );
  i = Math.min(i, Math.max(0, list.length - 3));
  return list.slice(i, i + 3).map((a) => a.id);
}

export interface Road {
  kind: "review" | "yourStop" | "challenge";
  areaId: string;
  coinBonus: number;
}

/** Le tre strade proposte alla partenza, intorno alla tappa a cui sei arrivato nel viaggio. */
export function roads(currentAreaId: string): Road[] {
  const list = PLAYABLE();
  const i = Math.max(
    0,
    list.findIndex((a) => a.id === currentAreaId),
  );
  const at = (k: number) => list[Math.max(0, Math.min(list.length - 1, k))].id;
  const out: Road[] = [
    { kind: "review", areaId: at(i - 2), coinBonus: 1 },
    { kind: "yourStop", areaId: at(i), coinBonus: 1.2 },
    { kind: "challenge", areaId: at(i + 1), coinBonus: 1.5 },
  ];
  // all'inizio del viaggio il ripasso coincide con la tua tappa: resta solo la tua tappa e la sfida
  return out.filter((r, k) => k === 1 || r.areaId !== out[1].areaId);
}

// ---------- mappa ----------

/** Tipi di nodo per colonna: la prima è sempre un duello, la penultima ha sempre un riposo, l'ultima è il boss. */
function kindsFor(col: number, n: number, rng: () => number): NodeKind[] {
  if (col === 0) return Array(n).fill("fight");
  if (col === COLS - 1) return ["boss"];
  const pools: Record<number, NodeKind[]> = {
    1: ["fight", "fight", "event"],
    2: ["shop", "fight", "event", "fight"],
    3: ["elite", "fight", "event", "elite"],
    4: ["rest", "shop", "fight"],
  };
  const kinds = shuffle(rng, pools[col]).slice(0, n);
  if (col === 2 && !kinds.includes("shop")) kinds[0] = "shop";
  if (col === 4 && !kinds.includes("rest")) kinds[0] = "rest";
  return shuffle(rng, kinds);
}

export function buildMap(area: AreaDef, rng: () => number, actIndex: number): MapNode[] {
  const normal = area.enemies.filter((e) => !e.boss && !e.comingSoon);
  const boss = area.enemies.find((e) => e.boss && !e.comingSoon) ?? normal[normal.length - 1];
  const nodes: MapNode[] = [];
  const events = shuffle(
    rng,
    EVENTS.map((e) => e.id),
  );
  // nemici a rotazione: tutti quelli della tappa si incontrano prima di ripeterne uno
  let deck: EnemyDef[] = [];
  const nextEnemy = () => {
    if (deck.length === 0) deck = shuffle(rng, normal);
    return deck.pop()!.id;
  };
  for (let col = 0; col < COLS; col++) {
    // corsia centrale sempre presente: così ogni nodo ha un'uscita e un'entrata
    let lanes = col === COLS - 1 ? [1] : [0, 1, 2];
    if (col > 0 && col < COLS - 1 && rng() < 0.4) lanes = lanes.filter((l) => l !== (rng() < 0.5 ? 0 : 2));
    const kinds = kindsFor(col, lanes.length, rng);
    lanes.forEach((lane, k) => {
      const kind = kinds[k];
      const node: MapNode = { id: `a${actIndex}c${col}l${lane}`, col, lane, kind, next: [] };
      if (kind === "fight" || kind === "elite") node.enemyId = nextEnemy();
      if (kind === "boss") node.enemyId = boss.id;
      if (kind === "event") node.eventId = events.pop() ?? EVENTS[0].id;
      nodes.push(node);
    });
  }
  for (const n of nodes) n.next = nodes.filter((m) => m.col === n.col + 1 && Math.abs(m.lane - n.lane) <= 1).map((m) => m.id);
  return nodes;
}

export function newRun(road: Road, seed = Math.floor(Math.random() * 2 ** 31)): RunState {
  const run: RunState = {
    version: 1,
    seed,
    acts: actsFrom(road.areaId),
    act: 0,
    coinBonus: road.coinBonus,
    map: [],
    pos: null,
    visited: [],
    hp: START_HP,
    maxHp: START_HP,
    coins: 0,
    band: [],
    gear: [],
    groove: "shuffle",
    bpmShift: 0,
    spareUsed: false,
    introSeen: -1,
    stats: { fights: 0, won: 0, notesHit: 0, notesExpected: 0, perfect: 0, parried: 0, missed: 0, bestStreak: 0, score: 0, misses: {}, hits: {} },
    lessonsSeen: [],
    rngState: seed,
  };
  run.map = buildMap(areaOf(run), rngFrom(run), 0);
  return run;
}

export const areaOf = (run: RunState): AreaDef => JOURNEY.find((a) => a.id === run.acts[run.act])!;
export const nodeById = (run: RunState, id: string): MapNode => run.map.find((n) => n.id === id)!;

/** I nodi che si possono scegliere adesso. */
export function reachable(run: RunState): MapNode[] {
  if (run.over) return [];
  if (run.pos === null) return run.map.filter((n) => n.col === 0);
  return nodeById(run, run.pos).next.map((id) => nodeById(run, id));
}

/** Nodo completato: si avanza. Battuto il boss si passa all'atto dopo (o all'alba). */
export function complete(run: RunState, nodeId: string): "next" | "act" | "dawn" {
  const node = nodeById(run, nodeId);
  run.pos = nodeId;
  run.visited.push(nodeId);
  if (node.kind !== "boss") return "next";
  if (run.act >= run.acts.length - 1) {
    run.over = "won";
    return "dawn";
  }
  run.act++;
  run.pos = null;
  run.visited = [];
  run.map = buildMap(areaOf(run), rngFrom(run), run.act);
  // tra un atto e l'altro un po' di fiato
  heal(run, 20);
  return "act";
}

// ---------- band, attrezzi e modificatori ----------

export function mods(run: Pick<RunState, "band" | "gear" | "groove" | "bpmShift">): Mods {
  const m: Mods = { ...BASE_MODS };
  for (const id of run.band) musicianById(id).apply(m);
  for (const id of run.gear) gearById(id).apply(m);
  GROOVES[run.groove].apply(m);
  m.bpm += run.bpmShift;
  return m;
}

/** Gli strumenti della base: il tuo piede che batte, più la band che hai radunato. */
export function bandInstruments(run: Pick<RunState, "band">): Strumento[] {
  return ["piede", ...run.band.map((id) => musicianById(id).instrument)];
}

export const heal = (run: Pick<RunState, "hp" | "maxHp">, n: number): number => {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + n);
  return run.hp - before;
};

export type Offer = { type: "musician"; id: MusicianId } | { type: "gear"; id: GearId } | { type: "heal"; amount: number };

export function addOffer(run: RunState, o: Offer): void {
  if (o.type === "musician" && !run.band.includes(o.id)) run.band.push(o.id);
  if (o.type === "gear" && !run.gear.includes(o.id)) {
    run.gear.push(o.id);
    if (o.id === "ancia") {
      run.maxHp += 20;
      heal(run, 20);
    }
    if (o.id === "diavolo") {
      run.maxHp = Math.max(30, run.maxHp - 20);
      run.hp = Math.min(run.hp, run.maxHp);
    }
  }
  if (o.type === "heal") heal(run, o.amount);
}

const freeMusicians = (run: RunState) => MUSICIANS.filter((m) => !run.band.includes(m.id));
const freeGear = (run: RunState) => GEAR.filter((g) => !g.eventOnly && !run.gear.includes(g.id));

/** Ricompense dopo un duello: tre carte, almeno un musicista dopo un duello duro o un boss (se ne restano). */
export function rewardOffers(run: RunState, kind: NodeKind): Offer[] {
  const rng = rngFrom(run);
  const pool: Offer[] = shuffle(rng, [
    ...freeMusicians(run).map((m): Offer => ({ type: "musician", id: m.id })),
    ...freeGear(run).map((g): Offer => ({ type: "gear", id: g.id })),
  ]);
  const out: Offer[] = [];
  if (kind !== "fight") {
    const i = pool.findIndex((o) => o.type === "musician");
    if (i >= 0) out.push(...pool.splice(i, 1));
  }
  // nei duelli normali la prima band arriva presto: un musicista tra le prime carte se non ne hai
  if (kind === "fight" && run.band.length === 0) {
    const i = pool.findIndex((o) => o.type === "musician");
    if (i >= 0) out.push(...pool.splice(i, 1));
  }
  while (out.length < 2 && pool.length) out.push(pool.shift()!);
  out.push({ type: "heal", amount: 20 });
  return out;
}

export interface ShopItem {
  offer: Offer;
  price: number;
}

/** Il banco dei pegni: due musicisti o attrezzi, un attrezzo, e una cura. */
export function shopItems(run: RunState): ShopItem[] {
  const rng = rngFrom(run);
  const mus = shuffle(rng, freeMusicians(run)).slice(0, 1);
  const gear = shuffle(rng, freeGear(run)).slice(0, 3 - mus.length);
  return [
    ...mus.map((m): ShopItem => ({ offer: { type: "musician", id: m.id }, price: m.price })),
    ...gear.map((g): ShopItem => ({ offer: { type: "gear", id: g.id }, price: g.price })),
    { offer: { type: "heal", amount: 30 }, price: 30 },
  ];
}

/** Dollari di un duello vinto. */
export function coinsFor(run: RunState, kind: NodeKind, score: number): number {
  const base = kind === "boss" ? 70 : kind === "elite" ? 40 : 18;
  return Math.round((base + score / 150) * mods(run).coins * run.coinBonus);
}

/** Il nemico di un nodo, adattato alla run: i duelli duri sono più robusti, il tempo segue i modificatori. */
export function runEnemy(base: EnemyDef, kind: NodeKind, bpmShift: number): EnemyDef {
  const elite = kind === "elite";
  return {
    ...base,
    hp: Math.round(base.hp * (elite ? 1.35 : 1)),
    attack: base.attack + (elite ? 3 : 0),
    volleySize: base.volleySize + (elite ? 1 : 0),
    phases: base.phases.map((p) => ({
      ...p,
      bpm: [Math.max(50, p.bpm[0] + bpmShift), Math.max(54, p.bpm[1] + bpmShift)] as [number, number],
    })),
  };
}

/** Somma le statistiche di un duello a quelle della notte. */
export function addStats(run: RunState, s: Omit<RunStats, "fights" | "won" | "misses" | "hits">, won: boolean): void {
  const t = run.stats;
  t.fights++;
  if (won) t.won++;
  t.notesHit += s.notesHit;
  t.notesExpected += s.notesExpected;
  t.perfect += s.perfect;
  t.parried += s.parried;
  t.missed += s.missed;
  t.score += s.score;
  t.bestStreak = Math.max(t.bestStreak, s.bestStreak);
}

export function tally(run: RunState, label: string, ok: boolean): void {
  const m = ok ? run.stats.hits : run.stats.misses;
  m[label] = (m[label] ?? 0) + 1;
}

/** I fori più sbagliati della notte, in proporzione a quante volte sono capitati. */
export function weakest(run: RunState, n = 3): { label: string; misses: number; rate: number }[] {
  return Object.entries(run.stats.misses)
    .map(([label, misses]) => ({ label, misses, rate: misses / (misses + (run.stats.hits[label] ?? 0)) }))
    .filter((x) => x.misses >= 2)
    .sort((a, b) => b.rate - a.rate || b.misses - a.misses)
    .slice(0, n);
}

// ---------- salvataggio ----------

const KEY = "heroharp-lunga-notte";

export interface Meta {
  nights: number;
  dawns: number;
  bestScore: number;
  bestAct: number;
}

interface Stored {
  run: RunState | null;
  meta: Meta;
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { run: d.run?.version === 1 ? d.run : null, meta: { nights: 0, dawns: 0, bestScore: 0, bestAct: 0, ...d.meta } };
    }
  } catch {
    /* niente salvataggio */
  }
  return { run: null, meta: { nights: 0, dawns: 0, bestScore: 0, bestAct: 0 } };
}

const store: Stored = read();

export const meta = (): Meta => store.meta;
/** La run in corso, se c'è (una run finita non si riprende). */
export const savedRun = (): RunState | null => (store.run && !store.run.over ? store.run : null);

/** L'ultima run, anche se finita: per la pagella. */
export const lastRun = (): RunState | null => store.run;

export function saveRun(run: RunState | null): void {
  store.run = run;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignorato */
  }
}

/** Fine della notte: aggiorna i record e chiude la run. */
export function endRun(run: RunState, result: "won" | "lost"): void {
  run.over = result;
  const m = store.meta;
  m.nights++;
  if (result === "won") m.dawns++;
  m.bestScore = Math.max(m.bestScore, run.stats.score);
  m.bestAct = Math.max(m.bestAct, run.act + 1);
  saveRun(run);
}
