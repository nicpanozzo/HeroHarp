import Phaser from "phaser";
import { groove } from "../audio/music";
import { areaById, enemyById, JOURNEY } from "../content/areas";
import { areaCleared, areaUnlocked, nextEnemy, starsFor } from "../progress";
import { getLang, t } from "../i18n";
import { save, persist } from "../state";
import type { Battle } from "../battle/logic";
import { W, H, HEX, txt, button, paper, panel, pop, portrait, reducedMotion } from "../ui";
import type { Tab } from "../harp";
import type { L10n } from "../content/areas";
import { noteWeakness } from "../stats/stats";
import { stats } from "../stats/store";
import { makeDrill } from "../stats/drill";

/**
 * Dove sta ogni cosa. In orizzontale le misure di sempre; in verticale tutto in colonna:
 * titolo, stelle, i due personaggi affiancati, il punteggio, e in fondo i pulsanti grandi per il pollice.
 */
function layout(drill: boolean) {
  if (!portrait())
    return {
      P: false,
      title: 84,
      titleSize: drill ? 64 : 80,
      name: 148,
      stars: 222,
      starGap: 84,
      starSize: 76,
      figY: 380,
      heroX: 250,
      hero: 260,
      foe: 240,
      panel: 280,
      panelW: 400,
      panelH: 210,
      msg: 530,
      main: 610,
      mainW: 300,
      mainH: 58,
      side: 610,
      sideW: 220,
      sideH: 50,
      leftX: W / 2 - 290,
    };
  // lo spazio in più dei telefoni alti va un po' a ogni blocco
  const e = H - 1180;
  const title = 96 + e * 0.06;
  const name = title + (drill ? 104 : 70);
  const stars = name + 78 + e * 0.04;
  const figY = stars + 176 + e * 0.12;
  const fig = 220 + e * 0.16;
  const panel = figY + fig / 2 + 20 + e * 0.06;
  const panelH = 228;
  const sideH = 74;
  const side = H - 24 - sideH / 2;
  const mainH = 90;
  const main = side - sideH / 2 - 24 - mainH / 2;
  const sideW = (W - 104) / 2;
  return {
    P: true,
    title,
    titleSize: drill ? 54 : 84,
    name,
    stars,
    starGap: 104,
    starSize: 92,
    figY,
    heroX: 180,
    hero: fig,
    foe: fig - 20,
    panel,
    panelW: W - 120,
    panelH,
    // messaggio o consiglio: a metà tra il punteggio e i pulsanti
    msg: (panel + panelH + main - mainH / 2) / 2,
    main,
    mainW: W - 80,
    mainH,
    side,
    sideW,
    sideH,
    leftX: 40 + sideW / 2,
  };
}

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

    const L = layout(drill);
    const title = txt(
      this,
      W / 2,
      L.title,
      (data.won ? (drill ? t("drillDone") : t("won")) : t("lost")).toUpperCase(),
      L.titleSize,
      data.won ? HEX.inchiostro : HEX.rosso,
      "titoli",
    )
      .setShadow(5, 4, data.won ? HEX.ottone : HEX.inchiostro, 0, false, true)
      .setName("result");
    if (L.P) title.setWordWrapWidth(W - 60);
    txt(this, W / 2, L.name, e.name[lang].toUpperCase(), L.P ? 30 : 24, HEX.inchiostro, "titoli");
    this.add.image(L.heroX, L.figY, `personaggi-protagonista-${data.won ? "vittoria" : "colpito"}`).setDisplaySize(L.hero, L.hero);
    const size = e.boss ? L.foe + 40 : L.foe;
    this.add.image(W - L.heroX, L.figY, `nemici-${e.sprite}-${data.won ? "sconfitto" : "idle"}`).setDisplaySize(size, size);

    // stelle che arrivano una alla volta
    for (let i = 0; i < 3; i++) {
      const star = txt(this, W / 2 + (i - 1) * L.starGap, L.stars, "★", L.starSize, i < stars ? HEX.ottone : HEX.carta2, "titoli").setStroke(HEX.inchiostro, 6);
      if (i < stars && !reducedMotion()) {
        star.setScale(0);
        this.tweens.add({ targets: star, scale: 1, delay: 250 + i * 220, duration: 260, ease: "Back.easeOut" });
      }
    }

    // punteggio che sale
    const pt = L.panel;
    panel(this, W / 2 - L.panelW / 2, pt, L.panelW, L.panelH);
    txt(this, W / 2, pt + 26, t("score").toUpperCase(), L.P ? 20 : 16, HEX.inchiostro).setLetterSpacing(3);
    const score = txt(this, W / 2, pt + (L.P ? 80 : 72), "0", L.P ? 64 : 54, HEX.inchiostro, "fori").setName("score");
    this.tweens.addCounter({
      from: 0,
      to: s.score,
      duration: reducedMotion() ? 0 : 700,
      onUpdate: (tw) => score.setText(String(Math.round(tw.getValue() ?? 0))),
    });
    const bestY = pt + (L.P ? 134 : 120);
    if (record) this.time.delayedCall(800, () => pop(this, W / 2, bestY + 2, t("newBest").toUpperCase(), HEX.rosso, L.P ? 30 : 26));
    else if (prevBest && !drill) txt(this, W / 2, bestY, `${t("best")}: ${prevBest}`, L.P ? 22 : 18, HEX.inchiostro).setAlpha(0.7);
    const line = `${t("notesHit")} ${s.notesHit}/${s.notesExpected} · ${t("parried")} ${s.parried}/${s.parried + s.missed} · ${t("streak")} ${s.bestStreak}`;
    txt(this, W / 2, pt + (L.P ? 192 : 172), line, L.P ? 22 : 17, HEX.inchiostro).setWordWrapWidth(L.panelW - 20);

    // tappa finita: si annuncia la prossima
    const progress = { beaten: save.beaten, openAll: save.settings.openAll };
    let msg = "";
    if (data.won && e.boss && !drill && areaCleared(area, progress)) {
      const next = JOURNEY.find((a) => a.order > area.order && areaUnlocked(a, progress));
      msg = next ? t("areaClear", { name: next.name[lang] }) : area.extra ? "" : t("journeyClear");
      if (msg) txt(this, W / 2, L.msg, msg, L.P ? 26 : 24, HEX.indaco).setWordWrapWidth(L.P ? W - 60 : null);
    }
    // la nota che ti ha fatto inciampare di più: un tocco e parte l'allenamento su quella
    const hint = data.hint;
    if (!msg && !drill && hint?.tab) {
      const tab = hint.tab;
      // scritta e pulsante centrati insieme (in verticale uno sopra l'altro)
      const label = txt(this, 0, L.P ? L.msg - 42 : 532, hint.title[lang], L.P ? 26 : 24, HEX.indaco)
        .setOrigin(0, 0.5)
        .setName("hint");
      const left = W / 2 - (label.width + 20 + 190) / 2;
      if (L.P)
        label
          .setOrigin(0.5)
          .setX(W / 2)
          .setWordWrapWidth(W - 60);
      else label.setX(left);
      button(
        this,
        L.P ? W / 2 : left + label.width + 20 + 95,
        L.P ? L.msg + 26 : 532,
        `${t("drillBtn")} ▶`,
        () => {
          makeDrill(noteWeakness(stats, tab));
          this.scene.start("battle", { enemyId: "drill" });
        },
        L.P ? 340 : 190,
        false,
        L.P ? 70 : 44,
      ).setName("hint-drill");
    }

    if (drill) {
      // dall'allenamento: ancora, la pagella o di nuovo in viaggio
      const again = () => this.scene.start("battle", { enemyId: e.id });
      button(this, W / 2, L.main, `${t("drillAgain")} ▶`, again, L.mainW, true, L.mainH).setName("next");
      button(this, L.leftX, L.side, t("stats"), () => this.scene.start("stats"), L.sideW, false, L.sideH).setName("to-stats");
      button(this, W - L.leftX, L.side, t("journeyShort"), () => this.scene.start("journey"), L.sideW, false, L.sideH).setName("tomap");
      this.input.keyboard?.once("keydown-ENTER", again);
      this.input.keyboard?.once("keydown-SPACE", again);
      return;
    }

    // un tocco per continuare: Avanti porta al prossimo nemico, Invio fa lo stesso
    const next = nextEnemy(progress);
    const go = () => this.scene.start("battle", { enemyId: data.won ? next.id : e.id });
    button(this, W / 2, L.main, data.won ? `${t("nextFight")} ▶` : t("retry"), go, L.mainW, true, L.mainH).setName("next");
    // in verticale, dopo una sconfitta, un solo pulsante Mappa largo invece di due uguali
    const oneMap = L.P && !data.won;
    if (!oneMap)
      button(
        this,
        L.leftX,
        L.side,
        data.won ? t("retry") : t("mapBtn"),
        () => (data.won ? this.scene.start("battle", { enemyId: e.id }) : this.scene.start("map", { areaId: area.id })),
        L.sideW,
        false,
        L.sideH,
      );
    button(
      this,
      oneMap ? W / 2 : W - L.leftX,
      L.side,
      t("mapBtn"),
      () => this.scene.start(e.boss && data.won ? "journey" : "map", { areaId: area.id }),
      oneMap ? L.mainW : L.sideW,
      false,
      L.sideH,
    ).setName("tomap");
    this.input.keyboard?.once("keydown-ENTER", go);
    this.input.keyboard?.once("keydown-SPACE", go);
  }
}
