// Statistiche del giocatore e rilevamento degli errori più frequenti.
// Niente grafica qui: il registratore ascolta gli eventi della battaglia (battle/logic.ts)
// e la pagella (scenes/StatsScene.ts) legge solo i numeri, così le regole si possono testare.

import type { Battle, BattleEvent, PhraseNote } from "../battle/logic";
import { formatTab, midiToTabs, type HarpKey, type Tab } from "../harp";
import type { L10n } from "../content/areas";

/** Un'abilità misurata: quante volte l'hai provata, quante è venuta, e quanto sbagli di recente. */
export interface Skill {
  n: number;
  ok: number;
  /** Tasso di errore recente (media mobile esponenziale, 0..1): conta più l'ultima sessione che la prima. */
  ema: number;
}

/** Che tipo di errore è una nota sbagliata. */
export type ErrorKind =
  | "direction" // foro giusto, ma soffiato invece di aspirato (o viceversa)
  | "neighbor" // il foro accanto: due note insieme o bocca spostata
  | "leap" // un foro lontano: il salto non è arrivato
  | "bendShallow" // il bend non scende abbastanza
  | "flat" // nota calante: pieghi senza volerlo
  | "hold" // nota lunga lasciata troppo presto
  | "silent"; // la nota non è arrivata affatto

export const ERROR_KINDS: ErrorKind[] = ["direction", "neighbor", "leap", "bendShallow", "flat", "hold", "silent"];

/** Tecniche, misurate a parte rispetto ai singoli fori. */
export type Technique = "bend" | "deepBend" | "blowBend" | "chord" | "overblow";

export interface Day {
  /** Secondi passati a suonare in battaglia. */
  seconds: number;
  notes: number;
  hits: number;
  battles: number;
  wins: number;
}

export interface StatsData {
  v: 1;
  /** Note della risposta per intavolatura ("4d0" = 4 aspirato senza bend). */
  notes: Record<string, Skill>;
  /** Parate per intavolatura. */
  parry: Record<string, Skill>;
  techniques: Partial<Record<Technique, Skill>>;
  /** Per ogni tipo d'errore: in quante note è capitato e quanto spesso di recente. */
  errors: Partial<Record<ErrorKind, Skill>>;
  /** Nota attesa → nota suonata al suo posto → volte. */
  confusions: Record<string, Record<string, number>>;
  /** Anticipo/ritardo medio in battiti (positivo = in ritardo), recente. */
  timing: { n: number; ema: number };
  days: Record<string, Day>;
  totals: { battles: number; wins: number; seconds: number; notes: number; hits: number; bestStreak: number };
}

export const emptyStats = (): StatsData => ({
  v: 1,
  notes: {},
  parry: {},
  techniques: {},
  errors: {},
  confusions: {},
  timing: { n: 0, ema: 0 },
  days: {},
  totals: { battles: 0, wins: 0, seconds: 0, notes: 0, hits: 0, bestStreak: 0 },
});

/** Peso dell'ultimo tentativo nella media recente: circa le ultime 12 prove contano davvero. */
const ALPHA = 0.15;
/** Giorni di storico tenuti (per il grafico e i giorni di fila). */
const KEEP_DAYS = 60;

export function bump(s: Skill | undefined, ok: boolean): Skill {
  const cur = s ?? { n: 0, ok: 0, ema: 0 };
  const err = ok ? 0 : 1;
  // la prima prova fissa il punto di partenza, poi la media si muove piano
  const ema = cur.n === 0 ? err : cur.ema + ALPHA * (err - cur.ema);
  return { n: cur.n + 1, ok: cur.ok + (ok ? 1 : 0), ema };
}

export const tabKey = (t: Tab): string => `${t.hole}${t.draw ? "d" : "b"}${t.bend}`;
export function keyTab(k: string): Tab {
  const m = /^(\d+)([bd])(\d)$/.exec(k)!;
  return { hole: Number(m[1]), draw: m[2] === "d", bend: Number(m[3]) };
}

/** Tecnica che una nota della frase richiede (se ne richiede una). */
export function techniqueOf(n: PhraseNote): Technique | null {
  const src = n.source;
  if (src.technique === "overblow" || src.technique === "overdraw") return "overblow";
  if (src.kind === "chord" && src.holes.length > 1) return "chord";
  if (n.tab.bend > 0) return !n.tab.draw ? "blowBend" : n.tab.bend >= 2 ? "deepBend" : "bend";
  return null;
}

/**
 * Perché una nota suonata non è quella attesa. `null` quando la nota sentita non c'entra
 * (per esempio un rumore che non esiste sull'armonica in questa tonalità).
 */
export function classify(expected: Tab, midi: number, key: HarpKey): { kind: ErrorKind; played: Tab } | null {
  const cands = midiToTabs(midi, key);
  if (!cands.length) return null;
  const same = cands.find((c) => c.hole === expected.hole);
  if (same) {
    if (same.draw !== expected.draw) return { kind: "direction", played: same };
    return { kind: same.bend < expected.bend ? "bendShallow" : "flat", played: same };
  }
  const near = cands.find((c) => Math.abs(c.hole - expected.hole) === 1);
  if (near) return { kind: "neighbor", played: near };
  // il foro più vicino tra quelli che fanno quella nota
  const far = [...cands].sort((a, b) => Math.abs(a.hole - expected.hole) - Math.abs(b.hole - expected.hole))[0];
  return { kind: "leap", played: far };
}

export const today = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Registra una battaglia mentre la giochi: si chiama con ogni evento e, alla fine, con il risultato. */
export class BattleRecorder {
  /** Errori notati per ogni nota della risposta del round in corso. */
  private flagged = new Map<PhraseNote, ErrorKind>();
  private round = -1;
  /** Note e risultati di questa sola battaglia, per il riepilogo a fine partita. */
  readonly session = {
    notes: {} as Record<string, Skill>,
    errors: {} as Partial<Record<ErrorKind, number>>,
    confusions: {} as Record<string, Record<string, number>>,
  };
  private finished = false;

  constructor(
    private data: StatsData,
    private key: HarpKey,
  ) {}

  observe(ev: BattleEvent, battle: Battle): void {
    const r = battle.round;
    if (!r) return;
    if (r.number !== this.round) {
      this.round = r.number;
      this.flagged.clear();
    }
    const d = this.data;
    switch (ev.type) {
      case "responseHit": {
        const n = r.response[ev.index];
        if (n && !n.source.free) {
          d.timing.ema = d.timing.n === 0 ? ev.offset / r.beat : d.timing.ema + 0.08 * (ev.offset / r.beat - d.timing.ema);
          d.timing.n++;
        }
        break;
      }
      case "wrongNote": {
        // la nota che stavi cercando: la prima della risposta non ancora presa
        const idx = ev.index;
        const exp = r.response[idx];
        // la coda della nota appena presa (o il suo riattacco) non è un errore
        if (idx > 0 && r.response[idx - 1].accept.includes(ev.midi)) break;
        if (!exp || exp.source.free || exp.source.kind === "chord" || this.flagged.has(exp)) break;
        const c = classify(exp.tab, ev.midi, this.key);
        if (!c) break;
        this.flagged.set(exp, c.kind);
        const from = tabKey(exp.tab);
        const to = tabKey(c.played);
        for (const map of [d.confusions, this.session.confusions]) {
          map[from] ??= {};
          map[from][to] = (map[from][to] ?? 0) + 1;
        }
        break;
      }
      case "shortNote": {
        const n = r.response[ev.index];
        if (n && !this.flagged.has(n)) this.flagged.set(n, "hold");
        break;
      }
      case "enemyDamaged": {
        // la risposta è finita: ogni nota attesa diventa una prova riuscita o no.
        // La frase si ferma sulla prima nota mancata: quelle dopo non le hai potute suonare, non contano.
        const stuck = r.response.findIndex((n) => !n.hit);
        r.response.forEach((n, i) => {
          if (stuck < 0 || i <= stuck) this.scoreNote(n, r.beat);
        });
        break;
      }
      case "parry":
      case "playerDamaged": {
        const p = r.volley.find((x) => x.id === ev.id);
        if (p) d.parry[tabKey(p.tab)] = bump(d.parry[tabKey(p.tab)], ev.type === "parry");
        break;
      }
    }
  }

  private scoreNote(n: PhraseNote, beat: number): void {
    const d = this.data;
    // pulita = presa al primo colpo e tenuta quanto serve
    const ok = !!n.hit && !n.short && !this.flagged.has(n);
    if (!n.source.free) {
      const k = tabKey(n.tab);
      d.notes[k] = bump(d.notes[k], ok);
      this.session.notes[k] = bump(this.session.notes[k], ok);
      const tech = techniqueOf(n);
      if (tech) d.techniques[tech] = bump(d.techniques[tech], ok);
    }
    let kind = this.flagged.get(n);
    if (!kind && !n.hit) kind = "silent";
    // ogni tipo d'errore si misura sulle note dove poteva capitare
    for (const e of ERROR_KINDS) {
      if (e === "hold" && n.dur < 2 * beat - 1e-6) continue;
      if ((e === "bendShallow" && n.tab.bend === 0) || (e === "flat" && n.tab.bend > 0)) continue;
      if (n.source.free && e !== "silent" && e !== "hold") continue;
      d.errors[e] = bump(d.errors[e], kind !== e);
    }
    if (kind) this.session.errors[kind] = (this.session.errors[kind] ?? 0) + 1;
    d.totals.notes++;
    if (ok) d.totals.hits++;
    const day = this.day();
    day.notes++;
    if (ok) day.hits++;
  }

  private day(): Day {
    const k = today();
    return (this.data.days[k] ??= { seconds: 0, notes: 0, hits: 0, battles: 0, wins: 0 });
  }

  /** Fine della battaglia (vinta, persa o lasciata a metà). */
  finish(won: boolean, seconds: number, bestStreak: number, counts = true): void {
    if (this.finished) return;
    this.finished = true;
    const d = this.data;
    const day = this.day();
    const secs = Math.max(0, Math.min(seconds, 3600));
    day.seconds += secs;
    d.totals.seconds += secs;
    d.totals.bestStreak = Math.max(d.totals.bestStreak, bestStreak);
    if (counts) {
      day.battles++;
      d.totals.battles++;
      if (won) {
        day.wins++;
        d.totals.wins++;
      }
    }
    // si tengono solo gli ultimi due mesi di giorni
    const keys = Object.keys(d.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete d.days[k];
  }
}

// ---------- lettura: riepiloghi e punti deboli ----------

/** Giorni di fila in cui hai suonato, fino a oggi (o fino a ieri, se oggi non hai ancora suonato). */
export function dayStreak(data: StatsData, now = new Date()): number {
  const played = (d: Date) => (data.days[today(d)]?.notes ?? 0) > 0 || (data.days[today(d)]?.seconds ?? 0) > 0;
  const d = new Date(now);
  if (!played(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (played(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Gli ultimi `n` giorni, dal più vecchio a oggi. */
export function lastDays(data: StatsData, n: number, now = new Date()): { key: string; day: Day | undefined }[] {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ key: today(d), day: data.days[today(d)] });
  }
  return out;
}

/** Precisione recente di un'intavolatura, unendo risposte e parate. null se non l'hai ancora suonata abbastanza. */
export function tabAccuracy(data: StatsData, k: string, min = 3): number | null {
  const parts = [data.notes[k], data.parry[k]].filter((s): s is Skill => !!s);
  const n = parts.reduce((a, s) => a + s.n, 0);
  if (n < min) return null;
  return 1 - parts.reduce((a, s) => a + s.ema * s.n, 0) / n;
}

/** Dove andare a ripassare: una lezione di una tappa. */
export interface LessonRef {
  areaId: string;
  lessonId: string;
}

/** Cosa allenare nell'allenamento mirato. */
export type DrillFocus =
  | { type: "note"; tab: Tab; against?: Tab }
  | { type: "direction"; hole: number }
  | { type: "neighbor"; hole: number }
  | { type: "bend"; tab: Tab }
  | { type: "hold" }
  | { type: "timing"; late: boolean }
  | { type: "chord" };

export interface Weakness {
  id: string;
  title: L10n;
  detail: L10n;
  /** Quanto pesa: errore recente × quanto ne sei sicuro. */
  score: number;
  /** Precisione recente su questo punto (0..1), per mostrare i progressi. */
  accuracy: number;
  lesson: LessonRef;
  drill: DrillFocus;
}

const LESSONS: Record<string, LessonRef> = {
  singleNote: { areaId: "porch", lessonId: "single-note" },
  breathe: { areaId: "porch", lessonId: "breathe" },
  scale: { areaId: "station", lessonId: "scale" },
  leaps: { areaId: "station", lessonId: "leaps" },
  chords: { areaId: "freight-train", lessonId: "chords" },
  rhythm: { areaId: "freight-train", lessonId: "train-rhythm" },
  bend: { areaId: "juke-joint", lessonId: "first-bend" },
  deepBend: { areaId: "delta-crossroads", lessonId: "deep-bends" },
  blowBend: { areaId: "after-hours", lessonId: "blow-bends" },
  overblow: { areaId: "after-hours", lessonId: "overblows" },
};

const bendLesson = (t: Tab): LessonRef => (!t.draw ? LESSONS.blowBend : t.bend >= 2 ? LESSONS.deepBend : LESSONS.bend);
const pct = (x: number) => Math.round(x * 100);
const fmt = (t: Tab) => formatTab(t);

/** Più prove = più fiducia: sotto le 12 prove il punto pesa meno. */
const confidence = (n: number) => Math.min(1, n / 12);

/** La confusione più frequente per una nota attesa, se è capitata almeno due volte. */
function topConfusion(data: StatsData, k: string): { tab: Tab; count: number } | null {
  const m = data.confusions[k];
  if (!m) return null;
  const [to, count] = Object.entries(m).sort((a, b) => b[1] - a[1])[0] ?? [];
  return to && count >= 2 ? { tab: keyTab(to), count } : null;
}

/** Il punto debole di un singolo foro: quanto lo sbagli, con cosa lo confondi, dove ripassarlo. */
export function noteWeakness(data: StatsData, tab: Tab): Weakness {
  const k = tabKey(tab);
  const s = data.notes[k] ?? { n: 0, ok: 0, ema: 0.5 };
  const conf = topConfusion(data, k);
  let lesson = tab.bend ? bendLesson(tab) : tab.hole >= 7 ? LESSONS.scale : LESSONS.singleNote;
  let detail: L10n = {
    it: `Giusta ${pct(1 - s.ema)}% delle volte, di recente.`,
    en: `Right ${pct(1 - s.ema)}% of the time, lately.`,
  };
  if (conf) {
    detail = { it: `Spesso al suo posto suoni ${fmt(conf.tab)} (${conf.count} volte).`, en: `You often play ${fmt(conf.tab)} instead (${conf.count} times).` };
    if (conf.tab.hole === tab.hole && conf.tab.draw !== tab.draw) lesson = LESSONS.scale;
    else if (Math.abs(conf.tab.hole - tab.hole) === 1) lesson = LESSONS.singleNote;
    else if (conf.tab.hole !== tab.hole) lesson = LESSONS.leaps;
  }
  return {
    id: `note:${k}`,
    title: { it: `Il foro ${fmt(tab)}`, en: `Hole ${fmt(tab)}` },
    detail,
    score: s.ema * confidence(s.n) * 1.1,
    accuracy: 1 - s.ema,
    lesson,
    drill: tab.bend ? { type: "bend", tab } : { type: "note", tab, against: conf?.tab },
  };
}

/**
 * I punti deboli, dal più urgente. Ognuno porta una lezione e un allenamento mirato.
 * Tre famiglie: singoli fori che sbagli spesso, tipi di errore ricorrenti, il tempo.
 */
export function weaknesses(data: StatsData, max = 3): Weakness[] {
  const out: Weakness[] = [];
  const kinds = data.errors;

  // 1. fori che sbagli spesso (con la nota che suoni al loro posto)
  for (const [k, sk] of Object.entries(data.notes)) if (sk.n >= 6 && sk.ema >= 0.3) out.push(noteWeakness(data, keyTab(k)));

  // 2. tipi di errore che tornano (il foro più colpito dice dove allenarsi)
  const worstHole = (pred: (from: Tab, to: Tab) => boolean): { hole: number; tab: Tab } | null => {
    let best: { hole: number; tab: Tab; n: number } | null = null;
    for (const [from, m] of Object.entries(data.confusions))
      for (const [to, n] of Object.entries(m)) {
        const a = keyTab(from);
        if (pred(a, keyTab(to)) && (!best || n > best.n)) best = { hole: a.hole, tab: a, n };
      }
    return best;
  };
  const kind = (e: ErrorKind, min: number) => {
    const s = kinds[e];
    return s && s.n >= 8 && s.ema >= min ? s : null;
  };
  const dir = kind("direction", 0.12);
  if (dir) {
    const w = worstHole((a, b) => a.hole === b.hole && a.draw !== b.draw);
    out.push({
      id: "error:direction",
      title: { it: "Soffio o aspirato?", en: "Blow or draw?" },
      detail: {
        it: `Inverti il respiro in una nota su ${Math.max(2, Math.round(1 / dir.ema))}${w ? `, soprattutto al foro ${w.hole}` : ""}.`,
        en: `You flip the breath on one note in ${Math.max(2, Math.round(1 / dir.ema))}${w ? `, mostly on hole ${w.hole}` : ""}.`,
      },
      score: dir.ema * confidence(dir.n) * 2.2,
      accuracy: 1 - dir.ema,
      lesson: LESSONS.scale,
      drill: { type: "direction", hole: w?.hole ?? 4 },
    });
  }
  const nb = kind("neighbor", 0.12);
  if (nb) {
    const w = worstHole((a, b) => Math.abs(a.hole - b.hole) === 1);
    out.push({
      id: "error:neighbor",
      title: { it: "Il foro accanto", en: "The next hole over" },
      detail: {
        it: `Scivoli sul foro vicino${w ? ` (soprattutto attorno al ${w.hole})` : ""}: punta a una nota sola, pulita.`,
        en: `You slip onto the next hole${w ? ` (mostly around ${w.hole})` : ""}: aim for one clean note.`,
      },
      score: nb.ema * confidence(nb.n) * 2,
      accuracy: 1 - nb.ema,
      lesson: LESSONS.singleNote,
      drill: { type: "neighbor", hole: w?.hole ?? 4 },
    });
  }
  const leap = kind("leap", 0.12);
  if (leap) {
    const w = worstHole((a, b) => Math.abs(a.hole - b.hole) > 1);
    out.push({
      id: "error:leap",
      title: { it: "I salti", en: "Leaps" },
      detail: {
        it: "Nei salti arrivi sul foro sbagliato: sposta l'armonica, non la testa.",
        en: "On leaps you land on the wrong hole: move the harp, not your head.",
      },
      score: leap.ema * confidence(leap.n) * 1.8,
      accuracy: 1 - leap.ema,
      lesson: LESSONS.leaps,
      drill: { type: "neighbor", hole: w?.hole ?? 4 },
    });
  }
  const shallow = kind("bendShallow", 0.25);
  if (shallow) {
    const w = worstHole((a, b) => a.hole === b.hole && a.draw === b.draw && b.bend < a.bend);
    const tab = w?.tab ?? { hole: 4, draw: true, bend: 1 };
    out.push({
      id: "error:bendShallow",
      title: { it: "Bend che non scendono", en: "Bends that don't drop" },
      detail: {
        it: `Il bend resta troppo in alto${w ? ` (soprattutto ${fmt(tab)})` : ""}: abbassa la lingua, come dire «iii-uuu».`,
        en: `The bend stays too high${w ? ` (mostly ${fmt(tab)})` : ""}: drop your tongue, like saying "eee-ooo".`,
      },
      score: shallow.ema * confidence(shallow.n) * 1.6,
      accuracy: 1 - shallow.ema,
      lesson: bendLesson(tab),
      drill: { type: "bend", tab },
    });
  }
  const flat = kind("flat", 0.12);
  if (flat) {
    const w = worstHole((a, b) => a.hole === b.hole && a.draw === b.draw && b.bend > a.bend);
    out.push({
      id: "error:flat",
      title: { it: "Note calanti", en: "Flat notes" },
      detail: {
        it: `${w ? `Al foro ${fmt(w.tab)} ` : ""}la nota scende senza volerlo: aspira piano, gola aperta.`,
        en: `${w ? `On ${fmt(w.tab)} ` : ""}the note sags without meaning to: draw gently, open throat.`,
      },
      score: flat.ema * confidence(flat.n) * 1.6,
      accuracy: 1 - flat.ema,
      lesson: LESSONS.breathe,
      drill: { type: "note", tab: w?.tab ?? { hole: 2, draw: true, bend: 0 } },
    });
  }
  const hold = kind("hold", 0.25);
  if (hold)
    out.push({
      id: "error:hold",
      title: { it: "Note lunghe", en: "Long notes" },
      detail: {
        it: `Lasci le note lunghe troppo presto (${pct(hold.ema)}% di recente): respira dalla pancia e tieni fino in fondo.`,
        en: `You let long notes go too soon (${pct(hold.ema)}% lately): breathe from the belly and hold to the end.`,
      },
      score: hold.ema * confidence(hold.n) * 1.3,
      accuracy: 1 - hold.ema,
      lesson: LESSONS.breathe,
      drill: { type: "hold" },
    });

  // 3. tecniche
  const chord = data.techniques.chord;
  if (chord && chord.n >= 6 && chord.ema >= 0.3)
    out.push({
      id: "tech:chord",
      title: { it: "Gli accordi", en: "Chords" },
      detail: {
        it: `Accordi giusti ${pct(1 - chord.ema)}% delle volte: bocca larga, tre fori insieme.`,
        en: `Chords right ${pct(1 - chord.ema)}% of the time: wide mouth, three holes together.`,
      },
      score: chord.ema * confidence(chord.n),
      accuracy: 1 - chord.ema,
      lesson: LESSONS.chords,
      drill: { type: "chord" },
    });
  const ob = data.techniques.overblow;
  if (ob && ob.n >= 4 && ob.ema >= 0.5)
    out.push({
      id: "tech:overblow",
      title: { it: "Overblow", en: "Overblows" },
      detail: {
        it: "L'overblow non esce ancora: è la tecnica più difficile, vai per gradi.",
        en: "The overblow isn't there yet: it's the hardest technique, take it step by step.",
      },
      score: ob.ema * confidence(ob.n) * 0.6,
      accuracy: 1 - ob.ema,
      lesson: LESSONS.overblow,
      drill: { type: "note", tab: { hole: 6, draw: false, bend: 0 } },
    });

  // 4. il tempo: arrivi sempre un po' prima o un po' dopo
  const tm = data.timing;
  if (tm.n >= 12 && Math.abs(tm.ema) >= 0.12) {
    const late = tm.ema > 0;
    out.push({
      id: "timing",
      title: late ? { it: "Arrivi in ritardo", en: "You come in late" } : { it: "Corri troppo", en: "You rush" },
      detail: late
        ? {
            it: `In media entri ${pct(tm.ema)}% di battito dopo: preparati sul colpo prima.`,
            en: `On average you come in ${pct(tm.ema)}% of a beat late: get ready on the beat before.`,
          }
        : {
            it: `In media entri ${pct(-tm.ema)}% di battito prima: aspetta il colpo, batti il piede.`,
            en: `On average you come in ${pct(-tm.ema)}% of a beat early: wait for the beat, tap your foot.`,
          },
      score: Math.min(1, Math.abs(tm.ema) * 2) * confidence(tm.n / 2) * 0.9,
      accuracy: Math.max(0, 1 - Math.abs(tm.ema) * 2),
      lesson: LESSONS.rhythm,
      drill: { type: "timing", late },
    });
  }

  // il più urgente prima; non due punti con lo stesso allenamento
  out.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return out
    .filter((w) => {
      const k = JSON.stringify(w.drill);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}

/** L'errore più evidente di una sola battaglia, per la riga a fine partita. */
export function sessionHint(rec: BattleRecorder): { title: L10n; tab?: Tab } | null {
  const s = rec.session;
  let worst: { k: string; miss: number } | null = null;
  for (const [k, sk] of Object.entries(s.notes)) {
    const miss = sk.n - sk.ok;
    if (miss >= 2 && (!worst || miss > worst.miss)) worst = { k, miss };
  }
  if (!worst) return null;
  const tab = keyTab(worst.k);
  const conf = Object.entries(s.confusions[worst.k] ?? {}).sort((a, b) => b[1] - a[1])[0];
  const instead = conf && conf[1] >= 2 ? keyTab(conf[0]) : null;
  return {
    tab,
    title: instead
      ? { it: `Da allenare: ${fmt(tab)} (spesso suoni ${fmt(instead)})`, en: `To practise: ${fmt(tab)} (you often play ${fmt(instead)})` }
      : { it: `Da allenare: ${fmt(tab)} (mancata ${worst.miss} volte)`, en: `To practise: ${fmt(tab)} (missed ${worst.miss} times)` },
  };
}
