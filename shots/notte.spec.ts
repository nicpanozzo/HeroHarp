import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { click, startBot } from "../e2e/helpers";

// Schermate della Lunga Notte (modalità roguelike). Uso: SHOTS=<cartella> npm run shots -- notte
const OUT = resolve(process.env.SHOTS ?? "test-results/shots");
// PHONE=1: schermo di un telefono in orizzontale, per il controllo di leggibilità
if (process.env.PHONE) test.use({ viewport: { width: 844, height: 390 } });
mkdirSync(OUT, { recursive: true });
const active = (page: Page, s: string, timeout = 30_000) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout });

async function shot(page: Page, name: string, wait = 700) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

const go = (page: Page, key: string, data: object = {}) =>
  page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);

test("schermate della Lunga Notte", async ({ page }) => {
  // un viaggio arrivato al Juke Joint: tre strade tra cui scegliere
  await page.addInitScript(() => {
    if (!localStorage.getItem("duello-dance-save"))
      localStorage.setItem(
        "duello-dance-save",
        JSON.stringify({
          introSeen: true,
          beaten: ["draft", "sigh", "bellows", "silence", "ticket-clerk", "porter", "stationmaster", "mad-metronome", "stoker", "hobo", "whistle", "old-iron"],
        }),
      );
  });
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await shot(page, "01-titolo");
  await click(page, "title", "to-night");
  await active(page, "runStart");
  await shot(page, "02-partenza");
  await click(page, "runStart", "road-yourStop");
  await active(page, "runMap");
  await shot(page, "03-atto", 900);
  await click(page, "runMap", "act-go");
  await shot(page, "04-mappa", 900);
  await page.keyboard.press("Enter");
  await active(page, "runBattle");
  await startBot(page, "runBattle");
  const phase = (p: string) => page.waitForFunction((x) => window.__game.scene.getScene("runBattle").battle?.phase === x, p, { timeout: 60_000 });
  await phase("response");
  await shot(page, "05-duello-risposta", 900);
  await phase("volley");
  await shot(page, "06-duello-parata", 700);
  await active(page, "runStop", 240_000);
  await shot(page, "07-ricompensa", 900);
  await click(page, "runStop", "offer-0");
  await active(page, "runMap");
  await shot(page, "08-mappa-band", 1200);

  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("heroharp-lunga-notte")!));
  const map = store.run.map as { id: string; kind: string }[];
  await go(page, "runStop", { mode: "shop", nodeId: map[0].id });
  await active(page, "runStop");
  await shot(page, "09-banco-dei-pegni");
  await go(page, "runStop", { mode: "rest", nodeId: map[0].id });
  await shot(page, "10-portico");
  const ev = map.find((n) => n.kind === "event");
  if (ev) {
    await go(page, "runStop", { mode: "event", nodeId: ev.id });
    await shot(page, "11-crocevia");
  }

  // più avanti nella notte: band al completo e attrezzi raccolti
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("heroharp-lunga-notte")!);
    Object.assign(st.run, { band: ["sam", "earl", "ruby", "tito", "june"], gear: ["bullet", "custodia", "metronomo", "cappello"], coins: 230, hp: 74 });
    localStorage.setItem("heroharp-lunga-notte", JSON.stringify(st));
    location.reload();
  });
  await active(page, "title");
  await go(page, "runMap");
  await active(page, "runMap");
  await shot(page, "14-mappa-band-completa", 900);
  await page.keyboard.press("Enter");
  await active(page, "runBattle");
  await startBot(page, "runBattle");
  await page.waitForFunction(() => window.__game.scene.getScene("runBattle").battle?.phase === "volley", null, { timeout: 60_000 });
  await shot(page, "15-duello-con-la-band", 600);

  // la pagella di fine notte
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("heroharp-lunga-notte")!);
    Object.assign(st.run, { over: "lost", hp: 0, act: 1, newBest: false });
    st.meta = { ...st.meta, nights: 4, bestScore: Math.max(st.run.stats.score, 5120) };
    Object.assign(st.run.stats, { misses: { "4↓": 6, "3↓'": 4, "6↑": 3, "5↓": 1 }, hits: { "4↓": 9, "3↓'": 2, "6↑": 12 } });
    localStorage.setItem("heroharp-lunga-notte", JSON.stringify(st));
    location.reload();
  });
  await active(page, "title");
  await go(page, "runEnd");
  await active(page, "runEnd");
  await shot(page, "16-pagella", 1200);
});

test("Lunga Notte su telefono (orizzontale)", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
  await click(page, "title", "to-night");
  await active(page, "runStart");
  await click(page, "runStart", "road-yourStop");
  await active(page, "runMap");
  await click(page, "runMap", "act-go");
  await shot(page, "12-telefono-mappa", 900);
  await page.keyboard.press("Enter");
  await active(page, "runBattle");
  await startBot(page, "runBattle");
  await page.waitForFunction(() => window.__game.scene.getScene("runBattle").battle?.phase === "volley", null, { timeout: 60_000 });
  await shot(page, "13-telefono-parata", 500);
});
