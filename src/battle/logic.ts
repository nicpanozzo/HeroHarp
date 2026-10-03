// Regole della battaglia, senza grafica né audio: così si possono testare.
// Un round: conto alla rovescia → il nemico suona (Ascolta) → tu ripeti (Rispondi) → raffica da parare (Para!).

import type { EnemyDef } from "../content/enemies";
import { parseTab, tabToMidi, type HarpKey, type Tab } from "../harp";

export type Phase = "countin" | "call" | "response" | "volley" | "won" | "lost";

export interface PhraseNote {
  tab: Tab;
  midi: number;
  /** Istante ideale (orologio audio). */
  time: number;
  hit?: boolean;
}

export interface Projectile {
  id: number;
  tab: Tab;
  midi: number;
  lane: number;
  /** Istante in cui arriva sulla linea di parata. */
  time: number;
  state: "pending" | "parried" | "missed";
}

export interface Round {
  number: number;
  beat: number;
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
  | { type: "enemyDamaged"; amount: number; accuracy: number; onTime: boolean; combo: number }
  | { type: "parry"; id: number }
  | { type: "playerDamaged"; id: number; amount: number }
  | { type: "difficulty"; level: number; tempo: number };

export const PLAYER_HP = 100;

export class Battle {
  readonly lanes: Tab[];
  phase: Phase = "countin";
  playerHp = PLAYER_HP;
  enemyHp: number;
  level = 0;
  tempo = 1;
  combo = 0;
  round!: Round;
  private roundNo = 0;
  private respIndex = 0;
  private nextId = 0;
  private events: BattleEvent[] = [];
  /** Statistiche per la schermata finale. */
  stats = { notesExpected: 0, notesHit: 0, parried: 0, missed: 0, rounds: 0 };

  constructor(
    readonly enemy: EnemyDef,
    readonly key: HarpKey,
    private rng: () => number = Math.random,
  ) {
    this.enemyHp = enemy.hp;
    this.lanes = enemy.volleyNotes.map(parseTab);
  }

  get beat(): number {
    return 60 / (this.enemy.bpm * this.tempo);
  }

  /** Margine per la parata, in secondi. Generoso: il gioco è per principianti. */
  get parryWindow(): number {
    return Math.max(0.25, 0.4 * this.beat);
  }

  drain(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  startRound(t0: number): Round {
    const beat = this.beat;
    const phrase = this.enemy.phrases[this.level].map(parseTab);
    const bars = Math.ceil(phrase.length / 4) * 4;
    const countIn = [0, 1, 2, 3].map((i) => t0 + i * beat);
    const callStart = t0 + 4 * beat;
    const mk = (start: number): PhraseNote[] =>
      phrase.map((tab, i) => ({ tab, midi: tabToMidi(tab, this.key), time: start + i * beat }));
    const call = mk(callStart);
    const callEnd = callStart + bars * beat;
    const response = mk(callEnd);
    // due battiti di tolleranza per chi è in ritardo
    const responseEnd = callEnd + bars * beat + 2 * beat;
    const volleyStart = responseEnd + beat;
    const spacing = this.level < 2 ? 2 * beat : beat;
    const volley: Projectile[] = [];
    let prev = -1;
    for (let i = 0; i < this.enemy.volleySize; i++) {
      let lane = Math.floor(this.rng() * this.lanes.length);
      if (lane === prev) lane = (lane + 1) % this.lanes.length;
      prev = lane;
      const tab = this.lanes[lane];
      volley.push({ id: this.nextId++, tab, midi: tabToMidi(tab, this.key), lane, time: volleyStart + 2 * beat + i * spacing, state: "pending" });
    }
    const end = volley[volley.length - 1].time + this.parryWindow + beat;
    this.roundNo++;
    this.respIndex = 0;
    this.offsets = [];
    this.round = { number: this.roundNo, beat, countIn, call, callEnd, response, responseEnd, volleyStart, volley, end };
    this.setPhase("countin");
    return this.round;
  }

  /** Un attacco di nota rilevato (dal microfono o dalla tastiera). */
  onset(midi: number, time: number): void {
    if (this.phase !== "response") return;
    const r = this.round;
    const exp = r.response[this.respIndex];
    if (!exp) return;
    if (midi === exp.midi) {
      exp.hit = true;
      this.offsets.push(time - exp.time);
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
    if (this.phase === "response" && (now >= r.responseEnd || this.respIndex >= r.response.length)) {
      this.finishResponse(now);
      if ((this.phase as Phase) === "won") return;
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
      if (now >= r.end) this.startRound(now + 0.2);
    }
  }

  private finishResponse(now: number): void {
    const r = this.round;
    const hits = r.response.filter((n) => n.hit).length;
    const accuracy = hits / r.response.length;
    this.stats.notesExpected += r.response.length;
    this.stats.notesHit += hits;
    this.stats.rounds++;
    // "a tempo" se tutte le note sono arrivate entro mezzo battito dal punto ideale
    const onTime = accuracy === 1 && this.offsets.every((o) => Math.abs(o) <= 0.5 * r.beat);
    this.combo = accuracy === 1 ? this.combo + 1 : 0;
    const base = this.enemy.hp / 4;
    const amount = Math.round(base * accuracy * (onTime ? 1.25 : 1) * (1 + 0.15 * Math.max(0, this.combo - 1)));
    this.enemyHp = Math.max(0, this.enemyHp - amount);
    this.events.push({ type: "enemyDamaged", amount, accuracy, onTime, combo: this.combo });
    this.adapt(accuracy);
    if (this.enemyHp <= 0) return this.setPhase("won");
    // se hai finito prima, la raffica arriva prima (di battiti interi, per restare a tempo)
    const shift = Math.max(0, Math.floor((r.responseEnd - now) / r.beat)) * r.beat;
    if (shift > 0) {
      r.volleyStart -= shift;
      r.end -= shift;
      for (const p of r.volley) p.time -= shift;
    }
    this.setPhase("volley");
  }

  private offsets: number[] = [];

  private adapt(accuracy: number): void {
    const before = [this.level, this.tempo];
    const maxLevel = this.enemy.phrases.length - 1;
    if (accuracy >= 0.9) {
      if (this.level < maxLevel) this.level++;
      else this.tempo = Math.min(1.2, +(this.tempo * 1.05).toFixed(3));
    } else if (accuracy < 0.5) {
      if (this.level > 0) this.level--;
      this.tempo = Math.max(0.7, +(this.tempo * 0.9).toFixed(3));
    }
    if (before[0] !== this.level || before[1] !== this.tempo) {
      this.events.push({ type: "difficulty", level: this.level, tempo: this.tempo });
    }
  }

  private setPhase(p: Phase): void {
    if (this.phase === p && p !== "countin") return;
    this.phase = p;
    this.events.push({ type: "phase", phase: p });
  }
}
