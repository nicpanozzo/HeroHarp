import Phaser from "phaser";
import { groove } from "../audio/music";
import { areaById, enemyById, JOURNEY } from "../content/areas";
import { areaCleared, areaUnlocked, nextEnemy, starsFor } from "../progress";
import { getLang, t } from "../i18n";
import { save, persist } from "../state";
import type { Battle } from "../battle/logic";
import { W, HEX, txt, button, paper, panel, pop, reducedMotion } from "../ui";
import type { Tab } from "../harp";
import type { L10n } from "../content/areas";
import { noteWeakness } from "../stats/stats";
import { stats } from "../stats/store";
import { makeDrill } from "../stats/drill";

/** Fine battaglia: punti, stelle, e via subito alla prossima. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: { won: boolean; enemyId: string; stats: Battle["stats"]; hint?: { title: L10n; tab?: Tab } | null }): void {
    paper(this);
    const lang = getLang();
    const e = enemyById(data.enemyId);
    const area = areaById(e.areaId);
    const s = data.stats;
    // la base non si ferma: torna al passo del luogo
    groove(area.music);
    const stars = starsFor(data.won, s);
    const prevBest = save.best[e.id] ?? 0;
    const drill = !!e.drill;
    const record = !drill && data.won && s.score > prevBest;
    if (data.won && !drill) {
      save.best[e.id] = Math.max(prevBest, s.score);
      save.stars[e.id] = Math.max(save.stars[e.id] ?? 0, stars);
      persist();
    }

    txt(
      this,
      W / 2,
      84,
      (data.won ? (drill ? t("drillDone") : t("won")) : t("lost")).toUpperCase(),
      drill ? 64 : 80,
      data.won ? HEX.inchiostro : HEX.rosso,
      "titoli",
    )
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
    else if (prevBest && !drill) txt(this, W / 2, 400, `${t("best")}: ${prevBest}`, 18, HEX.inchiostro).setAlpha(0.7);
    const line = `${t("notesHit")} ${s.notesHit}/${s.notesExpected} · ${t("parried")} ${s.parried}/${s.parried + s.missed} · ${t("streak")} ${s.bestStreak}`;
    txt(this, W / 2, 452, line, 17, HEX.inchiostro).setWordWrapWidth(380);

    // tappa finita: si annuncia la prossima
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    let msg = "";
    if (data.won && e.boss && !drill && areaCleared(area, progress)) {
      const next = JOURNEY.find((a) => a.order > area.order && areaUnlocked(a, progress));
      msg = next ? t("areaClear", { name: next.name[lang] }) : area.extra ? "" : t("journeyClear");
      if (msg) txt(this, W / 2, 530, msg, 24, HEX.indaco);
    }
    // la nota che ti ha fatto inciampare di più: un tocco e parte l'allenamento su quella
    const hint = data.hint;
    if (!msg && !drill && hint?.tab) {
      const tab = hint.tab;
      // scritta e pulsante centrati insieme
      const label = txt(this, 0, 532, hint.title[lang], 24, HEX.indaco).setOrigin(0, 0.5).setName("hint");
      const left = W / 2 - (label.width + 20 + 190) / 2;
      label.setX(left);
      button(
        this,
        left + label.width + 20 + 95,
        532,
        `${t("drillBtn")} ▶`,
        () => {
          makeDrill(noteWeakness(stats, tab));
          this.scene.start("battle", { enemyId: "drill" });
        },
        190,
        false,
        44,
      ).setName("hint-drill");
    }

    if (drill) {
      // dall'allenamento: ancora, la pagella o di nuovo in viaggio
      const again = () => this.scene.start("battle", { enemyId: e.id });
      button(this, W / 2, 610, `${t("drillAgain")} ▶`, again, 300).setName("next");
      button(this, W / 2 - 290, 610, t("stats"), () => this.scene.start("stats"), 220, false, 50).setName("to-stats");
      button(this, W / 2 + 290, 610, t("journeyShort"), () => this.scene.start("journey"), 220, false, 50).setName("tomap");
      this.input.keyboard?.once("keydown-ENTER", again);
      this.input.keyboard?.once("keydown-SPACE", again);
      return;
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
