import { describe, it, expect } from "vitest";
import { Battle } from "../src/battle/logic";
import { AREAS, enemyById } from "../src/content/areas";
import { keyById, tabToMidi, type Tab } from "../src/harp";
import { BattleRecorder, classify, dayStreak, emptyStats, noteWeakness, sessionHint, today, weaknesses, type StatsData } from "../src/stats/stats";
import { makeDrill } from "../src/stats/drill";

const C = keyById("C");
const T = (hole: number, draw: boolean, bend = 0): Tab => ({ hole, draw, bend });

const seeded = () => {
  let s = 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/**
 * Un giocatore che suona tutto a tempo, tranne le note per cui `instead` restituisce un'altra intavolatura
 * (la suona al posto di quella giusta) o null (non suona affatto). Registra tutto nelle statistiche.
 */
function play(data: StatsData, enemyId: string, instead: (t: Tab) => Tab | null | undefined, maxSeconds = 600) {
  const b = new Battle(enemyById(enemyId), C, { rng: seeded() });
  const rec = new BattleRecorder(data, C);
  b.startRound(0);
  const tried = new Set<object>();
  for (let now = 0; now < maxSeconds; now += 1 / 60) {
    let held: number | null = null;
    const r = b.round;
    if (b.phase === "response") {
      const n = r.response.find((x) => !x.hit);
      if (n && now >= n.time && !tried.has(n)) {
        tried.add(n);
        const alt = instead(n.tab);
        if (alt === undefined) b.onset(n.midi, now);
        else if (alt) b.onset(tabToMidi(alt, C), now);
      }
      for (const x of r.response) if (x.hit && now >= x.time && now < x.time + x.dur * 0.9) held = x.midi;
    }
    for (const p of r.volley) if (Math.abs(now - p.time) < 0.1) held = p.midi;
    b.update(now, held);
    for (const ev of b.drain()) rec.observe(ev, b);
    if (b.phase === "won" || b.phase === "lost") break;
  }
  rec.finish(b.phase === "won", 60, b.stats.bestStreak);
  return { b, rec };
}

describe("classificazione degli errori", () => {
  it("riconosce respiro invertito, foro accanto, salto, bend corto e nota calante", () => {
    expect(classify(T(4, true), tabToMidi(T(4, false), C), C)?.kind).toBe("direction");
    expect(classify(T(4, true), tabToMidi(T(5, true), C), C)?.kind).toBe("neighbor");
    expect(classify(T(4, true), tabToMidi(T(8, true), C), C)?.kind).toBe("leap");
    expect(classify(T(3, true, 2), tabToMidi(T(3, true, 1), C), C)?.kind).toBe("bendShallow");
    expect(classify(T(3, true, 1), tabToMidi(T(3, true), C), C)?.kind).toBe("bendShallow");
    expect(classify(T(2, true), tabToMidi(T(2, true, 1), C), C)?.kind).toBe("flat");
  });

  it("2↓ e 3↑ sono la stessa nota: suonare 3↑ al posto di 3↓ è un respiro invertito", () => {
    expect(classify(T(3, true), tabToMidi(T(2, true), C), C)?.kind).toBe("direction");
  });
});

describe("statistiche dalla battaglia", () => {
  it("un giocatore perfetto non ha punti deboli", () => {
    const data = emptyStats();
    for (const e of AREAS[0].enemies) play(data, e.id, () => undefined);
    expect(data.totals.notes).toBeGreaterThan(20);
    expect(data.totals.hits).toBe(data.totals.notes);
    expect(weaknesses(data)).toEqual([]);
    expect(data.days[today()].battles).toBe(AREAS[0].enemies.length);
  });

  it("chi suona sempre 4↑ al posto di 4↓ vede proprio quel punto debole, con la lezione e l'allenamento giusti", () => {
    const data = emptyStats();
    const confuse = (t: Tab) => (t.hole === 4 && t.draw && !t.bend ? T(4, false) : undefined);
    for (const id of ["draft", "sigh", "bellows", "ticket-clerk", "porter"]) play(data, id, confuse);
    expect(data.confusions["4d0"]?.["4b0"]).toBeGreaterThan(3);
    const w = weaknesses(data);
    expect(w.length).toBeGreaterThan(0);
    const top = w[0];
    expect(["note:4d0", "error:direction"]).toContain(top.id);
    expect(top.detail.it).toMatch(/4/);
    expect(top.lesson).toEqual({ areaId: "station", lessonId: "scale" });
    // il 4 soffiato invece è sano
    expect(data.notes["4b0"]?.ema ?? 0).toBeLessThan(0.2);
  });

  it("le note mai suonate diventano «silent», non confusioni", () => {
    const data = emptyStats();
    play(data, "draft", (t) => (t.hole === 4 ? null : undefined));
    expect(data.errors.silent?.ema).toBeGreaterThan(0);
    expect(Object.keys(data.confusions)).toHaveLength(0);
  });

  it("il riepilogo di fine battaglia indica la nota più sbagliata", () => {
    const data = emptyStats();
    const { rec } = play(data, "sigh", (t) => (t.hole === 4 && t.draw ? T(5, true) : undefined));
    const hint = sessionHint(rec);
    expect(hint?.tab).toEqual(T(4, true));
    expect(hint?.title.it).toContain("5↓");
  });
});

describe("giorni di fila", () => {
  it("conta i giorni consecutivi fino a oggi o ieri", () => {
    const data = emptyStats();
    const now = new Date(2026, 9, 3, 12);
    const day = (offset: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      data.days[today(d)] = { seconds: 60, notes: 10, hits: 8, battles: 1, wins: 1 };
    };
    expect(dayStreak(data, now)).toBe(0);
    [1, 2, 3, 5].forEach(day);
    expect(dayStreak(data, now)).toBe(3);
    day(0);
    expect(dayStreak(data, now)).toBe(4);
  });
});

describe("allenamento mirato", () => {
  it("costruisce una battaglia giocabile per ogni tipo di punto debole, e chi suona bene la vince", () => {
    const data = emptyStats();
    const kinds = [
      noteWeakness(data, T(4, true)),
      noteWeakness(data, T(3, true, 1)),
      noteWeakness(data, T(3, true, 2)),
      noteWeakness(data, T(9, false, 1)),
      { ...noteWeakness(data, T(4, true)), drill: { type: "direction" as const, hole: 1 } },
      { ...noteWeakness(data, T(4, true)), drill: { type: "neighbor" as const, hole: 10 } },
      { ...noteWeakness(data, T(4, true)), drill: { type: "hold" as const } },
      { ...noteWeakness(data, T(4, true)), drill: { type: "timing" as const, late: true } },
      { ...noteWeakness(data, T(4, true)), drill: { type: "chord" as const } },
    ];
    for (const w of kinds) {
      const def = makeDrill(w);
      expect(def.phases[0].phrases.length, JSON.stringify(w.drill)).toBeGreaterThan(3);
      for (const ph of def.phases[0].phrases) for (const seg of ph) expect(seg.beats % 4).toBe(0);
      const { b } = play(emptyStats(), def.id, () => undefined);
      expect(b.phase, JSON.stringify(w.drill)).toBe("won");
      // un allenamento è breve: pochi round
      expect(b.stats.rounds).toBeLessThanOrEqual(6);
    }
  });

  it("l'allenamento sulla nota la mette al centro delle frasi", () => {
    const def = makeDrill(noteWeakness(emptyStats(), T(6, true)));
    const notes = def.phases[0].phrases.flat().flatMap((p) => p.notes);
    const focus = notes.filter((n) => n.tab.hole === 6 && n.tab.draw).length;
    expect(focus / notes.length).toBeGreaterThan(0.45);
  });
});
