import Phaser from "phaser";
import { areaById } from "../content/areas";
import { getLang, t } from "../i18n";
import { stats } from "../stats/store";
import { dayStreak, lastDays, tabAccuracy, tabKey, weaknesses, type Weakness } from "../stats/stats";
import { makeDrill } from "../stats/drill";
import { maxBend } from "../harp";
import { C, W, H, HEX, txt, button, paper, panel, portrait } from "../ui";
import { showLesson } from "./lessons";

const GREEN = 0x5f8f4a;
/** Altezza di una scheda «da allenare» in verticale. */
const CARD_H = 190;
/** Colore di una precisione: verde sicura, ottone quasi, rosso da allenare. */
export const accColor = (a: number): number => (a >= 0.85 ? GREEN : a >= 0.6 ? C.ottone : C.rosso);

/** La pagella: quanto suoni, quali fori sono sicuri e cosa allenare, con lezione e allenamento a un tocco. */
export class StatsScene extends Phaser.Scene {
  private from = "title";
  /** In verticale (telefono dritto) i riquadri stanno uno sotto l'altro, con caratteri e pulsanti più grandi. */
  private P = false;

  constructor() {
    super("stats");
  }

  init(data: { from?: string }): void {
    this.from = data?.from ?? "title";
  }

  create(): void {
    paper(this);
    const P = (this.P = portrait());
    const back = () => this.scene.start(this.from === "result" ? "title" : this.from);
    button(this, P ? 76 : 70, P ? 60 : 56, "‹", back, P ? 84 : 64, false, P ? 72 : 50).setName("exit");
    this.input.keyboard?.on("keydown-ESC", back);
    this.events.once("shutdown", () => this.input.keyboard?.off("keydown-ESC"));
    txt(this, P ? W / 2 + 40 : W / 2, P ? 62 : 58, t("statsTitle").toUpperCase(), 44, HEX.inchiostro, "titoli").setShadow(4, 3, HEX.ottone, 0, false, true);
    if (P) return this.createPortrait();
    this.tiles();
    this.harp(40, 196, 600, 270);
    this.days(40, 484, 600, 206);
    this.focus(670, 196, 570, 494);
  }

  /**
   * In verticale: le quattro cifre in una griglia 2×2, poi l'armonica, i minuti al giorno e i punti deboli.
   * Sui telefoni bassi, se non c'è posto per tutto, il grafico dei giorni lascia spazio alle schede da allenare.
   */
  private createPortrait(): void {
    const x = 24;
    const w = W - 48;
    let y = this.tiles(x, 112, w);
    y = this.harp(x, y + 18, w, 286) + 18;
    const n = weaknesses(stats, 3).length;
    // spazio che servono le schede (o Zia Mae con il consiglio, se ce ne sono poche)
    const focusH = 40 + Math.max(1, n) * (CARD_H + 12) + (n > 0 && n < 3 ? 130 : n === 0 ? 100 : 0);
    const free = H - 24 - y - focusH;
    if (free >= 190) {
      const dh = Math.min(280, free - 18);
      this.days(x, y, w, dh);
      y += dh + 18;
    }
    this.focus(x, y, w, H - 24 - y);
  }

  private tiles(x0 = 40, top = 96, width = W - 80): number {
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
    // in verticale due per riga
    const cols = this.P ? 2 : 4;
    const th = this.P ? 96 : 82;
    const w = this.P ? (width - 18) / 2 : 282;
    const gap = (width - cols * w) / (cols - 1);
    items.forEach(([value, label], i) => {
      const x = x0 + (i % cols) * (w + gap);
      const y = top + Math.floor(i / cols) * (th + 16);
      panel(this, x, y, w, th);
      txt(this, x + w / 2, y + (this.P ? 34 : 28), value, this.P ? 40 : 36, HEX.inchiostro, "fori").setName(`tile-${i}`);
      txt(this, x + w / 2, y + (this.P ? 74 : 64), label.toUpperCase(), this.P ? 20 : 17, HEX.inchiostro).setLetterSpacing(2);
    });
    return top + Math.ceil(items.length / cols) * (th + 16) - 16;
  }

  /** L'armonica a colori: una casella per foro e respiro, più la riga dei bend. */
  private harp(x: number, y: number, w: number, h: number): number {
    const P = this.P;
    panel(this, x, y, w, h);
    txt(this, x + 20, y + (P ? 28 : 24), t("statHarp").toUpperCase(), P ? 21 : 18, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
    // in verticale le caselle sono un po' più grandi e riempiono la larghezza
    const cell = P ? 54 : 50;
    const gap = P ? 5 : 4;
    const gx = x + (P ? 60 : 62);
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
      const cy = y + (P ? 86 : 76) + r * (cell + 10);
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
    txt(this, x + w / 2, y + h - (P ? 26 : 22), t("statLegend"), P ? 20 : 17, HEX.inchiostro)
      .setAlpha(0.75)
      .setWordWrapWidth(P ? w - 30 : null);
    return y + h;
  }

  /** Minuti suonati negli ultimi 14 giorni. */
  private days(x: number, y: number, w: number, h: number): void {
    panel(this, x, y, w, h);
    const P = this.P;
    txt(this, x + 20, y + (P ? 28 : 24), t("statDays").toUpperCase(), P ? 20 : 17, HEX.inchiostro)
      .setOrigin(0, 0.5)
      .setLetterSpacing(P ? 1 : 2);
    const list = lastDays(stats, 14);
    const mins = list.map((d) => Math.round((d.day?.seconds ?? 0) / 60));
    const top = Math.max(10, ...mins);
    const base = y + h - (P ? 38 : 34);
    const area = h - (P ? 110 : 96);
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
        txt(this, bx + bw / 2, base - bh - (P ? 16 : 14), String(m), P ? 20 : 17, HEX.inchiostro, "fori");
      } else g.fillStyle(C.inchiostro, 0.2).fillRect(bx + 10, base - 3, bw - 22, 3);
    });
    txt(this, x + 30 + 13.5 * bw, base + (P ? 20 : 17), t("statToday"), P ? 20 : 16, HEX.inchiostro)
      .setOrigin(P ? 0.7 : 0.5, 0.5)
      .setAlpha(0.8);
  }

  /** I punti deboli, ognuno con la sua lezione e il suo allenamento. */
  private focus(x: number, y: number, w: number, h: number): void {
    txt(this, x + 4, y + 12, t("statFocus").toUpperCase(), 20, HEX.rosso)
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);
    const list = weaknesses(stats, 3);
    if (!list.length && this.P) {
      // in verticale Zia Mae a sinistra e il messaggio accanto, centrati nello spazio rimasto
      panel(this, x, y + 36, w, h - 36);
      const cy = y + 36 + (h - 36) / 2;
      this.add.image(x + 110, cy, "personaggi-zia-mae-spiega").setDisplaySize(Math.min(190, h - 60), Math.min(190, h - 60));
      txt(this, x + 220, cy, stats.totals.notes >= 60 ? t("statAllGood") : t("statEmpty"), 24, HEX.inchiostro)
        .setOrigin(0, 0.5)
        .setAlign("left")
        .setWordWrapWidth(w - 250)
        .setName("focus-empty");
      return;
    }
    if (!list.length) {
      panel(this, x, y + 36, w, h - 36);
      this.add.image(x + 120, y + 300, "personaggi-zia-mae-spiega").setScale(0.8);
      txt(this, x + 370, y + 230, stats.totals.notes >= 60 ? t("statAllGood") : t("statEmpty"), 22, HEX.inchiostro)
        .setWordWrapWidth(300)
        .setName("focus-empty");
      return;
    }
    const ch = this.P ? CARD_H : 148;
    const step = this.P ? ch + 12 : ch + 8;
    const y0 = y + (this.P ? 40 : 34);
    list.forEach((wk, i) => this.card(wk, i, x, y0 + i * step, w, ch));
    // posto libero sotto le schede: Zia Mae ricorda come si usa la pagella
    if (list.length < 3) {
      const top = y0 + list.length * step;
      const size = this.P ? Math.min(150, y + h - top) : 130;
      this.add.image(x + 70, top + (y + h - top) / 2 + 6, "personaggi-zia-mae-spiega").setDisplaySize(size, size);
      txt(this, x + 150, top + (y + h - top) / 2, t("statTip"), this.P ? 22 : 20, HEX.inchiostro)
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
    const detail = txt(this, x + 72, y + 50, wk.detail[lang], this.P ? 21 : 20, HEX.inchiostro)
      .setOrigin(0, 0)
      .setAlign("left")
      .setWordWrapWidth(w - 92);
    const area = areaById(wk.lesson.areaId);
    if (this.P) {
      // in verticale pulsanti più alti, a destra in fondo alla scheda; se il testo è lungo si stringe
      const bh = 62;
      const by = y + h - 14 - bh / 2;
      if (detail.y + detail.height > by - bh / 2 - 4) detail.setFontSize(18);
      button(this, x + w - 20 - 240 - 16 - 100, by, t("lessonBtn"), () => showLesson(this, area, wk.lesson.lessonId), 200, false, bh).setName(`lesson-${i}`);
      button(
        this,
        x + w - 20 - 120,
        by,
        `${t("drillBtn")} ▶`,
        () => {
          makeDrill(wk);
          this.scene.start("battle", { enemyId: "drill" });
        },
        240,
        true,
        bh,
      ).setName(`drill-${i}`);
      return;
    }
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
