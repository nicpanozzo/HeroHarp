import { test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { click, startBot } from "../e2e/helpers";

// Schermate della pagella e dell'allenamento mirato. Uso: SHOTS=dir [PHONE=1] npx playwright test -c playwright.shots.config.ts stats
const OUT = resolve(process.env.SHOTS ?? "test-results/shots");
mkdirSync(OUT, { recursive: true });
const DEMO = readFileSync(resolve(import.meta.dirname, "../e2e/fixtures/stats-demo.json"), "utf8");
const active = (page: Page, s: string) => page.waitForFunction((n) => window.__game.scene.isActive(n), s);
const P = process.env.PHONE ? "telefono-" : "";

test("pagella", async ({ page }) => {
  if (process.env.PHONE) await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript((demo) => {
    if (!localStorage.getItem("heroharp-stats")) localStorage.setItem("heroharp-stats", demo);
    if (!localStorage.getItem("duello-dance-save"))
      localStorage.setItem("duello-dance-save", JSON.stringify({ introSeen: true, lessonsSeen: ["porch", "station"] }));
  }, DEMO);
  const shot = async (name: string, wait = 600) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  };
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await shot("01-titolo");
  await click(page, "title", "to-stats");
  await active(page, "stats");
  await shot("02-pagella", 900);
  await click(page, "stats", "lesson-0");
  await shot("03-lezione-mirata");
  await page.evaluate(() => window.__game.scene.getScene("stats").scene.restart());
  await active(page, "stats");
  await click(page, "stats", "drill-0");
  await active(page, "battle");
  await startBot(page);
  await page.waitForFunction(() => window.__game.scene.getScene("battle").battle.phase === "response", null, { timeout: 60_000 });
  await shot("04-allenamento", 1200);
  // fine di una battaglia del viaggio con una nota da allenare
  await page.evaluate(() => {
    const g = window.__game;
    g.scene.getScenes(true)[0].scene.start("result", {
      won: true,
      enemyId: "sigh",
      stats: { notesExpected: 14, notesHit: 11, parried: 6, missed: 1, rounds: 3, perfect: 5, score: 1210, bestStreak: 6 },
      hint: { tab: { hole: 4, draw: true, bend: 0 }, title: { it: "Da allenare: 4↓ (spesso suoni 4↑)", en: "To practise: 4↓ (you often play 4↑)" } },
    });
  });
  await active(page, "result");
  await shot("05-fine-battaglia", 1500);
});
