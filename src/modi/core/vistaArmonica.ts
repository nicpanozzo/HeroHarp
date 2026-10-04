// Copiato da modes/src/core/vistaArmonica.ts con scripts/sync-content.mjs, non modificare qui.
// L'armonica disegnata in basso: 10 fori numerati, metà alta = soffio, metà bassa = aspirato.
// Si accende sul foro che stai suonando e può "suggerire" fori (es. note dell'accordo).

import Phaser from "phaser";
import { COL, HEX, testo } from "./ui";
import type { Tab } from "./armonica";

export class VistaArmonica extends Phaser.GameObjects.Container {
  readonly passo: number;
  private luce: Phaser.GameObjects.Graphics;
  private suggeriti: Phaser.GameObjects.Graphics;
  private bendTxt: Phaser.GameObjects.Text;
  private ultimo = "";

  /** grande = numeri dei fori più grossi, per il telefono tenuto dritto. */
  constructor(scene: Phaser.Scene, x: number, y: number, readonly larghezza = 520, readonly altezza = 64, readonly grande = false) {
    super(scene, x, y);
    this.passo = larghezza / 10;
    const g = scene.add.graphics();
    const w = larghezza, h = altezza;
    // ombra fuori registro, coperchi in metallo, pettine
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 - 14 + 5, -h / 2 - 10 + 5, w + 28, h + 20, 12);
    g.fillStyle(0xc9c6bd, 1).fillRoundedRect(-w / 2 - 14, -h / 2 - 10, w + 28, h + 20, 12);
    g.fillStyle(0xe9e6dd, 1).fillRoundedRect(-w / 2 - 14, -h / 2 - 10, w + 28, 10, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(3, COL.inchiostro, 1).strokeRoundedRect(-w / 2 - 14, -h / 2 - 10, w + 28, h + 20, 12);
    g.fillStyle(COL.legno, 1).fillRect(-w / 2, -h / 2 + 6, w, h - 12);
    for (let i = 0; i < 10; i++) {
      const cx = -w / 2 + this.passo * (i + 0.5);
      g.fillStyle(COL.inchiostro, 1).fillRoundedRect(cx - this.passo * 0.32, -h / 2 + 12, this.passo * 0.64, h - 24, 4);
    }
    this.suggeriti = scene.add.graphics();
    this.luce = scene.add.graphics();
    this.add([g, this.suggeriti, this.luce]);
    for (let i = 0; i < 10; i++) {
      const cx = -w / 2 + this.passo * (i + 0.5);
      const badge = scene.add.graphics();
      const [bw, bh] = grande ? [Math.min(40, this.passo - 6), 34] : [28, 26];
      badge.fillStyle(COL.inchiostro, 1).fillRoundedRect(cx - bw / 2, -h / 2 - 12 - bh, bw, bh, 6);
      this.add(badge);
      this.add(testo(scene, cx, -h / 2 - 12 - bh / 2, String(i + 1), grande ? 25 : 20, HEX.carta, "titoli"));
    }
    this.bendTxt = testo(scene, 0, h / 2 + (grande ? 28 : 24), "", grande ? 22 : 18, HEX.lampada, "titoli").setStroke(HEX.inchiostro, 4);
    this.add(this.bendTxt);
    scene.add.existing(this);
  }

  /** Centro x (locale) del foro. */
  xForo(foro: number) { return -this.larghezza / 2 + this.passo * (foro - 0.5); }

  /** Evidenzia il foro suonato; null = silenzio. */
  accendi(tab: Tab | null, etichetta = "") {
    const chiave = tab ? `${tab.hole}${tab.draw}${tab.bend}` : "";
    if (chiave === this.ultimo) return;
    this.ultimo = chiave;
    this.luce.clear();
    this.bendTxt.setText(etichetta);
    if (!tab) return;
    const cx = this.xForo(tab.hole), h = this.altezza;
    const colore = tab.bend ? COL.prugna : tab.draw ? COL.indaco : COL.ottone;
    this.luce.fillStyle(colore, 0.35).fillCircle(cx, 0, this.passo * 0.9);
    this.luce.fillStyle(colore, 1).fillRoundedRect(cx - this.passo * 0.32, -h / 2 + 12, this.passo * 0.64, h - 24, 4);
    this.luce.lineStyle(3, COL.carta, 1).strokeRoundedRect(cx - this.passo * 0.32, -h / 2 + 12, this.passo * 0.64, h - 24, 4);
    // freccia: su per il soffio, giù per l'aspirato
    const k = this.grande ? 1.5 : 1;
    const dy = (tab.draw ? 8 : -8) * k;
    this.luce.fillStyle(COL.carta, 1).fillTriangle(cx - 7 * k, -dy * 0.2, cx + 7 * k, -dy * 0.2, cx, dy);
    for (let b = 0; b < tab.bend; b++) this.luce.lineStyle(2, COL.prugna, 1).strokeCircle(cx, 0, this.passo * (0.62 + b * 0.16));
  }

  /** Mostra dei puntini sotto/sopra i fori consigliati (soffio sopra, aspirato sotto). */
  suggerisci(fori: Tab[], colore: number = COL.lampada) {
    this.suggeriti.clear();
    const h = this.altezza;
    for (const t of fori) {
      const cx = this.xForo(t.hole);
      const y = t.draw ? h / 2 + 8 : -h / 2 - 6;
      this.suggeriti.fillStyle(colore, 0.25).fillCircle(cx, y, 10);
      this.suggeriti.fillStyle(t.bend ? COL.prugna : colore, 1).fillCircle(cx, y, 5);
    }
  }
}
