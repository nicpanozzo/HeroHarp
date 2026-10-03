import { test, expect } from "@playwright/test";
import { click, start, startBot } from "./helpers";

test("il microfono finto viene riconosciuto come foro 4 soffiato", async ({ page }) => {
  const errors = await start(page);
  await expect.poll(() => page.evaluate(() => window.__game.scene.getScene("map").children.getByName("hearing").text)).toContain("4↑");
  expect(errors).toEqual([]);
});

for (const enemy of ["draft", "silence"]) {
  test(`un giocatore perfetto batte ${enemy}`, async ({ page }) => {
    const errors = await start(page);
    await page.evaluate((e) => window.__game.scene.getScene("map").scene.start("battle", { enemyId: e }), enemy);
    await page.waitForFunction(() => window.__game.scene.isActive("battle"));
    await startBot(page);
    await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 280_000 });
    const result = await page.evaluate(() => window.__game.scene.getScene("result").children.getByName("result").text);
    expect(result).toMatch(/VITTORIA|VICTORY/);
    expect(errors).toEqual([]);
  });
}

test("le opzioni si salvano", async ({ page }) => {
  await start(page);
  await click(page, "map", "mae-ok"); // la prima volta Zia Mae spiega il gioco
  await click(page, "map", "options");
  await page.waitForFunction(() => window.__game.scene.isActive("options"));
  await click(page, "options", "opt-headphones");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("duello-dance-save")!).settings.headphones);
  expect(saved).toBe(true);
});

test("la calibrazione del ritardo misura e salva lo scarto", async ({ page }) => {
  await start(page);
  await click(page, "map", "mae-ok");
  await click(page, "map", "options");
  await click(page, "options", "opt-latency");
  await page.waitForFunction(() => window.__game.scene.isActive("latency"));
  await click(page, "latency", "lat-go");
  // un giocatore che suona sempre 120 ms dopo ogni colpo (la tastiera non ha ritardo proprio)
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene("latency");
    const pending = [...sc.clicks];
    const tick = () => {
      const now = window.__engine().now;
      if (pending.length && now >= pending[0] + 0.12) {
        pending.shift();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "4" }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "4" })), 150);
      }
      if (sc.sys.isActive()) requestAnimationFrame(tick);
    };
    tick();
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("duello-dance-save")!).settings.latency !== null, null, { timeout: 20_000 });
  const latency = await page.evaluate(() => JSON.parse(localStorage.getItem("duello-dance-save")!).settings.latency);
  expect(latency).toBeGreaterThan(0.1);
  expect(latency).toBeLessThan(0.17);
  expect(await page.evaluate(() => window.__engine().inputLatency)).toBe(latency);
});
