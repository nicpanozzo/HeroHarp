// I brani irlandesi della Strada dei Riff: il lettore ABC e le partiture trasformate in intavolatura.
import { describe, expect, it } from "vitest";
import { armatura, leggiAbc, inIntavolatura } from "../src/modi/riff/abc";
import { BRANI } from "../src/modi/riff/irlanda";
import { RIFF_IRLANDA, TUTTI_I_RIFF } from "../src/modi/riff/riff";
import { leggiForo } from "../src/modi/core/armonica";
import { arrangia, PRESET } from "../src/style/basi";

describe("lettore ABC", () => {
  it("conosce tonalità e modi", () => {
    expect(armatura("G")).toMatchObject({ F: 1, C: 0 });
    expect(armatura("Edor")).toMatchObject({ F: 1, C: 1, G: 0 });
    expect(armatura("Amix")).toMatchObject({ F: 1, C: 1, G: 0 });
    expect(armatura("Em")).toMatchObject({ F: 1, C: 0 });
    expect(armatura("D")).toMatchObject({ F: 1, C: 1 });
  });

  it("legge altezze, ottave, alterazioni e durate", () => {
    const n = leggiAbc("C c c' C, ^F F | F2 G/2 z A", { tonalita: "C", unita: "1/4", battito: "1/4" });
    expect(n.map((x) => x.midi)).toEqual([60, 72, 84, 48, 66, 66, 65, 67, 69]);
    expect(n.map((x) => x.durata)).toEqual([1, 1, 1, 1, 1, 1, 2, 0.5, 1]);
    expect(n[8].inizio).toBe(9.5);
  });

  it("ritmo puntato, terzine e legature", () => {
    const p = leggiAbc("A>B c<d", { tonalita: "C", unita: "1/8", battito: "1/4" });
    expect(p.map((x) => x.durata)).toEqual([0.75, 0.25, 0.25, 0.75]);
    const t = leggiAbc("(3ABc d", { tonalita: "C", unita: "1/8", battito: "1/4" });
    expect(t.map((x) => x.inizio)).toEqual([0, 0.333, 0.667, 1]);
    const l = leggiAbc("A2-A B", { tonalita: "C", unita: "1/8", battito: "1/4" });
    expect(l).toEqual([
      { midi: 69, inizio: 0, durata: 1.5 },
      { midi: 71, inizio: 1.5, durata: 0.5 },
    ]);
  });

  it("nelle gighe tre crome fanno un battito", () => {
    const g = leggiAbc("GAB c3", { tonalita: "G", unita: "1/8", battito: "3/8" });
    expect(g.map((x) => x.inizio)).toEqual([0, 0.333, 0.667, 1]);
    expect(g[3].durata).toBe(1);
  });

  it("sceglie il foro più vicino tra 2 aspirato e 3 soffiato", () => {
    const fori = inIntavolatura(leggiAbc("c G c", { tonalita: "C", unita: "1/4", battito: "1/4" }));
    expect(fori.map((f) => f.foro)).toEqual(["4↑", "3↑", "4↑"]);
  });
});

describe("brani irlandesi", () => {
  it("sono otto, dal più facile al più difficile, e tutti nella strada", () => {
    expect(RIFF_IRLANDA).toHaveLength(8);
    expect(BRANI.map((b) => b.livello)).toEqual([...BRANI.map((b) => b.livello)].sort());
    for (const r of RIFF_IRLANDA) expect(TUTTI_I_RIFF).toContain(r);
  });

  for (const r of RIFF_IRLANDA) {
    it(`${r.nome.en}: senza bend, battute intere, note in ordine`, () => {
      expect(r.note.length).toBeGreaterThan(30);
      for (const n of r.note) expect(leggiForo(n.foro).bend).toBe(0);
      expect(r.battiti % 4).toBe(0);
      const fine = r.note[r.note.length - 1];
      expect(fine.inizio + fine.durata).toBeCloseTo(r.battiti, 2);
      for (let i = 1; i < r.note.length; i++) expect(r.note[i].inizio).toBeGreaterThanOrEqual(r.note[i - 1].inizio + r.note[i - 1].durata - 0.002);
      // partite brevi: meno di un minuto a tempo pieno
      expect((r.battiti * 60) / r.bpm).toBeLessThan(60);
    });
  }

  it("la Kesh comincia come nella fonte (Sol → Do: 4↑ 4↑ 4↓ 5↑)", () => {
    const k = RIFF_IRLANDA.find((r) => r.id === "irlanda-kesh")!;
    expect(k.note.slice(0, 4).map((n) => n.foro)).toEqual(["4↑", "4↑", "4↓", "5↑"]);
    expect(k.note[0].durata).toBe(1);
  });
});

describe("band irlandese", () => {
  const momento = (croma: number, battuta = 0) => ({
    band: ["bodhran", "bordone"] as const,
    stile: PRESET.portico.stili[0],
    forma: "vamp" as const,
    minore: false,
    battuta,
    croma,
    tonica: 40,
    durataCroma: 0.5,
  });
  it("il bodhrán batte ogni croma, il bordone tiene tonica e quinta sull'uno", () => {
    const uno = arrangia(momento(0));
    expect(uno.find((c) => c.voce === "bodhran")).toBeTruthy();
    expect(uno.filter((c) => c.voce === "bordone").map((c) => c.midi)).toEqual([52, 59]);
    expect(arrangia(momento(1)).map((c) => c.voce)).toEqual(["bacchetta"]);
    expect(arrangia(momento(2)).map((c) => c.voce)).toEqual(["bodhran"]);
  });
});
