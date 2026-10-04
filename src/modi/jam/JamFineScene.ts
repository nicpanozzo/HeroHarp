// Copiato da modes/src/jam/JamFineScene.ts con scripts/sync-content.mjs, non modificare qui.
// Fine del set: punteggio, statistiche, il disegno dell'assolo e la registrazione da riascoltare.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, grana, vaiA, coriandoli, verticale } from "../core/ui";
import { t, tx } from "../core/testi";
import { impostazioni } from "../core/impostazioni";
import { estensione } from "../core/armonica";
import { LICK } from "./lick";
import type { OpzioniJam } from "./JamScene";

export interface RisultatoJam {
  punti: number; hypeMax: number; nuovoRecord: boolean; frasi: number; bend: number; note: number; cambi: number; cambiTotali: number;
  lick: string[]; nuoviLick: string[]; storico: { punti: { t: number; m: number }[]; colore: number; mae: boolean }[];
  durata: number; inizio: number; audio: string | null; estensione: string; opzioni: OpzioniJam;
}

export class JamFineScene extends Phaser.Scene {
  private audio: HTMLAudioElement | null = null;
  constructor() { super("jamFine"); }

  create(r: RisultatoJam) {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    const g = this.add.graphics();
    g.fillStyle(COL.notte, 1).fillRect(0, 0, W, H);
    if (verticale()) return this.creaAlto(r, g);
    // manifesto
    g.fillStyle(COL.inchiostro, 1).fillRect(66, 26, 840, 490);
    g.fillStyle(COL.carta, 1).fillRect(60, 20, 840, 490);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(60, 20, 840, 490);
    g.fillStyle(COL.rosso, 1).fillRect(60, 20, 840, 64);
    titolo(this, W / 2, 52, t("fineJam"), 36, HEX.carta, HEX.inchiostro);
    testo(this, 200, 120, t("punti").toUpperCase(), 14, HEX.inchiostro, "fori");
    const p = testo(this, 200, 162, "0", 54, HEX.rosso, "titoli");
    this.tweens.addCounter({ from: 0, to: r.punti, duration: 600, ease: "Cubic.easeOut", onUpdate: (tw) => p.setText(String(Math.round(tw.getValue() ?? 0))) });
    if (r.nuovoRecord && r.punti > 0) {
      const timbro = testo(this, 200, 206, t("nuovoRecord").toUpperCase(), 18, HEX.rosso, "titoli").setAngle(-6).setAlpha(0).setScale(2);
      this.tweens.add({ targets: timbro, alpha: 1, scale: 1, delay: 600, duration: 250, ease: "Back.easeOut" });
      this.time.delayedCall(650, () => coriandoli(this));
    }
    const stat = [
      [t("hypeMax"), `${r.hypeMax}%`], [t("frasi"), r.frasi], [t("bendFatti"), r.bend],
      [t("cambiPresi"), `${r.cambi}/${r.cambiTotali}`], [t("lickTrovati"), `${r.lick.length}`],
    ] as const;
    stat.forEach(([k, v], i) => {
      const x = 360 + i * 108;
      testo(this, x, 120, String(k).toUpperCase(), 11, HEX.inchiostro, "fori").setWordWrapWidth(100);
      testo(this, x, 156, String(v), 30, HEX.inchiostro, "titoli");
    });
    // il disegno dell'assolo
    testo(this, W / 2, 228, t("ilTuoAssolo").toUpperCase(), 13, HEX.inchiostro, "fori");
    this.disegnaAssolo(r, g, { x: 100, y: 244, w: 760, h: 120 });


    // lick nuovi
    const nuovi = LICK.filter((l) => r.nuoviLick.includes(l.id));
    if (nuovi.length) {
      testo(this, W / 2, 386, `${t("lickTrovati")} · ${nuovi.length} ${tx("nuovi")}: ${nuovi.map((l) => l.nome[impostazioni.lingua]).join(" · ")}`, 15, HEX.prugna, "titoli").setWordWrapWidth(760);
    } else if (r.lick.length) {
      testo(this, W / 2, 386, `${t("lickTrovati")}: ${LICK.filter((l) => r.lick.includes(l.id)).map((l) => l.nome[impostazioni.lingua]).join(" · ")}`, 14, HEX.inchiostro).setWordWrapWidth(760);
    }

    // registrazione
    if (r.audio) {
      const play = bottone(this, 240, 440, "▶ " + t("riascolta"), () => {
        if (this.audio && !this.audio.paused) { this.audio.pause(); play.label.setText("▶ " + t("riascolta")); return; }
        this.audio ??= new Audio(r.audio!);
        this.audio.currentTime = 0; this.audio.play();
        this.audio.onended = () => play.label.setText("▶ " + t("riascolta"));
        play.label.setText("■ " + t("ferma"));
      }, { w: 190, primario: false, size: 16 });
      bottone(this, 440, 440, "⬇ " + t("scarica"), () => {
        const a = document.createElement("a");
        a.href = r.audio!; a.download = `jam-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${r.estensione}`;
        a.click();
      }, { w: 170, primario: false, size: 16 });
    } else if (r.opzioni.registra) testo(this, 340, 440, tx("nessunaRegistrazione"), 13, HEX.inchiostro);
    bottone(this, 640, 440, t("riprova"), () => vaiA(this, "jam", r.opzioni), { w: 150 });
    bottone(this, 800, 440, t("jukeJoint"), () => vaiA(this, "hub"), { w: 150, primario: false, size: 15 });
    testo(this, W / 2, 488, `${r.note} note · ${Math.round(r.durata)} s`, 12, HEX.inchiostro, "fori");
    this.events.once("shutdown", () => this.audio?.pause());
    this.input.keyboard?.once("keydown-ENTER", () => vaiA(this, "jam", r.opzioni));
    this.input.keyboard?.once("keydown-ESC", () => vaiA(this, "hub"));
    grana(this);
  }

  /** Telefono dritto: punti in grande, statistiche su due righe, il disegno dell'assolo e i pulsanti in fondo. */
  private creaAlto(r: RisultatoJam, g: Phaser.GameObjects.Graphics) {
    g.fillStyle(COL.inchiostro, 1).fillRect(22, 18, 508, H - 24);
    g.fillStyle(COL.carta, 1).fillRect(16, 12, 508, H - 24);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(16, 12, 508, H - 24);
    g.fillStyle(COL.rosso, 1).fillRect(16, 12, 508, 66);
    titolo(this, W / 2, 46, t("fineJam"), 34, HEX.carta, HEX.inchiostro, 460);
    testo(this, W / 2, 104, t("punti").toUpperCase(), 15, HEX.inchiostro, "fori");
    const p = testo(this, W / 2, 146, "0", 54, HEX.rosso, "titoli");
    this.tweens.addCounter({ from: 0, to: r.punti, duration: 600, ease: "Cubic.easeOut", onUpdate: (tw) => p.setText(String(Math.round(tw.getValue() ?? 0))) });
    if (r.nuovoRecord && r.punti > 0) {
      const timbro = testo(this, W / 2 + 150, 136, t("nuovoRecord").toUpperCase(), 19, HEX.rosso, "titoli").setAngle(-8).setAlpha(0);
      const k = Math.min(1, 150 / timbro.width);
      timbro.setScale(k * 2);

      this.tweens.add({ targets: timbro, alpha: 1, scale: k, delay: 600, duration: 250, ease: "Back.easeOut" });
      this.time.delayedCall(650, () => coriandoli(this));
    }
    const stat = [
      [t("hypeMax"), `${r.hypeMax}%`], [t("frasi"), r.frasi], [t("bendFatti"), r.bend],
      [t("cambiPresi"), `${r.cambi}/${r.cambiTotali}`], [t("lickTrovati"), `${r.lick.length}`],
    ] as const;
    // tre in alto e due sotto, con l'etichetta appoggiata sopra il numero
    stat.forEach(([k, v], i) => {
      const riga = i < 3 ? 0 : 1, x = riga === 0 ? W / 2 + (i - 1) * 164 : W / 2 + (i === 3 ? -82 : 82), y = 236 + riga * 84;
      testo(this, x, y, String(k).toUpperCase(), 15, HEX.inchiostro, "fori").setWordWrapWidth(150).setOrigin(0.5, 1);
      testo(this, x, y + 24, String(v), 30, HEX.inchiostro, "titoli");
    });
    // in fondo, dal basso: nota finale, pulsanti, registrazione, lick; il disegno dell'assolo prende il resto
    const yNote = H - 34, yBottoni = H - 88, yAudio = H - 154, yLick = H - 206;
    const alto = 392, basso = yLick - 36, hb = Math.min(320, basso - alto);
    const box = { x: 36, y: alto + (basso - alto - hb) / 2, w: 468, h: hb };
    testo(this, W / 2, box.y - 16, t("ilTuoAssolo").toUpperCase(), 15, HEX.inchiostro, "fori");
    this.disegnaAssolo(r, g, box);
    const nuovi = LICK.filter((l) => r.nuoviLick.includes(l.id));
    if (nuovi.length) {
      testo(this, W / 2, yLick, `${t("lickTrovati")} · ${nuovi.length} ${tx("nuovi")}: ${nuovi.map((l) => l.nome[impostazioni.lingua]).join(" · ")}`, 16, HEX.prugna, "titoli").setWordWrapWidth(470);
    } else if (r.lick.length) {
      testo(this, W / 2, yLick, `${t("lickTrovati")}: ${LICK.filter((l) => r.lick.includes(l.id)).map((l) => l.nome[impostazioni.lingua]).join(" · ")}`, 15, HEX.inchiostro).setWordWrapWidth(470);
    }
    if (r.audio) {
      const play = bottone(this, 152, yAudio, "▶ " + t("riascolta"), () => {
        if (this.audio && !this.audio.paused) { this.audio.pause(); play.label.setText("▶ " + t("riascolta")); return; }
        this.audio ??= new Audio(r.audio!);
        this.audio.currentTime = 0; this.audio.play();
        this.audio.onended = () => play.label.setText("▶ " + t("riascolta"));
        play.label.setText("■ " + t("ferma"));
      }, { w: 220, h: 56, primario: false, size: 18 });
      bottone(this, 388, yAudio, "⬇ " + t("scarica"), () => {
        const a = document.createElement("a");
        a.href = r.audio!; a.download = `jam-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${r.estensione}`;
        a.click();
      }, { w: 220, h: 56, primario: false, size: 18 });
    } else if (r.opzioni.registra) testo(this, W / 2, yAudio, tx("nessunaRegistrazione"), 15, HEX.inchiostro).setWordWrapWidth(460);
    bottone(this, 152, yBottoni, t("riprova"), () => vaiA(this, "jam", r.opzioni), { w: 220, h: 58, size: 21 });
    bottone(this, 388, yBottoni, t("jukeJoint"), () => vaiA(this, "hub"), { w: 220, h: 58, primario: false, size: 17 });
    testo(this, W / 2, yNote, `${r.note} note · ${Math.round(r.durata)} s`, 15, HEX.inchiostro, "fori");
    this.events.once("shutdown", () => this.audio?.pause());
    this.input.keyboard?.once("keydown-ENTER", () => vaiA(this, "jam", r.opzioni));
    this.input.keyboard?.once("keydown-ESC", () => vaiA(this, "hub"));
    grana(this);
  }

  /** Il disegno dell'assolo nel riquadro: una riga per battuta, la penna che scorre da sinistra a destra. */
  private disegnaAssolo(r: RisultatoJam, g: Phaser.GameObjects.Graphics, box: { x: number; y: number; w: number; h: number }) {
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(box.x, box.y, box.w, box.h, 8);
    const { min, max } = estensione(impostazioni.tonalita);
    const fine = r.inizio + r.durata;
    const xDi = (tm: number) => box.x + 10 + ((tm - r.inizio) / Math.max(1, fine - r.inizio)) * (box.w - 20);
    const yDi = (m: number) => box.y + box.h - 10 - ((m - min) / (max - min)) * (box.h - 20);
    for (let b = 0; b <= r.durata / ((60 / r.opzioni.bpm) * 4); b++) {
      const x = xDi(r.inizio + b * (60 / r.opzioni.bpm) * 4);
      g.lineStyle(1, COL.carta, b % 12 === 0 ? 0.35 : 0.1).lineBetween(x, box.y + 6, x, box.y + box.h - 6);
    }
    const s = this.add.graphics();
    for (const n of r.storico) {
      if (n.punti.length < 1 || n.mae) continue;
      s.lineStyle(4, n.colore, 1);
      s.beginPath(); s.moveTo(xDi(n.punti[0].t), yDi(n.punti[0].m));
      for (const q of n.punti) s.lineTo(xDi(q.t), yDi(q.m));
      if (n.punti.length === 1) s.lineTo(xDi(n.punti[0].t) + 2, yDi(n.punti[0].m));
      s.strokePath();
    }
    const maschera = this.make.graphics({}, false);
    s.setMask(maschera.createGeometryMask());
    this.tweens.addCounter({ from: 0, to: box.w, duration: 1800, onUpdate: (tw) => { maschera.clear().fillStyle(0xffffff).fillRect(box.x, box.y, tw.getValue() ?? 0, box.h); } });
  }
}
