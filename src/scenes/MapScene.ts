import Phaser from "phaser";
import { AREA1 } from "../content/enemies";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, txt, button, stage, drawEnemy } from "../ui";
import { HearingReadout } from "./readout";

export class MapScene extends Phaser.Scene {
  private readout!: HearingReadout;

  constructor() {
    super("map");
  }

  create(): void {
    stage(this);
    const lang = getLang();
    txt(this, W / 2, 50, t("area1"), 34, C.brass, true);
    txt(this, W / 2, 92, t("area1Desc"), 17, C.muted);

    const unlockedBoss = AREA1.filter((e) => !e.boss).every((e) => save.beaten.includes(e.id));
    AREA1.forEach((e, i) => {
      const x = W / 2 + (i - 1) * 290;
      const card = this.add.graphics();
      card.fillStyle(C.bgLight, 1).fillRoundedRect(x - 125, 130, 250, 320, 14);
      card.lineStyle(2, e.boss ? C.brass : C.wood, 1).strokeRoundedRect(x - 125, 130, 250, 320, 14);
      const locked = e.boss && !unlockedBoss;
      const beaten = save.beaten.includes(e.id);
      const fig = drawEnemy(this, x, 240, e, 0.85);
      if (locked) fig.setAlpha(0.25);
      this.tweens.add({ targets: fig, y: 232, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      txt(this, x, 340, e.name[lang], 21, C.cream, true).setWordWrapWidth(230);
      txt(this, x, 375, `${e.bpm} bpm · ${e.phrases[0].length}-${e.phrases[e.phrases.length - 1].length} ${lang === "it" ? "note" : "notes"}`, 14, C.muted);
      if (locked) txt(this, x, 418, t("locked"), 14, C.muted).setWordWrapWidth(220);
      else button(this, x, 418, beaten ? `${t("fight")} ✓` : t("fight"), () => this.scene.start("battle", { enemyId: e.id }), 180, !beaten).setName(`fight-${e.id}`);
    });

    this.readout = new HearingReadout(this, W / 2, H - 17);
  }

  update(): void {
    getEngine().poll();
    this.readout.update();
  }
}
