// Copiato da modes/src/jam/JamMenuScene.ts con scripts/sync-content.mjs, non modificare qui.
// Menu della Jam Libera: modo, tempo, giri, registrazione e la collezione di lick.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, scelta, grana, vaiA, verticale } from "../core/ui";
import { t, tx } from "../core/testi";
import { impostazioni, record, salva } from "../core/impostazioni";
import { Registratore } from "../core/suono";
import { LICK } from "./lick";
import type { OpzioniJam } from "./JamScene";

const TEMPI = [{ id: "lento", bpm: 72 }, { id: "medio", bpm: 88 }, { id: "veloce", bpm: 108 }] as const;
export const scelteJam: OpzioniJam = { modo: "assolo", bpm: 88, giri: 2, registra: true };
const scelte = scelteJam;

export class JamMenuScene extends Phaser.Scene {
  constructor() { super("jamMenu"); }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.events.off("scelte-aggiorna");
    const g = this.add.graphics();
    g.fillStyle(0x2a1d14, 1).fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 48) g.fillStyle(x % 96 ? 0x281b12 : 0x2f2117, 1).fillRect(x, 0, 46, H);
    if (verticale()) return this.creaAlto(g);
    // locandina a sinistra
    g.fillStyle(COL.inchiostro, 1).fillRect(36, 30, 470, 486);
    g.fillStyle(COL.ottone, 1).fillRect(30, 24, 470, 486);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(30, 24, 470, 486);
    titolo(this, 265, 72, t("jamTitolo"), 46, HEX.inchiostro, HEX.carta);
    testo(this, 265, 116, t("jamPoster"), 16, HEX.inchiostro, "testo").setWordWrapWidth(400);

    const riga = (y: number, etichetta: string) => testo(this, 60, y, etichetta.toUpperCase(), 13, HEX.inchiostro, "fori").setOrigin(0, 0.5);
    riga(160, "Modo");
    scelta(this, 150 + 70, 190, t("jamModoLibero"), () => scelte.modo === "assolo", () => (scelte.modo = "assolo"), 170);
    scelta(this, 150 + 250, 190, t("jamModoScambio"), () => scelte.modo === "scambio", () => (scelte.modo = "scambio"), 170);
    const desc = testo(this, 265, 226, "", 13, HEX.inchiostro).setWordWrapWidth(420);
    const aggiornaDesc = () => desc.setText(t(scelte.modo === "assolo" ? "jamModoLiberoDesc" : "jamModoScambioDesc"));
    aggiornaDesc();
    this.events.on("scelte-aggiorna", aggiornaDesc);

    riga(258, t("tempo"));
    TEMPI.forEach((tp, i) => scelta(this, 125 + i * 125, 288, `${t(tp.id)} ${tp.bpm}`, () => scelte.bpm === tp.bpm, () => (scelte.bpm = tp.bpm), 116));
    riga(326, t("jamGiri"));
    [2, 3, 5].forEach((n, i) => scelta(this, 125 + i * 125, 356, `${n} × 12`, () => scelte.giri === n, () => (scelte.giri = n), 116));
    riga(394, "Audio");
    scelta(this, 125, 424, tx("cuffieNo"), () => !record.cuffie, () => { record.cuffie = false; salva(); }, 116);
    scelta(this, 250, 424, tx("cuffieSi"), () => record.cuffie, () => { record.cuffie = true; salva(); }, 116);
    if (Registratore.disponibile()) scelta(this, 390, 424, scelte.registra ? tx("registraSi") : tx("registraNo"), () => scelte.registra, () => {
      scelte.registra = !scelte.registra;
      this.scene.restart();
    }, 150);
    testo(this, 265, 462, tx("cuffieDesc"), 12, HEX.inchiostro).setWordWrapWidth(430);
    bottone(this, 190, 498, t("indietro"), () => vaiA(this, "hub"), { w: 150, primario: false });
    bottone(this, 360, 498, t("gioca") + " ▶", () => this.parti(), { w: 170 });

    // collezione di lick a destra
    titolo(this, 735, 52, tx("collezione"), 22, HEX.carta, HEX.rosso);
    testo(this, 735, 80, `${record.lick.length}/${LICK.length} · ${tx("collezioneAiuto")}`, 13, HEX.grigio);
    LICK.forEach((l, i) => {
      const x = 598 + (i % 3) * 136, y = 132 + Math.floor(i / 3) * 84;
      const preso = record.lick.includes(l.id);
      const c = this.add.graphics();
      c.fillStyle(COL.inchiostro, 1).fillRoundedRect(x - 60, y - 32, 128, 72, 8);
      c.fillStyle(preso ? COL.carta : 0x3a2818, 1).fillRoundedRect(x - 64, y - 36, 128, 72, 8);
      c.lineStyle(2, preso ? COL.inchiostro : COL.ottone, preso ? 1 : 0.4).strokeRoundedRect(x - 64, y - 36, 128, 72, 8);
      const nome = testo(this, x, y - 14, preso ? l.nome[impostazioni.lingua] : "? ? ?", 13, preso ? HEX.inchiostro : HEX.ottone, "titoli");
      if (nome.width > 118) nome.setScale(118 / nome.width);
      const fori = testo(this, x, y + 14, l.fori.join(" "), 13, preso ? HEX.indaco : HEX.carta, "fori");
      if (fori.width > 118) fori.setScale(118 / fori.width);
    });
    if (record.jam.jam) testo(this, 735, 512, `${t("record")}: ${record.jam.punti} · ${t("hype")} ${record.jam.hype}%`, 14, HEX.ottone, "fori");
    grana(this);
    this.input.keyboard?.once("keydown-ENTER", () => this.parti());
  }

  /** Telefono dritto: la locandina con le scelte in alto (etichetta a sinistra, scelte in riga), la collezione sotto. */
  private creaAlto(g: Phaser.GameObjects.Graphics) {
    // sui telefoni lunghi la locandina si allunga un po' e le righe respirano
    const k = 1 + Math.max(0, H - 885) / 1000, Y = (y: number) => Math.round(y * k);
    const fondo = Y(498);
    g.fillStyle(COL.inchiostro, 1).fillRect(22, 18, 506, fondo - 12);
    g.fillStyle(COL.ottone, 1).fillRect(16, 12, 506, fondo - 12);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(16, 12, 506, fondo - 12);
    titolo(this, W / 2, Y(52), t("jamTitolo"), 42, HEX.inchiostro, HEX.carta, 470);
    testo(this, W / 2, Y(92), t("jamPoster"), 16, HEX.inchiostro).setWordWrapWidth(470);
    const riga = (y: number, etichetta: string) => {
      const r = testo(this, 30, y, etichetta.toUpperCase(), 15, HEX.inchiostro, "fori").setOrigin(0, 0.5);
      if (r.width > 88) r.setScale(88 / r.width);
    };
    // tre scelte per riga, larghe 128, a destra delle etichette
    const x3 = (i: number) => 188 + i * 134;
    riga(Y(136), "Modo");
    scelta(this, 218, Y(136), t("jamModoLibero"), () => scelte.modo === "assolo", () => (scelte.modo = "assolo"), 192);
    scelta(this, 420, Y(136), t("jamModoScambio"), () => scelte.modo === "scambio", () => (scelte.modo = "scambio"), 192);
    const desc = testo(this, W / 2, Y(180), "", 15, HEX.inchiostro).setWordWrapWidth(470);
    const aggiornaDesc = () => desc.setText(t(scelte.modo === "assolo" ? "jamModoLiberoDesc" : "jamModoScambioDesc"));
    aggiornaDesc();
    this.events.on("scelte-aggiorna", aggiornaDesc);
    riga(Y(224), t("tempo"));
    TEMPI.forEach((tp, i) => scelta(this, x3(i), Y(224), `${t(tp.id)} ${tp.bpm}`, () => scelte.bpm === tp.bpm, () => (scelte.bpm = tp.bpm), 126));
    riga(Y(284), t("jamGiri"));
    [2, 3, 5].forEach((n, i) => scelta(this, x3(i), Y(284), `${n} × 12`, () => scelte.giri === n, () => (scelte.giri = n), 126));
    riga(Y(344), "Audio");
    scelta(this, x3(0), Y(344), tx("cuffieNo"), () => !record.cuffie, () => { record.cuffie = false; salva(); }, 126);
    scelta(this, x3(1), Y(344), tx("cuffieSi"), () => record.cuffie, () => { record.cuffie = true; salva(); }, 126);
    if (Registratore.disponibile()) scelta(this, x3(2), Y(344), scelte.registra ? tx("registraSi") : tx("registraNo"), () => scelte.registra, () => {
      scelte.registra = !scelte.registra;
      this.scene.restart();
    }, 126);
    testo(this, W / 2, Y(400), tx("cuffieDesc"), 15, HEX.inchiostro).setWordWrapWidth(470);
    bottone(this, 142, Y(452), t("indietro"), () => vaiA(this, "hub"), { w: 196, h: 56, primario: false, size: 19 });
    bottone(this, 384, Y(452), t("gioca") + " ▶", () => this.parti(), { w: 224, h: 56, size: 21 });

    // la collezione di lick, tre per riga, nello spazio che resta
    titolo(this, W / 2, fondo + 34, tx("collezione"), 22, HEX.carta, HEX.rosso, W - 40);
    testo(this, W / 2, fondo + 62, `${record.lick.length}/${LICK.length} · ${tx("collezioneAiuto")}`, 15, HEX.grigio).setWordWrapWidth(W - 40);
    const alto = fondo + 84, basso = H - (record.jam.jam ? 40 : 14), righe = Math.ceil(LICK.length / 3);
    const passo = Math.min(92, (basso - alto) / righe), ch = passo - 8, cw = 160;
    const y0 = alto + (basso - alto - passo * righe) / 2;
    LICK.forEach((l, i) => {
      const x = W / 2 + ((i % 3) - 1) * (cw + 10), y = y0 + passo * (Math.floor(i / 3) + 0.5);
      const preso = record.lick.includes(l.id);
      const c = this.add.graphics();
      c.fillStyle(COL.inchiostro, 1).fillRoundedRect(x - cw / 2 + 4, y - ch / 2 + 4, cw, ch, 8);
      c.fillStyle(preso ? COL.carta : 0x3a2818, 1).fillRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 8);
      c.lineStyle(2, preso ? COL.inchiostro : COL.ottone, preso ? 1 : 0.4).strokeRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 8);
      const nome = testo(this, x, y - ch * 0.22, preso ? l.nome[impostazioni.lingua] : "? ? ?", 16, preso ? HEX.inchiostro : HEX.ottone, "titoli");
      if (nome.width > cw - 10) nome.setScale((cw - 10) / nome.width);
      const fori = testo(this, x, y + ch * 0.22, l.fori.join(" "), 16, preso ? HEX.indaco : HEX.carta, "fori");
      if (fori.width > cw - 10) fori.setScale((cw - 10) / fori.width);
    });
    if (record.jam.jam) testo(this, W / 2, H - 22, `${t("record")}: ${record.jam.punti} · ${t("hype")} ${record.jam.hype}%`, 16, HEX.ottone, "fori");
    grana(this);
    this.input.keyboard?.once("keydown-ENTER", () => this.parti());
  }

  private parti() { vaiA(this, "jam", { ...scelte }); }

}
