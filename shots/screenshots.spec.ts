import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { click, start, startBot } from "../e2e/helpers";

// Fotografa le schermate principali per le presentazioni dei progressi.
// Uso: SHOTS=../screenshots/<data-tappa> npm run shots
const OUT = resolve(process.env.SHOTS ?? "test-results/shots");
mkdirSync(OUT, { recursive: true });
// PHONE=1: schermo di un telefono in orizzontale
if (process.env.PHONE) test.use({ viewport: { width: 844, height: 390 } });

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

test("schermata su telefono (orizzontale)", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await start(page);
  await page.evaluate(() => window.__game.scene.getScene("journey").scene.start("battle", { enemyId: "singer" }));
  await active(page, "battle");
  await startBot(page);
  await page.waitForFunction(() => window.__game.scene.getScene("battle").battle.phase === "volley", null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/13-telefono-attacco.png` });
});

test("schermate del Juke Joint", async ({ page }) => {
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await page.screenshot({ path: `${OUT}/20-titolo.png` });
  await click(page, "title", "to-juke");
  await active(page, "hub");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/21-juke-joint.png` });
  const go = async (key: string, data: object, name: string, wait = 3500) => {
    await page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
    await active(page, key);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  await go("riffMenu", {}, "22-riff-menu", 800);
  await go("riff", { id: "primi-passi", modo: "concerto", tempo: 1 }, "23-riff", 6000);
  await go("voloMenu", {}, "24-volo-menu", 800);
  await go("volo", { id: "primo-volo" }, "24b-volo", 5000);
  await go("jamMenu", {}, "25-jam-menu", 800);
});

test("schermate verso la beta", async ({ page }) => {
  const shot = async (name: string, wait = 600) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await shot("30-titolo");
  await click(page, "title", "to-dojo");
  await active(page, "dojo");
  await shot("31-dojo", 1500);
  await page.evaluate(() => window.__game.scene.getScene("dojo").scene.start("journey"));
  await active(page, "journey");
  await page.evaluate(() => window.__game.scene.getScene("journey").scene.start("map", { areaId: "chicago-club" }));
  await active(page, "map");
  await shot("32-chicago", 900);
  for (const [enemy, name] of [
    ["drummer", "33-batterista"],
    ["stage-boss", "34-padrone-del-palco"],
    ["midnight-whistle", "35-fischio-di-mezzanotte"],
  ]) {
    await page.evaluate((e) => window.__game.scene.getScenes(true)[0].scene.start("battle", { enemyId: e }), enemy);
    await active(page, "battle");
    await startBot(page);
    await page.waitForFunction(() => window.__game.scene.getScene("battle").battle.phase === "response", null, { timeout: 60_000 });
    await shot(`${name}-risposta`, 900);
  }
  await page.evaluate(() => window.__game.scene.getScenes(true)[0].scene.start("options", { from: "title" }));
  await active(page, "options");
  await shot("36-opzioni");
});

test("controllo visivo su telefono, in inglese", async ({ page }) => {
  test.setTimeout(400_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    if (!localStorage.getItem("duello-dance-save"))
      localStorage.setItem(
        "duello-dance-save",
        JSON.stringify({ lang: "en", introSeen: true, beaten: ["draft", "sigh", "bellows", "silence", "ticket-clerk"] }),
      );
  });
  const shot = async (name: string, wait = 700) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  };
  const go = async (key: string, data: object = {}) => {
    await page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
    await active(page, key);
  };
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await shot("en-01-title");
  await click(page, "title", "to-journey");
  await active(page, "journey");
  await shot("en-02-journey", 900);
  await go("map", { areaId: "station" });
  await shot("en-03-map", 900);
  await click(page, "map", "lessons");
  await shot("en-04-lesson");
  await go("options", { from: "title" });
  await shot("en-05-options");
  await go("latency", { from: "options" });
  await shot("en-06-latency");
  await go("calibration", { from: "options" });
  await shot("en-07-calibration");
  await go("dojo");
  await shot("en-08-dojo", 1200);
  await go("hub");
  await shot("en-09-hub", 900);
  await go("battle", { enemyId: "porter" });
  await startBot(page);
  for (const phase of ["call", "response", "volley"]) {
    await page.waitForFunction((p) => window.__game.scene.getScene("battle").battle.phase === p, phase, { timeout: 60_000 });
    await shot(`en-10-battle-${phase}`, 800);
  }
  await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 200_000 });
  await shot("en-11-result", 2500);
});
