// Allenamento mirato: una battaglia breve costruita sul tuo punto debole.
// Le frasi ripetono la nota (o la tecnica) da allenare contro quella con cui la confondi,
// partendo lente e facili: la difficoltà adattiva della battaglia sale da sola se vanno bene.

import { areaById, registerEnemy, type EnemyDef, type Phrase, type PhraseNote } from "../content/areas";
import { BLOW, DRAW, maxBend, type Tab } from "../harp";
import type { DrillFocus, Weakness } from "./stats";

export const DRILL_ID = "drill";

const semi = (t: Tab) => (t.draw ? DRAW[t.hole - 1] : BLOW[t.hole - 1]) - t.bend;
const n = (tab: Tab, start: number, dur: number): PhraseNote => ({ tab, semitones: [semi(tab)], holes: [tab.hole], kind: "note", start, dur });
const tab = (hole: number, draw: boolean, bend = 0): Tab => ({ hole, draw, bend });
const clampHole = (h: number) => Math.max(1, Math.min(10, h));

/** Note e durate in battiti, in fila: [nota, durata]. */
type Line = [Tab, number][];
const phrase = (id: string, line: Line): Phrase[] => {
  let at = 0;
  const notes = line.map(([t, d]) => {
    const out = n(t, at, d);
    at += d;
    return out;
  });
  return [{ id, beats: Math.ceil(at / 4) * 4, notes }];
};

/** Tre frasi facili, due medie, una difficile su X (la nota da allenare), Y (la sua rivale) e Z (una vicina). */
function contrast(x: Tab, y: Tab, z: Tab): { lines: Line[]; tiers: number[] } {
  return {
    lines: [
      [
        [x, 2],
        [x, 2],
        [y, 2],
        [x, 2],
      ],
      [
        [x, 1],
        [x, 1],
        [x, 2],
        [y, 1],
        [y, 1],
        [x, 2],
      ],
      [
        [y, 2],
        [x, 2],
        [z, 2],
        [x, 2],
      ],
      [
        [x, 1],
        [y, 1],
        [x, 1],
        [y, 1],
        [x, 4],
      ],
      [
        [z, 1],
        [x, 1],
        [y, 1],
        [x, 1],
        [x, 2],
        [x, 2],
      ],
      [
        [x, 0.5],
        [x, 0.5],
        [y, 1],
        [x, 1],
        [z, 1],
        [y, 1],
        [x, 1],
        [x, 2],
      ],
    ],
    tiers: [0, 0, 0, 1, 1, 2],
  };
}

/** Una vicina della nota sulla stessa direzione, o il respiro opposto se è l'unica. */
function neighborOf(t: Tab, avoid?: Tab): Tab {
  const opts = [tab(clampHole(t.hole + 1), t.draw), tab(clampHole(t.hole - 1), t.draw), tab(t.hole, !t.draw)];
  return opts.find((o) => (o.hole !== t.hole || o.draw !== t.draw) && !same(o, avoid)) ?? opts[2];
}
const same = (a: Tab, b?: Tab) => !!b && a.hole === b.hole && a.draw === b.draw && a.bend === b.bend;

function linesFor(f: DrillFocus): { lines: Line[]; tiers: number[] } {
  switch (f.type) {
    case "note": {
      const y = f.against && !same(f.against, f.tab) ? f.against : tab(f.tab.hole, !f.tab.draw);
      return contrast(f.tab, y, neighborOf(f.tab, y));
    }
    case "direction":
      return contrast(tab(f.hole, true), tab(f.hole, false), neighborOf(tab(f.hole, true), tab(f.hole, false)));
    case "neighbor": {
      const h = f.hole;
      const lo = tab(clampHole(h === 1 ? 2 : h - 1), true);
      const hi = tab(clampHole(h === 10 ? 9 : h + 1), true);
      return contrast(tab(h, true), h === 10 ? lo : hi, lo.hole === h ? hi : lo);
    }
    case "bend": {
      const b = f.tab;
      const open = tab(b.hole, b.draw);
      // nei bend profondi si passa anche dal gradino di mezzo
      const mid = b.bend >= 2 && maxBend(b.hole, b.draw) >= b.bend - 1 ? tab(b.hole, b.draw, b.bend - 1) : tab(b.hole, !b.draw);
      const c = contrast(b, open, mid);
      // i bend vogliono tempo: niente crome
      return { lines: c.lines.slice(0, 5), tiers: c.tiers.slice(0, 5) };
    }
    case "hold": {
      const [a, b, c] = [tab(4, true), tab(4, false), tab(5, true)];
      return {
        lines: [
          [
            [a, 4],
            [b, 4],
          ],
          [
            [a, 2],
            [a, 2],
            [c, 4],
          ],
          [
            [b, 1],
            [a, 1],
            [a, 2],
            [c, 4],
          ],
          [
            [c, 2],
            [a, 2],
            [b, 4],
          ],
          [
            [a, 1],
            [b, 1],
            [c, 2],
            [a, 4],
          ],
        ],
        tiers: [0, 0, 1, 1, 2],
      };
    }
    case "timing": {
      const [a, b] = [tab(4, true), tab(4, false)];
      return {
        lines: [
          [
            [a, 1],
            [a, 1],
            [a, 1],
            [a, 1],
            [b, 2],
            [b, 2],
          ],
          [
            [a, 2],
            [b, 1],
            [b, 1],
            [a, 2],
            [a, 2],
          ],
          [
            [a, 1.5],
            [b, 0.5],
            [a, 2],
            [a, 1.5],
            [b, 0.5],
            [a, 2],
          ],
          [
            [a, 0.5],
            [a, 0.5],
            [b, 1],
            [a, 1],
            [b, 1],
            [a, 4],
          ],
          [
            [b, 1],
            [a, 0.5],
            [a, 0.5],
            [b, 1],
            [a, 0.5],
            [a, 0.5],
            [b, 2],
            [a, 2],
          ],
        ],
        tiers: [0, 0, 1, 1, 2],
      };
    }
    case "chord":
      return { lines: [], tiers: [] };
  }
}

/** Accordi del treno: 1-2-3 aspirati (Sol) e 1-2-3 / 4-5-6 soffiati (Do). */
function chordPhrases(): { phrases: Phrase[][]; tiers: number[] } {
  const ch = (holes: number[], draw: boolean, start: number, dur: number): PhraseNote => {
    const semis = holes.map((h) => (draw ? DRAW[h - 1] : BLOW[h - 1])).sort((a, b) => a - b);
    return { tab: tab(holes[0], draw), semitones: semis, holes, kind: "chord", start, dur };
  };
  const G = (s: number, d: number) => ch([1, 2, 3], true, s, d);
  const Cl = (s: number, d: number) => ch([1, 2, 3], false, s, d);
  const Ch = (s: number, d: number) => ch([4, 5, 6], false, s, d);
  const mk = (id: string, notes: PhraseNote[]): Phrase[] => [{ id, beats: 8, notes }];
  return {
    phrases: [
      mk("drill.c1", [G(0, 2), G(2, 2), Cl(4, 2), G(6, 2)]),
      mk("drill.c2", [G(0, 1), G(1, 1), G(2, 2), Cl(4, 1), Cl(5, 1), G(6, 2)]),
      mk("drill.c3", [Ch(0, 2), Cl(2, 2), G(4, 4)]),
      mk("drill.c4", [G(0, 1), Cl(1, 1), G(2, 1), Cl(3, 1), G(4, 1), Cl(5, 1), G(6, 2)]),
      mk("drill.c5", [G(0, 0.5), G(0.5, 0.5), Cl(1, 1), G(2, 0.5), G(2.5, 0.5), Cl(3, 1), Ch(4, 2), G(6, 2)]),
    ],
    tiers: [0, 0, 1, 1, 2],
  };
}

/** Costruisce (e registra) il nemico dell'allenamento per un punto debole. */
export function makeDrill(w: Weakness): EnemyDef {
  const f = w.drill;
  let phrases: Phrase[][];
  let tiers: number[];
  if (f.type === "chord") ({ phrases, tiers } = chordPhrases());
  else {
    const l = linesFor(f);
    phrases = l.lines.map((line, i) => phrase(`drill.${i + 1}`, line));
    tiers = l.tiers;
  }
  const area = areaById(w.lesson.areaId);
  // il primo nemico della tappa della lezione fa da compagno di allenamento
  const mate = area.enemies.find((e) => !e.comingSoon) ?? area.enemies[0];
  const def: EnemyDef = {
    id: DRILL_ID,
    areaId: area.id,
    sprite: mate.sprite,
    timbre: mate.timbre,
    name: { it: `Allenamento · ${w.title.it}`, en: `Practice · ${w.title.en}` },
    trains: w.detail,
    hp: 60,
    attack: 5,
    volleySize: 3,
    phases: [{ phrases, tiers, bpm: [72, 96] }],
    drill: { weaknessId: w.id },
  };
  registerEnemy(def);
  return def;
}
