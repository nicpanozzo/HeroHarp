import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { click, start, startBot } from "./helpers";

// Statistiche di un giocatore che confonde spesso 4↓ con 4↑ (generate dalla logica vera della battaglia)
const DEMO = readFileSync(resolve(import.meta.dirname, "fixtures/stats-demo.json"), "utf8");
const active = (page: Page, s: string) => page.waitForFunction((n) => window.__game.scene.isActive(n), s);
const text = (page: Page, scene: string, name: string) =>
  page.evaluate(([s, n]) => window.__game.scene.getScene(s).children.getByName(n)?.text ?? null, [scene, name]);

test("la pagella trova l'errore più frequente e parte l'allenamento mirato", async ({ page }) => {
  await page.addInitScript((demo) => {
    if (!localStorage.getItem("heroharp-stats")) localStorage.setItem("heroharp-stats", demo);
  }, DEMO);
  const errors = await start(page);
  await page.evaluate(() => window.__game.scene.getScene("journey").scene.start("title"));
  await active(page, "title");
  await click(page, "title", "to-stats");
  await active(page, "stats");
  // il primo punto debole riguarda il foro 4 (respiro invertito o la nota stessa)
  expect(await text(page, "stats", "focus-0")).toMatch(/Soffio o aspirato|4↓/);
  await click(page, "stats", "drill-0");
  await active(page, "battle");
  expect(await page.evaluate(() => window.__game.scene.getScene("battle").enemy.id)).toBe("drill");
  await startBot(page);
  await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 280_000 });
  expect(await text(page, "result", "result")).toMatch(/ALLENAMENTO|PRACTICE/);
  // l'allenamento non conta come nemico battuto nel viaggio
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("duello-dance-save")!).beaten ?? [])).not.toContain("drill");
  await click(page, "result", "to-stats");
  await active(page, "stats");
  expect(errors).toEqual([]);
});

test("una battaglia finisce nelle statistiche", async ({ page }) => {
  const errors = await start(page);
  await page.evaluate(() => window.__game.scene.getScene("journey").scene.start("battle", { enemyId: "draft" }));
  await active(page, "battle");
  await startBot(page);
  await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 280_000 });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("heroharp-stats")!));
  expect(s.totals.battles).toBe(1);
  expect(s.totals.notes).toBeGreaterThan(5);
  expect(Object.keys(s.notes).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
