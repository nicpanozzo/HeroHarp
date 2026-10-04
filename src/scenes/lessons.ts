import Phaser from "phaser";
import type { AreaDef, Lesson } from "../content/areas";
import { getLang, t } from "../i18n";
import { C, W, H, HEX, txt, button, panel } from "../ui";

const TOP = 110;
const BOX = { x: 130, y: 80, w: W - 260, h: 560 };
const COL = 480; // inizio della colonna di testo
const TEXT_W = BOX.x + BOX.w - COL - 40;

/** Un riquadro di Zia Mae sopra la scena, con pagine da sfogliare. */
function overlay(scene: Phaser.Scene, pages: ((layer: Phaser.GameObjects.Container) => void)[], onDone?: () => void): void {
  const root = scene.add.container(0, 0).setDepth(20);
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, C.inchiostro, 0.6).setInteractive();
  root.add([shade, panel(scene, BOX.x, BOX.y, BOX.w, BOX.h), scene.add.image(300, 400, "personaggi-zia-mae-spiega").setScale(1.05)]);
  const page = scene.add.container(0, 0);
  root.add(page);
  let i = 0;
  const show = () => {
    page.removeAll(true);
    pages[i](page);
    const last = i === pages.length - 1;
    if (pages.length > 1) page.add(txt(scene, BOX.x + BOX.w - 250, BOX.y + BOX.h - 50, `${i + 1}/${pages.length}`, 18, HEX.inchiostro).setAlpha(0.6));
    page.add(
      button(
        scene,
        BOX.x + BOX.w - 130,
        BOX.y + BOX.h - 50,
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
        200,
        true,
        52,
      ).setName("mae-ok"),
    );
  };
  show();
}

/** Testo a sinistra della colonna, che va a capo: restituisce la y sotto di esso. */
function para(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, y: number, s: string, size: number, color: string = HEX.inchiostro): number {
  const tx = txt(scene, COL, y, s, size, color).setOrigin(0, 0).setAlign("left").setWordWrapWidth(TEXT_W);
  layer.add(tx);
  return y + tx.height;
}

function lessonPage(scene: Phaser.Scene, area: AreaDef, l: Lesson) {
  return (layer: Phaser.GameObjects.Container) => {
    const lang = getLang();
    const head = `${area.extra ? t("extra") : t("area", { n: area.order })} · ${area.name[lang]}`.toUpperCase();
    layer.add(txt(scene, COL, TOP, head, 15, HEX.rosso).setOrigin(0, 0.5).setLetterSpacing(3));
    let y = para(scene, layer, TOP + 22, l.title[lang].toUpperCase(), 30, HEX.prugna) + 14;
    // se il testo è lungo si rimpicciolisce, così resta nel riquadro
    const long = l.steps.reduce((n, s) => n + s[lang].length, 0) + l.mistakes.reduce((n, m) => n + m.problem[lang].length + m.fix[lang].length, 0) > 520;
    const size = long ? 17 : 19;
    l.steps.forEach((s, k) => (y = para(scene, layer, y, `${k + 1}. ${s[lang]}`, size) + 8));
    if (l.mistakes.length) {
      y = para(scene, layer, y + 8, t("mistakes").toUpperCase(), 15, HEX.indaco) + 4;
      for (const m of l.mistakes.slice(0, 2)) y = para(scene, layer, y, `${m.problem[lang]} → ${m.fix[lang]}`, size - 1, HEX.indaco) + 6;
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
        let y = para(scene, layer, TOP, t("maeTitle").toUpperCase(), 34, HEX.prugna) + 16;
        y = para(scene, layer, y, t("maeIntro"), 21) + 18;
        para(scene, layer, y, t("keyboardHint"), 17, HEX.indaco);
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
