import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { click } from "../e2e/helpers";

// La Lunga Notte sul telefono in verticale, senza giocare duelli: la run si prepara nel salvataggio.
// Uso: npm run build && npx playwright test -c playwright.shots.config.ts verticale-notte   (SOLO=mappa,fine per farne solo alcune)
const OUT = resolve(process.env.SHOTS ?? "test-results/verticale-notte");
mkdirSync(OUT, { recursive: true });
const SOLO = process.env.SOLO?.split(",");
const want = (name: string) => !SOLO || SOLO.some((s) => name.includes(s));
const KEY = "heroharp-lunga-notte";
const EVENTI = (process.env.EVENTI ?? "stranger").split(",");

const SAVE = {
  introSeen: true,
  beaten: ["draft", "sigh", "bellows", "silence", "ticket-clerk", "porter", "stationmaster", "mad-metronome", "stoker", "hobo", "whistle", "old-iron"],
  lessonsSeen: ["porch", "station", "freight-train", "juke-joint", "beale-street", "delta-crossroads", "riverboat", "chicago-club", "after-hours"],
};

const active = (page: Page, s: string, timeout = 90_000) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout });
const go = (page: Page, key: string, data: object = {}) =>
  page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
/** Cambia la run salvata e ricarica (il salvataggio si legge all'avvio). */
async function edit(page: Page, fn: string) {
  await page.evaluate(
    ([k, f]) => {
      const st = JSON.parse(localStorage.getItem(k)!);
      new Function("run", f)(st.run);
      localStorage.setItem(k, JSON.stringify(st));
    },
    [KEY, fn] as const,
  );
  await page.reload();
  await active(page, "title");
}

for (const [label, vw, vh] of [
  ["alto", 390, 844],
  ["basso", 360, 640],
] as const) {
  test(`notte verticale ${label}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: vw, height: vh });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((s) => {
      if (!localStorage.getItem("duello-dance-save")) localStorage.setItem("duello-dance-save", JSON.stringify(s));
    }, SAVE);
    await page.goto("file://" + resolve("dist/index.html"));
    await active(page, "title");
    const shot = async (name: string, wait = 800) => {
      await page.waitForTimeout(wait);
      if (want(name)) await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
    };
    await go(page, "runStart");
    await active(page, "runStart");
    await shot("1-partenza");
    await click(page, "runStart", "road-yourStop");
    await active(page, "runMap");
    await shot("2-atto");
    await click(page, "runMap", "act-go");
    await shot("3-mappa");

    // run a metà: band, attrezzi, un paio di tappe fatte
    await edit(
      page,
      `run.band = ["sam", "earl", "ruby"];
      run.gear = ["bullet", "ferro", "cappello"];
      run.coins = 140;
      run.hp = 62;
      const c0 = run.map.find((n) => n.col === 0 && n.lane === 1);
      const c1 = run.map.find((n) => c0.next.includes(n.id));
      run.visited = [c0.id, c1.id];
      run.pos = c1.id;
      run.introSeen = 0;
      run.stats = { ...run.stats, fights: 5, won: 4, notesHit: 80, notesExpected: 100, score: 12345, misses: { "4↓": 7, "3↓'": 9, "6↑": 3 }, hits: { "4↓": 10, "3↓'": 4, "6↑": 12 } };`,
    );
    await go(page, "runStart");
    await active(page, "runStart");
    await shot("4-partenza-continua");
    await go(page, "runMap");
    await active(page, "runMap");
    await shot("5-mappa-avanti");
    const map = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).run.map, KEY)) as { id: string; kind: string }[];
    const nodeOf = (kind: string) => (map.find((n) => n.kind === kind) ?? map[0]).id;
    await go(page, "runStop", { mode: "reward", nodeId: nodeOf("fight"), coins: 24 });
    await active(page, "runStop");
    await shot("6-ricompensa");
    await go(page, "runStop", { mode: "shop", nodeId: map[0].id });
    await shot("7-negozio");
    await go(page, "runStop", { mode: "rest", nodeId: map[0].id });
    await shot("8-riposo");
    await click(page, "runStop", "rest-lesson");
    await shot("9-lezione");
    for (const ev of EVENTI) {
      await edit(page, `run.map[0].kind = "event"; run.map[0].eventId = ${JSON.stringify(ev)};`);
      await go(page, "runStop", { mode: "event", nodeId: map[0].id });
      await active(page, "runStop");
      await shot(`10-evento-${ev}`);
    }
    // fine notte
    for (const over of ["won", "lost"]) {
      await edit(page, `run.over = ${JSON.stringify(over)}; run.newBest = ${over === "won"};`);
      await go(page, "runEnd");
      await active(page, "runEnd");
      await shot(`11-fine-${over}`, 2500);
    }
    if (errors.length) throw new Error(errors.join("\n"));
  });
}
