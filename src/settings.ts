// Applica le opzioni salvate al motore audio.
import { getEngine, DEFAULT_GATE, DEFAULT_LATENCY } from "./audio/engine";
import { save, persist } from "./state";

export function applySettings(): void {
  const s = save.settings;
  const engine = getEngine();
  engine.configureMusic(s.music ? s.musicVolume : 0, s.headphones);
  engine.gate = s.micGate ?? DEFAULT_GATE;
  engine.inputLatency = s.latency ?? DEFAULT_LATENCY;
}

export function updateSettings(patch: Partial<typeof save.settings>): void {
  Object.assign(save.settings, patch);
  persist();
  applySettings();
}
