import Phaser from "phaser";
import type { AreaDef, Lesson } from "../content/areas";
import { getLang, t } from "../i18n";
import { C, W, H, HEX, txt, button, panel, portrait } from "../ui";

/** Dove sta ogni cosa nel riquadro: in orizzontale Zia Mae a sinistra e il testo a destra, in verticale lei in alto. */
function layout() {
  if (!portrait()) {
    const BOX = { x: 130, y: 80, w: W - 260, h: 560 };
    const COL = 480; // inizio della colonna di testo
    return { P: false, TOP: 110, BOX, COL, TEXT_W: BOX.x + BOX.w - COL - 40, HEAD_W: BOX.x + BOX.w - COL - 40, BODY: 0, mae: { x: 300, y: 400, size: 0 } };
  }
  // in verticale: il riquadro prende quasi tutto lo schermo, Zia Mae in alto a sinistra e il titolo accanto a lei
  const m = Math.round(Phaser.Math.Clamp((H - 1180) / 8, 20, 60));
  const BOX = { x: 22, y: m, w: W - 44, h: H - 2 * m };
  return {
    P: true,
    TOP: BOX.y + 56,
    BOX,
    COL: 60,
    TEXT_W: BOX.w - 76,
    HEAD_W: BOX.w - 250,
    BODY: BOX.y + 270,
    mae: { x: BOX.x + 112, y: BOX.y + 130, size: 210 },
  };
}
let L = layout();

/** Una pagina disegna il suo testo nel livello e, se può, dice dove finisce (serve in verticale per adattare il riquadro). */
type Page = (layer: Phaser.GameObjects.Container) => number | void;

/** Un riquadro di Zia Mae sopra la scena, con pagine da sfogliare. */
function overlay(scene: Phaser.Scene, pages: Page[], onDone?: () => void): void {
  L = layout();
  const { BOX, P } = L;
  const root = scene.add.container(0, 0).setDepth(20);
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, C.inchiostro, 0.6).setInteractive();
  root.add(shade);
  // in orizzontale riquadro e Zia Mae sono fissi; in verticale si ridisegnano a ogni pagina, alti quanto il testo
  if (!P) root.add([panel(scene, BOX.x, BOX.y, BOX.w, BOX.h), scene.add.image(L.mae.x, L.mae.y, "personaggi-zia-mae-spiega").setScale(1.05)]);
  const page = scene.add.container(0, 0);
  root.add(page);
  let i = 0;
  const show = () => {
    page.removeAll(true);
    let h = BOX.h;
    if (P) {
      page.add(scene.add.image(L.mae.x, L.mae.y, "personaggi-zia-mae-spiega").setDisplaySize(L.mae.size, L.mae.size));
      page.add(scene.add.rectangle(W / 2, L.BODY - 24, BOX.w - 60, 3, C.inchiostro, 0.25));
      const bottom = pages[i](page) ?? BOX.y + BOX.h;
      // il riquadro finisce poco sotto il testo (ma non diventa troppo piccolo) e resta centrato sullo schermo
      h = Phaser.Math.Clamp(bottom - BOX.y + 150, Math.min(BOX.h, H * 0.4), BOX.h);
      page.addAt(panel(scene, BOX.x, BOX.y, BOX.w, h), 0);
      page.y = Math.round((BOX.h - h) / 2);
    } else pages[i](page);
    const last = i === pages.length - 1;
    // in verticale il pulsante è largo e alto, comodo per il pollice
    const bw = P ? 300 : 200;
    const by = BOX.y + h - (P ? 64 : 50);
    if (pages.length > 1) page.add(txt(scene, P ? BOX.x + 80 : BOX.x + BOX.w - 250, by, `${i + 1}/${pages.length}`, P ? 24 : 18, HEX.inchiostro).setAlpha(0.6));
    page.add(
      button(
        scene,
        BOX.x + BOX.w - (P ? bw / 2 + 30 : 130),
        by,
        last ? t("maeOk") : t("next"),
        () => {
          if (last) {
            root.destroy(true);
            onDone?.();
          } else {
            i++;
            show();
          }
        },
        bw,
        true,
        P ? 76 : 52,
      ).setName("mae-ok"),
    );
  };
  show();
}

/** Testo a sinistra della colonna, che va a capo: restituisce la y sotto di esso. */
function para(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  y: number,
  s: string,
  size: number,
  color: string = HEX.inchiostro,
  head = false,
): number {
  // in verticale i titoli stanno accanto a Zia Mae, il resto sotto di lei su tutta la larghezza
  const x = head && L.P ? L.BOX.x + 230 : L.COL;
  const tx = txt(scene, x, y, s, size, color)
    .setOrigin(0, 0)
    .setAlign("left")
    .setWordWrapWidth(head ? L.HEAD_W : L.TEXT_W);
  layer.add(tx);
  return y + tx.height;
}

function lessonPage(scene: Phaser.Scene, area: AreaDef, l: Lesson): Page {
  return (layer) => {
    const lang = getLang();
    const head = `${area.extra ? t("extra") : t("area", { n: area.order })} · ${area.name[lang]}`.toUpperCase();
    const P = L.P;
    if (P) {
      layer.add(
        txt(scene, L.BOX.x + 230, L.TOP - 6, head, 18, HEX.rosso)
          .setOrigin(0, 0.5)
          .setAlign("left")
          .setLetterSpacing(3)
          .setWordWrapWidth(L.HEAD_W),
      );
    } else layer.add(txt(scene, L.COL, L.TOP, head, 15, HEX.rosso).setOrigin(0, 0.5).setLetterSpacing(3));
    let y = para(scene, layer, L.TOP + (P ? 16 : 22), l.title[lang].toUpperCase(), P ? 34 : 30, HEX.prugna, true) + 14;
    if (P) y = Math.max(y, L.BODY);
    // se il testo è lungo si rimpicciolisce, così resta nel riquadro
    const long = l.steps.reduce((n, s) => n + s[lang].length, 0) + l.mistakes.reduce((n, m) => n + m.problem[lang].length + m.fix[lang].length, 0) > 520;
    const body = (size: number, into: Phaser.GameObjects.Container): number => {
      const gap = P ? Math.round(size * 0.55) : 8;
      let yy = y;
      l.steps.forEach((s, k) => (yy = para(scene, into, yy, `${k + 1}. ${s[lang]}`, size) + gap));
      if (l.mistakes.length) {
        yy = para(scene, into, yy + gap, t("mistakes").toUpperCase(), P ? size - 4 : 15, HEX.indaco) + (P ? 8 : 4);
        for (const m of l.mistakes.slice(0, 2)) yy = para(scene, into, yy, `${m.problem[lang]} → ${m.fix[lang]}`, size - 1, HEX.indaco) + (P ? gap - 2 : 6);
      }
      return yy;
    };
    if (!P) return void body(long ? 17 : 19, layer);
    // in verticale c'è tanto spazio: il carattere più grande che ci sta sopra il pulsante
    const limit = L.BOX.y + L.BOX.h - 130;
    for (const size of [28, 26, 24, 22]) {
      const tmp = scene.add.container(0, 0);
      const bottom = body(size, tmp);
      if (bottom <= limit || size === 22) {
        layer.add(tmp.list.slice());
        tmp.destroy();
        return bottom;
      }
      tmp.destroy(true);
    }
  };
}

/** Le lezioni di una tappa: una pagina per tecnica, con i passi e gli errori tipici. */
export function showLessons(scene: Phaser.Scene, area: AreaDef, onDone?: () => void): void {
  overlay(
    scene,
    area.lessons.map((l) => lessonPage(scene, area, l)),
    onDone,
  );
}

/** Come si gioca: la spiegazione iniziale di Zia Mae. */
export function showIntro(scene: Phaser.Scene, onDone?: () => void): void {
  overlay(
    scene,
    [
      (layer) => {
        const P = L.P;
        let y = para(scene, layer, L.TOP, t("maeTitle").toUpperCase(), P ? 40 : 34, HEX.prugna, true) + 16;
        if (P) y = Math.max(y, L.BODY);
        y = para(scene, layer, y, t("maeIntro"), P ? 28 : 21) + (P ? 28 : 18);
        return para(scene, layer, y, t("keyboardHint"), P ? 23 : 17, HEX.indaco);
      },
    ],
    onDone,
  );
}

/** Una sola lezione, aperta dalla pagella per ripassare un punto debole. */
export function showLesson(scene: Phaser.Scene, area: AreaDef, lessonId: string, onDone?: () => void): void {
  const l = area.lessons.find((x) => x.id === lessonId) ?? area.lessons[0];
  if (l) overlay(scene, [lessonPage(scene, area, l)], onDone);
}
