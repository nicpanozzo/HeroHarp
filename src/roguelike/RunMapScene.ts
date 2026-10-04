import Phaser from "phaser";
import { enemyById } from "../content/areas";
import { onBeat } from "../scenes/beat";
import { C, HEX, W, H, txt, button, backdrop, panel, reducedMotion, portrait } from "../ui";
import { GROOVES } from "./data";
import { COLS, areaOf, reachable, savedRun, saveRun, type MapNode, type RunState } from "./run";
import { bigButton, gearIcon, hud, hudBottom, l, leaveRun, runGrooveOnGesture, s, spread, slot } from "./ui";

const MAP = { x0: 150, x1: 1130, lanes: [186, 324, 462] };
const colX = (c: number) => MAP.x0 + ((MAP.x1 - MAP.x0) * c) / (COLS - 1);

/** Come si dispone la mappa: dove sta ogni tappa, quanto è grande, quanto spazio ha intorno. */
interface MapLayout {
  at: (n: MapNode) => { x: number; y: number };
  /** Raggio di una tappa normale (il boss è più grande). */
  r: number;
  boss: number;
  label: number;
  /** Area cliccabile intorno a una tappa. */
  hit: (R: number) => { w: number; h: number };
}

const LANDSCAPE: MapLayout = {
  at: (n) => ({ x: colX(n.col), y: MAP.lanes[n.lane] }),
  r: 46,
  boss: 66,
  label: 17,
  hit: (R) => ({ w: 2 * R + 20, h: 2 * R + 20 }),
};

/** La mappa dell'atto: bivi da sinistra a destra, il boss in fondo (in verticale dal basso verso l'alto). */
export class RunMapScene extends Phaser.Scene {
  private run!: RunState;
  private lay: MapLayout = LANDSCAPE;

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
    if (portrait()) this.portraitFrame();
    else {
      this.lay = LANDSCAPE;
      // un velo scuro sotto la mappa: strade e nomi si leggono su qualunque sfondo
      this.add.rectangle(W / 2, 342, W - 64, 470, C.inchiostro, 0.5);
    }

    const open = new Set(reachable(run).map((n) => n.id));
    const visited = new Set(run.visited);
    // strade tra le tappe: quelle percorse in ottone, le possibili tratteggiate
    const g = this.add.graphics();
    for (const n of run.map)
      for (const id of n.next) {
        const m = run.map.find((x) => x.id === id)!;
        const done = visited.has(n.id) && visited.has(m.id);
        const next = n.id === run.pos && open.has(m.id);
        const a = this.lay.at(n);
        const b = this.lay.at(m);
        const [ax, ay, bx, by] = [a.x, a.y, b.x, b.y];
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

    if (portrait()) this.portraitDock();
    else {
      // in basso: la tua band (che senti suonare) e gli attrezzi; l'uscita lascia la notte salvata
      panel(this, 24, 590, W - 48, 110);
      txt(this, 48, 610, s("band").toUpperCase(), 16, HEX.inchiostro).setOrigin(0, 0.5).setLetterSpacing(2);
      if (run.band.length === 0) txt(this, 48, 652, s("footOnly"), 18, HEX.inchiostro).setOrigin(0, 0.5).setAlpha(0.7);
      run.band.forEach((id, i) => this.add.image(78 + i * 64, 658, `band-${id}-suona`).setDisplaySize(76, 76));
      txt(this, 420, 610, `${s("gear").toUpperCase()} · ${l(GROOVES[run.groove].name).toUpperCase()}`, 16, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setLetterSpacing(2);
      if (run.gear.length === 0) txt(this, 420, 652, l(GROOVES[run.groove].perk), 16, HEX.inchiostro).setOrigin(0, 0.5).setAlpha(0.7);
      run.gear.forEach((id, i) => gearIcon(this, id, 446 + i * 60, 656, 52));
      button(this, W - 130, 645, `‹ ${s("title2")}`, () => leaveRun(this, "title"), 180, false, 48).setName("run-exit");
      txt(this, W / 2, 560, s("pickNode"), 18, HEX.ottone).setStroke(HEX.inchiostro, 5);
    }

    // prima volta nell'atto: Zia Mae presenta la tappa (si impara anche di notte)
    if (run.introSeen < run.act) this.actIntro();
    else this.keyShortcut();
  }

  // ---------- in verticale: la strada sale dal basso (partenza) verso l'alto (boss) ----------

  /** Altezza del pannello in basso (band, attrezzi, uscita). */
  private static readonly DOCK = 218;

  private portraitFrame(): void {
    const top = hudBottom() + 14;
    const dockY = H - 16 - RunMapScene.DOCK;
    const bottom = dockY - 54;
    this.add.rectangle(W / 2, (top + bottom) / 2, W - 32, bottom - top, C.inchiostro, 0.5);
    // il boss ha bisogno di più spazio sopra; la partenza del nome sotto
    const padTop = 82;
    const padBottom = 76;
    const step = (bottom - top - padTop - padBottom) / (COLS - 1);
    const r = Phaser.Math.Clamp(Math.round(step * 0.33), 36, 54);
    const lanes = [150, 360, 570];
    this.lay = {
      at: (n) => ({ x: lanes[n.lane], y: bottom - padBottom - n.col * step }),
      r,
      boss: Math.round(r * 1.3),
      label: step >= 140 ? 20 : 17,
      hit: (R) => ({ w: Math.min(200, 2 * R + 70), h: Math.min(step, 2 * R + 50) }),
    };
    txt(this, W / 2, dockY - 28, s("pickNode"), 23, HEX.ottone).setStroke(HEX.inchiostro, 6);
  }

  private portraitDock(): void {
    const run = this.run;
    const y = H - 16 - RunMapScene.DOCK;
    panel(this, 16, y, W - 32, RunMapScene.DOCK);
    txt(this, 40, y + 26, s("band").toUpperCase(), 19, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    if (run.band.length === 0)
      txt(this, 40, y + 72, s("footOnly"), 21, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setAlpha(0.7);
    run.band.forEach((id, i) => this.add.image(76 + i * 68, y + 80, `band-${id}-suona`).setDisplaySize(80, 80));
    txt(this, 40, y + 138, `${s("gear").toUpperCase()} · ${l(GROOVES[run.groove].name).toUpperCase()}`, 19, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    if (run.gear.length === 0)
      txt(this, 40, y + 182, l(GROOVES[run.groove].perk), 20, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setAlpha(0.7)
        .setWordWrapWidth(640);
    run.gear.forEach((id, i) => gearIcon(this, id, 66 + i * 60, y + 184, 52));
    bigButton(this, W - 136, y + 62, `‹ ${s("title2")}`, () => leaveRun(this, "title"), 200, false, 74).setName("run-exit");
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
    const { x, y } = this.lay.at(n);
    const boss = n.kind === "boss";
    const R = boss ? this.lay.boss : this.lay.r;
    // i segni dentro la tappa crescono col raggio (in orizzontale restano quelli di sempre)
    const k = this.lay.r / 46;
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
    else parts.push(txt(this, 0, 2, n.kind === "shop" ? "$" : "?", Math.round(52 * k), HEX.inchiostro, "titoli"));
    if (n.kind === "elite") parts.push(txt(this, R - 8, -R + 8, "!", Math.round(30 * k), HEX.carta, "titoli").setStroke(HEX.rosso, 10));
    const label = boss ? enemyById(n.enemyId!).name : null;
    const name = label ? l(label) : s(n.kind);
    const size = boss ? this.lay.label + 2 : this.lay.label; // in orizzontale 17 e 19 come sempre
    const tag = txt(this, 0, R + (portrait() ? size + 2 : 18), name.toUpperCase(), size, HEX.carta)
      .setStroke(HEX.inchiostro, 5)
      .setWordWrapWidth(portrait() ? 206 : 170);
    // in verticale il nome del boss va accanto: sotto c'è la fila di tappe prima di lui
    if (portrait() && boss)
      tag
        .setPosition(R + 16, 0)
        .setOrigin(0, 0.5)
        .setAlign("left")
        .setWordWrapWidth(W / 2 - R - 50);
    parts.push(tag);
    const c = this.add.container(x, y, parts).setName(`node-${n.id}`);
    c.setAlpha(open || done ? 1 : 0.72);
    if (open) {
      const hit = this.lay.hit(R);
      c.setSize(hit.w, hit.h).setInteractive({ useHandCursor: true });
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
    const go = () => {
      run.introSeen = run.act;
      saveRun(run);
      layer.destroy();
      this.keyShortcut();
    };
    this.input.keyboard?.once("keydown-ENTER", go);
    const lines = [`${s("technique")}: ${l(area.technique)}`, `${s("goal")}: ${l(area.goal)}`, area.tips[0] ? `“${l(area.tips[0])}”` : ""].filter(Boolean);
    if (portrait()) return this.actIntroPortrait(layer, lines, go);
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
    layer.add(
      txt(this, x + 520, y + 230, lines.join("\n\n"), 19, HEX.inchiostro)
        .setWordWrapWidth(580)
        .setLineSpacing(4),
    );
    layer.add(button(this, x + 520, y + ph - 50, `${s("go")} ▶`, go, 280, true, 58).setName("act-go"));
  }

  /** La cartolina in verticale: Zia Mae in alto, poi la tappa, i consigli e un pulsante largo. */
  private actIntroPortrait(layer: Phaser.GameObjects.Container, lines: string[], go: () => void): void {
    const run = this.run;
    const area = areaOf(run);
    const pw = W - 48;
    const x = 24;
    const items: Phaser.GameObjects.GameObject[] = [];
    const act = txt(this, W / 2, 0, `${s("act", { n: run.act + 1 })} / 3`.toUpperCase(), 24, HEX.rosso).setLetterSpacing(3);
    const name = txt(this, W / 2, 0, l(area.name).toUpperCase(), 48, HEX.inchiostro, "titoli").setWordWrapWidth(pw - 60);
    const mae = this.add.image(W / 2, 0, "personaggi-zia-mae-spiega");
    const body = txt(this, W / 2, 0, lines.join("\n\n"), 24, HEX.inchiostro)
      .setWordWrapWidth(pw - 70)
      .setLineSpacing(5);
    const b = bigButton(this, W / 2, 0, `${s("go")} ▶`, go, 460, true, 92).setName("act-go");
    items.push(act, name, mae, body, b);
    // Zia Mae prende lo spazio che avanza (tra 180 e 300)
    const fixed = act.height + name.height + body.height + 92 + 4 * 24 + 80;
    const maeSize = Phaser.Math.Clamp(H - 80 - fixed, 180, 300);
    mae.setDisplaySize(maeSize, maeSize);
    const ph = Math.min(H - 60, fixed + maeSize + 4 * 16);
    const y = H / 2 - ph / 2;
    layer.add(panel(this, x, y, pw, ph));
    layer.add(items);
    spread([slot(act, act.height), slot(mae, maeSize), slot(name, name.height), slot(body, body.height), slot(b, 92)], y + 36, y + ph - 36, 40, 10);
  }
}
