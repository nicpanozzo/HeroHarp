import Phaser from "phaser";
import { grooveOnGesture } from "../audio/music";
import { areaById, AREA1, type AreaDef } from "../content/areas";
import { enemyUnlocked } from "../progress";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, HEX, txt, button, backdrop, panel, portrait, reducedMotion } from "../ui";
import { HearingReadout } from "./readout";
import { showLessons } from "./lessons";

/** Una tappa del viaggio: i nemici da sfidare, il boss in fondo. */
export class MapScene extends Phaser.Scene {
  private readout!: HearingReadout;
  private area: AreaDef = AREA1;

  constructor() {
    super("map");
  }

  init(data: { areaId?: string }): void {
    if (data.areaId) this.area = areaById(data.areaId);
  }

  create(): void {
    const lang = getLang();
    const a = this.area;
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    backdrop(this, a.backdrop, 0.35);
    // ogni tappa ha il suo groove
    grooveOnGesture(this, a.music);
    if (portrait()) return this.createPortrait();
    panel(this, 140, 24, W - 280, 104);
    const head = `${a.extra ? t("extra") : t("area", { n: a.order })} · ${a.name[lang]}`.toUpperCase();
    txt(this, W / 2, 60, head, 34, HEX.inchiostro, "titoli").setName("area-title");
    txt(this, W / 2, 102, a.goal[lang], 19, HEX.inchiostro).setWordWrapWidth(W - 340);

    const n = a.enemies.length;
    const gap = 20;
    const cardW = Math.min(260, Math.floor((W - 80 - (n - 1) * gap) / n));
    const x0 = W / 2 - (n * cardW + (n - 1) * gap) / 2;
    const img = Math.min(200, cardW - 40);
    a.enemies.forEach((e, i) => {
      const x = x0 + i * (cardW + gap);
      const y = 160;
      const open = enemyUnlocked(e, progress);
      const beaten = save.beaten.includes(e.id);
      panel(this, x, y, cardW, 450, e.boss ? C.carta2 : C.carta);
      if (e.boss) txt(this, x + cardW / 2, y + 22, t("boss").toUpperCase(), 16, HEX.rosso).setLetterSpacing(4);
      const pic = this.add.image(x + cardW / 2, y + 150, `nemici-${e.sprite}-${beaten ? "sconfitto" : "idle"}`);
      if (pic.texture.key === "__MISSING") pic.setVisible(false);
      pic.setDisplaySize(img, img);
      if (!open) pic.setTint(0x555555).setAlpha(0.5);
      else if (!reducedMotion()) this.tweens.add({ targets: pic, y: y + 142, duration: 1100 + i * 170, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      txt(this, x + cardW / 2, y + 292, e.name[lang].toUpperCase(), cardW < 240 || e.name[lang].length > 16 ? 20 : 24, HEX.inchiostro, "titoli")
        .setOrigin(0.5, 1)
        .setWordWrapWidth(cardW - 20);
      txt(this, x + cardW / 2, y + 304, e.trains[lang], e.boss ? 16 : cardW < 240 ? 18 : 20, HEX.inchiostro)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(cardW - 26);
      if (e.comingSoon)
        txt(this, x + cardW / 2, y + 412, t("comingSoon"), 16, HEX.rosso)
          .setWordWrapWidth(cardW - 30)
          .setAlpha(0.8);
      else if (!open)
        txt(this, x + cardW / 2, y + 412, t("locked"), 15, HEX.inchiostro)
          .setWordWrapWidth(cardW - 30)
          .setAlpha(0.7);
      else
        button(
          this,
          x + cardW / 2,
          y + 404,
          beaten ? `${t("again")} ✓` : t("fight"),
          () => this.scene.start("battle", { enemyId: e.id }),
          Math.min(200, cardW - 30),
          !beaten,
          52,
        ).setName(`fight-${e.id}`);
    });

    this.add.rectangle(W / 2, H - 34, W, 68, C.carta, 0.92);
    this.readout = new HearingReadout(this, W / 2 + 60, H - 34);
    button(this, 100, H - 34, `‹ ${t("toJourney")}`, () => this.scene.start("journey"), 170, false, 48).setName("journey");
    if (a.lessons.length) button(this, 290, H - 34, t("lessons"), () => showLessons(this, a), 170, false, 48).setName("lessons");
    button(this, W - 110, H - 34, t("options"), () => this.scene.start("options", { from: "map" }), 180, false, 48).setName("options");
  }

  /** In verticale i nemici stanno uno sotto l'altro, ognuno su una scheda larga: figura a sinistra, nome e pulsante a destra. */
  private createPortrait(): void {
    const lang = getLang();
    const a = this.area;
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    const head = `${a.extra ? t("extra") : t("area", { n: a.order })} · ${a.name[lang]}`.toUpperCase();
    const top = 24;
    const title = txt(this, W / 2, top + 22, head, 36, HEX.inchiostro, "titoli")
      .setOrigin(0.5, 0)
      .setWordWrapWidth(W - 100)
      .setDepth(1)
      .setName("area-title");
    const goal = txt(this, W / 2, title.y + title.height + 10, a.goal[lang], 22, HEX.inchiostro)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(W - 100)
      .setDepth(1);
    // il pannello si adatta al titolo e all'obiettivo, che possono andare a capo
    const headH = goal.y + goal.height + 22 - top;
    panel(this, 24, top, W - 48, headH);

    const barTop = H - 176;
    const n = a.enemies.length;
    const gap = 16;
    const y0 = top + headH + 26;
    const cw = W - 48;
    const ch = Math.min(250, Math.floor((barTop - 22 - y0 - (n - 1) * gap) / n));
    const img = Math.min(170, ch - 30);
    a.enemies.forEach((e, i) => {
      const x = 24;
      const y = y0 + i * (ch + gap);
      const open = enemyUnlocked(e, progress);
      const beaten = save.beaten.includes(e.id);
      panel(this, x, y, cw, ch, e.boss ? C.carta2 : C.carta);
      const pic = this.add.image(x + 24 + img / 2, y + ch / 2, `nemici-${e.sprite}-${beaten ? "sconfitto" : "idle"}`);
      if (pic.texture.key === "__MISSING") pic.setVisible(false);
      pic.setDisplaySize(img, img);
      if (!open) pic.setTint(0x555555).setAlpha(0.5);
      else if (!reducedMotion()) this.tweens.add({ targets: pic, y: y + ch / 2 - 8, duration: 1100 + i * 170, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      const tx = x + img + 48;
      const tw = x + cw - 20 - tx;
      if (e.boss)
        txt(this, x + cw - 18, y + 24, t("boss").toUpperCase(), 20, HEX.rosso)
          .setOrigin(1, 0.5)
          .setLetterSpacing(4);
      const name = txt(this, tx, y + 16, e.name[lang].toUpperCase(), 28, HEX.inchiostro, "titoli")
        .setOrigin(0, 0)
        .setAlign("left")
        .setWordWrapWidth(tw - (e.boss ? 90 : 0));
      const trains = txt(this, tx, name.y + name.height + 6, e.trains[lang], 21, HEX.inchiostro)
        .setOrigin(0, 0)
        .setAlign("left")
        .setWordWrapWidth(tw);
      // pulsante in basso a destra: alto quanto lo spazio lascia, senza coprire il testo
      const bh = Phaser.Math.Clamp(ch - 30 - (trains.y + trains.height - y), 52, 68);
      const by = y + ch - 14 - bh / 2;
      if (e.comingSoon || !open)
        txt(this, x + cw - 20, by, e.comingSoon ? t("comingSoon") : t("locked"), 20, e.comingSoon ? HEX.rosso : HEX.inchiostro)
          .setOrigin(1, 0.5)
          .setAlign("right")
          .setWordWrapWidth(tw)
          .setAlpha(e.comingSoon ? 0.8 : 0.7);
      else
        button(
          this,
          x + cw - 20 - 115,
          by,
          beaten ? `${t("again")} ✓` : t("fight"),
          () => this.scene.start("battle", { enemyId: e.id }),
          230,
          !beaten,
          bh,
        ).setName(`fight-${e.id}`);
    });

    // in fondo: cosa sente il microfono e tre pulsanti grandi
    this.add.rectangle(W / 2, barTop + (H - barTop) / 2, W, H - barTop, C.carta, 0.94);
    this.add.rectangle(W / 2, barTop, W, 3, C.inchiostro, 0.4);
    this.readout = new HearingReadout(this, W / 2, barTop + 36, HEX.inchiostro, 22);
    const bw = (W - 48 - 32) / 3;
    const bx = (k: number) => 24 + bw / 2 + k * (bw + 16);
    const by = H - 64;
    button(this, bx(0), by, `‹ ${t("toJourney")}`, () => this.scene.start("journey"), bw, false, 72).setName("journey");
    if (a.lessons.length) button(this, bx(1), by, t("lessons"), () => showLessons(this, a), bw, false, 72).setName("lessons");
    button(this, bx(2), by, t("options"), () => this.scene.start("options", { from: "map" }), bw, false, 72).setName("options");
  }

  update(): void {
    getEngine().poll();
    this.readout.update();
  }
}
