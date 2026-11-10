import { describe, expect, it } from "vitest";
import { generaDemo } from "../src/modi/brano/demo";
import { tracciaAltezze, estraiNote, dividiFrasi, indovinaTonalita, GiudiceFrase, SR_ANALISI } from "../src/modi/brano/analisi";

describe("Impara un brano", () => {
  const demo = generaDemo(SR_ANALISI);
  it("ritrova le note dell'armonica nel missaggio del brano di prova", async () => {
    const tr = await tracciaAltezze(demo.campioni);
    const note = estraiNote(tr, "C");
    const trovate = demo.verita.filter((v) => note.some((n) => n.midi === v.midi && Math.abs(n.t - v.t) < 0.12));
    console.log(note.length, demo.verita.length, trovate.length);
    expect(trovate.length / demo.verita.length).toBeGreaterThan(0.9);
    expect(note.length).toBeLessThan(demo.verita.length * 1.3);
    const frasi = dividiFrasi(note);
    console.log(frasi.map((f) => [f.inizio.toFixed(2), f.fine.toFixed(2), f.a - f.da + 1]));
    expect(frasi.length).toBe(6);
    expect(indovinaTonalita(tr)[0]).toBe("C");
  });
  it("giudica una frase: note giuste in tempo, note sbagliate no", () => {
    const note = [60, 62, 64].map((midi, i) => ({ t: i, durata: 0.5, midi, tab: { hole: 4, draw: false, bend: 0 }, conta: true }));
    const g = new GiudiceFrase(note, 0.3);
    expect(g.attacco(0.1, 60)).toBe(0);
    expect(g.attacco(1.6, 62)).toBe(-1);
    expect(g.attacco(2.05, 63)).toBe(-1);
    g.aggiorna(5);
    expect(g.precisione).toBeCloseTo(1 / 3);
    expect(g.stelleAl(0)).toBe(0);
  });
});
