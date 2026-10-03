import { test, expect, type Page } from "@playwright/test";
import { click, startBot } from "./helpers";
import { GAME } from "./paths";

const active = (page: Page, s: string, timeout = 30_000) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout });
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("heroharp-lunga-notte") ?? "null"));

// La Lunga Notte: dal titolo alla mappa, un duello vinto dal giocatore automatico, la ricompensa e il musicista nella base.
test("una notte: duello, ricompensa, la band suona", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(GAME);
  await active(page, "title");
  await click(page, "title", "to-night");
  await active(page, "runStart");
  await click(page, "runStart", "road-yourStop");
  await active(page, "runMap");
  await click(page, "runMap", "act-go");
  // Invio = la prima tappa raggiungibile (sempre un duello all'inizio)
  await page.keyboard.press("Enter");
  await active(page, "runBattle");
  await startBot(page, "runBattle");
  await active(page, "runStop", 240_000);
  const before = await stored(page);
  expect(before.run.stats.won).toBe(1);
  expect(before.run.coins).toBeGreaterThan(0);
  // la prima ricompensa propone sempre un musicista, per primo
  await click(page, "runStop", "offer-0");
  await active(page, "runMap");
  const after = await stored(page);
  expect(after.run.visited).toHaveLength(1);
  expect(after.run.band).toHaveLength(1);
  const band = await page.evaluate(() => window.__engine().basi.band);
  expect(band.length).toBe(2);
  expect(band).toContain("piede");
  expect(errors).toEqual([]);
});
