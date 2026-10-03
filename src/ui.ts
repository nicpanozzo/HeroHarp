// Palette, stili di testo e piccoli componenti condivisi tra le scene.
import Phaser from "phaser";
import type { EnemyDef } from "./content/enemies";

export const W = 960;
export const H = 540;

export const C = {
  bg: 0x140f0b,
  bgLight: 0x221a13,
  wood: 0x3a2a1c,
  brass: 0xe0a948,
  brassDark: 0x8a6420,
  cream: 0xf1e8da,
  muted: 0xa99c8a,
  blow: 0x6fb3d4,
  draw: 0xe88468,
  good: 0x8fcf7a,
  bad: 0xe0533a,
};

export const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export const FONT_DISPLAY = "Rye, Georgia, serif";
export const FONT_BODY = "Barlow, 'Segoe UI', system-ui, sans-serif";

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, color = C.cream, display = false): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, s, {
      fontFamily: display ? FONT_DISPLAY : FONT_BODY,
      fontSize: `${size}px`,
      color: hex(color),
      fontStyle: display ? "normal" : "600",
      align: "center",
    })
    .setOrigin(0.5);
}

export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, w = 220, primary = true): Phaser.GameObjects.Container {
  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(primary ? (hover ? 0xf0bd5e : C.brass) : hover ? 0x4a3826 : C.wood, 1);
    bg.fillRoundedRect(-w / 2, -24, w, 48, 10);
    if (!primary) {
      bg.lineStyle(2, C.brassDark, 1);
      bg.strokeRoundedRect(-w / 2, -24, w, 48, 10);
    }
  };
  draw(false);
  const label_ = txt(scene, 0, 0, label, 20, primary ? C.bg : C.cream).setFontStyle("700");
  const c = scene.add.container(x, y, [bg, label_]).setSize(w, 48).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => draw(true));
  c.on("pointerout", () => draw(false));
  c.on("pointerup", onClick);
  return c;
}

/** Sfondo comune: un locale fumoso con un faro di luce. */
export function stage(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(C.bg, 1).fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(C.brass, 0.025).fillCircle(W / 2, -60, 260 + i * 70);
  }
  g.fillStyle(C.wood, 1).fillRect(0, H - 34, W, 34);
  g.fillStyle(C.brassDark, 0.5).fillRect(0, H - 34, W, 2);
}

/** Disegna un nemico con forme semplici; niente immagini esterne. */
export function drawEnemy(scene: Phaser.Scene, x: number, y: number, e: EnemyDef, scale = 1): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const dark = Phaser.Display.Color.IntegerToColor(e.color).darken(25).color;
  g.fillStyle(0x000000, 0.3).fillEllipse(0, 78, 120, 18);
  if (e.shape === "blob") {
    g.fillStyle(e.color, 1).fillEllipse(0, 10, 130, 140);
    g.fillStyle(dark, 1).fillEllipse(0, 50, 110, 50);
    g.fillStyle(C.cream, 1).fillRect(-30, 20, 60, 6); // bocca cucita
    for (let i = -24; i <= 24; i += 12) g.fillStyle(dark, 1).fillRect(i, 16, 3, 14);
  } else if (e.shape === "spiky") {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 18; i++) {
      const r = i % 2 ? 52 : 74;
      const a = (i / 18) * Math.PI * 2;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r + 6));
    }
    g.fillStyle(e.color, 1).fillPoints(pts, true);
    g.fillStyle(dark, 1).fillEllipse(0, 34, 50, 20);
    g.lineStyle(4, C.cream, 1).beginPath().moveTo(-18, 34).lineTo(-6, 28).lineTo(6, 40).lineTo(18, 30).strokePath();
  } else {
    g.fillStyle(C.brassDark, 1).fillTriangle(-70, 76, 70, 76, 0, -90);
    g.fillStyle(e.color, 1).fillTriangle(-58, 70, 58, 70, 0, -74);
    g.fillStyle(C.cream, 1).fillCircle(0, 20, 30);
    g.lineStyle(4, C.bg, 1).lineBetween(0, 20, 0, -2).lineBetween(0, 20, 16, 28);
    g.lineStyle(5, C.brass, 1).lineBetween(0, 60, 34, -60);
  }
  // occhi
  const eyeY = e.shape === "clock" ? -26 : -14;
  g.fillStyle(C.cream, 1).fillCircle(-22, eyeY, 13).fillCircle(22, eyeY, 13);
  g.fillStyle(C.bg, 1).fillCircle(-19, eyeY + 2, 6).fillCircle(19, eyeY + 2, 6);
  if (e.boss) g.fillStyle(C.brass, 1).fillTriangle(-26, -96, 26, -96, 0, -120);
  return scene.add.container(x, y, [g]).setScale(scale);
}

/** Testo che sale e svanisce, per danni e complimenti. */
export function pop(scene: Phaser.Scene, x: number, y: number, s: string, color = C.cream, size = 26): void {
  const t = txt(scene, x, y, s, size, color, true).setStroke(hex(C.bg), 5);
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1000, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
}
