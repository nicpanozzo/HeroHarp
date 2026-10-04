// Componenti condivisi tra le scene, con i colori e i caratteri della guida di stile (style/tema.ts).
import Phaser from "phaser";
import { COLORI, COLORI_NUM, FONT } from "./style/tema";
import { save } from "./state";
import { getEngine } from "./audio/engine";

/**
 * Dimensioni del palco. In orizzontale 1280×720; sul telefono in verticale il palco è largo 720
 * e alto quanto serve per riempire lo schermo (da 1180 a 1560), così non restano bande nere.
 * Sono `let`: le scene le leggono al momento di disegnarsi, quindi girando il telefono basta ridisegnarle.
 */
export let W = 1280;
export let H = 720;
/** true quando il palco è in verticale (telefono tenuto dritto). */
export const portrait = (): boolean => H > W;

/** Il formato che serve alla finestra attuale. */
export function stageFor(width: number, height: number): { w: number; h: number } {
  if (height <= width) return { w: 1280, h: 720 };
  const h = Math.round(Phaser.Math.Clamp((720 * height) / Math.max(1, width), 1180, 1560) / 2) * 2;
  return { w: 720, h };
}

/** Adatta il palco alla finestra; true se il formato è cambiato. */
export function fitStage(width = window.innerWidth, height = window.innerHeight): boolean {
  const s = stageFor(width, height);
  const changed = s.w !== W || s.h !== H;
  W = s.w;
  H = s.h;
  return changed;
}
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
  // sul telefono dritto i pulsanti sono più alti: la scritta cresce con loro (le frecce ancora di più)
  const size = portrait() ? Math.round(Phaser.Math.Clamp(h * (label.length <= 2 ? 0.55 : 0.36), 22, label.length <= 2 ? 52 : 30)) : 22;
  const t = txt(scene, 0, 0, label.toUpperCase(), size, HEX.inchiostro, "titoli");
  // la scritta resta dentro il pulsante
  if (portrait() && t.width > w - 16) t.setFontSize(Math.max(16, Math.floor((size * (w - 16)) / t.width)));
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

/**
 * Sfondo di un luogo (tre livelli di parallasse). `dim` lo scurisce per far risaltare i pannelli.
 * Riempie il riquadro `area` (di solito tutto il palco) senza deformarsi: in verticale si vede la parte centrale.
 */
export function backdrop(
  scene: Phaser.Scene,
  layers: string[] | null = PORCH,
  dim = 0,
  area: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: W, h: H },
): Phaser.GameObjects.Image[] {
  const imgs = (layers ?? PORCH).map((k) => {
    const img = scene.add.image(area.x + area.w / 2, area.y + area.h, k).setOrigin(0.5, 1);
    // copre il riquadro: la scala più grande tra le due, ancorata in basso (il palco e il pavimento restano)
    const s = Math.max(area.w / img.width, area.h / img.height);
    img.setScale(s);
    img.setCrop((img.width - area.w / s) / 2, img.height - area.h / s, area.w / s, area.h / s);
    return img;
  });
  if (dim > 0) scene.add.rectangle(area.x + area.w / 2, area.y + area.h / 2, area.w, area.h, C.inchiostro, dim);
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

const feedbackText = new WeakMap<Phaser.Scene, Phaser.GameObjects.Text>();
const feedbackY = new WeakMap<Phaser.Scene, number>();
/** Dove compaiono i giudizi delle note in questa scena (in verticale il palco è disposto diversamente). */
export const setFeedbackY = (scene: Phaser.Scene, y: number): void => void feedbackY.set(scene, y);
/**
 * Il giudizio della nota (perfetto, bene, nota sbagliata, tieni…): uno solo alla volta, nello stesso punto,
 * così le scritte non si sovrappongono mai, nemmeno quando arrivano di fila.
 */
export function feedback(scene: Phaser.Scene, x: number, s: string, color: string, size = 26): Phaser.GameObjects.Text {
  const prev = feedbackText.get(scene);
  if (prev?.active) {
    scene.tweens.killTweensOf(prev);
    prev.destroy();
  }
  const t = pop(scene, x, feedbackY.get(scene) ?? 430, s, color, size);
  feedbackText.set(scene, t);
  return t;
}
