import { describe, expect, it } from "vitest";
import { Battle } from "../src/battle/logic";
import { AREAS, type EnemyDef } from "../src/content/areas";
import { keyById } from "../src/harp";

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function sim(e: EnemyDef, hitP: number, parryP: number, seed = 1) {
  const r0 = rng(seed),
    roll = rng(seed + 7);
  const b = new Battle(e, keyById("C"), { rng: r0 });
  b.startRound(0);
  const decided = new Map<any, boolean>();
  const will = (o: any, p: number) => {
    if (!decided.has(o)) decided.set(o, roll() < p);
    return decided.get(o);
  };
  let now = 0;
  for (; now < 1500; now += 1 / 60) {
    let held: number | null = null;
    const r = b.round;
    if (b.phase === "response")
      for (const n of r.response) {
        if (!will(n, hitP)) continue;
        if (!n.hit && Math.abs(now - n.time) < 1 / 120) b.onset(n.midi, now);
        if (now >= n.time && now < n.time + n.dur * 0.9) held = n.midi;
      }
    for (const p of r.volley) if (will(p, parryP) && Math.abs(now - p.time) < 0.1) held = p.midi;
    b.update(now, held);
    b.drain();
    if (b.phase === "won" || b.phase === "lost") break;
  }
  return { won: b.phase === "won", t: Math.round(now), rounds: b.stats.rounds, hp: b.playerHp };
}
// Bilanciamento: un giocatore "bravo ma non perfetto" (80% delle note, 70% delle parate)
// deve poter battere ogni nemico, boss compresi, almeno due volte su tre.
describe("bilanciamento", () => {
  it("un giocatore bravo ma non perfetto batte ogni nemico", () => {
    for (const e of AREAS.flatMap((a) => a.enemies).filter((x) => !x.comingSoon)) {
      const wins = [1, 2, 3].filter((seed) => sim(e, 0.8, 0.7, seed).won).length;
      expect(wins, e.id).toBeGreaterThanOrEqual(2);
    }
  }, 300_000);
});
