// Copiato da modes/src/riff/RiffMenuScene.ts con scripts/sync-content.mjs, non modificare qui.
// Scelta del riff: dischi a 78 giri appesi al muro, modo Concerto/Prova e velocità.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, scelta, grana, vaiA } from "../core/ui";
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

  private disco(x: number, y: number, r: Riff, w: number, h: number, piccolo = false) {
    const rec = record.riff[r.id];
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w, h, 10);
    g.fillStyle(0x2f2117, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(2, COL.ottone, 0.5).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    // il disco
    const rr = piccolo ? 22 : Math.min(h / 2 - 6, 40), rx = -w / 2 + rr + 8;
    g.fillStyle(0x0d0b0a, 1).fillCircle(rx, 0, rr);
    g.lineStyle(1, 0x333333, 1);
    for (let k = rr - 4; k > rr * 0.45; k -= 4) g.strokeCircle(rx, 0, k);
    g.fillStyle(COLORE_LIVELLO[r.livello - 1], 1).fillCircle(rx, 0, rr * 0.42);
    g.fillStyle(COL.carta, 1).fillCircle(rx, 0, 3);
    const tx = rx + rr + 10, tw = w / 2 - tx - 8;
    const nome = testo(this, tx, -h / 2 + 9, r.nome[impostazioni.lingua], piccolo ? 12 : 15, HEX.carta, "titoli")
      .setOrigin(0, 0).setAlign("left");
    if (piccolo) nome.setWordWrapWidth(tw);
    else if (nome.width > tw) nome.setScale(tw / nome.width);
    c.add([g, nome]);
    if (!piccolo && h >= 80) c.add(testo(this, tx, nome.y + nome.displayHeight + 4, r.descr[impostazioni.lingua], 12, HEX.grigio).setOrigin(0, 0).setAlign("left").setWordWrapWidth(tw));
    c.add(testo(this, tx, h / 2 - 12, "★".repeat(r.livello), piccolo ? 10 : 12, HEX.ottone, "fori").setOrigin(0, 0.5));
    const stelle = rec?.stelle ?? 0;
    c.add(testo(this, w / 2 - 10, h / 2 - 12, rec ? "●".repeat(stelle) + "○".repeat(3 - stelle) : "", 12, HEX.lampada, "fori").setOrigin(1, 0.5));
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerup", () => vaiA(this, "riff", { id: r.id, ...scelte }));
  }
}
