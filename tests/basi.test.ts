import { describe, expect, it } from "vitest";
import { PRESET, arrangia, grado, periodo, type Area, type Colpo, type Stile } from "../src/style/basi";

const AREE = Object.keys(PRESET) as Area[];

/** Tutto quello che suona un luogo con un arrangiamento, battuta per battuta, per `battute` battute. */
function suona(area: Area, stile: Stile, battute: number): Colpo[][] {
  const p = PRESET[area];
  const out: Colpo[][] = [];
  for (let b = 0; b < battute; b++) {
    const bar: Colpo[] = [];
    for (let e = 0; e < 8; e++)
      bar.push(
        ...arrangia({ band: p.band, stile, forma: p.forma, minore: !!p.minore, battuta: b, croma: e, tonica: 43, durataCroma: 0.5 }).map(
          (c) => ({ ...c, e }) as Colpo,
        ),
      );
    out.push(bar);
  }
  return out;
}
const firma = (x: unknown) => JSON.stringify(x);

describe("basi: ogni luogo e ogni livello hanno il loro giro", () => {
  it("ogni luogo ha cinque arrangiamenti, tutti diversi tra loro", () => {
    for (const a of AREE) {
      const stili = PRESET[a].stili;
      expect(stili.length, a).toBe(5);
      const suoni = stili.map((s) => firma(suona(a, s, periodo(PRESET[a].forma) * 4)));
      expect(new Set(suoni).size, a).toBe(5);
    }
  });

  it("l'arrangiamento dei menu e delle modalità non cambia gli accordi e non si ferma", () => {
    for (const a of AREE) {
      const s = PRESET[a].stili[0];
      expect(s.cambioVeloce, a).toBeFalsy();
      expect(s.stopTime, a).toBeFalsy();
    }
  });

  it("il quick change porta la seconda battuta sul IV solo nel blues di 12", () => {
    expect(grado("blues12", 1)).toBe(0);
    expect(grado("blues12", 1, true)).toBe(5);
    expect(grado("blues12", 13, true)).toBe(5);
    expect(grado("quattro", 1, true)).toBe(0);
    expect(grado("vamp", 7, true)).toBe(0);
  });

  it("la strofa B suona diversa dalla A, e ogni giro chiude con un fill", () => {
    for (const a of AREE) {
      const per = periodo(PRESET[a].forma);
      const giri = suona(a, PRESET[a].stili[0], per * 2);
      expect(firma(giri.slice(0, per)), a).not.toBe(firma(giri.slice(per)));
      // fill: nell'ultima battuta del giro il ritmo pesta di più nella seconda metà
      const fine = giri[per - 1].filter((c: any) => c.e >= 4 && ["cassa", "rullante", "spazzola", "tom"].includes(c.voce)).reduce((s, c) => s + c.v, 0);
      const meta = giri[1].filter((c: any) => c.e >= 4 && ["cassa", "rullante", "spazzola", "tom"].includes(c.voce)).reduce((s, c) => s + c.v, 0);
      expect(fine, a).toBeGreaterThan(meta);
    }
  });

  it("nello stop-time la band colpisce sull'uno e lascia spazio", () => {
    const stile = PRESET.chicago.stili[2];
    expect(stile.stopTime).toBe(true);
    const giri = suona("chicago", stile, 36);
    for (let b = 24; b < 28; b++) {
      const intonati = giri[b].filter((c: any) => c.midi !== undefined);
      expect(intonati.length).toBeGreaterThan(0);
      expect(intonati.every((c: any) => c.e === 0)).toBe(true);
    }
    // finito lo stop, il basso riparte a camminare
    expect(giri[28].filter((c) => c.voce === "basso").length).toBeGreaterThan(1);
  });

  it("il basso resta nel registro grave e segue la tonica dell'accordo sull'uno", () => {
    for (const a of AREE) {
      if (!PRESET[a].band.includes("basso")) continue;
      for (const s of PRESET[a].stili) {
        const giri = suona(a, s, 48);
        giri.forEach((bar, b) => {
          for (const c of bar.filter((c) => c.voce === "basso")) {
            expect(c.midi!, `${a} ${s.nome.it}`).toBeGreaterThanOrEqual(28);
            expect(c.midi!, `${a} ${s.nome.it}`).toBeLessThanOrEqual(43 + 7 + 12 + 1);
          }
          const uno = bar.find((c: any) => c.voce === "basso" && c.e === 0);
          const nuovo = b === 0 || grado(PRESET[a].forma, b - 1, s.cambioVeloce) !== grado(PRESET[a].forma, b, s.cambioVeloce);
          if (uno && nuovo) expect((uno.midi! - 43 - grado(PRESET[a].forma, b, s.cambioVeloce) + 120) % 12, `${a} ${s.nome.it} battuta ${b}`).toBe(0);
        });
      }
    }
  });

  it("in minore niente terze maggiori sugli accordi di I e IV", () => {
    const giri = suona("fiume", PRESET.fiume.stili[0], 24);
    giri.forEach((bar, b) => {
      const g = grado("blues12", b);
      if (g === 7) return;
      for (const c of bar.filter((c) => c.midi !== undefined && c.voce !== "basso")) expect((c.midi! - 43 - g + 120) % 12).not.toBe(4);
    });
  });
});
