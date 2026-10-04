import Phaser from "phaser";
import { areaById } from "../content/areas";
import { currentArea } from "../progress";
import { save } from "../state";
import { groove } from "../audio/music";
import { pulse } from "../scenes/beat";
import { C, HEX, W, H, txt, button, paper, panel, portrait, backdrop } from "../ui";
import { meta, newRun, roads, savedRun, saveRun, type Road } from "./run";
import { bigButton, l, leaveRun, s, slot, spread, type Slot } from "./ui";

/** Partenza della Lunga Notte: riprendi la notte in corso o scegli da dove partire. */
export class RunStartScene extends Phaser.Scene {
  constructor() {
    super("runStart");
  }

  create(): void {
    paper(this);
    const here = currentArea({ beaten: save.beaten, openAll: save.settings.openAll });
    groove(here.music);
    if (portrait()) return this.createPortrait(here.id);
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

  /** In verticale: titolo grande, la notte da riprendere e le strade una sotto l'altra, larghe quanto lo schermo. */
  private createPortrait(hereId: string): void {
    bigButton(this, 102, 60, `‹ ${s("back")}`, () => leaveRun(this, "title"), 172, false, 70).setName("run-back");
    const title = txt(this, W / 2, 0, s("title").toUpperCase(), 88, HEX.inchiostro, "titoli")
      .setShadow(5, 4, HEX.indaco, 0, false, true)
      .setWordWrapWidth(640)
      .setLineSpacing(-8);
    pulse(this, [title], 0.03);
    const slots: Slot[] = [slot(title, title.height)];
    const tagline = txt(this, W / 2, 0, s("tagline"), 24, HEX.inchiostro)
      .setWordWrapWidth(620)
      .setLineSpacing(4);
    slots.push(slot(tagline, tagline.height));
    const m = meta();
    if (m.nights) {
      const t = txt(this, W / 2, 0, `${s("nightNo", { n: m.nights + 1 })} · ${s("bestRun", { n: m.bestScore })} · ☀ ${m.dawns}`, 21, HEX.indaco);
      slots.push(slot(t, t.height));
    }
    const saved = savedRun();
    const list = roads(hereId);
    if (saved) {
      // la notte lasciata a metà: un tocco e si riprende
      const area = areaById(saved.acts[saved.act]);
      const go = () => this.scene.start("runMap");
      const b = bigButton(this, W / 2, 0, `${s("continueRun")} ▶`, go, 620, true, 92).setName("run-continue");
      pulse(this, [b], 0.04);
      const info = txt(this, W / 2, 0, `${s("act", { n: saved.act + 1 })} · ${l(area.name)} · ♥ ${saved.hp} · $ ${saved.coins}`, 21, HEX.inchiostro);
      slots.push({
        h: 92 + 44,
        at: (y) => {
          b.setY(y - 22);
          info.setY(y + 46);
        },
      });
      this.input.keyboard?.once("keydown-ENTER", go);
    } else {
      const rec = list.find((r) => r.kind === "yourStop")!;
      this.input.keyboard?.once("keydown-ENTER", () => this.start(rec));
    }
    const pick = txt(this, W / 2, 0, s("pickRoad").toUpperCase(), 23, HEX.inchiostro).setLetterSpacing(3);
    slots.push(slot(pick, 30));
    // le carte delle strade prendono lo spazio che resta (tra 180 e 250 di altezza)
    const top = 116;
    const bottom = H - 40;
    const fixed = slots.reduce((a, x) => a + x.h, 0) + 22 * (slots.length + list.length - 1);
    const ch = Phaser.Math.Clamp(Math.floor((bottom - top - fixed) / list.length), 180, 250);
    list.forEach((r) => slots.push({ h: ch, at: (y) => this.roadRow(r, y, ch) }));
    spread(slots, top, bottom, 56, 14);
  }

  /** Strada in verticale: finestra sul luogo a sinistra, nome e tecnica a destra. */
  private roadRow(r: Road, y: number, h: number): void {
    const area = areaById(r.areaId);
    const w = 660;
    const x0 = W / 2 - w / 2;
    const rec = r.kind === "yourStop";
    panel(this, x0, y - h / 2, w, h, rec ? 0xf6d9a0 : C.carta);
    const iw = Math.min(250, Math.round((h - 24) * 1.2));
    if (area.backdrop) {
      backdrop(this, area.backdrop, 0, { x: x0 + 12, y: y - h / 2 + 12, w: iw, h: h - 24 });
      this.add
        .graphics()
        .lineStyle(3, C.inchiostro, 1)
        .strokeRect(x0 + 12, y - h / 2 + 12, iw, h - 24);
    }
    const tx0 = x0 + 28 + iw;
    const tw = x0 + w - 18 - tx0;
    const cx = tx0 + tw / 2;
    const col: Phaser.GameObjects.Text[] = [
      txt(this, cx, 0, s(r.kind).toUpperCase() + (rec ? ` · ${s("recommended")}` : ""), 18, rec ? HEX.rosso : HEX.inchiostro)
        .setLetterSpacing(2)
        .setWordWrapWidth(tw),
      txt(this, cx, 0, l(area.name).toUpperCase(), 30, HEX.inchiostro, "titoli").setWordWrapWidth(tw),
      txt(this, cx, 0, l(area.technique), 21, HEX.indaco).setWordWrapWidth(tw),
    ];
    if (r.coinBonus > 1) col.push(txt(this, cx, 0, s("coinsBonus", { n: r.coinBonus }), 19, HEX.inchiostro).setAlpha(0.8));
    if (col.reduce((a, t) => a + t.height + 8, 0) > h - 20) col[2].setFontSize(18);
    spread(
      col.map((t) => slot(t, t.height)),
      y - h / 2 + 12,
      y + h / 2 - 12,
      14,
      4,
    );
    const zone = this.add
      .zone(W / 2, y, w, h)
      .setInteractive({ useHandCursor: true })
      .setName(`road-${r.kind}`);
    zone.on("pointerup", () => this.start(r));
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
