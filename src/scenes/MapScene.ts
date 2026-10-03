import Phaser from "phaser";
import { AREA1 } from "../content/area1";
import { getLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, HEX, txt, button, porch, panel } from "../ui";
import { HearingReadout } from "./readout";

export class MapScene extends Phaser.Scene {
  private readout!: HearingReadout;

  constructor() {
    super("map");
  }

  create(): void {
    const lang = getLang();
    porch(this, 0.35);
    panel(this, 140, 24, W - 280, 104);
    txt(this, W / 2, 60, `${t("area").toUpperCase()} · ${AREA1.name[lang].toUpperCase()}`, 36, HEX.inchiostro, "titoli");
    txt(this, W / 2, 102, AREA1.goal[lang], 20, HEX.inchiostro);

    const normals = AREA1.enemies.filter((e) => !e.boss);
    const bossUnlocked = normals.every((e) => save.beaten.includes(e.id));
    const cardW = 260,
      gap = 24;
    const x0 = W / 2 - (AREA1.enemies.length * cardW + (AREA1.enemies.length - 1) * gap) / 2;
    AREA1.enemies.forEach((e, i) => {
      const x = x0 + i * (cardW + gap);
      const y = 160;
      const locked = !!e.boss && !bossUnlocked;
      const beaten = save.beaten.includes(e.id);
      panel(this, x, y, cardW, 450, e.boss ? C.carta2 : C.carta);
      if (e.boss) txt(this, x + cardW / 2, y + 22, t("boss").toUpperCase(), 16, HEX.rosso).setLetterSpacing(4);
      const img = this.add.image(x + cardW / 2, y + 150, `nemici-${e.sprite}-${beaten ? "sconfitto" : "idle"}`).setDisplaySize(200, 200);
      if (locked) img.setTint(0x555555).setAlpha(0.5);
      else this.tweens.add({ targets: img, y: y + 142, duration: 1100 + i * 170, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      txt(this, x + cardW / 2, y + 276, e.name[lang].toUpperCase(), 24, HEX.inchiostro, "titoli").setWordWrapWidth(cardW - 20);
      txt(this, x + cardW / 2, y + 300, e.trains[lang], e.boss ? 16 : 18, HEX.inchiostro)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(cardW - 30);
      if (locked)
        txt(this, x + cardW / 2, y + 412, t("locked"), 16, HEX.inchiostro)
          .setWordWrapWidth(cardW - 30)
          .setAlpha(0.7);
      else
        button(
          this,
          x + cardW / 2,
          y + 400,
          beaten ? `${t("again")} ✓` : t("fight"),
          () => this.scene.start("battle", { enemyId: e.id }),
          200,
          !beaten,
        ).setName(`fight-${e.id}`);
    });

    this.add.rectangle(W / 2, H - 34, W, 68, C.carta, 0.92);
    this.readout = new HearingReadout(this, W / 2, H - 34);
    button(this, 120, H - 34, t("help"), () => this.showMae(), 190, false);
    button(this, W - 120, H - 34, t("options"), () => this.scene.start("options", { from: "map" }), 190, false).setName("options");
    if (!save.introSeen) this.showMae();
  }

  /** Zia Mae spiega il gioco e il consiglio dell'area. */
  private showMae(): void {
    const lang = getLang();
    const layer = this.add.container(0, 0).setDepth(10);
    const shade = this.add.rectangle(W / 2, H / 2, W, H, C.inchiostro, 0.55).setInteractive();
    const box = panel(this, 200, 150, W - 400, 420);
    const mae = this.add.image(340, 390, "personaggi-zia-mae-spiega").setScale(1.05);
    const title = txt(this, 760, 200, t("maeTitle").toUpperCase(), 34, HEX.prugna, "titoli");
    const body = txt(this, 760, 330, t("maeIntro"), 21, HEX.inchiostro).setWordWrapWidth(560).setAlign("left");
    const tip = txt(this, 760, 450, `“${AREA1.tips[0][lang]}”`, 20, HEX.indaco).setWordWrapWidth(560);
    const ok = button(
      this,
      760,
      520,
      t("maeOk"),
      () => {
        save.introSeen = true;
        persist();
        layer.destroy(true);
      },
      220,
    ).setName("mae-ok");
    layer.add([shade, box, mae, title, body, tip, ok]);
  }

  update(): void {
    getEngine().poll();
    this.readout.update();
  }
}
