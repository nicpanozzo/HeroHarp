import { test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { click } from "../e2e/helpers";

// Menu, mappa, pagella e fine battaglia sul telefono tenuto dritto, su uno schermo alto e su uno basso.
// Uso: npm run build && npx playwright test -c playwright.shots.config.ts verticale-menu   ·   SOLO=pagella,esito per farne solo alcune
const OUT = resolve(process.env.SHOTS ?? "test-results/verticale-menu");
mkdirSync(OUT, { recursive: true });
const DEMO = readFileSync(resolve(import.meta.dirname, "../e2e/fixtures/stats-demo.json"), "utf8");
const SOLO = process.env.SOLO?.split(",");
const want = (name: string) => !SOLO || SOLO.some((s) => name.includes(s));

const SAVE = {
  introSeen: true,
  beaten: ["draft", "sigh", "bellows", "silence", "ticket-clerk", "porter", "stationmaster", "mad-metronome", "stoker", "hobo", "whistle", "old-iron"],
  lessonsSeen: ["porch", "station", "freight-train", "juke-joint", "beale-street", "delta-crossroads", "riverboat", "chicago-club", "after-hours"],
};

const active = (page: Page, s: string, timeout = 30_000) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout });
const go = (page: Page, key: string, data: object = {}) =>
  page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);

const STATS = { notesExpected: 14, notesHit: 11, parried: 6, missed: 1, rounds: 3, perfect: 5, score: 1210, bestStreak: 6 };

for (const [label, viewport] of [
  ["alto", { width: 390, height: 844 }],
  ["basso", { width: 360, height: 640 }],
] as const) {
  test.describe(label, () => {
    test.use({ viewport, deviceScaleFactor: 2, hasTouch: true });
    const shot = async (page: Page, name: string, wait = 700) => {
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
    };

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        ([s, demo]) => {
          if (!localStorage.getItem("duello-dance-save")) localStorage.setItem("duello-dance-save", s);
          if (!localStorage.getItem("heroharp-stats")) localStorage.setItem("heroharp-stats", demo);
        },
        [JSON.stringify(SAVE), DEMO] as const,
      );
      await page.goto("file://" + resolve("dist/index.html"));
      await active(page, "title");
    });

    test("viaggio e tappe", async ({ page }) => {
      if (want("viaggio")) {
        await go(page, "journey");
        await active(page, "journey");
        await shot(page, "01-viaggio", 900);
        await click(page, "journey", "help");
        await shot(page, "02-come-si-gioca");
      }
      if (want("tappa")) {
        await go(page, "map", { areaId: "porch" });
        await active(page, "map");
        await shot(page, "03-tappa-portico", 900);
        await go(page, "map", { areaId: "juke-joint" });
        await active(page, "map");
        await shot(page, "04-tappa-juke", 900);
        for (const id of ["chicago-club", "after-hours"]) {
          await go(page, "map", { areaId: id });
          await active(page, "map");
          await shot(page, `04-tappa-${id}`, 900);
        }
        await go(page, "map", { areaId: "juke-joint" });
        await active(page, "map");
        await click(page, "map", "lessons");
        await shot(page, "05-lezione-1");
        await click(page, "map", "mae-ok");
        await shot(page, "06-lezione-2");
      }
    });

    test("opzioni e calibrazione", async ({ page }) => {
      if (want("opzioni")) {
        await go(page, "options", { from: "title" });
        await active(page, "options");
        await shot(page, "10-opzioni");
      }
      if (want("calibrazione")) {
        // il microfono finto risulta acceso, così si vedono i messaggi e il pulsante Avvia
        await page.evaluate(() => (window.__engine().micStatus = "on"));
        await go(page, "calibration", { from: "title" });
        await active(page, "calibration");
        await shot(page, "11-calibrazione");
        await go(page, "latency", { from: "title" });
        await active(page, "latency");
        await shot(page, "12-ritardo");
      }
      if (want("dojo")) {
        await go(page, "dojo");
        await active(page, "dojo");
        await shot(page, "13-dojo-vuoto");
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" })));
        await shot(page, "14-dojo-nota", 400);
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "r" })));
      }
    });

    test("pagella ed esito", async ({ page }) => {
      if (want("pagella")) {
        await go(page, "stats");
        await active(page, "stats");
        await shot(page, "20-pagella", 900);
        await click(page, "stats", "lesson-0");
        await shot(page, "21-pagella-lezione");
        await page.evaluate(() => window.__game.scene.getScene("stats").scene.restart());
        await active(page, "stats");
        await click(page, "stats", "drill-0");
        await active(page, "battle");
        await go(page, "result", { won: true, enemyId: "drill", stats: STATS });
        await active(page, "result");
        await shot(page, "22-allenamento-fatto", 1500);
        await page.evaluate(() => localStorage.removeItem("heroharp-stats"));
      }
      if (want("esito")) {
        const hint = { tab: { hole: 4, draw: true, bend: 0 }, title: { it: "Da allenare: 4↓ (spesso suoni 4↑)", en: "To practise: 4↓ (you often play 4↑)" } };
        await go(page, "result", { won: true, enemyId: "sigh", stats: STATS, hint });
        await active(page, "result");
        await shot(page, "30-vittoria", 1500);
        await go(page, "result", { won: false, enemyId: "porter", stats: { ...STATS, score: 420 } });
        await active(page, "result");
        await shot(page, "31-sconfitta", 1500);
        await go(page, "result", { won: true, enemyId: "old-iron", stats: STATS });
        await active(page, "result");
        await shot(page, "32-boss-battuto", 1500);
      }
    });
  });
}
