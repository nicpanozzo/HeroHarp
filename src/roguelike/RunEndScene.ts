// Fine della notte: com'è andata, la pagella dei fori da ripassare, e via con un'altra.
import Phaser from "phaser";
import { getEngine } from "../audio/engine";
import { t } from "../i18n";
import { C, HEX, W, txt, button, backdrop, panel, reducedMotion } from "../ui";
import { areaOf, lastRun, meta, saveRun, weakest } from "./run";
import { leaveRun, s } from "./ui";

export class RunEndScene extends Phaser.Scene {
  constructor() {
    super("runEnd");
  }

  create(): void {
    // la run appena finita (savedRun() non restituisce quelle concluse)
    const run = lastRun();
    if (!run) return void this.scene.start("runStart");
    const won = run.over === "won";
    backdrop(this, areaOf(run).backdrop, won ? 0.25 : 0.55);
    const engine = getEngine();
    // all'alba resta la band intera; di notte tutto si ferma
    if (!won) engine.basi.ferma(1.2);

    txt(this, W / 2, 86, (won ? s("victory") : s("defeat")).toUpperCase(), 70, HEX.carta, "titoli")
      .setStroke(HEX.inchiostro, 12)
      .setShadow(5, 4, won ? HEX.ottone : HEX.rosso, 0, false, true)
      .setName("run-result");
    txt(this, W / 2, 146, won ? s("victorySub") : s("defeatSub"), 24, HEX.carta).setStroke(HEX.inchiostro, 6);
    this.add.image(170, 440, `personaggi-protagonista-${won ? "vittoria" : "colpito"}`).setDisplaySize(260, 260);
    run.band.forEach((id, i) =>
      this.add.image(W - 250 + (i % 3) * 90 - 40, 380 + Math.floor(i / 3) * 110, `band-${id}-${won ? "saluta" : "suona"}`).setDisplaySize(110, 110),
    );

    // numeri della notte
    const st = run.stats;
    panel(this, 330, 186, 620, 190);
    const acc = st.notesExpected ? Math.round((100 * st.notesHit) / st.notesExpected) : 0;
    const rows: [string, string][] = [
      [s("reached", { n: run.act + 1 }), ""],
      [s("fightsWon"), `${st.won} / ${st.fights}`],
      [s("accuracy"), `${acc}%`],
      [s("totalScore"), String(st.score)],
    ];
    rows.forEach(([k, v], i) => {
      if (!v) return void txt(this, 640, 214, k.toUpperCase(), 18, HEX.rosso).setLetterSpacing(2);
      txt(this, 380, 254 + (i - 1) * 38, k, 21, HEX.inchiostro).setOrigin(0, 0.5);
      txt(this, 900, 254 + (i - 1) * 38, v, 26, HEX.inchiostro, "fori").setOrigin(1, 0.5);
    });
    // il record comprende sempre questa notte; se l'ha battuto si festeggia
    if (run.newBest) txt(this, 640, 356, t("newBest").toUpperCase(), 18, HEX.rosso, "titoli");
    else txt(this, 640, 356, s("bestRun", { n: Math.max(meta().bestScore, st.score) }), 16, HEX.indaco);

    // pagella: i fori più sbagliati, grandi e leggibili, da allenare
    panel(this, 330, 396, 620, 196, 0xf6d9a0);
    txt(this, 640, 422, s("report").toUpperCase(), 18, HEX.inchiostro).setLetterSpacing(2);
    const weak = weakest(run);
    if (weak.length === 0) txt(this, 640, 494, s("allClean"), 24, HEX.indaco, "titoli");
    weak.forEach((w, i) => {
      const x = 640 + (i - (weak.length - 1) / 2) * 180;
      const draw = w.label.includes("↓");
      const g = this.add.graphics();
      g.fillStyle(C.inchiostro, 1).fillRoundedRect(x - 70 + 5, 446 + 5, 140, 80, 12);
      g.fillStyle(draw ? C.indaco : C.ottone, 1).fillRoundedRect(x - 70, 446, 140, 80, 12);
      g.lineStyle(3, C.inchiostro, 1).strokeRoundedRect(x - 70, 446, 140, 80, 12);
      const t = txt(this, x, 486, w.label, 44, draw ? HEX.carta : HEX.inchiostro, "fori");
      if (!reducedMotion()) {
        t.setScale(0);
        this.tweens.add({ targets: t, scale: 1, delay: 300 + i * 200, duration: 260, ease: "Back.easeOut" });
      }
      txt(this, x, 542, `${Math.round(w.rate * 100)}% ✗`, 17, HEX.inchiostro);
    });
    if (weak.length) txt(this, 640, 572, s("practiseHint"), 17, HEX.inchiostro);

    const again = () => {
      saveRun(null);
      leaveRun(this, "runStart");
    };
    button(this, W / 2, 650, `${s("again")} ▶`, again, 320, true, 62).setName("run-again");
    button(this, W / 2 - 330, 650, s("dojo"), () => leaveRun(this, "dojo"), 220, false, 50).setName("run-dojo");
    button(this, W / 2 + 330, 650, s("title2"), () => leaveRun(this, "title"), 220, false, 50).setName("run-title");
    this.input.keyboard?.once("keydown-ENTER", again);
  }
}
