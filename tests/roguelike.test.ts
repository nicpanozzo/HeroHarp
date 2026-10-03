import { describe, expect, it } from "vitest";
import { JOURNEY } from "../src/content/areas";
import {
  COLS,
  actsFrom,
  addOffer,
  bandInstruments,
  buildMap,
  complete,
  mods,
  newRun,
  reachable,
  rewardOffers,
  roads,
  rngFrom,
  runEnemy,
  shopItems,
  tally,
  weakest,
} from "../src/roguelike/run";
import { EVENTS } from "../src/roguelike/data";

const road = { kind: "yourStop" as const, areaId: "porch", coinBonus: 1 };

describe("La Lunga Notte", () => {
  it("una notte attraversa tre tappe consecutive del percorso", () => {
    expect(actsFrom("porch")).toEqual(["porch", "station", "freight-train"]);
    // in fondo al viaggio si arretra per avere sempre tre atti
    const last = JOURNEY.filter((a) => !a.comingSoon).pop()!.id;
    expect(actsFrom(last)).toHaveLength(3);
    expect(actsFrom(last)[2]).toBe(last);
  });

  it("all'inizio del viaggio non propone un ripasso uguale alla tua tappa", () => {
    const r = roads("porch");
    expect(r.map((x) => x.kind)).toEqual(["yourStop", "challenge"]);
    expect(r[1].areaId).toBe("station");
    expect(roads("juke-joint").map((x) => x.areaId)).toEqual(["station", "juke-joint", "beale-street"]);
  });

  it("ogni mappa è percorribile dalla partenza al boss, con negozio e riposo", () => {
    for (let seed = 1; seed < 60; seed++) {
      for (const area of JOURNEY.filter((a) => !a.comingSoon)) {
        const map = buildMap(area, rngFrom({ rngState: seed }), 0);
        const boss = map.filter((n) => n.kind === "boss");
        expect(boss).toHaveLength(1);
        expect(boss[0].col).toBe(COLS - 1);
        for (const n of map) {
          if (n.col < COLS - 1) expect(n.next.length).toBeGreaterThan(0);
          if (n.col > 0) expect(map.some((m) => m.next.includes(n.id))).toBe(true);
          if (n.kind === "fight" || n.kind === "elite" || n.kind === "boss") expect(area.enemies.some((e) => e.id === n.enemyId)).toBe(true);
        }
        expect(map.filter((n) => n.col === 0).every((n) => n.kind === "fight")).toBe(true);
        expect(map.some((n) => n.kind === "shop")).toBe(true);
        expect(map.some((n) => n.col === COLS - 2 && n.kind === "rest")).toBe(true);
      }
    }
  });

  it("battuto il boss si passa all'atto dopo, e al terzo arriva l'alba", () => {
    const run = newRun(road, 7);
    for (let act = 0; act < 3; act++) {
      expect(run.act).toBe(act);
      let result: string = "";
      while (!run.over && run.act === act) result = complete(run, reachable(run)[0].id);
      if (act < 2) expect(result).toBe("act");
      else expect(result).toBe("dawn");
    }
    expect(run.over).toBe("won");
    expect(reachable(run)).toEqual([]);
  });

  it("la band suona nella base e aiuta in battaglia", () => {
    const run = newRun(road, 3);
    expect(bandInstruments(run)).toEqual(["piede"]);
    addOffer(run, { type: "musician", id: "earl" });
    addOffer(run, { type: "musician", id: "june" });
    expect(bandInstruments(run)).toEqual(["piede", "basso", "elettrica"]);
    const m = mods(run);
    expect(m.parry).toBeCloseTo(1.3 * 1.1);
    expect(m.volleyMinus).toBe(1);
  });

  it("le ance nuove alzano la vita massima, l'ancia del crocevia la abbassa", () => {
    const run = newRun(road, 3);
    run.hp = 50;
    addOffer(run, { type: "gear", id: "ancia" });
    expect(run.maxHp).toBe(120);
    expect(run.hp).toBe(70);
    addOffer(run, { type: "gear", id: "diavolo" });
    expect(run.maxHp).toBe(100);
    expect(mods(run).dmg).toBeCloseTo(1.4);
  });

  it("le ricompense non ripropongono quello che hai già, e il primo duello porta un musicista", () => {
    const run = newRun(road, 11);
    const first = rewardOffers(run, "fight");
    expect(first.some((o) => o.type === "musician")).toBe(true);
    expect(first[first.length - 1].type).toBe("heal");
    run.band = ["sam", "earl", "ruby", "tito", "june"];
    run.gear = ["bullet", "custodia"];
    for (let i = 0; i < 20; i++) {
      for (const o of rewardOffers(run, "elite")) {
        expect(o.type === "musician").toBe(false);
        if (o.type === "gear") expect(["bullet", "custodia", "diavolo"]).not.toContain(o.id);
      }
      for (const it of shopItems(run)) if (it.offer.type === "gear") expect(it.offer.id).not.toBe("diavolo");
    }
  });

  it("i nemici dei duelli duri sono più robusti e il tempo segue la run", () => {
    const base = JOURNEY[0].enemies[0];
    const e = runEnemy(base, "elite", -8);
    expect(e.hp).toBeGreaterThan(base.hp);
    expect(e.phases[0].bpm[0]).toBe(Math.max(50, base.phases[0].bpm[0] - 8));
  });

  it("gli eventi cambiano la run come promettono", () => {
    const run = newRun(road, 5);
    const ev = EVENTS.find((e) => e.id === "jukebox")!;
    const r = { ...run, rng: rngFrom(run) };
    ev.choices[1].apply(r);
    expect(r.groove).toBe("dritto");
    const jam = EVENTS.find((e) => e.id === "backroom")!;
    jam.choices[0].apply(r);
    expect(r.band).toHaveLength(1);
    expect(r.hp).toBe(85);
  });

  it("la pagella mette in cima i fori sbagliati più spesso", () => {
    const run = newRun(road, 5);
    for (let i = 0; i < 4; i++) tally(run, "4↓", false);
    tally(run, "4↓", true);
    tally(run, "3↓'", false);
    tally(run, "3↓'", false);
    for (let i = 0; i < 8; i++) tally(run, "3↓'", true);
    tally(run, "6↑", false);
    expect(weakest(run).map((w) => w.label)).toEqual(["4↓", "3↓'"]);
  });
});
