import { test, expect } from "@playwright/test";
import { click, start, startBot } from "./helpers";
import { GAME } from "./paths";

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

test("Gioca porta in un tocco alla battaglia contro il primo nemico", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "start");
  await page.waitForFunction(() => window.__game.scene.isActive("battle"));
  expect(await page.evaluate(() => window.__game.scene.getScene("battle").enemy.id)).toBe("draft");
  expect(errors).toEqual([]);
});

test("la base suona dal primo tocco e non si ferma entrando in battaglia", async ({ page }) => {
  const errors = await start(page);
  await page.waitForFunction(() => window.__engine().basi.inRiproduzione);
  // conta le ripartenze: entrando in battaglia nella stessa tappa non ce ne devono essere
  await page.evaluate(() => {
    const b = window.__engine().basi;
    const avvia = b.avvia.bind(b);
    (window as any).__restarts = 0;
    b.avvia = (...a: any[]) => ((window as any).__restarts++, avvia(...a));
  });
  await click(page, "journey", "play");
  await page.waitForFunction(() => window.__game.scene.isActive("battle"));
  expect(await page.evaluate(() => window.__engine().basi.inRiproduzione)).toBe(true);
  expect(await page.evaluate(() => (window as any).__restarts)).toBe(0);
  await page.evaluate(() => window.__game.scene.getScene("battle").scene.start("map", { areaId: "porch" }));
  await page.waitForFunction(() => window.__game.scene.isActive("map"));
  expect(await page.evaluate(() => window.__engine().basi.inRiproduzione)).toBe(true);
  expect(errors).toEqual([]);
});

test("si gioca una tappa con accordi e una con i bend", async ({ page }) => {
  const errors = await start(page);
  for (const enemy of ["stoker", "crow", "drummer", "midnight-whistle"]) {
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

test("dal titolo si entra nel Juke Joint, si aprono le tre modalità e si torna al titolo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "to-juke");
  await page.waitForFunction(() => window.__game.scene.isActive("hub"));
  // le modalità sono a 960×540: la camera le porta a tutto schermo
  expect(await page.evaluate(() => window.__game.scene.getScene("hub").cameras.main.zoom)).toBeCloseTo(4 / 3);
  for (const mode of ["riff", "volo", "jam"]) {
    await page.evaluate((m) => window.__game.scene.getScene("hub").scene.start(m === "jam" ? "jamMenu" : `${m}Menu`), mode);
    await page.waitForFunction((m) => window.__game.scene.isActive(`${m}Menu`), mode);
    await page.evaluate((m) => window.__game.scene.getScene(`${m}Menu`).scene.start("hub"), mode);
    await page.waitForFunction(() => window.__game.scene.isActive("hub"));
  }
  await page.waitForTimeout(400);
  await click(page, "hub", "hub-back");
  await page.waitForFunction(() => window.__game.scene.isActive("title"));
  expect(errors).toEqual([]);
});

test("il Dojo mostra il foro che senti dal microfono", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "to-dojo");
  await page.waitForFunction(() => window.__game.scene.isActive("dojo"));
  // il microfono finto suona un Do: 4 soffiato
  await page.waitForFunction(() => window.__game.scene.getScene("dojo").children.getByName("dojo-tab")?.text === "4↑", null, { timeout: 15_000 });
  await click(page, "dojo", "dojo-back");
  await page.waitForFunction(() => window.__game.scene.isActive("title"));
  expect(errors).toEqual([]);
});

test("il salvataggio si esporta in un file e si reimporta", async ({ page }, info) => {
  const errors = await start(page);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("duello-dance-save")!);
    raw.beaten = ["draft", "sigh"];
    localStorage.setItem("duello-dance-save", JSON.stringify(raw));
    localStorage.setItem("heroharp-lunga-notte", JSON.stringify({ prova: 7 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "options");
  await page.waitForFunction(() => window.__game.scene.isActive("options"));
  const download = page.waitForEvent("download");
  await click(page, "options", "opt-export");
  const file = info.outputPath("salvataggio.json");
  await (await download).saveAs(file);
  // un altro dispositivo: niente progressi
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "options");
  await page.waitForFunction(() => window.__game.scene.isActive("options"));
  const chooser = page.waitForEvent("filechooser");
  await click(page, "options", "opt-import");
  // l'importazione ricarica la pagina: si aspetta il salvataggio, non la scena (il titolo è già attivo prima)
  await Promise.all([page.waitForEvent("load"), (await chooser).setFiles(file)]);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("duello-dance-save")!).beaten)).toEqual(["draft", "sigh"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("heroharp-lunga-notte")!))).toEqual({ prova: 7 });
  expect(errors).toEqual([]);
});

test("al primo avvio la prima nota arriva in meno di 30 secondi", async ({ page }) => {
  const t0 = Date.now();
  await page.goto(GAME);
  await page.waitForFunction(() => window.__game?.scene.isActive("title"));
  await click(page, "title", "start");
  await page.waitForFunction(() => window.__game.scene.isActive("battle"));
  // la prima nota del nemico: da lì in poi stai già suonando
  await page.waitForFunction(() => {
    const b = window.__game.scene.getScene("battle").battle;
    return b && window.__engine().now >= b.round.callStart;
  });
  const seconds = (Date.now() - t0) / 1000;
  console.log(`prima nota dopo ${seconds.toFixed(1)} s`);
  expect(seconds).toBeLessThan(30);
});
