import { describe, it, expect } from "vitest";
import { parseTab, tabToMidi, midiToTabs, keyById, formatTab, noteName } from "../src/harp";

const C = keyById("C");

describe("modello dell'armonica", () => {
  it("legge l'intavolatura", () => {
    expect(parseTab("4")).toEqual({ hole: 4, draw: false, bend: 0 });
    expect(parseTab("-3''")).toEqual({ hole: 3, draw: true, bend: 2 });
    expect(() => parseTab("-5'")).toThrow(); // il foro 5 aspirato non si piega
    expect(() => parseTab("11")).toThrow();
  });

  it("calcola le note su un'armonica in Do", () => {
    expect(noteName(tabToMidi(parseTab("4"), C), "it")).toBe("Do5");
    expect(noteName(tabToMidi(parseTab("-4"), C), "it")).toBe("Re5");
    expect(noteName(tabToMidi(parseTab("-3'''"), C), "en")).toBe("A♭4");
    expect(noteName(tabToMidi(parseTab("10''"), C), "it")).toBe("Sib6");
  });

  it("traspone in ogni tonalità con la stessa intavolatura", () => {
    expect(tabToMidi(parseTab("4"), keyById("A"))).toBe(69); // La4 su un'armonica in La
    expect(tabToMidi(parseTab("-2"), keyById("G")) - tabToMidi(parseTab("1"), keyById("G"))).toBe(7);
  });

  it("riconosce che 2 aspirato e 3 soffiato sono la stessa nota", () => {
    expect(midiToTabs(67, C).map(formatTab).sort()).toEqual(["2↓", "3↑"]);
  });
});
