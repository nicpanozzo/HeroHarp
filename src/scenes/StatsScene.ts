import Phaser from "phaser";
import { areaById } from "../content/areas";
import { getLang, t } from "../i18n";
import { stats } from "../stats/store";
import { dayStreak, lastDays, tabAccuracy, tabKey, weaknesses, type Weakness } from "../stats/stats";
import { makeDrill } from "../stats/drill";
import { maxBend } from "../harp";
import { C, W, HEX, txt, button, paper, panel } from "../ui";
import { showLesson } from "./lessons";

const GREEN = 0x5f8f4a;
/** Colore di una precisione: verde sicura, ottone quasi, rosso da allenare. */
export const accColor = (a: number): number => (a >= 0.85 ? GREEN : a >= 0.6 ? C.ottone : C.rosso);

/** La pagella: quanto suoni, quali fori sono sicuri e cosa allenare, con lezione e allenamento a un tocco. */
export class StatsScene extends Phaser.Scene {
  private from = "title";

  constructor() {
    super("stats");
  }

  init(data: { from?: string }): void {
    this.from = data?.from ?? "title";
  }

  create(): void {
    paper(this);
    const back = () => this.scene.start(this.from === "result" ? "title" : this.from);
    button(this, 70, 56, "‹", back, 64, false, 50).setName("exit");
    this.input.keyboard?.on("keydown-ESC", back);
    this.events.once("shutdown", () => this.input.keyboard?.off("keydown-ESC"));
    txt(this, W / 2, 58, t("statsTitle").toUpperCase(), 44, HEX.inchiostro, "titoli").setShadow(4, 3, HEX.ottone, 0, false, true);
    this.tiles();
    this.harp(40, 196, 600, 270);
    this.days(40, 484, 600, 206);
    this.focus(670, 196, 570, 494);
  }

  private tiles(): void {
    const tt = stats.totals;
    const mins = Math.round(tt.seconds / 60);
    const time = mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : `${mins}m`;
    const acc = tt.notes ? `${Math.round((tt.hits / tt.notes) * 100)}%` : "–";
    const items: [string, string][] = [
      [time, t("statTime")],
      [acc, t("statAccuracy")],
      [`${tt.wins}/${tt.battles}`, t("statWins")],
      [String(dayStreak(stats)), t("statStreak")],
    ];
    const w = 282;
    const gap = (W - 80 - 4 * w) / 3;
    items.forEach(([value, label], i) => {
      const x = 40 + i * (w + gap);
      panel(this, x, 96, w, 82);
      txt(this, x + w / 2, 124, value, 36, HEX.inchiostro, "fori").setName(`tile-${i}`);
      txt(this, x + w / 2, 160, label.toUpperCase(), 17, HEX.inchiostro).setLetterSpacing(2);
    });
  }

  /** L'armonica a colori: una casella per foro e respiro, più la riga dei bend. */
  private harp(x: number, y: number, w: number, h: number): void {
    panel(this, x, y, w, h);
    txt(this, x + 20, y + 24, t("statHarp").toUpperCase(), 18, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
    const cell = 50;
    const gap = 4;
    const gx = x + 62;
    const rows: { label: string; color: string; acc: (hole: number) => number | null | undefined }[] = [
      { label: "↑", color: HEX.ottone, acc: (hole) => tabAccuracy(stats, tabKey({ hole, draw: false, bend: 0 })) },
      { label: "↓", color: HEX.indaco, acc: (hole) => tabAccuracy(stats, tabKey({ hole, draw: true, bend: 0 })) },
      {
        label: "'",
        color: HEX.prugna,
        // tutti i bend di quel foro insieme; undefined = su quel foro non si piega
        acc: (hole) => {
          const draw = maxBend(hole, true) > 0;
          const depth = maxBend(hole, draw);
          if (!depth) return undefined;
          const accs = Array.from({ length: depth }, (_, i) => tabAccuracy(stats, tabKey({ hole, draw, bend: i + 1 }))).filter((a): a is number => a !== null);
          return accs.length ? Math.min(...accs) : null;
        },
      },
    ];
    rows.forEach((row, r) => {
      const cy = y + 76 + r * (cell + 10);
      txt(this, x + 34, cy, row.label, 34, row.color, "fori");
      for (let hole = 1; hole <= 10; hole++) {
        const cx = gx + (hole - 1) * (cell + gap) + cell / 2;
        const a = row.acc(hole);
        const g = this.add.graphics();
        if (a === undefined) {
          g.lineStyle(2, C.inchiostro, 0.15).strokeRect(cx - cell / 2, cy - cell / 2, cell, cell);
          continue;
        }
        g.fillStyle(C.inchiostro, 1).fillRect(cx - cell / 2 + 3, cy - cell / 2 + 3, cell, cell);
        g.fillStyle(a === null ? C.carta2 : accColor(a), 1).fillRect(cx - cell / 2, cy - cell / 2, cell, cell);
        g.lineStyle(3, C.inchiostro, 1).strokeRect(cx - cell / 2, cy - cell / 2, cell, cell);
        const light = a !== null && a < 0.85 && a >= 0.6;
        txt(this, cx, cy + 1, String(hole), 30, a === null ? HEX.inchiostro : light ? HEX.inchiostro : HEX.carta, "fori").setAlpha(a === null ? 0.45 : 1);
      }
    });
    txt(this, x + w / 2, y + h - 22, t("statLegend"), 17, HEX.inchiostro).setAlpha(0.75);
  }

  /** Minuti suonati negli ultimi 14 giorni. */
  private days(x: number, y: number, w: number, h: number): void {
    panel(this, x, y, w, h);
    txt(this, x + 20, y + 24, t("statDays").toUpperCase(), 17, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    const list = lastDays(stats, 14);
    const mins = list.map((d) => Math.round((d.day?.seconds ?? 0) / 60));
    const top = Math.max(10, ...mins);
    const base = y + h - 34;
    const area = h - 96;
    const bw = (w - 60) / 14;
    const g = this.add.graphics();
    g.lineStyle(2, C.inchiostro, 0.3).lineBetween(x + 24, base, x + w - 24, base);
    mins.forEach((m, i) => {
      const bx = x + 30 + i * bw;
      const bh = m ? Math.max(6, (m / top) * area) : 0;
      const isToday = i === mins.length - 1;
      if (bh) {
        g.fillStyle(C.inchiostro, 1).fillRect(bx + 6, base - bh + 3, bw - 10, bh - 3);
        g.fillStyle(isToday ? C.ottone : C.indaco, 1).fillRect(bx + 4, base - bh, bw - 10, bh);
        txt(this, bx + bw / 2, base - bh - 14, String(m), 17, HEX.inchiostro, "fori");
      } else g.fillStyle(C.inchiostro, 0.2).fillRect(bx + 10, base - 3, bw - 22, 3);
    });
    txt(this, x + 30 + 13.5 * bw, base + 17, t("statToday"), 16, HEX.inchiostro).setAlpha(0.8);
  }

  /** I punti deboli, ognuno con la sua lezione e il suo allenamento. */
  private focus(x: number, y: number, w: number, h: number): void {
    txt(this, x + 4, y + 12, t("statFocus").toUpperCase(), 20, HEX.rosso)
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
    const list = weaknesses(stats, 3);
    if (!list.length) {
      panel(this, x, y + 36, w, h - 36);
      this.add.image(x + 120, y + 300, "personaggi-zia-mae-spiega").setScale(0.8);
      txt(this, x + 370, y + 230, stats.totals.notes >= 60 ? t("statAllGood") : t("statEmpty"), 22, HEX.inchiostro)
        .setWordWrapWidth(300)
        .setName("focus-empty");
      return;
    }
    const ch = 148;
    list.forEach((wk, i) => this.card(wk, i, x, y + 34 + i * (ch + 8), w, ch));
    // posto libero sotto le schede: Zia Mae ricorda come si usa la pagella
    if (list.length < 3) {
      const top = y + 34 + list.length * (ch + 8);
      this.add.image(x + 70, top + (y + h - top) / 2 + 6, "personaggi-zia-mae-spiega").setDisplaySize(130, 130);
      txt(this, x + 150, top + (y + h - top) / 2, t("statTip"), 20, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setAlign("left")
        .setWordWrapWidth(w - 170);
    }
  }

  private card(wk: Weakness, i: number, x: number, y: number, w: number, h: number): void {
    const lang = getLang();
    panel(this, x, y, w, h);
    // numero della classifica, a sinistra, come un gettone
    const g = this.add.graphics();
    g.fillStyle(C.inchiostro, 1).fillCircle(x + 38, y + 38, 22);
    txt(this, x + 38, y + 39, String(i + 1), 26, HEX.carta, "fori");
    txt(this, x + 72, y + 30, wk.title[lang], 26, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setName(`focus-${i}`);
    txt(this, x + w - 20, y + 30, `${Math.round(wk.accuracy * 100)}%`, 26, Phaser.Display.Color.IntegerToColor(accColor(wk.accuracy)).rgba, "fori").setOrigin(
      1,
      0.5,
    );
    txt(this, x + 72, y + 50, wk.detail[lang], 20, HEX.inchiostro)
      .setOrigin(0, 0)
      .setAlign("left")
      .setWordWrapWidth(w - 92);
    const area = areaById(wk.lesson.areaId);
    button(this, x + w - 300, y + h - 24, t("lessonBtn"), () => showLesson(this, area, wk.lesson.lessonId), 170, false, 42).setName(`lesson-${i}`);
    button(
      this,
      x + w - 112,
      y + h - 24,
      `${t("drillBtn")} ▶`,
      () => {
        makeDrill(wk);
        this.scene.start("battle", { enemyId: "drill" });
      },
      190,
      true,
      42,
    ).setName(`drill-${i}`);
  }
}
