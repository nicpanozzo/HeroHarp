import { test, expect } from "@playwright/test";
import { click, start, startBot } from "./helpers";

test("il microfono finto viene riconosciuto come foro 4 soffiato", async ({ page }) => {
  const errors = await start(page);
  await expect.poll(() => page.evaluate(() => window.__game.scene.getScene("journey").children.getByName("hearing").text)).toContain("4↑");
  expect(await page.evaluate(() => window.__engine().detector)).toBe("worklet");
  expect(errors).toEqual([]);
});

for (const enemy of ["draft", "silence"]) {
  test(`un giocatore perfetto batte ${enemy}`, async ({ page }) => {
    const errors = await start(page);
    await page.evaluate((e) => window.__game.scene.getScene("journey").scene.start("battle", { enemyId: e }), enemy);
    await page.waitForFunction(() => window.__game.scene.isActive("battle"));
    // diario degli eventi: se la prova fallisce si vede perché
    await page.evaluate(() => {
      const sc = window.__game.scene.getScene("battle");
      const handle = sc.handle.bind(sc);
      (window as any).__log = [];
      sc.handle = (ev: any) => {
        if (ev.type !== "responseHit") (window as any).__log.push(`${window.__engine().now.toFixed(2)} ${JSON.stringify(ev)}`);
        handle(ev);
      };
    });
    await startBot(page);
    await page.waitForFunction(() => window.__game.scene.isActive("result"), null, { timeout: 280_000 });
    const result = await page.evaluate(() => window.__game.scene.getScene("result").children.getByName("result").text);
    const log: string[] = await page.evaluate(() => (window as any).__log);
    expect(result, log.filter((l) => !l.includes('"parry"')).join("\n")).toMatch(/VITTORIA|VICTORY/);
    expect(errors).toEqual([]);
  });
}

test("le opzioni si salvano", async ({ page }) => {
  await start(page);
  await click(page, "journey", "options");
  await page.waitForFunction(() => window.__game.scene.isActive("options"));
  await click(page, "options", "opt-headphones");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("duello-dance-save")!).settings.headphones);
  expect(saved).toBe(true);
});

test("la calibrazione del ritardo misura e salva lo scarto", async ({ page }) => {
  await start(page);
  await click(page, "journey", "options");
  await click(page, "options", "opt-latency");
  await page.waitForFunction(() => window.__game.scene.isActive("latency"));
  await click(page, "latency", "lat-go");
  // un giocatore che suona sempre 120 ms dopo ogni colpo (la tastiera non ha ritardo proprio)
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene("latency");
    const pending = [...sc.clicks];
    (window as any).__offsets = [];
    const tick = () => {
      const now = window.__engine().now;
      if (pending.length && now >= pending[0] + 0.12) {
        // su una macchina lenta i frame arrivano in ritardo: si registra lo scarto vero
        (window as any).__offsets.push(now - pending.shift()!);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "4" }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "4" })), 150);
      }
      if (sc.sys.isActive()) requestAnimationFrame(tick);
    };
    tick();
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("duello-dance-save")!).settings?.latency != null, null, { timeout: 20_000 });
  const latency = await page.evaluate(() => JSON.parse(localStorage.getItem("duello-dance-save")!).settings.latency);
  const offsets: number[] = (await page.evaluate(() => (window as any).__offsets)).sort((a: number, b: number) => a - b);
  const median = (offsets[3] + offsets[4]) / 2;
  expect(latency).toBeGreaterThan(0.1);
  expect(Math.abs(latency - median)).toBeLessThan(0.03);
  expect(await page.evaluate(() => window.__engine().inputLatency)).toBe(latency);
});

test("la prima volta Zia Mae spiega il gioco e la tappa, poi si entra nel portico", async ({ page }) => {
  const errors = await start(page, false);
  await click(page, "journey", "mae-ok");
  // le lezioni della prima tappa, una pagina per tecnica
  for (let i = 0; i < 10 && !(await page.evaluate(() => window.__game.scene.isActive("map"))); i++) {
    await click(page, "journey", "mae-ok");
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.__game.scene.isActive("map"));
  const title = await page.evaluate(() => window.__game.scene.getScene("map").children.getByName("area-title").text);
  expect(title).toMatch(/PORTICO/);
  expect(errors).toEqual([]);
});

test("si gioca una tappa con accordi e una con i bend", async ({ page }) => {
  const errors = await start(page);
  for (const enemy of ["stoker", "crow"]) {
    await page.evaluate((e) => window.__game.scene.getScene("journey").scene.start("battle", { enemyId: e }), enemy);
    await page.waitForFunction(() => window.__game.scene.isActive("battle"));
    await page.waitForFunction(() => window.__game.scene.getScene("battle").battle.phase === "response", null, { timeout: 60_000 });
    await page.evaluate(() => window.__game.scene.getScene("battle").scene.start("journey"));
    await page.waitForFunction(() => window.__game.scene.isActive("journey"));
  }
  expect(errors).toEqual([]);
});

test("dopo la prima apertura il gioco funziona anche senza rete", async ({ page, context }) => {
  await page.goto("http://localhost:4173/");
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // ora la pagina passa dal service worker, che ha salvato tutto
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  const manifest = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute("href"));
  expect(manifest).toBe("manifest.webmanifest");
  await context.setOffline(false);
});
