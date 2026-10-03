// Copiato da modes/src/volo/VoloMenuScene.ts con scripts/sync-content.mjs, non modificare qui.
// Scelta del volo: barattoli di lucciole in fila sul pontile.

import Phaser from "phaser";
import { COL, HEX, W, H, testo, titolo, bottone, grana, vaiA, textureLuce } from "../core/ui";
import { t } from "../core/testi";
import { impostazioni, record } from "../core/impostazioni";
import { VOLI } from "./voli";

export class VoloMenuScene extends Phaser.Scene {
  constructor() { super("voloMenu"); }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0f26, 0x0a0f26, 0x1d2a4a, 0x1d2a4a, 1).fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) g.fillStyle(COL.carta, Math.random() * 0.6 + 0.15).fillCircle(Math.random() * W, Math.random() * H, Math.random() * 1.3 + 0.3);
    g.fillStyle(COL.legno, 1).fillRect(0, 440, W, 18);
    g.fillStyle(0x3a2818, 1).fillRect(0, 458, W, 82);
    titolo(this, W / 2, 48, t("voloTitolo"), 38, HEX.lampada, HEX.indaco);
    testo(this, W / 2, 88, t("voloPoster"), 15, HEX.carta).setAlpha(0.85);
    const luce = textureLuce(this);
    VOLI.forEach((v, i) => {
      const x = 95 + i * 154, y = 300;
      const rec = record.volo[v.id];
      const c = this.add.container(x, y);
      const b = this.add.graphics();
      // barattolo di vetro con le lucciole raccolte
      b.fillStyle(COL.carta, 0.08).fillRoundedRect(-52, -70, 104, 140, 14);
      b.lineStyle(3, COL.carta, 0.7).strokeRoundedRect(-52, -70, 104, 140, 14);
      b.fillStyle(COL.legno, 1).fillRect(-46, -84, 92, 16);
      c.add(b);
      const quante = 3 + (rec?.stelle ?? 0) * 4;
      for (let k = 0; k < quante; k++) {
        const l = this.add.image(Phaser.Math.Between(-36, 36), Phaser.Math.Between(-50, 50), luce).setScale(0.3).setTint(0xffe27a).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: l, x: l.x + Phaser.Math.Between(-10, 10), y: l.y + Phaser.Math.Between(-10, 10), alpha: 0.4, duration: 800 + Math.random() * 900, yoyo: true, repeat: -1 });
        c.add(l);
      }
      const nome = testo(this, 0, 104, v.nome[impostazioni.lingua], 14, HEX.carta, "titoli").setWordWrapWidth(140);
      c.add(nome);
      c.add(testo(this, 0, -40, `${i + 1}`, 30, HEX.lampada, "titoli").setAlpha(0.9));
      c.add(testo(this, 0, 136, rec ? "★".repeat(rec.stelle) + "☆".repeat(3 - rec.stelle) : "☆☆☆", 16, HEX.lampada, "fori"));
      c.add(testo(this, 0, 30, v.descr[impostazioni.lingua], 10, HEX.carta).setWordWrapWidth(96).setAlpha(0.85));
      c.setSize(110, 160).setInteractive({ useHandCursor: true });
      c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.07, duration: 120 }));
      c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
      c.on("pointerup", () => vaiA(this, "volo", { id: v.id }));
    });
    bottone(this, 70, 510, t("indietro"), () => vaiA(this, "hub"), { w: 110, h: 34, primario: false, size: 15 });
    grana(this, 0.3);
  }
}
