import Phaser from "phaser";
import { areaById } from "../content/areas";
import { currentArea } from "../progress";
import { save } from "../state";
import { groove } from "../audio/music";
import { pulse } from "../scenes/beat";
import { C, HEX, W, H, txt, button, paper, panel } from "../ui";
import { meta, newRun, roads, savedRun, saveRun, type Road } from "./run";
import { l, leaveRun, s } from "./ui";

/** Partenza della Lunga Notte: riprendi la notte in corso o scegli da dove partire. */
export class RunStartScene extends Phaser.Scene {
  constructor() {
    super("runStart");
  }

  create(): void {
    paper(this);
    const here = currentArea({ beaten: save.beaten, openAll: save.settings.openAll });
    groove(here.music);
    const title = txt(this, W / 2, 84, s("title").toUpperCase(), 78, HEX.inchiostro, "titoli").setShadow(5, 4, HEX.indaco, 0, false, true);
    pulse(this, [title], 0.03);
    txt(this, W / 2, 146, s("tagline"), 21, HEX.inchiostro).setWordWrapWidth(900);
    const m = meta();
    if (m.nights) txt(this, W / 2, 178, `${s("nightNo", { n: m.nights + 1 })} · ${s("bestRun", { n: m.bestScore })} · ☀ ${m.dawns}`, 16, HEX.indaco);

    button(this, 92, 44, `‹ ${s("back")}`, () => leaveRun(this, "title"), 150, false, 44).setName("run-back");

    const saved = savedRun();
    const list = roads(here.id);
    const cardW = 330;
    const gap = 30;
    const y0 = saved ? 300 : 250;
    const x0 = W / 2 - ((list.length - 1) * (cardW + gap)) / 2;
    txt(this, W / 2, y0 - 50, s("pickRoad").toUpperCase(), 20, HEX.inchiostro).setLetterSpacing(3);
    list.forEach((r, i) => this.roadCard(r, x0 + i * (cardW + gap), y0, cardW));

    if (saved) {
      // la notte lasciata a metà: un tocco e si riprende
      const area = areaById(saved.acts[saved.act]);
      const go = () => this.scene.start("runMap");
      const b = button(this, W / 2, 196, `${s("continueRun")} ▶`, go, 420, true, 60).setName("run-continue");
      pulse(this, [b], 0.04);
      txt(this, W / 2, 236, `${s("act", { n: saved.act + 1 })} · ${l(area.name)} · ♥ ${saved.hp} · $ ${saved.coins}`, 16, HEX.inchiostro);
      this.input.keyboard?.once("keydown-ENTER", go);
    } else {
      const rec = list.find((r) => r.kind === "yourStop")!;
      this.input.keyboard?.once("keydown-ENTER", () => this.start(rec));
    }
    this.add.rectangle(W / 2, H - 40, W, 2, C.inchiostro, 0.3);
    txt(this, W / 2, H - 22, "1-0 ↑ · Q-P ↓", 17, HEX.inchiostro).setAlpha(0.7);
  }

  private start(r: Road): void {
    const run = newRun(r);
    saveRun(run);
    this.scene.start("runMap");
  }

  private roadCard(r: Road, x: number, y: number, w: number): void {
    const area = areaById(r.areaId);
    const h = 330;
    const rec = r.kind === "yourStop";
    panel(this, x - w / 2, y, w, h, rec ? 0xf6d9a0 : C.carta);
    // finestra sul luogo: lo sfondo della tappa
    if (area.backdrop) {
      const imgs = area.backdrop.map((k) => this.add.image(x, y + 92, k).setDisplaySize(w - 24, ((w - 24) * 9) / 16));
      const mask = this.make.graphics({}, false).fillRect(x - w / 2 + 12, y + 12, w - 24, 160);
      imgs.forEach((im) => im.setMask(mask.createGeometryMask()));
      this.add
        .graphics()
        .lineStyle(3, C.inchiostro, 1)
        .strokeRect(x - w / 2 + 12, y + 12, w - 24, 160);
    }
    txt(this, x, y + 196, s(r.kind).toUpperCase() + (rec ? ` · ${s("recommended")}` : ""), 15, rec ? HEX.rosso : HEX.inchiostro).setLetterSpacing(2);
    txt(this, x, y + 226, l(area.name).toUpperCase(), 24, HEX.inchiostro, "titoli").setWordWrapWidth(w - 20);
    txt(this, x, y + 262, l(area.technique), 17, HEX.indaco).setWordWrapWidth(w - 30);
    if (r.coinBonus > 1) txt(this, x, y + 296, s("coinsBonus", { n: r.coinBonus }), 16, HEX.inchiostro).setAlpha(0.8);
    const zone = this.add
      .zone(x, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true })
      .setName(`road-${r.kind}`);
    zone.on("pointerup", () => this.start(r));
  }
}
