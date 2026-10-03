import Phaser from "phaser";
import { areaById, enemyById, JOURNEY } from "../content/areas";
import { areaCleared, areaUnlocked } from "../progress";
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
    const lang = getLang();
    const e = enemyById(data.enemyId);
    const area = areaById(e.areaId);
    txt(this, W / 2, 100, (data.won ? t("won") : t("lost")).toUpperCase(), 84, data.won ? HEX.inchiostro : HEX.rosso, "titoli")
      .setShadow(5, 4, data.won ? HEX.ottone : HEX.inchiostro, 0, false, true)
      .setName("result");
    txt(this, W / 2, 168, e.name[lang].toUpperCase(), 26, HEX.inchiostro, "titoli");
    this.add.image(330, 380, `personaggi-protagonista-${data.won ? "vittoria" : "colpito"}`).setDisplaySize(280, 280);
    const size = e.boss ? 300 : 260;
    this.add.image(W - 330, 380, `nemici-${e.sprite}-${data.won ? "sconfitto" : "idle"}`).setDisplaySize(size, size);

    const s = data.stats;
    panel(this, W / 2 - 170, 250, 340, 220);
    txt(this, W / 2, 300, `${s.notesHit}/${s.notesExpected}`, 44, HEX.inchiostro, "titoli");
    txt(this, W / 2, 340, t("notesHit"), 19, HEX.inchiostro);
    txt(this, W / 2, 395, `${s.parried}/${s.parried + s.missed}`, 44, HEX.inchiostro, "titoli");
    txt(this, W / 2, 435, t("parried"), 19, HEX.inchiostro);

    // tappa finita: si annuncia la prossima
    const progress = { beaten: save.beaten };
    if (data.won && e.boss && areaCleared(area, progress)) {
      const next = JOURNEY.find((a) => a.order > area.order && areaUnlocked(a, progress));
      const msg = next ? t("areaClear", { name: next.name[lang] }) : area.extra ? "" : t("journeyClear");
      if (msg) txt(this, W / 2, 520, msg, 24, HEX.indaco);
    }
    button(this, W / 2 - 160, 610, t("retry"), () => this.scene.start("battle", { enemyId: e.id }), 280, !data.won);
    button(this, W / 2 + 160, 610, t("toMap"), () => this.scene.start(e.boss && data.won ? "journey" : "map", { areaId: area.id }), 280, data.won).setName(
      "tomap",
    );
  }
}
