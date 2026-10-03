import { defineConfig } from "@playwright/test";
import { FAKE_MIC } from "./e2e/paths";

// Prove nel browser vero sul file costruito (dist/index.html), con un microfono finto.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 300_000,
  // le battaglie durano minuti veri: si giocano in parallelo
  fullyParallel: true,
  // su GitHub gli errori compaiono come annotazioni accanto al codice
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // server locale per le prove che servono un sito vero (app offline)
  webServer: { command: "npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: true },
  use: {
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${FAKE_MIC}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
});
