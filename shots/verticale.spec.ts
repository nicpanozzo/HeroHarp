import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { click, startBot } from "../e2e/helpers";

// Schermate sul telefono tenuto in verticale (390×844, come un iPhone 14).
// Uso: SHOTS=<cartella> npm run shots -- verticale   ·   SOLO=battaglia,titolo per farne solo alcune
const OUT = resolve(process.env.SHOTS ?? "test-results/verticale");
mkdirSync(OUT, { recursive: true });
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const SOLO = process.env.SOLO?.split(",");
const want = (name: string) => !SOLO || SOLO.some((s) => name.includes(s));

const active = (page: Page, s: string, timeout = 30_000) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout });
async function shot(page: Page, name: string, wait = 700) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
const go = (page: Page, key: string, data: object = {}) =>
  page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
const phase = (page: Page, scene: string, p: string) =>
  page.waitForFunction(([s, x]) => window.__game.scene.getScene(s).battle?.phase === x, [scene, p] as const, { timeout: 60_000 });

const SAVE = {
  introSeen: true,
  beaten: ["draft", "sigh", "bellows", "silence", "ticket-clerk", "porter", "stationmaster", "mad-metronome", "stoker", "hobo", "whistle", "old-iron"],
  lessonsSeen: ["porch", "station", "freight-train", "juke-joint", "beale-street", "delta-crossroads", "riverboat", "chicago-club", "after-hours"],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((s) => {
    if (!localStorage.getItem("duello-dance-save")) localStorage.setItem("duello-dance-save", JSON.stringify(s));
  }, SAVE);
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
});

test("menu e viaggio", async ({ page }) => {
  if (want("titolo")) await shot(page, "01-titolo");
  if (want("viaggio")) {
    await go(page, "journey");
    await active(page, "journey");
    await shot(page, "02-viaggio", 900);
  }
  if (want("tappa")) {
    await go(page, "map", { areaId: "juke-joint" });
    await active(page, "map");
    await shot(page, "03-tappa", 900);
    await click(page, "map", "lessons");
    await shot(page, "04-lezione");
  }
  if (want("opzioni")) {
    await go(page, "options", { from: "title" });
    await active(page, "options");
    await shot(page, "05-opzioni");
  }
  if (want("calibrazione")) {
    await go(page, "calibration", { from: "title" });
    await active(page, "calibration");
    await shot(page, "06-calibrazione");
    await go(page, "latency", { from: "title" });
    await active(page, "latency");
    await shot(page, "07-ritardo");
  }
  if (want("dojo")) {
    await go(page, "dojo");
    await active(page, "dojo");
    await shot(page, "08-dojo");
  }
  if (want("pagella")) {
    await go(page, "stats");
    await active(page, "stats");
    await shot(page, "09-pagella");
  }
});

test("battaglia", async ({ page }) => {
  test.skip(!want("battaglia"));
  await go(page, "battle", { enemyId: process.env.NEMICO ?? "singer" });
  await active(page, "battle");
  await startBot(page);
  await phase(page, "battle", "call");
  await shot(page, "10-battaglia-ascolta", 900);
  await phase(page, "battle", "response");
  await shot(page, "11-battaglia-rispondi", 900);
  await phase(page, "battle", "volley");
  await shot(page, "12-battaglia-para", 1300);
  if (want("vittoria")) {
    await active(page, "result", 280_000);
    await shot(page, "13-vittoria", 1200);
  }
});

test("lunga notte", async ({ page }) => {
  test.skip(!want("notte"));
  await go(page, "runStart");
  await active(page, "runStart");
  await shot(page, "20-notte-partenza");
  await click(page, "runStart", "road-yourStop");
  await active(page, "runMap");
  await shot(page, "21-notte-atto", 900);
  await click(page, "runMap", "act-go");
  await shot(page, "22-notte-mappa", 900);
  await page.keyboard.press("Enter");
  await active(page, "runBattle");
  await startBot(page, "runBattle");
  await phase(page, "runBattle", "response");
  await shot(page, "23-notte-duello", 900);
  await phase(page, "runBattle", "volley");
  await shot(page, "24-notte-parata", 1300);
  await active(page, "runStop", 240_000);
  await shot(page, "25-notte-ricompensa", 900);
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("heroharp-lunga-notte")!));
  const map = store.run.map as { id: string; kind: string }[];
  for (const mode of ["shop", "rest", "event"]) {
    await go(page, "runStop", { mode, nodeId: map[0].id });
    await active(page, "runStop");
    await shot(page, `26-notte-${mode}`, 900);
  }
  await go(page, "runEnd");
  await active(page, "runEnd");
  await shot(page, "27-notte-fine", 900);
});

test("juke joint", async ({ page }) => {
  test.skip(!want("juke"));
  await go(page, "hub");
  await active(page, "hub");
  await shot(page, "30-juke-ingresso", 900);
  for (const [menu, play] of [
    ["jamMenu", "jam"],
    ["riffMenu", "riff"],
    ["voloMenu", "volo"],
  ]) {
    await go(page, menu);
    await active(page, menu);
    await shot(page, `31-${menu}`, 900);
    await go(page, play);
    await active(page, play);
    await shot(page, `32-${play}`, 2500);
  }
});
