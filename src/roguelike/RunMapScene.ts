import Phaser from "phaser";
import { enemyById } from "../content/areas";
import { onBeat } from "../scenes/beat";
import { C, HEX, W, H, txt, button, backdrop, panel, reducedMotion } from "../ui";
import { GROOVES } from "./data";
import { COLS, areaOf, reachable, savedRun, saveRun, type MapNode, type RunState } from "./run";
import { gearIcon, hud, l, leaveRun, runGrooveOnGesture, s } from "./ui";

const MAP = { x0: 150, x1: 1130, lanes: [186, 324, 462] };
const colX = (c: number) => MAP.x0 + ((MAP.x1 - MAP.x0) * c) / (COLS - 1);

/** La mappa dell'atto: bivi da sinistra a destra, il boss in fondo. */
export class RunMapScene extends Phaser.Scene {
  private run!: RunState;

  constructor() {
    super("runMap");
  }

  create(): void {
    const run = savedRun();
    if (!run) return void this.scene.start("runStart");
    this.run = run;
    const area = areaOf(run);
    backdrop(this, area.backdrop, 0.35);
    runGrooveOnGesture(this, run);
    hud(this, run);
    // un velo scuro sotto la mappa: strade e nomi si leggono su qualunque sfondo
    this.add.rectangle(W / 2, 342, W - 64, 470, C.inchiostro, 0.5);

    const open = new Set(reachable(run).map((n) => n.id));
    const visited = new Set(run.visited);
    // strade tra le tappe: quelle percorse in ottone, le possibili tratteggiate
    const g = this.add.graphics();
    for (const n of run.map)
      for (const id of n.next) {
        const m = run.map.find((x) => x.id === id)!;
        const done = visited.has(n.id) && visited.has(m.id);
        const next = n.id === run.pos && open.has(m.id);
        const [ax, ay, bx, by] = [colX(n.col), MAP.lanes[n.lane], colX(m.col), MAP.lanes[m.lane]];
        if (done || next) g.lineStyle(done ? 10 : 6, done ? C.ottone : C.carta, 1).lineBetween(ax, ay, bx, by);
        else this.dashed(g, ax, ay, bx, by);
      }
    const pulsing: Phaser.GameObjects.Container[] = [];
    for (const n of run.map) {
      const c = this.node(n, open.has(n.id), visited.has(n.id));
      if (open.has(n.id)) pulsing.push(c);
    }
    // le tappe raggiungibili ballano a tempo
    if (!reducedMotion())
      onBeat(this, () =>
        pulsing.forEach((c) => c.active && this.tweens.add({ targets: c, scale: { from: 1.12, to: 1 }, duration: 200, ease: "Quad.easeOut" })),
      );

    // in basso: la tua band (che senti suonare) e gli attrezzi; l'uscita lascia la notte salvata
    panel(this, 24, 590, W - 48, 110);
    txt(this, 48, 610, s("band").toUpperCase(), 14, HEX.inchiostro).setOrigin(0, 0.5).setLetterSpacing(2);
    if (run.band.length === 0) txt(this, 48, 652, s("footOnly"), 18, HEX.inchiostro).setOrigin(0, 0.5).setAlpha(0.7);
    run.band.forEach((id, i) => this.add.image(78 + i * 64, 658, `band-${id}-suona`).setDisplaySize(76, 76));
    txt(this, 420, 610, `${s("gear").toUpperCase()} · ${l(GROOVES[run.groove].name).toUpperCase()}`, 14, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    if (run.gear.length === 0) txt(this, 420, 652, l(GROOVES[run.groove].perk), 16, HEX.inchiostro).setOrigin(0, 0.5).setAlpha(0.7);
    run.gear.forEach((id, i) => gearIcon(this, id, 446 + i * 60, 656, 52));
    button(this, W - 130, 645, `‹ ${s("title2")}`, () => leaveRun(this, "title"), 180, false, 48).setName("run-exit");
    txt(this, W / 2, 560, s("pickNode"), 18, HEX.ottone).setStroke(HEX.inchiostro, 5);

    // prima volta nell'atto: Zia Mae presenta la tappa (si impara anche di notte)
    if (run.introSeen < run.act) this.actIntro();
    else this.keyShortcut();
  }

  private keyShortcut(): void {
    // Invio = la prima tappa raggiungibile, per giocare senza toccare lo schermo
    this.input.keyboard?.once("keydown-ENTER", () => {
      const n = reachable(this.run)[0];
      if (n) this.enter(n);
    });
  }

  private dashed(g: Phaser.GameObjects.Graphics, ax: number, ay: number, bx: number, by: number): void {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.floor(len / 18);
    g.lineStyle(4, C.carta, 0.45);
    for (let i = 0; i < steps; i += 2) {
      const t0 = i / steps;
      const t1 = Math.min(1, (i + 1) / steps);
      g.lineBetween(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1);
    }
  }

  private node(n: MapNode, open: boolean, done: boolean): Phaser.GameObjects.Container {
    const x = colX(n.col);
    const y = MAP.lanes[n.lane];
    const boss = n.kind === "boss";
    const R = boss ? 66 : 46;
    const g = this.add.graphics();
    const ring = n.kind === "elite" || boss ? C.rosso : open ? C.ottone : C.inchiostro;
    g.fillStyle(C.inchiostro, 1).fillCircle(5, 5, R);
    g.fillStyle(done ? 0x8c8577 : n.kind === "shop" ? 0xf6d9a0 : n.kind === "rest" ? 0xd9e7c4 : n.kind === "event" ? 0xd8cdea : C.carta, 1).fillCircle(0, 0, R);
    g.lineStyle(open ? 7 : 4, ring, 1).strokeCircle(0, 0, R);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    if (n.enemyId) {
      const e = enemyById(n.enemyId);
      parts.push(this.add.image(0, 2, `nemici-${e.sprite}-${done ? "sconfitto" : "idle"}`).setDisplaySize(R * 1.8, R * 1.8));
    } else if (n.kind === "rest") parts.push(this.add.image(0, 6, "personaggi-zia-mae-sorride").setDisplaySize(R * 1.9, R * 1.9));
    else parts.push(txt(this, 0, 2, n.kind === "shop" ? "$" : "?", 52, HEX.inchiostro, "titoli"));
    if (n.kind === "elite") parts.push(txt(this, R - 8, -R + 8, "!", 30, HEX.carta, "titoli").setStroke(HEX.rosso, 10));
    const label = boss ? enemyById(n.enemyId!).name : null;
    const name = label ? l(label) : s(n.kind);
    parts.push(
      txt(this, 0, R + 18, name.toUpperCase(), boss ? 17 : 14, HEX.carta)
        .setStroke(HEX.inchiostro, 5)
        .setWordWrapWidth(170),
    );
    const c = this.add.container(x, y, parts).setName(`node-${n.id}`);
    c.setAlpha(open || done ? 1 : 0.72);
    if (open) {
      c.setSize(2 * R + 20, 2 * R + 20).setInteractive({ useHandCursor: true });
      c.on("pointerup", () => this.enter(n));
    }
    return c;
  }

  private enter(n: MapNode): void {
    if (n.kind === "fight" || n.kind === "elite" || n.kind === "boss") this.scene.start("runBattle", { nodeId: n.id });
    else this.scene.start("runStop", { mode: n.kind, nodeId: n.id });
  }

  /** Cartolina dell'atto: tappa, tecnica, obiettivo e un consiglio di Zia Mae. */
  private actIntro(): void {
    const run = this.run;
    const area = areaOf(run);
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, C.inchiostro, 0.6).setInteractive());
    const pw = 860;
    const ph = 440;
    const x = W / 2 - pw / 2;
    const y = H / 2 - ph / 2;
    const p = this.add.graphics();
    p.fillStyle(C.inchiostro, 1).fillRect(x + 8, y + 8, pw, ph);
    p.fillStyle(C.carta, 1).fillRect(x, y, pw, ph);
    p.lineStyle(4, C.inchiostro, 1).strokeRect(x, y, pw, ph);
    layer.add(p);
    layer.add(this.add.image(x + 140, y + ph - 150, "personaggi-zia-mae-spiega").setDisplaySize(250, 250));
    layer.add(txt(this, x + 520, y + 50, `${s("act", { n: run.act + 1 })} / 3`.toUpperCase(), 20, HEX.rosso).setLetterSpacing(3));
    layer.add(txt(this, x + 520, y + 98, l(area.name).toUpperCase(), 40, HEX.inchiostro, "titoli").setWordWrapWidth(560));
    const lines = [`${s("technique")}: ${l(area.technique)}`, `${s("goal")}: ${l(area.goal)}`, area.tips[0] ? `“${l(area.tips[0])}”` : ""].filter(Boolean);
    layer.add(
      txt(this, x + 520, y + 230, lines.join("\n\n"), 19, HEX.inchiostro)
        .setWordWrapWidth(580)
        .setLineSpacing(4),
    );
    const go = () => {
      run.introSeen = run.act;
      saveRun(run);
      layer.destroy();
      this.keyShortcut();
    };
    layer.add(button(this, x + 520, y + ph - 50, `${s("go")} ▶`, go, 280, true, 58).setName("act-go"));
    this.input.keyboard?.once("keydown-ENTER", go);
  }
}
