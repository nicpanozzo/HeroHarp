import { describe, it, expect } from "vitest";
import { Battle } from "../src/battle/logic";
import { AREA1 } from "../src/content/enemies";
import { keyById } from "../src/harp";

const seeded = () => {
  let s = 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

/** Simula una battaglia a 60 frame al secondo. Il giocatore perfetto suona tutto a tempo. */
function simulate(perfect: boolean, enemyIndex = 0, maxSeconds = 600) {
  const b = new Battle(AREA1[enemyIndex], keyById("C"), seeded());
  b.startRound(0);
  let held: number | null = null;
  for (let now = 0; now < maxSeconds; now += 1 / 60) {
    if (perfect) {
      const r = b.round;
      held = null;
      if (b.phase === "response") {
        for (const n of r.response) if (!n.hit && Math.abs(now - n.time) < 1 / 120) b.onset(n.midi, now);
      }
      for (const p of r.volley) if (Math.abs(now - p.time) < 0.1) held = p.midi;
    }
    b.update(now, held);
    b.drain();
    if (b.phase === "won" || b.phase === "lost") break;
  }
  return b;
}

describe("battaglia", () => {
  it("il giocatore perfetto vince contro ogni nemico senza subire danni", () => {
    for (let i = 0; i < AREA1.length; i++) {
      const b = simulate(true, i);
      expect(b.phase).toBe("won");
      expect(b.playerHp).toBe(100);
    }
  });

  it("chi non suona perde e il gioco rallenta per aiutarlo", () => {
    const b = simulate(false);
    expect(b.phase).toBe("lost");
    expect(b.tempo).toBeLessThan(1);
    expect(b.level).toBe(0);
  });

  it("le note sbagliate non fanno avanzare la frase", () => {
    const b = new Battle(AREA1[0], keyById("C"), seeded());
    const r = b.startRound(0);
    b.update(r.callEnd, null);
    expect(b.phase).toBe("response");
    b.onset(r.response[0].midi + 1, r.callEnd);
    expect(r.response[0].hit).toBeUndefined();
    b.onset(r.response[0].midi, r.callEnd + 0.1);
    expect(r.response[0].hit).toBe(true);
  });

  it("i suoni durante l'ascolto non contano come risposta", () => {
    const b = new Battle(AREA1[0], keyById("C"), seeded());
    const r = b.startRound(0);
    b.update(r.call[0].time, null);
    expect(b.phase).toBe("call");
    b.onset(r.call[0].midi, r.call[0].time);
    expect(r.response[0].hit).toBeUndefined();
  });
});
