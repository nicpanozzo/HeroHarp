// Copiato da modes/src/riff/RiffMenuScene.ts con scripts/sync-content.mjs, non modificare qui.
// Scelta del riff: dischi a 78 giri appesi al muro, modo Concerto/Prova e velocità.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, scelta, grana, vaiA, verticale } from "../core/ui";
import { t } from "../core/testi";
import { impostazioni, record } from "../core/impostazioni";
import { RIFF, RIFF_PERCORSO, type Riff } from "./riff";
import type { OpzioniRiff } from "./RiffScene";

let scelte: Omit<OpzioniRiff, "id"> = { modo: "concerto", tempo: 1 };
const COLORE_LIVELLO = [COL.verde, COL.ottone, COL.rosso, COL.prugna, COL.indaco];

export class RiffMenuScene extends Phaser.Scene {
  constructor() { super("riffMenu"); }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.events.off("scelte-aggiorna");
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b1022, 0x0b1022, 0x2a1d14, 0x2a1d14, 1).fillRect(0, 0, W, H);
    if (verticale()) return this.creaAlto();
    titolo(this, 250, 44, t("riffTitolo"), 34, HEX.lampada, HEX.rosso);
    testo(this, 250, 78, t("scegliRiff"), 14, HEX.carta).setAlpha(0.8);
    scelta(this, 590, 40, t("concerto"), () => scelte.modo === "concerto", () => (scelte.modo = "concerto"), 140, true);
    scelta(this, 740, 40, t("pratica"), () => scelte.modo === "prova", () => (scelte.modo = "prova"), 140, true);
    const desc = testo(this, 665, 72, "", 12, HEX.carta).setAlpha(0.8);
    const agg = () => desc.setText(t(scelte.modo === "concerto" ? "concertoDesc" : "praticaDesc"));
    agg(); this.events.on("scelte-aggiorna", agg);
    testo(this, 530, 100, t("tempo").toUpperCase(), 11, HEX.grigio, "fori");
    [0.7, 0.85, 1].forEach((v, i) => scelta(this, 610 + i * 100, 100, `${Math.round(v * 100)}%`, () => scelte.tempo === v, () => (scelte.tempo = v), 86, true));

    RIFF.forEach((r, i) => this.disco(130 + (i % 4) * 233, 162 + Math.floor(i / 4) * 62, r, 214, 54));
    testo(this, W / 2, 400, impostazioni.lingua === "it" ? "DAL PERCORSO" : "FROM THE JOURNEY", 13, HEX.ottone, "fori");
    RIFF_PERCORSO.forEach((r, i) => this.disco(90 + i * 156, 456, r, 146, 74, true));
    bottone(this, 70, 516, t("indietro"), () => vaiA(this, "hub"), { w: 110, h: 34, primario: false, size: 15 });
    grana(this, 0.35);
  }

  /** Telefono dritto: Indietro e titolo in alto, poi modo e tempo; tutti i dischi in due colonne. */
  private creaAlto() {
    bottone(this, 66, 38, "‹ " + t("indietro"), () => vaiA(this, "hub"), { w: 116, h: 54, primario: false, size: 17 });
    titolo(this, 336, 30, t("riffTitolo"), 30, HEX.lampada, HEX.rosso, 356);
    testo(this, 336, 62, t("scegliRiff"), 16, HEX.carta).setAlpha(0.85);
    scelta(this, 166, 112, t("concerto"), () => scelte.modo === "concerto", () => (scelte.modo = "concerto"), 200, true);
    scelta(this, 376, 112, t("pratica"), () => scelte.modo === "prova", () => (scelte.modo = "prova"), 200, true);
    const desc = testo(this, W / 2, 150, "", 15, HEX.carta).setAlpha(0.85).setWordWrapWidth(W - 40);
    const agg = () => desc.setText(t(scelte.modo === "concerto" ? "concertoDesc" : "praticaDesc"));
    agg(); this.events.on("scelte-aggiorna", agg);
    testo(this, 30, 190, t("tempo").toUpperCase(), 15, HEX.grigio, "fori").setOrigin(0, 0.5);
    [0.7, 0.85, 1].forEach((v, i) => scelta(this, 188 + i * 134, 190, `${Math.round(v * 100)}%`, () => scelte.tempo === v, () => (scelte.tempo = v), 126, true));

    // i dischi riempiono il resto dello schermo: più alti sui telefoni lunghi
    const alto = 226, basso = H - 12, gap = 8, etichetta = 28;
    const righe = Math.ceil(RIFF.length / 2) + Math.ceil(RIFF_PERCORSO.length / 2);
    const h = Math.min(72, (basso - alto - etichetta - gap * righe) / righe);
    const colonna = (i: number) => W / 2 + (i % 2 ? 130 : -130);
    let y = alto + Math.max(0, (basso - alto - etichetta - righe * (h + gap) + gap) / 2) + h / 2;
    RIFF.forEach((r, i) => this.disco(colonna(i), y + Math.floor(i / 2) * (h + gap), r, 252, h));
    y += Math.ceil(RIFF.length / 2) * (h + gap);
    testo(this, W / 2, y - h / 2 + etichetta / 2 - 4, impostazioni.lingua === "it" ? "DAL PERCORSO" : "FROM THE JOURNEY", 15, HEX.ottone, "fori");
    y += etichetta;
    RIFF_PERCORSO.forEach((r, i) => this.disco(colonna(i), y + Math.floor(i / 2) * (h + gap), r, 252, h));
    grana(this, 0.35);
  }


  private disco(x: number, y: number, r: Riff, w: number, h: number, piccolo = false) {
    const V = verticale();
    const rec = record.riff[r.id];
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w, h, 10);
    g.fillStyle(0x2f2117, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(2, COL.ottone, 0.5).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    // il disco
    const rr = piccolo ? Math.min(22, h / 2 - 5) : Math.min(h / 2 - 6, 40), rx = -w / 2 + rr + 8;

    g.fillStyle(0x0d0b0a, 1).fillCircle(rx, 0, rr);
    g.lineStyle(1, 0x333333, 1);
    for (let k = rr - 4; k > rr * 0.45; k -= 4) g.strokeCircle(rx, 0, k);
    g.fillStyle(COLORE_LIVELLO[r.livello - 1], 1).fillCircle(rx, 0, rr * 0.42);
    g.fillStyle(COL.carta, 1).fillCircle(rx, 0, 3);
    const tx = rx + rr + 10, tw = w / 2 - tx - 8;
    const nome = testo(this, tx, -h / 2 + (V ? 7 : 9), r.nome[impostazioni.lingua], V ? (piccolo ? 15 : 17) : piccolo ? 12 : 15, HEX.carta, "titoli")
      .setOrigin(0, 0).setAlign("left");
    // in verticale il nome sta su una riga sola (stretto se serve): sotto ci sono le stelle
    if (piccolo && !V) nome.setWordWrapWidth(tw);
    else if (nome.width > tw) nome.setScale(tw / nome.width);
    c.add([g, nome]);
    if (!piccolo && h >= 80) c.add(testo(this, tx, nome.y + nome.displayHeight + 4, r.descr[impostazioni.lingua], 12, HEX.grigio).setOrigin(0, 0).setAlign("left").setWordWrapWidth(tw));
    c.add(testo(this, tx, h / 2 - 12, "★".repeat(r.livello), V ? 15 : piccolo ? 10 : 12, HEX.ottone, "fori").setOrigin(0, 0.5));
    const stelle = rec?.stelle ?? 0;
    c.add(testo(this, w / 2 - 10, h / 2 - 12, rec ? "●".repeat(stelle) + "○".repeat(3 - stelle) : "", V ? 15 : 12, HEX.lampada, "fori").setOrigin(1, 0.5));
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerup", () => vaiA(this, "riff", { id: r.id, ...scelte }));
  }
}
