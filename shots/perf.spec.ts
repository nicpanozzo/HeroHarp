import { test } from "@playwright/test";
import { start, startBot } from "../e2e/helpers";

// Prestazioni come su un telefono economico: CPU rallentata 4 volte, schermo piccolo.
test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
test("fps in battaglia con CPU rallentata", async ({ page }) => {
  test.setTimeout(240_000);
  await start(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE ?? 4) });
  const out: string[] = [];
  for (const enemy of ["porter", "drummer", "midnight-whistle"]) {
    await page.evaluate((e) => window.__game.scene.getScenes(true)[0].scene.start("battle", { enemyId: e }), enemy);
    await page.waitForFunction(() => window.__game.scene.isActive("battle"));
    await startBot(page);
    await page.waitForFunction(() => window.__game.scene.getScene("battle").battle.phase === "volley", null, { timeout: 120_000 });
    const fps = await page.evaluate(
      () =>
        new Promise<number[]>((ok) => {
          const s: number[] = [];
          let last = performance.now();
          const tick = (t: number) => {
            s.push(1000 / (t - last));
            last = t;
            if (s.length < 180) requestAnimationFrame(tick);
            else ok(s);
          };
          requestAnimationFrame(tick);
        }),
    );
    fps.sort((a, b) => a - b);
    out.push(`${enemy}: mediana ${fps[90].toFixed(0)} fps, peggior 5% ${fps[9].toFixed(0)} fps`);
  }
  console.log(out.join("\n"));
});
