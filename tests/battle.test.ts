import { describe, it, expect } from "vitest";
import { Battle } from "../src/battle/logic";
import { AREA1, AREAS, enemyById, parseTab, segment } from "../src/content/areas";
import { keyById } from "../src/harp";

const seeded = () => {
  let s = 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/** Simula una battaglia a 60 frame al secondo. Il giocatore perfetto suona tutto a tempo e tiene le note lunghe. */
function simulate(perfect: boolean, enemyId: string, maxSeconds = 1200) {
  const b = new Battle(enemyById(enemyId), keyById("C"), { rng: seeded() });
  b.startRound(0);
  for (let now = 0; now < maxSeconds; now += 1 / 60) {
    let held: number | null = null;
    if (perfect) {
      const r = b.round;
      if (b.phase === "response") {
        for (const n of r.response) {
          if (!n.hit && Math.abs(now - n.time) < 1 / 120) b.onset(n.midi, now);
          if (now >= n.time && now < n.time + n.dur * 0.9) held = n.midi;
        }
      }
      for (const p of r.volley) if (Math.abs(now - p.time) < 0.1) held = p.midi;
    }
    b.update(now, held);
    b.drain();
    if (b.phase === "won" || b.phase === "lost") break;
  }
  return b;
}

describe("contenuti dell'area 1", () => {
  it("carica tre nemici e il boss dal percorso didattico", () => {
    expect(AREA1.enemies.map((e) => e.id)).toEqual(["draft", "sigh", "bellows", "silence"]);
    expect(enemyById("silence").phases).toHaveLength(3);
  });

  it("divide le frasi lunghe in pezzi di due battute", () => {
    const raw = {
      id: "x",
      tab: "",
      beatsPerBar: 4,
      lengthBeats: 32,
      events: Array.from({ length: 32 }, (_, i) => ({ type: "note", start: i, dur: 1, notes: [{ hole: 4, dir: "blow" as const, bend: 0 }] })),
    };
    const parts = segment(raw);
    expect(parts).toHaveLength(4);
    expect(parts.every((p) => p.beats === 8 && p.notes.length === 8 && p.notes[0].start === 0)).toBe(true);
  });
});

describe("battaglia", () => {
  it("il giocatore perfetto batte ogni nemico, boss compreso, senza subire danni", () => {
    for (const e of AREA1.enemies) {
      const b = simulate(true, e.id);
      expect(b.phase, e.id).toBe("won");
      expect(b.playerHp, e.id).toBe(100);
    }
  });

  it("il boss passa per tutte le sue fasi", () => {
    const b = simulate(true, "silence");
    expect(b.bossPhase).toBe(2);
  });

  it("chi non suona perde e il gioco rallenta per aiutarlo", () => {
    const b = simulate(false, "draft");
    expect(b.phase).toBe("lost");
    expect(b.bpm).toBeLessThan(enemyById("draft").phases[0].bpm[0]);
  });

  it("le note sbagliate non fanno avanzare la frase", () => {
    const b = new Battle(enemyById("bellows"), keyById("C"), { rng: seeded() });
    const r = b.startRound(0);
    b.update(r.callEnd, null);
    expect(b.phase).toBe("response");
    b.onset(r.response[0].midi + 1, r.callEnd);
    expect(r.response[0].hit).toBeUndefined();
    b.onset(r.response[0].midi, r.callEnd + 0.1);
    expect(r.response[0].hit).toBe(true);
  });

  it("i suoni durante l'ascolto non contano come risposta", () => {
    const b = new Battle(enemyById("draft"), keyById("C"), { rng: seeded() });
    const r = b.startRound(0);
    b.update(r.call[0].time, null);
    expect(b.phase).toBe("call");
    b.onset(r.call[0].midi, r.call[0].time);
    expect(r.response[0].hit).toBeUndefined();
  });

  it("una nota lunga lasciata subito vale metà", () => {
    const b = new Battle(enemyById("draft"), keyById("C"), { rng: seeded() });
    // si cerca un round che cominci con una nota lunga (almeno due battiti)
    let r = b.startRound(0);
    while (r.response[0].dur < 2 * r.beat - 1e-6) r = b.startRound(r.end);
    b.update(r.callEnd, null);
    const n = r.response[0];
    b.onset(n.midi, n.time);
    b.update(n.time + 0.05, n.midi);
    b.update(n.time + 0.2, null);
    expect(n.short).toBe(true);
  });

  it("il Silenzio recupera vita se smetti di suonare", () => {
    const b = new Battle(enemyById("silence"), keyById("C"), { rng: seeded() });
    b.enemyHp = 100;
    const r = b.startRound(0);
    for (let now = r.callEnd; now < r.callEnd + 4 * r.beat; now += 1 / 60) b.update(now, null);
    expect(b.enemyHp).toBeGreaterThan(100);
  });

  it("i round si allineano alla battuta della base", () => {
    const b = new Battle(enemyById("draft"), keyById("C"), { align: (t) => Math.ceil(t / 2) * 2 });
    expect(b.startRound(0.3).countIn[0]).toBe(2);
  });
});

describe("tutte le tappe", () => {
  it("carica il viaggio completo dal percorso, con grafica e lezioni", () => {
    expect(AREAS.map((a) => a.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const a of AREAS.filter((x) => !x.comingSoon)) {
      expect(a.backdrop, a.id).not.toBeNull();
      expect(a.lessons.length, a.id).toBeGreaterThan(0);
    }
  });

  it("il giocatore perfetto batte ogni nemico giocabile di ogni tappa", () => {
    const playable = AREAS.flatMap((a) => a.enemies).filter((e) => !e.comingSoon);
    expect(playable.length).toBeGreaterThan(25);
    for (const e of playable) {
      const b = simulate(true, e.id);
      expect(b.phase, e.id).toBe("won");
    }
  });

  it("le frasi partono dal livello facile e salgono", () => {
    for (const e of AREAS.flatMap((a) => a.enemies).filter((x) => !x.comingSoon))
      for (const ph of e.phases)
        expect(
          [...ph.tiers].sort((a, b) => a - b),
          e.id,
        ).toEqual(ph.tiers);
  });

  it("un accordo vale con una qualunque delle sue note", () => {
    const e = AREAS.flatMap((a) => a.enemies).find((x) => !x.comingSoon && x.phases[0].phrases.some((p) => p.some((s) => s.notes[0].kind === "chord")))!;
    const b = new Battle(e, keyById("C"), { rng: seeded() });
    let r = b.startRound(0);
    while (r.response[0].source.kind !== "chord") r = b.startRound(r.end);
    b.update(r.callEnd, null);
    const n = r.response[0];
    expect(n.accept.length).toBeGreaterThan(1);
    b.onset(n.accept[n.accept.length - 1], n.time);
    expect(n.hit).toBe(true);
  });

  it("i bend e gli overblow hanno l'altezza giusta in ogni tonalità", () => {
    const notes = AREAS.flatMap((a) => a.enemies.flatMap((e) => e.phases.flatMap((p) => p.phrases.flat().flatMap((s) => s.notes))));
    const bend = notes.find((n) => n.tab.hole === 4 && n.tab.draw && n.tab.bend === 1)!;
    expect(bend.semitones[0]).toBe(13); // 4↓' = Do# su armonica in Do
    const ob = notes.find((n) => n.technique === "overblow" && n.tab.hole === 6);
    if (ob) expect(ob.semitones[0]).toBe(22); // 6 overblow = Si bemolle
  });
});

describe("frame persi", () => {
  it("la parata vale anche se l'aggiornamento arriva dopo la finestra, con la nota tenuta", () => {
    const b = new Battle(enemyById("draft"), keyById("C"), { rng: seeded() });
    const r = b.startRound(0);
    b.update(r.callEnd, null);
    b.update(r.responseEnd + 0.01, null); // risposta mancata: si passa alla raffica
    const p = r.volley[0];
    b.update(p.time - b.parryWindow - 0.05, p.midi); // tenuta appena prima della finestra...
    b.update(p.time + b.parryWindow + 0.3, p.midi); // ...e il frame dopo arriva in ritardo
    expect(p.state).toBe("parried");
  });
});

describe("club di Chicago", () => {
  it("nella jam vale qualunque nota permessa, purché a tempo", () => {
    const drummer = enemyById("drummer");
    expect(drummer.jam?.allowed.length).toBe(3);
    const b = new Battle(drummer, keyById("C"), { rng: () => 0 });
    const r = b.startRound(0);
    for (const n of r.response) {
      expect(n.source.free).toBe(true);
      expect(n.accept).toHaveLength(3);
    }
  });
  it("il bassista chiede le note dell'accordo, esattamente", () => {
    const bass = enemyById("bassist");
    expect(bass.jam).toBeUndefined();
    const notes = bass.phases[0].phrases.flat().flatMap((p) => p.notes);
    expect(new Set(notes.map((n) => `${n.tab.hole}${n.tab.draw}`))).toEqual(new Set(["2true", "4false", "4true"]));
  });
  it("parseTab legge bend e direzione", () => {
    expect(parseTab("3↓''")).toEqual({ hole: 3, draw: true, bend: 2 });
    expect(parseTab("6↑")).toEqual({ hole: 6, draw: false, bend: 0 });
  });
});
