// Regole della battaglia, senza grafica né audio: così si possono testare.
// Un round: conto alla rovescia → il nemico suona (Ascolta) → tu ripeti (Rispondi) → raffica da parare (Para!).

import type { EnemyDef, Phrase, PhraseNote as ContentNote } from "../content/areas";
import { tabToMidi, type HarpKey, type Tab } from "../harp";

export type Phase = "countin" | "call" | "response" | "volley" | "won" | "lost";

export interface PhraseNote {
  tab: Tab;
  /** Nota principale; per un accordo la più bassa. */
  midi: number;
  /** Note accettate: per accordi, ottave e trilli basta una delle loro note. */
  accept: number[];
  /** Nota del percorso da cui viene (fori, tecnica, tipo). */
  source: ContentNote;
  /** Istante ideale (orologio audio) e durata, in secondi. */
  time: number;
  dur: number;
  hit?: boolean;
  /** Nota lunga lasciata troppo presto: vale metà. */
  short?: boolean;
}

export interface Projectile {
  id: number;
  tab: Tab;
  midi: number;
  /** Indice della corsia (una per foro). */
  lane: number;
  /** Istante in cui arriva sulla linea di parata. */
  time: number;
  state: "pending" | "parried" | "missed";
}

export interface Round {
  number: number;
  beat: number;
  bpm: number;
  phraseId: string;
  countIn: number[];
  call: PhraseNote[];
  callEnd: number;
  response: PhraseNote[];
  responseEnd: number;
  volleyStart: number;
  volley: Projectile[];
  end: number;
}

export type BattleEvent =
  | { type: "phase"; phase: Phase }
  | { type: "responseHit"; index: number; offset: number }
  | { type: "wrongNote"; midi: number }
  | { type: "shortNote"; index: number }
  | { type: "enemyDamaged"; amount: number; accuracy: number; onTime: boolean; combo: number }
  | { type: "parry"; id: number }
  | { type: "playerDamaged"; id: number; amount: number }
  | { type: "heal"; amount: number }
  | { type: "bossPhase"; index: number }
  | { type: "difficulty"; level: number; bpm: number };

export const PLAYER_HP = 100;
/** Le note lunghe almeno così (in battiti) vanno tenute. */
const HOLD_BEATS = 2;

export interface BattleOptions {
  rng?: () => number;
  /** Sposta l'inizio di un round sulla prossima battuta della base musicale. */
  align?: (t: number) => number;
}

export class Battle {
  /** Fori usati da questo nemico, uno per corsia di difesa. */
  readonly lanes: number[];
  private readonly volleyTabs: Tab[];
  phase: Phase = "countin";
  playerHp = PLAYER_HP;
  enemyHp: number;
  bossPhase = 0;
  level = 0;
  bpm: number;
  combo = 0;
  round!: Round;
  stats = { notesExpected: 0, notesHit: 0, parried: 0, missed: 0, rounds: 0 };
  private rng: () => number;
  private align: (t: number) => number;
  private roundNo = 0;
  private respIndex = 0;
  private nextId = 0;
  private offsets: number[] = [];
  private queue: Phrase[] = [];
  private lastPhrase = -1;
  private sustain: { index: number; until: number } | null = null;
  private silentSince: number | null = null;
  private healedBeats = 0;
  private events: BattleEvent[] = [];

  constructor(
    readonly enemy: EnemyDef,
    readonly key: HarpKey,
    opts: BattleOptions = {},
  ) {
    this.rng = opts.rng ?? Math.random;
    this.level = 0;
    this.align = opts.align ?? ((t) => t);
    this.enemyHp = enemy.hp;
    this.bpm = enemy.phases[0].bpm[0];
    // la raffica usa le note singole del nemico (niente accordi né overblow: si parano con una nota sola)
    const seen = new Map<string, Tab>();
    for (const ph of enemy.phases)
      for (const phrase of ph.phrases)
        for (const seg of phrase) for (const n of seg.notes) if (n.kind === "note" && !n.technique) seen.set(`${n.tab.hole}${n.tab.draw}${n.tab.bend}`, n.tab);
    if (seen.size === 0) seen.set("4b", { hole: 4, draw: false, bend: 0 });
    this.volleyTabs = [...seen.values()].sort((a, b) => a.hole - b.hole || Number(a.draw) - Number(b.draw) || a.bend - b.bend);
    this.lanes = [...new Set(this.volleyTabs.map((t) => t.hole))];
  }

  get beat(): number {
    return 60 / this.bpm;
  }

  /** Margine per la parata, in secondi. Generoso: il gioco è per principianti. */
  get parryWindow(): number {
    return Math.max(0.25, 0.4 * this.beat);
  }

  get currentPhase() {
    return this.enemy.phases[this.bossPhase];
  }

  drain(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Livello più alto disponibile nella fase attuale (0 facile, 1 medio, 2 difficile). */
  private get maxLevel(): number {
    return Math.max(...this.currentPhase.tiers);
  }

  /** Una frase a caso del livello attuale (o del più vicino), mai la stessa due volte di fila. */
  private nextPhrase(): Phrase {
    if (this.queue.length === 0) {
      const { phrases, tiers } = this.currentPhase;
      const wanted = [...new Set(tiers)].sort((a, b) => Math.abs(a - this.level) - Math.abs(b - this.level) || a - b)[0];
      let pool = tiers.map((t, i) => (t === wanted ? i : -1)).filter((i) => i >= 0);
      if (pool.length > 1) pool = pool.filter((i) => i !== this.lastPhrase);
      const pick = pool[Math.floor(this.rng() * pool.length)];
      this.lastPhrase = pick;
      this.queue = [...phrases[pick]];
    }
    return this.queue.shift()!;
  }

  private midiOf(semitone: number): number {
    return this.key.root + semitone;
  }

  startRound(at: number): Round {
    const t0 = this.align(at);
    const beat = this.beat;
    const phrase = this.nextPhrase();
    const countIn = [0, 1, 2, 3].map((i) => t0 + i * beat);
    const callStart = t0 + 4 * beat;
    const mk = (start: number): PhraseNote[] =>
      phrase.notes.map((n) => ({
        tab: n.tab,
        midi: this.midiOf(n.semitones[0]),
        accept: n.semitones.map((s) => this.midiOf(s)),
        source: n,
        time: start + n.start * beat,
        dur: n.dur * beat,
      }));
    const call = mk(callStart);
    const callEnd = callStart + phrase.beats * beat;
    const response = mk(callEnd);
    // due battiti di tolleranza per chi è in ritardo
    const responseEnd = callEnd + phrase.beats * beat + 2 * beat;
    const volleyStart = responseEnd + beat;
    const spacing = this.level < 1 ? 2 * beat : beat;
    const volley: Projectile[] = [];
    let prev = -1;
    for (let i = 0; i < this.enemy.volleySize; i++) {
      let k = Math.floor(this.rng() * this.volleyTabs.length);
      if (k === prev) k = (k + 1) % this.volleyTabs.length;
      prev = k;
      const tab = this.volleyTabs[k];
      volley.push({
        id: this.nextId++,
        tab,
        midi: tabToMidi(tab, this.key),
        lane: this.lanes.indexOf(tab.hole),
        time: volleyStart + 2 * beat + i * spacing,
        state: "pending",
      });
    }
    const end = volley[volley.length - 1].time + this.parryWindow + beat;
    this.roundNo++;
    this.respIndex = 0;
    this.offsets = [];
    this.sustain = null;
    this.silentSince = null;
    this.healedBeats = 0;
    this.round = { number: this.roundNo, beat, bpm: this.bpm, phraseId: phrase.id, countIn, call, callEnd, response, responseEnd, volleyStart, volley, end };
    this.setPhase("countin");
    return this.round;
  }

  /** Un attacco di nota rilevato (dal microfono o dalla tastiera). */
  onset(midi: number, time: number): void {
    if (this.phase !== "response") return;
    const exp = this.round.response[this.respIndex];
    if (!exp) return;
    if (exp.accept.includes(midi)) {
      exp.hit = true;
      this.offsets.push(time - exp.time);
      if (exp.dur >= HOLD_BEATS * this.round.beat - 1e-6) this.sustain = { index: this.respIndex, until: time + 0.6 * exp.dur };
      this.events.push({ type: "responseHit", index: this.respIndex, offset: time - exp.time });
      this.respIndex++;
    } else {
      this.events.push({ type: "wrongNote", midi });
    }
  }

  /** Da chiamare a ogni frame con la nota tenuta in questo momento. */
  update(now: number, heldMidi: number | null): void {
    if (this.phase === "won" || this.phase === "lost") return;
    const r = this.round;
    if (this.phase === "countin" && now >= r.countIn[3] + r.beat) this.setPhase("call");
    if (this.phase === "call" && now >= r.callEnd - 0.1 * r.beat) this.setPhase("response");
    if (this.phase === "response") {
      this.checkSustain(now, heldMidi);
      this.checkSilence(now, heldMidi);
      const done = this.respIndex >= r.response.length && !this.sustain;
      if (now >= r.responseEnd || done) {
        this.finishResponse(now);
        if ((this.phase as Phase) === "won") return;
      }
    }
    if (this.phase === "volley") {
      for (const p of r.volley) {
        if (p.state !== "pending") continue;
        if (heldMidi === p.midi && Math.abs(now - p.time) <= this.parryWindow) {
          p.state = "parried";
          this.stats.parried++;
          this.events.push({ type: "parry", id: p.id });
        } else if (now > p.time + this.parryWindow) {
          p.state = "missed";
          this.stats.missed++;
          this.playerHp = Math.max(0, this.playerHp - this.enemy.attack);
          this.events.push({ type: "playerDamaged", id: p.id, amount: this.enemy.attack });
          if (this.playerHp <= 0) return this.setPhase("lost");
        }
      }
      if (now >= r.end) this.startRound(now);
    }
  }

  private checkSustain(now: number, heldMidi: number | null): void {
    const s = this.sustain;
    if (!s) return;
    const exp = this.round.response[s.index];
    if (now >= s.until) this.sustain = null;
    else if (heldMidi === null || !exp.accept.includes(heldMidi)) {
      exp.short = true;
      this.sustain = null;
      this.events.push({ type: "shortNote", index: s.index });
    }
  }

  /** Il Silenzio recupera vita per ogni battito in cui non suoni durante la risposta. */
  private checkSilence(now: number, heldMidi: number | null): void {
    if (!this.enemy.healsOnSilence) return;
    const r = this.round;
    if (heldMidi !== null || now < r.callEnd + r.beat) {
      this.silentSince = null;
      this.healedBeats = 0;
      return;
    }
    this.silentSince ??= now;
    const beats = Math.floor((now - this.silentSince) / r.beat);
    const cap = this.phaseCap();
    if (beats > this.healedBeats && this.enemyHp < cap) {
      const amount = Math.min(2, cap - this.enemyHp);
      this.enemyHp += amount;
      this.healedBeats = beats;
      this.events.push({ type: "heal", amount });
    }
  }

  /** Vita massima nella fase attuale del boss: non si guarisce oltre. */
  private phaseCap(): number {
    return Math.round(this.enemy.hp * (1 - this.bossPhase / this.enemy.phases.length));
  }

  private finishResponse(now: number): void {
    const r = this.round;
    const score = r.response.reduce((s, n) => s + (n.hit ? (n.short ? 0.5 : 1) : 0), 0);
    const accuracy = score / r.response.length;
    this.stats.notesExpected += r.response.length;
    this.stats.notesHit += r.response.filter((n) => n.hit && !n.short).length;
    this.stats.rounds++;
    // "a tempo" se tutte le note sono arrivate entro mezzo battito dal punto ideale
    const onTime = accuracy === 1 && this.offsets.every((o) => Math.abs(o) <= 0.5 * r.beat);
    this.combo = accuracy === 1 ? this.combo + 1 : 0;
    const base = this.enemy.hp / (this.enemy.boss ? 8 : 4);
    const amount = Math.round(base * accuracy * (onTime ? 1.25 : 1) * (1 + 0.15 * Math.max(0, this.combo - 1)));
    this.enemyHp = Math.max(0, this.enemyHp - amount);
    this.events.push({ type: "enemyDamaged", amount, accuracy, onTime, combo: this.combo });
    this.adapt(accuracy);
    if (this.enemyHp <= 0) return this.setPhase("won");
    this.advanceBossPhase();
    // se hai finito prima, la raffica arriva prima (di battiti interi, per restare a tempo)
    const shift = Math.max(0, Math.floor((r.responseEnd - now) / r.beat)) * r.beat;
    if (shift > 0) {
      r.volleyStart -= shift;
      r.end -= shift;
      for (const p of r.volley) p.time -= shift;
    }
    this.setPhase("volley");
  }

  private advanceBossPhase(): void {
    const n = this.enemy.phases.length;
    const next = Math.min(n - 1, Math.floor((1 - this.enemyHp / this.enemy.hp) * n));
    if (next > this.bossPhase) {
      this.bossPhase = next;
      this.level = 0;
      this.queue = [];
      this.bpm = this.currentPhase.bpm[0];
      this.events.push({ type: "bossPhase", index: next });
    }
  }

  private adapt(accuracy: number): void {
    const before = [this.level, this.bpm];
    const [lo, hi] = this.currentPhase.bpm;
    const maxLevel = this.maxLevel;
    if (accuracy >= 0.9) {
      if (this.level < maxLevel) this.level++;
      else this.bpm = Math.min(hi, this.bpm + 4);
    } else if (accuracy < 0.5) {
      if (this.level > 0) this.level--;
      this.bpm = Math.max(lo - 10, this.bpm - 6);
    }
    if (before[0] !== this.level || before[1] !== this.bpm) this.events.push({ type: "difficulty", level: this.level, bpm: this.bpm });
  }

  private setPhase(p: Phase): void {
    if (this.phase === p && p !== "countin") return;
    this.phase = p;
    this.events.push({ type: "phase", phase: p });
  }
}
