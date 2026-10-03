import { resolve } from "node:path";
export const FAKE_MIC = resolve(import.meta.dirname, "../test-results/do5.wav");
export const GAME = "file://" + resolve(import.meta.dirname, "../dist/index.html");
