import { type Page } from "@playwright/test";
import { GAME } from "./paths";

declare global {
  interface Window {
    __game: any;
    __engine: () => any;
  }
}

/** Clic su un oggetto della scena Phaser cercato per nome. */
export async function click(page: Page, scene: string, name: string) {
  const pos = await page.evaluate(
    ([s, n]) => {
      const g = window.__game;
      const sc = g.scene.getScene(s);
      // cerca anche dentro i contenitori (finestre di dialogo), l'ultimo aggiunto vince
      const find = (list: any[]): any => {
        for (const c of [...list].reverse()) {
          if (c.name === n && c.active) return c;
          const inner = c.list && find(c.list);
          if (inner) return inner;
        }
      };
      const o = find(sc.children.list);
      if (!o) throw new Error(`"${n}" non trovato nella scena ${s}`);
      const m = o.getWorldTransformMatrix ? o.getWorldTransformMatrix() : { tx: o.x, ty: o.y };
      const r = g.canvas.getBoundingClientRect();
      return { x: r.left + (m.tx * r.width) / g.config.width, y: r.top + (m.ty * r.height) / g.config.height };
    },
    [scene, name],
  );
  await page.mouse.click(pos.x, pos.y);
}

export async function start(page: Page, skipIntro = true) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Zia Mae ha già spiegato tutto: le prove partono dalla mappa del viaggio
  if (skipIntro)
    await page.addInitScript(() => {
      if (!localStorage.getItem("duello-dance-save"))
        localStorage.setItem(
          "duello-dance-save",
          JSON.stringify({
            introSeen: true,
            lessonsSeen: ["porch", "station", "freight-train", "juke-joint", "beale-street", "delta-crossroads", "riverboat", "chicago-club", "after-hours"],
          }),
        );
    });
  await page.goto(GAME);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "start");
  await page.waitForFunction(() => window.__game.scene.isActive("journey"));
  return errors;
}

/** Un giocatore automatico che suona con la tastiera le note giuste al momento giusto. */
export async function startBot(page: Page) {
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
      if (bt.phase === "volley") {
        // anche se i frame arrivano a scatti (CI lenta): si suona un po' prima e si tiene oltre il colpo
        const p = r.volley.find((x: any) => x.state === "pending" && now >= x.time - 0.15 && now <= x.time + 0.2);
        if (p && held !== key(p.tab)) {
          up();
          down(key(p.tab));
          releaseAt = p.time + 0.2;
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
