import { test, expect, type Page } from "@playwright/test";
import { GAME } from "./paths";

declare global {
  interface Window {
    __game: any;
    __engine: () => any;
  }
}

/** Clic su un oggetto della scena Phaser cercato per nome. */
async function click(page: Page, scene: string, name: string) {
  const pos = await page.evaluate(
    ([s, n]) => {
      const g = window.__game;
      const sc = g.scene.getScene(s);
      const o = sc.children.getByName(n) ?? sc.children.list.flatMap((c: any) => c.list ?? []).find((c: any) => c.name === n);
      const r = g.canvas.getBoundingClientRect();
      return { x: r.left + (o.x * r.width) / g.config.width, y: r.top + (o.y * r.height) / g.config.height };
    },
    [scene, name],
  );
  await page.mouse.click(pos.x, pos.y);
}

async function start(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "start");
  await page.waitForFunction(() => window.__game.scene.isActive("map"));
  return errors;
}

/** Un giocatore automatico che suona con la tastiera le note giuste al momento giusto. */
async function startBot(page: Page) {
  await page.evaluate(() => {
    const K = { b: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], d: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] };
    const key = (t: any) => (t.draw ? K.d : K.b)[t.hole - 1];
    let held: string | null = null;
    let releaseAt = 0;
    const down = (k: string) => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
      held = k;
    };
    const up = () => {
      if (held) window.dispatchEvent(new KeyboardEvent("keyup", { key: held }));
      held = null;
    };
    const tick = () => {
      const sc = window.__game.scene.getScene("battle");
      if (!sc.sys.isActive()) return up();
      const bt = sc.battle,
        now = window.__engine().now,
        r = bt.round;
      if (held && now >= releaseAt) up();
      if (!held && bt.phase === "response") {
        const n = r.response.find((x: any) => !x.hit);
        if (n && now >= n.time - 0.01) {
          down(key(n.tab));
          releaseAt = now + Math.max(0.15, n.dur * 0.8);
        }
      }
      if (!held && bt.phase === "volley") {
        const p = r.volley.find((x: any) => x.state === "pending" && Math.abs(now - x.time) < 0.12);
        if (p) {
          down(key(p.tab));
          releaseAt = now + 0.2;
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

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
