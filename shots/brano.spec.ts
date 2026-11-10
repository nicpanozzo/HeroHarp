import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Schermate di "Impara un brano": locandina nel Juke Joint, libreria, mappa delle frasi, ascolta, tocca a te, esito.
// Uso: npm run build && npx playwright test -c playwright.shots.config.ts brano
// VW/VH = finestra (predefinita 390×844; 1280×720 per il computer) · SHOTS = cartella
const VW = Number(process.env.VW ?? 390);
const VH = Number(process.env.VH ?? 844);
const OUT = resolve(process.env.SHOTS ?? `test-results/brano-${VW}x${VH}`);
mkdirSync(OUT, { recursive: true });
test.use({ viewport: { width: VW, height: VH }, deviceScaleFactor: VW > VH ? 1 : 2, hasTouch: true });

const active = (page: Page, s: string) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout: 60_000 });
async function go(page: Page, key: string, data: object = {}) {
  await page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
  await active(page, key);
}
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
const fase = (page: Page, f: string) => page.waitForFunction((x) => window.__game.scene.getScene("brano")?.fase === x, f, { timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("duello-dance-save")) localStorage.setItem("duello-dance-save", JSON.stringify({ introSeen: true, lang: "it" }));
    localStorage.setItem(
      "heroharp-brani-progressi",
      JSON.stringify({ "demo-slow-blues": { tonalita: "C", stelle: { "0-0": 3, "1-1": 2 }, meglio: {}, velocita: 1 } }),
    );
  });
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
});

test("impara un brano", async ({ page }) => {
  test.setTimeout(240_000);
  const shot = async (n: string, ms = 700) => {
    await page.waitForTimeout(ms);
    await page.screenshot({ path: `${OUT}/${n}.png` });
  };
  await go(page, "hub");
  await shot("01-juke-joint");
  await go(page, "branoMenu");
  await shot("02-libreria", 900);
  await premi(page, "branoMenu", "Slow blues di prova");
  await page.waitForFunction(() => window.__game.scene.getScene("branoMenu").vista === "mappa", null, { timeout: 60_000 });
  await shot("03-mappa", 900);
  await go(page, "brano", { da: 2, a: 2 });
  await fase(page, "ascolta");
  await shot("04-ascolta", 3600);
  await fase(page, "tocca");
  // si suona con la tastiera qualche nota della frase (4↑ = tasto 4, 4↓ = R, 3↓ = E, 5↑ = 5, 5↓ = T)
  for (const k of ["4", "5", "t", "r", "4", "e", "4"]) {
    await page.keyboard.down(k);
    await page.waitForTimeout(380);
    await page.keyboard.up(k);
  }
  await shot("05-tocca-a-te", 200);
  await fase(page, "esito");
  await shot("06-esito", 900);
});
