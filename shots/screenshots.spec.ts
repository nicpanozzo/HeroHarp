import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { click, start, startBot } from "../e2e/helpers";

// Fotografa le schermate principali per le presentazioni dei progressi.
// Uso: SHOTS=../screenshots/2026-10-03-opzioni npx playwright test -c playwright.shots.config.ts
const OUT = resolve(process.env.SHOTS ?? "test-results/shots");
mkdirSync(OUT, { recursive: true });

test("schermate", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}.png` });
  await page.goto(resolve("dist/index.html").replace(/^/, "file://"));
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await page.waitForTimeout(600);
  await shot("01-titolo");
  await start(page);
  await page.waitForTimeout(800);
  await shot("02-zia-mae");
  await click(page, "map", "mae-ok");
  await page.waitForTimeout(600);
  await shot("03-mappa");
  await click(page, "map", "options");
  await page.waitForFunction(() => window.__game.scene.isActive("options"));
  await page.waitForTimeout(400);
  await shot("04-opzioni");
  await click(page, "options", "opt-latency");
  await page.waitForFunction(() => window.__game.scene.isActive("latency"));
  await page.waitForTimeout(400);
  await shot("05-ritardo");
  await click(page, "latency", "lat-go");
  await page.waitForTimeout(4200);
  await shot("05-ritardo-in-corso");
  await page.evaluate(() => window.__game.scene.getScene("latency").scene.start("options", { from: "map" }));
  await page.waitForFunction(() => window.__game.scene.isActive("options"));
  await click(page, "options", "opt-calibrate");
  await page.waitForFunction(() => window.__game.scene.isActive("calibration"));
  await page.waitForTimeout(400);
  await shot("05-calibrazione-microfono");

  await page.evaluate(() => window.__game.scene.getScene("calibration").scene.start("battle", { enemyId: "silence" }));
  await page.waitForFunction(() => window.__game.scene.isActive("battle"));
  await startBot(page);
  const at = async (phase: string, name: string, extra = 0) => {
    await page.waitForFunction((p) => window.__game.scene.getScene("battle").battle.phase === p, phase, { timeout: 60_000 });
    await page.waitForTimeout(extra);
    await shot(name);
  };
  await at("call", "06-battaglia-chiamata", 900);
  await at("response", "07-battaglia-risposta", 900);
  await at("volley", "08-battaglia-attacco", 700);
  await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 280_000 });
  await page.waitForTimeout(1200);
  await shot("09-vittoria");
});
