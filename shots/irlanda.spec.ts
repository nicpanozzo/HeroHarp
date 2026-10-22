import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Schermate della sezione irlandese della Strada dei Riff: menu, brano in ascolto e brano suonato.
// Uso: npm run build && npx playwright test -c playwright.shots.config.ts irlanda
// VW/VH = finestra (predefinita 390×844; 1280×720 per il computer) · SHOTS = cartella · LANG=en
const VW = Number(process.env.VW ?? 390);
const VH = Number(process.env.VH ?? 844);
const OUT = resolve(process.env.SHOTS ?? `test-results/irlanda-${VW}x${VH}`);
mkdirSync(OUT, { recursive: true });
test.use({ viewport: { width: VW, height: VH }, deviceScaleFactor: VW > VH ? 1 : 2, hasTouch: true });

const active = (page: Page, s: string) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout: 30_000 });
async function go(page: Page, key: string, data: object = {}) {
  await page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
  await active(page, key);
}
/** Preme una scelta del menu cercandola per il testo dell'etichetta. */
async function premi(page: Page, scena: string, etichetta: string) {
  await page.evaluate(
    ([s, e]) => {
      const sc = window.__game.scene.getScene(s);
      const c = sc.children.list.find((o: { list?: { text?: string }[] }) => o.list?.some((x) => x.text?.includes(e)));
      c.emit("pointerup");
    },
    [scena, etichetta] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((lang) => {
    if (!localStorage.getItem("duello-dance-save")) localStorage.setItem("duello-dance-save", JSON.stringify({ introSeen: true, lang }));
  }, process.env.LANG_GIOCO ?? "it");
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
});

test("sezione irlandese", async ({ page }) => {
  test.setTimeout(240_000);
  await go(page, "riffMenu");
  await premi(page, "riffMenu", process.env.LANG_GIOCO === "en" ? "Ireland" : "Irlanda");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/01-menu-irlanda.png` });
  await go(page, "riff", { id: "irlanda-kesh", modo: "ascolta", tempo: 1 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/02-ascolta-kesh.png` });
  await go(page, "riff", { id: "irlanda-drowsy-maggie", modo: "concerto", tempo: 1 });
  await page.waitForTimeout(5200);
  await page.screenshot({ path: `${OUT}/03-concerto-drowsy-maggie.png` });
  await go(page, "riff", { id: "irlanda-minstrel-boy", modo: "ascolta", tempo: 1 });
  await page.waitForFunction(() => window.__game.scene.getScene("riff").finito === true, null, { timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/04-fine-ascolto.png` });
});
