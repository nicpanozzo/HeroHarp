// Fine della notte: com'è andata, la pagella dei fori da ripassare, e via con un'altra.
import Phaser from "phaser";
import { getEngine } from "../audio/engine";
import { t } from "../i18n";
import { C, HEX, W, H, txt, button, backdrop, panel, reducedMotion, portrait } from "../ui";
import { areaOf, lastRun, meta, saveRun, weakest, type RunState } from "./run";
import { bigButton, leaveRun, s, slot, spread, type Slot } from "./ui";

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
    if (portrait()) return this.createPortrait(run);

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

  /** In verticale: risultato, chi ha suonato con te, i numeri, la pagella e i pulsanti, uno sotto l'altro. */
  private createPortrait(run: RunState): void {
    const won = run.over === "won";
    const PW = 660;
    const x0 = W / 2 - PW / 2;
    const slots: Slot[] = [];
    const title = txt(this, W / 2, 0, (won ? s("victory") : s("defeat")).toUpperCase(), 68, HEX.carta, "titoli")
      .setStroke(HEX.inchiostro, 12)
      .setShadow(5, 4, won ? HEX.ottone : HEX.rosso, 0, false, true)
      .setWordWrapWidth(PW)
      .setLineSpacing(-6)
      .setName("run-result");
    slots.push(slot(title, title.height));
    const sub = txt(this, W / 2, 0, won ? s("victorySub") : s("defeatSub"), 25, HEX.carta)
      .setStroke(HEX.inchiostro, 6)
      .setWordWrapWidth(PW);
    slots.push(slot(sub, sub.height));

    // tu e la tua band, in fila
    const hero = this.add.image(0, 0, `personaggi-protagonista-${won ? "vittoria" : "colpito"}`);
    const band = run.band.map((id) => this.add.image(0, 0, `band-${id}-${won ? "saluta" : "suona"}`));
    const crew: Slot = {
      h: 200,
      at: (y) => {
        const size = crew.h;
        const bs = Math.min(110, size * 0.62);
        const step = band.length ? Math.min(bs, (PW - size - 10) / band.length) : 0;
        const total = size + band.length * step;
        let x = W / 2 - total / 2;
        hero.setDisplaySize(size, size).setPosition(x + size / 2, y);
        x += size;
        band.forEach((b, i) => b.setDisplaySize(bs, bs).setPosition(x + step * i + step / 2, y + size / 2 - bs / 2));
      },
    };
    slots.push(crew);

    // numeri della notte
    const st = run.stats;
    const acc = st.notesExpected ? Math.round((100 * st.notesHit) / st.notesExpected) : 0;
    const rows: [string, string][] = [
      [s("fightsWon"), `${st.won} / ${st.fights}`],
      [s("accuracy"), `${acc}%`],
      [s("totalScore"), String(st.score)],
    ];
    const RH = 44;
    const statsH = 50 + rows.length * RH + 46;
    slots.push({
      h: statsH,
      at: (y) => {
        const y0 = y - statsH / 2;
        panel(this, x0, y0, PW, statsH);
        txt(this, W / 2, y0 + 28, s("reached", { n: run.act + 1 }).toUpperCase(), 21, HEX.rosso).setLetterSpacing(2);
        rows.forEach(([k, v], i) => {
          const ry = y0 + 50 + RH / 2 + i * RH;
          txt(this, x0 + 32, ry, k, 24, HEX.inchiostro).setOrigin(0, 0.5);
          txt(this, x0 + PW - 32, ry, v, 30, HEX.inchiostro, "fori").setOrigin(1, 0.5);
        });
        // il record comprende sempre questa notte; se l'ha battuto si festeggia
        const by = y0 + statsH - 26;
        if (run.newBest) txt(this, W / 2, by, t("newBest").toUpperCase(), 22, HEX.rosso, "titoli");
        else txt(this, W / 2, by, s("bestRun", { n: Math.max(meta().bestScore, st.score) }), 21, HEX.indaco);
      },
    });

    // pagella: i fori più sbagliati, grandi e leggibili, da allenare
    const weak = weakest(run);
    const hint = weak.length ? txt(this, W / 2, 0, s("practiseHint"), 22, HEX.inchiostro).setWordWrapWidth(PW - 60) : null;
    const repH = 50 + (weak.length ? 96 + 36 : 70) + (hint ? hint.height + 14 : 0) + 18;
    slots.push({
      h: repH,
      at: (y) => {
        const y0 = y - repH / 2;
        panel(this, x0, y0, PW, repH, 0xf6d9a0);
        txt(this, W / 2, y0 + 28, s("report").toUpperCase(), 21, HEX.inchiostro).setLetterSpacing(2);
        if (weak.length === 0) txt(this, W / 2, y0 + 50 + 35, s("allClean"), 26, HEX.indaco, "titoli").setWordWrapWidth(PW - 40);
        weak.forEach((w, i) => {
          const x = W / 2 + (i - (weak.length - 1) / 2) * 200;
          const draw = w.label.includes("↓");
          const by = y0 + 52;
          const g = this.add.graphics();
          g.fillStyle(C.inchiostro, 1).fillRoundedRect(x - 80 + 5, by + 5, 160, 92, 12);
          g.fillStyle(draw ? C.indaco : C.ottone, 1).fillRoundedRect(x - 80, by, 160, 92, 12);
          g.lineStyle(3, C.inchiostro, 1).strokeRoundedRect(x - 80, by, 160, 92, 12);
          const label = txt(this, x, by + 46, w.label, 50, draw ? HEX.carta : HEX.inchiostro, "fori");
          if (!reducedMotion()) {
            label.setScale(0);
            this.tweens.add({ targets: label, scale: 1, delay: 300 + i * 200, duration: 260, ease: "Back.easeOut" });
          }
          txt(this, x, by + 92 + 24, `${Math.round(w.rate * 100)}% ✗`, 21, HEX.inchiostro);
        });
        if (hint) {
          hint.setY(y0 + repH - 18 - hint.height / 2);
          this.children.bringToTop(hint);
        }
      },
    });

    const again = () => {
      saveRun(null);
      leaveRun(this, "runStart");
    };
    const a = bigButton(this, W / 2, 0, `${s("again")} ▶`, again, 600, true, 90).setName("run-again");
    const d = bigButton(this, W / 2 - 160, 0, s("dojo"), () => leaveRun(this, "dojo"), 290, false, 76).setName("run-dojo");
    const tt = bigButton(this, W / 2 + 160, 0, s("title2"), () => leaveRun(this, "title"), 290, false, 76).setName("run-title");
    slots.push({
      h: 90 + 20 + 76,
      at: (y) => {
        a.setY(y - 93 + 45);
        d.setY(y + 93 - 38);
        tt.setY(y + 93 - 38);
      },
    });
    this.input.keyboard?.once("keydown-ENTER", again);

    // i personaggi prendono lo spazio che avanza
    const used = slots.reduce((acc2, x) => acc2 + x.h, 0) - crew.h;
    crew.h = Phaser.Math.Clamp(H - 50 - used - 16 * (slots.length - 1), 140, 260);
    spread(slots, 24, H - 26, 40, 14);
  }
}
