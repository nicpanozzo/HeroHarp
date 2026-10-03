import Phaser from "phaser";
import { AREA1, enemyById } from "../content/enemies";
import { getLang, t } from "../i18n";
import { save } from "../state";
import type { Battle } from "../battle/logic";
import { C, W, txt, button, stage, drawEnemy } from "../ui";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: { won: boolean; enemyId: string; stats: Battle["stats"] }): void {
    stage(this);
    const e = enemyById(data.enemyId);
    txt(this, W / 2, 90, data.won ? t("won") : t("lost"), 60, data.won ? C.brass : C.draw, true).setStroke("#000", 6).setName("result");
    txt(this, W / 2, 150, e.name[getLang()], 22, C.muted, true);
    const fig = drawEnemy(this, W / 2, 255, e, 0.7);
    if (data.won) fig.setAlpha(0.35).setAngle(15);
    const s = data.stats;
    txt(this, W / 2 - 120, 360, `${s.notesHit}/${s.notesExpected}`, 30, C.cream, true);
    txt(this, W / 2 - 120, 392, t("notesHit"), 15, C.muted);
    txt(this, W / 2 + 120, 360, `${s.parried}/${s.parried + s.missed}`, 30, C.cream, true);
    txt(this, W / 2 + 120, 392, t("parried"), 15, C.muted);
    if (data.won && AREA1.every((x) => save.beaten.includes(x.id))) txt(this, W / 2, 430, t("areaClear"), 18, C.good);
    button(this, W / 2 - 130, 480, t("retry"), () => this.scene.start("battle", { enemyId: e.id }), 220, !data.won);
    button(this, W / 2 + 130, 480, t("toMap"), () => this.scene.start("map"), 220, data.won).setName("tomap");
  }
}
