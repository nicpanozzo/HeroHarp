// Copiato da modes/src/riff/RiffFineScene.ts con scripts/sync-content.mjs, non modificare qui.
// Risultato di un riff: stelle, precisione, combo e punteggio.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, grana, vaiA, verticale } from "../core/ui";
import { t } from "../core/testi";
import { impostazioni } from "../core/impostazioni";
import type { OpzioniRiff } from "./RiffScene";

interface Dati {
  opzioni: OpzioniRiff; nome: { it: string; en: string }; punti: number; stelle: number; precisione: number;
  comboMax: number; conteggio: { perfetto: number; bene: number; mancata: number }; nuovo: boolean;
}

export class RiffFineScene extends Phaser.Scene {
  constructor() { super("riffFine"); }

  create(d: Dati) {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b1022, 0x0b1022, 0x2a1d14, 0x2a1d14, 1).fillRect(0, 0, W, H);
    if (verticale()) return this.creaAlto(d, g);
    g.fillStyle(COL.inchiostro, 1).fillRect(186, 40, 600, 440);
    g.fillStyle(COL.rosso, 1).fillRect(180, 34, 600, 440);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(180, 34, 600, 440);
    titolo(this, 480, 80, d.nome[impostazioni.lingua], 32, HEX.carta, HEX.inchiostro, 540);
    for (let i = 0; i < 3; i++) {
      const s = testo(this, 400 + i * 80, 150, "★", 70, i < d.stelle ? HEX.lampada : "#7a2a1d", "titoli").setStroke(HEX.inchiostro, 6).setScale(0);
      this.tweens.add({ targets: s, scale: 1, delay: 150 + i * 160, duration: 220, ease: "Back.easeOut" });
    }
    const voto = d.precisione >= 0.95 ? "S" : d.precisione >= 0.85 ? "A" : d.precisione >= 0.7 ? "B" : d.precisione >= 0.55 ? "C" : "D";
    testo(this, 690, 160, voto, 64, HEX.carta, "titoli").setStroke(HEX.inchiostro, 8).setAngle(-8);
    const righe: [string, string][] = [
      [t("punti"), String(d.punti)], [t("precisione"), `${Math.round(d.precisione * 100)}%`], [t("comboMax"), String(d.comboMax)],
      [t("perfetto"), String(d.conteggio.perfetto)], [t("bene"), String(d.conteggio.bene)], [t("mancata"), String(d.conteggio.mancata)],
    ];
    righe.forEach(([k, v], i) => {
      const x = 290 + (i % 3) * 190, y = 250 + Math.floor(i / 3) * 74;
      testo(this, x, y, k.toUpperCase(), 12, HEX.carta, "fori");
      testo(this, x, y + 28, v, 28, HEX.carta, "titoli");
    });
    if (d.nuovo && d.punti > 0) testo(this, 480, 396, t("nuovoRecord").toUpperCase(), 20, HEX.lampada, "titoli").setAngle(-3);
    bottone(this, 305, 440, t("riprova"), () => vaiA(this, "riff", d.opzioni), { w: 160 });
    bottone(this, 482, 440, t("scegliRiff"), () => vaiA(this, "riffMenu"), { w: 178, primario: false, size: 15 });
    bottone(this, 655, 440, "Juke Joint", () => vaiA(this, "hub"), { w: 150, primario: false, size: 15 });
    grana(this, 0.35);
    this.input.keyboard?.once("keydown-ENTER", () => vaiA(this, "riff", d.opzioni));
    this.input.keyboard?.once("keydown-ESC", () => vaiA(this, "riffMenu"));
  }

  /** Telefono dritto: il cartello rosso al centro, stelle e voto in alto, numeri in due righe, pulsanti grandi in fondo. */
  private creaAlto(d: Dati, g: Phaser.GameObjects.Graphics) {
    // sui telefoni lunghi il cartello si allunga: le righe si allargano con lui
    const ph = Math.round(600 + Math.max(0, H - 885) * 0.6), top = Math.round((H - ph) / 2);
    const Y = (y: number) => top + Math.round((y * ph) / 600);
    g.fillStyle(COL.inchiostro, 1).fillRect(22, top + 6, 508, ph);
    g.fillStyle(COL.rosso, 1).fillRect(16, top, 508, ph);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(16, top, 508, ph);
    titolo(this, W / 2, Y(48), d.nome[impostazioni.lingua], 32, HEX.carta, HEX.inchiostro, 460);
    for (let i = 0; i < 3; i++) {
      const s = testo(this, W / 2 - 40 + (i - 1) * 84, Y(130), "★", 70, i < d.stelle ? HEX.lampada : "#7a2a1d", "titoli").setStroke(HEX.inchiostro, 6).setScale(0);
      this.tweens.add({ targets: s, scale: 1, delay: 150 + i * 160, duration: 220, ease: "Back.easeOut" });
    }
    const voto = d.precisione >= 0.95 ? "S" : d.precisione >= 0.85 ? "A" : d.precisione >= 0.7 ? "B" : d.precisione >= 0.55 ? "C" : "D";
    testo(this, W - 84, Y(128), voto, 64, HEX.carta, "titoli").setStroke(HEX.inchiostro, 8).setAngle(-8);
    const righe: [string, string][] = [
      [t("punti"), String(d.punti)], [t("precisione"), `${Math.round(d.precisione * 100)}%`], [t("comboMax"), String(d.comboMax)],
      [t("perfetto"), String(d.conteggio.perfetto)], [t("bene"), String(d.conteggio.bene)], [t("mancata"), String(d.conteggio.mancata)],
    ];
    righe.forEach(([k, v], i) => {
      const x = W / 2 + ((i % 3) - 1) * 160, y = Y(222 + Math.floor(i / 3) * 84);
      const et = testo(this, x, y, k.toUpperCase(), 15, HEX.carta, "fori");
      if (et.width > 150) et.setScale(150 / et.width);
      testo(this, x, y + 32, v, 30, HEX.carta, "titoli");
    });
    if (d.nuovo && d.punti > 0) testo(this, W / 2, Y(400), t("nuovoRecord").toUpperCase(), 22, HEX.lampada, "titoli").setAngle(-3);
    bottone(this, W / 2, Y(464), t("riprova"), () => vaiA(this, "riff", d.opzioni), { w: 300, h: 58, size: 22 });
    bottone(this, 150, Y(540), t("scegliRiff"), () => vaiA(this, "riffMenu"), { w: 224, h: 56, primario: false, size: 17 });
    bottone(this, 390, Y(540), "Juke Joint", () => vaiA(this, "hub"), { w: 224, h: 56, primario: false, size: 17 });
    grana(this, 0.35);
    this.input.keyboard?.once("keydown-ENTER", () => vaiA(this, "riff", d.opzioni));
    this.input.keyboard?.once("keydown-ESC", () => vaiA(this, "riffMenu"));
  }

}
