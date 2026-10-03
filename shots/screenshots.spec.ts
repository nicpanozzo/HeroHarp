import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { click, start, startBot } from "../e2e/helpers";

// Fotografa le schermate principali per le presentazioni dei progressi.
// Uso: SHOTS=../screenshots/<data-tappa> npm run shots
const OUT = resolve(process.env.SHOTS ?? "test-results/shots");
mkdirSync(OUT, { recursive: true });

const active = (page: Page, s: string) => page.waitForFunction((n) => window.__game.scene.isActive(n), s);

test("schermate", async ({ page }) => {
  const shot = async (name: string, wait = 500) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await shot("01-titolo");
  await start(page);
  await shot("02-viaggio-inizio", 800);
  await page.evaluate(() => window.__game.scene.getScene("journey").scene.start("map", { areaId: "porch" }));
  await active(page, "map");
  await shot("03-tappa-portico", 800);
  await click(page, "map", "lessons");
  await shot("04-lezione");

  // un viaggio già avanzato: prime tre tappe battute, la band cresce
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("duello-dance-save")!);
    s.beaten = ["draft", "sigh", "bellows", "silence", "ticket-clerk", "porter", "stationmaster", "mad-metronome", "stoker", "hobo", "whistle", "old-iron"];
    s.lessonsSeen = ["porch", "station", "freight-train", "juke-joint", "beale-street", "delta-crossroads", "riverboat", "chicago-club", "after-hours"];
    localStorage.setItem("duello-dance-save", JSON.stringify(s));
    location.reload();
  });
  await active(page, "title");
  await click(page, "title", "to-journey");
  await active(page, "journey");
  await shot("05-viaggio", 900);
  await page.evaluate(() => window.__game.scene.getScene("journey").scene.start("map", { areaId: "juke-joint" }));
  await active(page, "map");
  await shot("06-tappa-juke-joint", 800);
  await click(page, "map", "options");
  await active(page, "options");
  await shot("07-opzioni");
  await click(page, "options", "opt-latency");
  await active(page, "latency");
  await click(page, "latency", "lat-go");
  await shot("08-ritardo", 4200);

  const battle = async (enemyId: string, prefix: string) => {
    await page.evaluate((e) => {
      const g = window.__game;
      const cur = g.scene.getScenes(true)[0];
      cur.scene.start("battle", { enemyId: e });
    }, enemyId);
    await active(page, "battle");
    await startBot(page);
    const at = async (phase: string, name: string, extra: number) => {
      await page.waitForFunction((p) => window.__game.scene.getScene("battle").battle.phase === p, phase, { timeout: 60_000 });
      await shot(name, extra);
    };
    await at("call", `${prefix}-chiamata`, 900);
    await at("response", `${prefix}-risposta`, 900);
    await at("volley", `${prefix}-attacco`, 700);
  };
  await battle("singer", "09-juke-joint");
  await battle("crow", "10-crocevia");
  await battle("silence", "11-portico");
  await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 280_000 });
  await shot("12-vittoria", 1200);
});
