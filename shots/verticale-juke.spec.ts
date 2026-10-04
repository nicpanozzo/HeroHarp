import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Schermate del Juke Joint sul telefono tenuto dritto, anche a metà partita e nelle schermate finali.
// Uso: npm run build && npx playwright test -c playwright.shots.config.ts verticale-juke
// VW/VH = finestra (predefinita 390×844, prova anche 360×640 o 1280×720) · SHOTS = cartella · SOLO=hub,jam,...
const VW = Number(process.env.VW ?? 390);
const VH = Number(process.env.VH ?? 844);
const OUT = resolve(process.env.SHOTS ?? `test-results/verticale-juke-${VW}x${VH}`);
mkdirSync(OUT, { recursive: true });
test.use({ viewport: { width: VW, height: VH }, deviceScaleFactor: VW > VH ? 1 : 2, hasTouch: true });
const SOLO = process.env.SOLO?.split(",");
const want = (name: string) => !SOLO || SOLO.some((s) => name.includes(s));

const active = (page: Page, s: string) => page.waitForFunction((n) => window.__game.scene.isActive(n), s, { timeout: 30_000 });
async function shot(page: Page, name: string, wait = 700) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function go(page: Page, key: string, data: object = {}) {
  await page.evaluate(([k, d]) => window.__game.scene.getScenes(true)[0].scene.start(k, d), [key, data] as const);
  await active(page, key);
}
/** Suona dalla tastiera: "1"-"0" soffio, "q"-"p" aspirato. */
async function suona(page: Page, tasti: string, ms = 260) {
  for (const k of tasti) {
    await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    await page.keyboard.up(k);
    await page.waitForTimeout(60);
  }
}

/** Una frase già suonata (e, nello scambio, quella di Zia Mae che arriva), con il pubblico caldo. */
async function nastri(page: Page, mae = false) {
  await page.evaluate((conMae) => {
    const s = window.__game.scene.getScene("jam");
    const ora = s.ascolto.ora;
    const base = 60; // armonica in Do: 7 = 2↓, 11 = 3↓, 12 = 4↑, 14 = 4↓, 16 = 5↑, 17 = 5↓, 19 = 6↑
    const frase: [number, number][] = [
      [12, 0.5],
      [14, 0.4],
      [17, 0.9],
      [16, 0.3],
      [14, 0.6],
      [12, 0.4],
      [11, 0.5],
      [10.5, 0.7],
      [7, 0.6],
    ];
    let t = ora - 6;
    for (const [d, dur] of frase) {
      for (let k = 0; k * 0.04 < dur; k++) {
        const m = base + d + (d === 10.5 ? 0.5 - k * 0.06 : 0);
        s.aggiornaNastro(t + k * 0.04, Math.round(m), m);
      }
      t += dur;
      s.aggiornaNastro(t, null, null);
      t += 0.15;
    }
    s.giudice.hype = 66;
    if (!conMae) return;
    for (const [i, d] of [7, 11, 12, 14].entries()) {
      const t0 = ora - 1.6 + i * 0.5,
        m = base + d;
      s.nastri.push({
        punti: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ t: t0 + k * 0.05, m })),
        colore: 0xf1e4c8,
        etichetta: ["2↓", "3↓", "4↑", "4↓"][i],
        inizio: t0,
        fine: t0 + 0.4,
        mae: true,
      });
    }
  }, mae);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("duello-dance-save")) localStorage.setItem("duello-dance-save", JSON.stringify({ introSeen: true }));
  });
  await page.goto("file://" + resolve("dist/index.html"));
  await active(page, "title");
});

test("juke joint in verticale", async ({ page }) => {
  test.setTimeout(480_000);
  if (want("hub")) {
    await go(page, "hub");
    await shot(page, "01-hub", 900);
  }
  if (want("menu")) {
    for (const m of ["jamMenu", "riffMenu", "voloMenu"]) {
      await go(page, m);
      await shot(page, `02-${m}`, 600);
    }
  }
  if (want("jam")) {
    await go(page, "jam", { modo: process.env.SCAMBIO ? "scambio" : "assolo", bpm: 88, giri: 2, registra: false });
    await page.waitForTimeout(1500);
    // il browser di prova va a pochi fotogrammi al secondo: i nastri si costruiscono direttamente
    await nastri(page);
    await page.keyboard.down("t");
    await shot(page, "03-jam", 400);
    await page.keyboard.up("t");
  }
  if (want("scambio")) {
    await go(page, "jam", { modo: "scambio", bpm: 108, giri: 2, registra: false });
    await page.waitForTimeout(1500);
    await nastri(page, true);
    await shot(page, "03-jam-scambio", 900);
  }
  if (want("riff")) {
    await go(page, "riff", { id: "shuffle-12", modo: "concerto", tempo: 1 });
    await shot(page, "04-riff", 4300);
  }
  if (want("volo")) {
    await go(page, "volo", { id: "primo-volo" });
    await page.waitForTimeout(1500);
    await suona(page, "456", 600);
    await page.keyboard.down("t");
    await shot(page, "05-volo", 400);
    await page.keyboard.up("t");
    await page.evaluate(() => window.__game.scene.getScene("volo").chiudi());
    await shot(page, "05-volo-fine", 2500);
  }
  if (want("fine")) {
    const storico = Array.from({ length: 40 }, (_, i) => ({
      punti: Array.from({ length: 8 }, (_, k) => ({ t: 1 + i * 0.9 + k * 0.08, m: 60 + ((i * 5) % 19) + (k > 5 ? -1 : 0) })),
      colore: [0xe8a33d, 0x6b8fd6, 0x9b5fc0][i % 3],
      mae: false,
    }));
    await go(page, "jamFine", {
      punti: 1234,
      hypeMax: 87,
      nuovoRecord: true,
      frasi: 14,
      bend: 6,
      note: 120,
      cambi: 5,
      cambiTotali: 8,
      lick: ["boogie"],
      nuoviLick: [],
      storico,
      durata: 40,
      inizio: 1,
      audio: "data:audio/webm;base64,",
      estensione: "webm",
      opzioni: { modo: "assolo", bpm: 88, giri: 2, registra: true },
    });
    await shot(page, "06-jamFine", 4000);
    await go(page, "riffFine", {
      opzioni: { id: "shuffle-12", modo: "concerto", tempo: 1 },
      nome: { it: "Shuffle a 12 battute", en: "12-bar shuffle" },
      punti: 4321,
      stelle: 2,
      precisione: 0.82,
      comboMax: 37,
      conteggio: { perfetto: 30, bene: 12, mancata: 6 },
      nuovo: true,
    });
    await shot(page, "07-riffFine", 2500);
  }
});
