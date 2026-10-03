import { describe, it, expect } from "vitest";
import { estimateLatency } from "../src/audio/latency";

const clicks = Array.from({ length: 8 }, (_, i) => 10 + i * 0.75);

describe("stima del ritardo", () => {
  it("trova un ritardo costante", () => {
    const r = estimateLatency(
      clicks,
      clicks.map((c) => c + 0.12),
    );
    expect(r.latency).toBeCloseTo(0.12, 5);
    expect(r.matched).toBe(8);
  });

  it("resiste a un colpo mancato e a uno anticipato", () => {
    const onsets = clicks.map((c, i) => c + (i === 3 ? -0.05 : 0.15 + (i % 2) * 0.02)).filter((_, i) => i !== 5);
    const r = estimateLatency(clicks, onsets);
    expect(r.matched).toBe(7);
    expect(r.latency!).toBeGreaterThan(0.14);
    expect(r.latency!).toBeLessThan(0.18);
  });

  it("rifiuta la misura se il giocatore ha suonato troppo poco", () => {
    expect(
      estimateLatency(
        clicks,
        clicks.slice(0, 3).map((c) => c + 0.1),
      ).latency,
    ).toBeNull();
  });

  it("non abbina attacchi troppo lontani", () => {
    expect(
      estimateLatency(
        clicks,
        clicks.map((c) => c + 0.6),
      ).latency,
    ).toBeNull();
  });
});
