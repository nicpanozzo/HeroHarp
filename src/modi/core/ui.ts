// Copiato da modes/src/core/ui.ts con scripts/sync-content.mjs, non modificare qui.
// Componenti grafici condivisi dalle modalità, nello stile "manifesto da juke joint"
// (style/guida-stile.md): forme piatte, inchiostro con ombra fuori registro, carta.

import Phaser from "phaser";
import { COLORI, COLORI_NUM } from "../../style/tema";

export const W = 960;
export const H = 540;
export const COL = {
  ...COLORI_NUM,
  notte: 0x15110e,
  legno: 0x6b4a2b,
  legnoScuro: 0x3a2818,
  lampada: 0xffd27a,
  neonRosa: 0xff5fa2,
  neonAzzurro: 0x5fe1ff,
  verde: 0x8a9a5b,
};
export const HEX = { ...COLORI, notte: "#15110E", lampada: "#FFD27A", neonRosa: "#FF5FA2", grigio: "#A9A49A" };
export const FONT = {
  titoli: "'Alfa Slab One', Rockwell, Georgia, serif",
  testo: "'Atkinson Hyperlegible', Verdana, system-ui, sans-serif",
};

export type Carattere = "titoli" | "testo" | "fori";

export function testo(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, colore: string = HEX.carta,
  carattere: Carattere = "testo"): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: carattere === "titoli" ? FONT.titoli : FONT.testo,
    fontSize: `${size}px`,
    color: colore,
    fontStyle: carattere === "testo" ? "normal" : "bold",
    align: "center",
  }).setOrigin(0.5).setResolution(2);
}

/** Titolo da cartellone con l'ombra "fuori registro" tipica della serigrafia. */
export function titolo(scene: Phaser.Scene, x: number, y: number, s: string, size = 44, colore: string = HEX.carta, ombra: string = HEX.rosso, maxW = Infinity) {
  const o = testo(scene, x + 3, y + 3, s.toUpperCase(), size, ombra, "titoli");
  const t = testo(scene, x, y, s.toUpperCase(), size, colore, "titoli");
  if (t.width > maxW) { const k = maxW / t.width; t.setScale(k); o.setScale(k); }
  const c = scene.add.container(0, 0, [o, t]);
  return Object.assign(c, { testo: t, ombra: o });
}

export interface OpzioniBottone { w?: number; h?: number; primario?: boolean; size?: number }

export function bottone(scene: Phaser.Scene, x: number, y: number, etichetta: string, azione: () => void, o: OpzioniBottone = {}) {
  const w = o.w ?? 200, h = o.h ?? 46, primario = o.primario ?? true;
  const g = scene.add.graphics();
  const label = testo(scene, 0, 0, etichetta, o.size ?? 19, primario ? HEX.inchiostro : HEX.carta, "titoli");
  const disegna = (stato: "su" | "sopra" | "giu") => {
    g.clear();
    const dx = stato === "giu" ? 2 : 0;
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w, h, 8);
    g.fillStyle(primario ? (stato === "sopra" ? 0xf3b24a : COL.ottone) : (stato === "sopra" ? 0x4a3826 : COL.legnoScuro), 1)
      .fillRoundedRect(-w / 2 + dx, -h / 2 + dx, w, h, 8);
    g.lineStyle(3, COL.inchiostro, 1).strokeRoundedRect(-w / 2 + dx, -h / 2 + dx, w, h, 8);
    if (!primario) g.lineStyle(2, COL.ottone, 0.8).strokeRoundedRect(-w / 2 + dx + 4, -h / 2 + dx + 4, w - 8, h - 8, 5);
    label.setPosition(dx, dx);
  };
  disegna("su");
  const c = scene.add.container(x, y, [g, label]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on("pointerover", () => disegna("sopra"));
  c.on("pointerout", () => disegna("su"));
  c.on("pointerdown", () => disegna("giu"));
  c.on("pointerup", () => { disegna("sopra"); azione(); });
  return Object.assign(c, { label });
}

/** Un'etichetta selezionabile (per le opzioni: modo, tempo, giri). */
export function scelta(scene: Phaser.Scene, x: number, y: number, etichetta: string, attiva: () => boolean, azione: () => void, w = 130, scuro = false) {
  const h = 38;
  const g = scene.add.graphics();
  const label = testo(scene, 0, 0, etichetta, 16, HEX.carta, "fori");
  const c = scene.add.container(x, y, [g, label]).setSize(w, h).setInteractive({ useHandCursor: true });
  const disegna = () => {
    const on = attiva();
    g.clear();
    if (on) g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, h / 2);
    const base = scuro ? COL.carta : COL.inchiostro;
    g.fillStyle(on ? COL.rosso : base, on ? 1 : scuro ? 0.08 : 0.18).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(on ? 3 : 2, on ? COL.inchiostro : base, on ? 1 : 0.6).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    label.setColor(on || scuro ? HEX.carta : HEX.inchiostro).setText((on ? "● " : "") + etichetta);
  };
  disegna();
  c.on("pointerup", () => { azione(); scene.events.emit("scelte-aggiorna"); });
  scene.events.on("scelte-aggiorna", disegna);
  return c;
}

/** Testo che salta fuori e svanisce (punti, complimenti). */
export function pop(scene: Phaser.Scene, x: number, y: number, s: string, colore: string = HEX.carta, size = 24, durata = 1100) {
  const t = testo(scene, x, y, s, size, colore, "titoli").setStroke(HEX.inchiostro, 6).setScale(0.4).setDepth(50);
  scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: "Back.easeOut" });
  scene.tweens.add({ targets: t, y: y - 46, alpha: 0, delay: durata * 0.45, duration: durata * 0.55, ease: "Cubic.easeIn", onComplete: () => t.destroy() });
  return t;
}

/** Texture di grana della carta, da sovrapporre a tutto con un'opacità bassa. */
export function grana(scene: Phaser.Scene, alpha = 0.5) {
  if (!scene.textures.exists("grana")) {
    const tex = scene.textures.createCanvas("grana", 256, 256)!;
    const ctx = tex.getContext();
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      // granelli d'inchiostro e di carta sparsi, molto trasparenti
      const chiaro = Math.random() < 0.5;
      img.data[i] = chiaro ? 241 : 30; img.data[i + 1] = chiaro ? 228 : 26; img.data[i + 2] = chiaro ? 200 : 23;
      img.data[i + 3] = Math.random() < 0.35 ? Math.random() * 90 : 0;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
  }
  return scene.add.tileSprite(W / 2, H / 2, W, H, "grana").setAlpha(alpha).setDepth(1000);
}

/** Punto luminoso morbido, usato per luci, lucciole e scintille. */
export function textureLuce(scene: Phaser.Scene) {
  if (scene.textures.exists("luce")) return "luce";
  const tex = scene.textures.createCanvas("luce", 64, 64)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); tex.refresh();
  return "luce";
}

/** Coriandoli di carta colorata. */
export function textureCoriandolo(scene: Phaser.Scene) {
  if (scene.textures.exists("coriandolo")) return "coriandolo";
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 10, 6);
  g.generateTexture("coriandolo", 10, 6); g.destroy();
  return "coriandolo";
}

export function coriandoli(scene: Phaser.Scene, x = W / 2, y = -10, quanti = 80) {
  const e = scene.add.particles(x, y, textureCoriandolo(scene), {
    x: { min: -W / 2, max: W / 2 }, speedY: { min: 120, max: 300 }, speedX: { min: -60, max: 60 },
    rotate: { start: 0, end: 720 }, lifespan: 3500, gravityY: 60, quantity: 4, frequency: 30,
    tint: [COL.ottone, COL.rosso, COL.indaco, COL.prugna, COL.carta], emitting: true,
  }).setDepth(60);
  scene.time.delayedCall(Math.max(200, quanti * 8), () => e.stop());
  scene.time.delayedCall(5000, () => e.destroy());
  return e;
}

/** Dissolvenza in nero e cambio scena. */
export function vaiA(scene: Phaser.Scene, chiave: string, dati?: object) {
  scene.cameras.main.fadeOut(120, 21, 17, 14);
  scene.cameras.main.once("camerafadeoutcomplete", () => scene.scene.start(chiave, dati));
}

export const ridotto = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
