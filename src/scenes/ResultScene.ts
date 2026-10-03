import Phaser from "phaser";
import { AREA1, enemyById } from "../content/area1";
import { getLang, t } from "../i18n";
import { save } from "../state";
import type { Battle } from "../battle/logic";
import { W, HEX, txt, button, paper, panel } from "../ui";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: { won: boolean; enemyId: string; stats: Battle["stats"] }): void {
    paper(this);
    const e = enemyById(data.enemyId);
    txt(this, W / 2, 100, (data.won ? t("won") : t("lost")).toUpperCase(), 84, data.won ? HEX.inchiostro : HEX.rosso, "titoli")
      .setShadow(5, 4, data.won ? HEX.ottone : HEX.inchiostro, 0, false, true)
      .setName("result");
    txt(this, W / 2, 168, e.name[getLang()].toUpperCase(), 26, HEX.inchiostro, "titoli");
    this.add.image(330, 380, `personaggi-protagonista-${data.won ? "vittoria" : "colpito"}`).setDisplaySize(280, 280);
    this.add.image(W - 330, 380, `nemici-${e.sprite}-${data.won ? "sconfitto" : "idle"}`).setDisplaySize(260, 260);

    const s = data.stats;
    panel(this, W / 2 - 170, 250, 340, 220);
    txt(this, W / 2, 300, `${s.notesHit}/${s.notesExpected}`, 44, HEX.inchiostro, "titoli");
    txt(this, W / 2, 340, t("notesHit"), 19, HEX.inchiostro);
    txt(this, W / 2, 395, `${s.parried}/${s.parried + s.missed}`, 44, HEX.inchiostro, "titoli");
    txt(this, W / 2, 435, t("parried"), 19, HEX.inchiostro);
    if (data.won && AREA1.enemies.every((x) => save.beaten.includes(x.id))) txt(this, W / 2, 520, t("areaClear"), 24, HEX.indaco);
    button(this, W / 2 - 160, 610, t("retry"), () => this.scene.start("battle", { enemyId: e.id }), 280, !data.won);
    button(this, W / 2 + 160, 610, t("toMap"), () => this.scene.start("map"), 280, data.won).setName("tomap");
  }
}
