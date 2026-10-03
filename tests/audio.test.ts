import { describe, it, expect } from "vitest";
import { yin } from "../src/audio/yin";
import { NoteTracker } from "../src/audio/tracker";

const SR = 48000;
function tone(hz: number, n = 2048): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ph = (2 * Math.PI * hz * i) / SR;
    for (let k = 1; k <= 6; k++) b[i] += Math.pow(0.6, k - 1) * Math.sin(k * ph) * 0.3;
  }
  return b;
}

describe("YIN", () => {
  for (const hz of [196, 261.63, 587.33, 1174.66, 2093]) {
    it(`trova ${hz} Hz entro 5 centesimi`, () => {
      const r = yin(tone(hz), SR)!;
      expect(Math.abs(1200 * Math.log2(r.hz / hz))).toBeLessThan(5);
      expect(r.clarity).toBeGreaterThan(0.9);
    });
  }
  it("non trova note nel rumore", () => {
    const b = new Float32Array(2048).map(() => Math.random() * 2 - 1);
    const r = yin(b, SR);
    expect(r === null || r.clarity < 0.8).toBe(true);
  });
});

describe("NoteTracker", () => {
  it("emette un attacco solo dopo alcuni frame stabili", () => {
    const tr = new NoteTracker();
    const onsets: number[] = [];
    tr.onOnset((o) => onsets.push(o.midi));
    tr.feed(0, 72.1, 0.1);
    tr.feed(0.016, 71.9, 0.1);
    expect(onsets).toEqual([]);
    tr.feed(0.032, 72.0, 0.1);
    expect(onsets).toEqual([72]);
    expect(tr.state.midi).toBe(72);
  });
  it("riconosce la stessa nota suonata due volte grazie al calo di volume", () => {
    const tr = new NoteTracker();
    const onsets: number[] = [];
    tr.onOnset((o) => onsets.push(o.midi));
    let t = 0;
    for (const lvl of [0.1, 0.1, 0.1, 0.1, 0.03, 0.03, 0.1, 0.1]) tr.feed((t += 0.016), 72, lvl);
    expect(onsets).toEqual([72, 72]);
  });
  it("ignora un singolo frame spurio", () => {
    const tr = new NoteTracker();
    const onsets: number[] = [];
    tr.onOnset((o) => onsets.push(o.midi));
    for (const m of [72, 72, 72, 84, 72, 72]) tr.feed(0, m, 0.1);
    expect(onsets).toEqual([72]);
  });
});
