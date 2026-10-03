// Componenti condivisi tra le scene, con i colori e i caratteri della guida di stile (style/tema.ts).
import Phaser from "phaser";
import { COLORI, COLORI_NUM, FONT } from "./style/tema";
import { save } from "./state";
import { getEngine } from "./audio/engine";

export const W = 1280;
export const H = 720;
export const C = COLORI_NUM;
export const HEX = COLORI;

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size = 22,
  color: string = HEX.inchiostro,
  kind: "titoli" | "testo" | "fori" = "testo",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, s, {
      fontFamily: FONT[kind],
      fontSize: `${size}px`,
      color,
      fontStyle: kind === "titoli" ? "normal" : "bold",
      align: "center",
    })
    .setOrigin(0.5);
}

/** Pulsante da manifesto: rettangolo pieno con contorno d'inchiostro e ombra sfalsata. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  w = 260,
  primary = true,
  h = 58,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(C.inchiostro, 1).fillRect(-w / 2 + 5, -h / 2 + 5, w, h);
    g.fillStyle(primary ? (hover ? 0xf0b04a : C.ottone) : hover ? C.carta : C.carta2, 1).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(3, C.inchiostro, 1).strokeRect(-w / 2, -h / 2, w, h);
  };
  draw(false);
  const t = txt(scene, 0, 0, label.toUpperCase(), 22, HEX.inchiostro, "titoli");
  const c = scene.add.container(x, y, [g, t]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => draw(true));
  c.on("pointerout", () => draw(false));
  c.on("pointerup", () => {
    tap();
    onClick();
  });
  return c;
}

let tapStep = 0;
/** Ogni tocco è una nota della scala della base: i menu suonano insieme alla musica. */
export function tap(): void {
  const engine = getEngine();
  if (engine.ctx.state === "running") engine.fx.notaGiusta(tapStep++ % 5);
}

/** Pannello di carta con contorno d'inchiostro, come un manifesto incollato. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: number = C.carta): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(C.inchiostro, 1).fillRect(x + 6, y + 6, w, h);
  g.fillStyle(fill, 1).fillRect(x, y, w, h);
  g.lineStyle(3, C.inchiostro, 1).strokeRect(x, y, w, h);
  return g;
}

const PORCH = ["sfondi-portico-1-cielo", "sfondi-portico-2-casa", "sfondi-portico-3-primo-piano"];

/** Sfondo di un luogo (tre livelli di parallasse). `dim` lo scurisce per far risaltare i pannelli. */
export function backdrop(scene: Phaser.Scene, layers: string[] | null = PORCH, dim = 0): Phaser.GameObjects.Image[] {
  const imgs = (layers ?? PORCH).map((k) => scene.add.image(W / 2, H / 2, k).setDisplaySize(W, H));
  if (dim > 0) scene.add.rectangle(W / 2, H / 2, W, H, C.inchiostro, dim);
  return imgs;
}

export const porch = (scene: Phaser.Scene, dim = 0) => backdrop(scene, PORCH, dim);

/** Fondo di carta semplice. */
export function paper(scene: Phaser.Scene): void {
  scene.add.rectangle(W / 2, H / 2, W, H, C.carta);
  const g = scene.add.graphics();
  // grana della carta: puntini casuali molto tenui
  const rnd = new Phaser.Math.RandomDataGenerator(["carta"]);
  for (let i = 0; i < 900; i++) g.fillStyle(C.carta2, 0.6).fillRect(rnd.between(0, W), rnd.between(0, H), 2, 2);
  g.lineStyle(4, C.rosso, 0.45).strokeRect(10, 9, W - 18, H - 18);
}

/** Testo che sale e svanisce, per danni e complimenti. */
export function pop(scene: Phaser.Scene, x: number, y: number, s: string, color: string = HEX.inchiostro, size = 32): Phaser.GameObjects.Text {
  const t = txt(scene, x, y, s, size, color, "titoli").setStroke(HEX.carta, 6);
  const reduce = reducedMotion();
  scene.tweens.add({ targets: t, y: reduce ? y : y - 60, alpha: 0, duration: 1100, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  return t;
}

export const reducedMotion = (): boolean => save.settings.reduceMotion || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
