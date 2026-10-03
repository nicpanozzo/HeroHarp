// Copiato da modes/src/jam/JamFineScene.ts con scripts/sync-content.mjs, non modificare qui.
// Fine del set: punteggio, statistiche, il disegno dell'assolo e la registrazione da riascoltare.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, grana, vaiA, coriandoli } from "../core/ui";
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
    const box = { x: 100, y: 244, w: 760, h: 120 };
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
    // la penna disegna da sinistra a destra
    const maschera = this.make.graphics({}, false);
    s.setMask(maschera.createGeometryMask());
    this.tweens.addCounter({ from: 0, to: box.w, duration: 1800, onUpdate: (tw) => { maschera.clear().fillStyle(0xffffff).fillRect(box.x, box.y, tw.getValue() ?? 0, box.h); } });

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
}
