import Phaser from "phaser";
import { areaById, enemyById, JOURNEY } from "../content/areas";
import { areaCleared, areaUnlocked, nextEnemy, starsFor } from "../progress";
import { getLang, t } from "../i18n";
import { save, persist } from "../state";
import type { Battle } from "../battle/logic";
import { W, HEX, txt, button, paper, panel, pop, reducedMotion } from "../ui";

/** Fine battaglia: punti, stelle, e via subito alla prossima. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: { won: boolean; enemyId: string; stats: Battle["stats"] }): void {
    paper(this);
    const lang = getLang();
    const e = enemyById(data.enemyId);
    const area = areaById(e.areaId);
    const s = data.stats;
    const stars = starsFor(data.won, s);
    const prevBest = save.best[e.id] ?? 0;
    const record = data.won && s.score > prevBest;
    if (data.won) {
      save.best[e.id] = Math.max(prevBest, s.score);
      save.stars[e.id] = Math.max(save.stars[e.id] ?? 0, stars);
      persist();
    }

    txt(this, W / 2, 84, (data.won ? t("won") : t("lost")).toUpperCase(), 80, data.won ? HEX.inchiostro : HEX.rosso, "titoli")
      .setShadow(5, 4, data.won ? HEX.ottone : HEX.inchiostro, 0, false, true)
      .setName("result");
    txt(this, W / 2, 148, e.name[lang].toUpperCase(), 24, HEX.inchiostro, "titoli");
    this.add.image(250, 380, `personaggi-protagonista-${data.won ? "vittoria" : "colpito"}`).setDisplaySize(260, 260);
    const size = e.boss ? 280 : 240;
    this.add.image(W - 250, 380, `nemici-${e.sprite}-${data.won ? "sconfitto" : "idle"}`).setDisplaySize(size, size);

    // stelle che arrivano una alla volta
    for (let i = 0; i < 3; i++) {
      const star = txt(this, W / 2 + (i - 1) * 84, 222, "★", 76, i < stars ? HEX.ottone : HEX.carta2, "titoli").setStroke(HEX.inchiostro, 6);
      if (i < stars && !reducedMotion()) {
        star.setScale(0);
        this.tweens.add({ targets: star, scale: 1, delay: 250 + i * 220, duration: 260, ease: "Back.easeOut" });
      }
    }

    // punteggio che sale
    panel(this, W / 2 - 200, 280, 400, 210);
    txt(this, W / 2, 306, t("score").toUpperCase(), 16, HEX.inchiostro).setLetterSpacing(3);
    const score = txt(this, W / 2, 352, "0", 54, HEX.inchiostro, "fori").setName("score");
    this.tweens.addCounter({
      from: 0,
      to: s.score,
      duration: reducedMotion() ? 0 : 700,
      onUpdate: (tw) => score.setText(String(Math.round(tw.getValue() ?? 0))),
    });
    if (record) this.time.delayedCall(800, () => pop(this, W / 2, 402, t("newBest").toUpperCase(), HEX.rosso, 26));
    else if (prevBest) txt(this, W / 2, 400, `${t("best")}: ${prevBest}`, 18, HEX.inchiostro).setAlpha(0.7);
    const line = `${t("notesHit")} ${s.notesHit}/${s.notesExpected} · ${t("parried")} ${s.parried}/${s.parried + s.missed} · ${t("streak")} ${s.bestStreak}`;
    txt(this, W / 2, 452, line, 17, HEX.inchiostro).setWordWrapWidth(380);

    // tappa finita: si annuncia la prossima
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    if (data.won && e.boss && areaCleared(area, progress)) {
      const next = JOURNEY.find((a) => a.order > area.order && areaUnlocked(a, progress));
      const msg = next ? t("areaClear", { name: next.name[lang] }) : area.extra ? "" : t("journeyClear");
      if (msg) txt(this, W / 2, 530, msg, 24, HEX.indaco);
    }

    // un tocco per continuare: Avanti porta al prossimo nemico, Invio fa lo stesso
    const next = nextEnemy(progress);
    const go = () => this.scene.start("battle", { enemyId: data.won ? next.id : e.id });
    button(this, W / 2, 610, data.won ? `${t("nextFight")} ▶` : t("retry"), go, 300).setName("next");
    button(
      this,
      W / 2 - 290,
      610,
      data.won ? t("retry") : t("mapBtn"),
      () => (data.won ? this.scene.start("battle", { enemyId: e.id }) : this.scene.start("map", { areaId: area.id })),
      220,
      false,
      50,
    );
    button(this, W / 2 + 290, 610, t("mapBtn"), () => this.scene.start(e.boss && data.won ? "journey" : "map", { areaId: area.id }), 220, false, 50).setName(
      "tomap",
    );
    this.input.keyboard?.once("keydown-ENTER", go);
    this.input.keyboard?.once("keydown-SPACE", go);
  }
}
