// Copiato da modes/src/scene/HubScene.ts con scripts/sync-content.mjs, non modificare qui.
// Il Juke Joint: la sala delle modalità libere. Tre locandine sul muro, una per modalità.

import Phaser from "phaser";
import { keyById, noteName } from "../../harp";
import { foroPerMidi, scriviForo } from "../core/armonica";
import { COL, HEX, W, H, testo, titolo, grana, vaiA, textureLuce, bottone, verticale } from "../core/ui";
import { t } from "../core/testi";
import { impostazioni, record, salva, TONALITA } from "../core/impostazioni";
import { prendiAscolto } from "../core/ascolto";
import { LICK } from "../jam/lick";
import { scelteJam } from "../jam/JamMenuScene";
import { RIFF } from "../riff/riff";
import { VOLI } from "../volo/voli";

interface Locandina { chiave: string; via: () => [string, object]; titolo: string; testo: string; colore: number; inchiostro: string; disegno: (g: Phaser.GameObjects.Graphics) => void; record: string }

export class HubScene extends Phaser.Scene {
  private ascolto = prendiAscolto();
  private micTesto!: Phaser.GameObjects.Text;
  private livello!: Phaser.GameObjects.Graphics;
  private notaTesto!: Phaser.GameObjects.Text;
  /** dove si disegna il livello del microfono */
  private barraLivello = { x: 372, y: 522, w: 196 };

  constructor() { super("hub"); }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    const V = verticale();
    if (V) this.disegnaEsternoAlto(); else this.disegnaEsterno();
    // in verticale il titolo scende un po': in alto a sinistra c'è il pulsante per tornare al viaggio
    titolo(this, W / 2, V ? 108 : 50, t("jukeJoint"), 46, HEX.lampada, HEX.rosso, W - 40);
    testo(this, W / 2, V ? 150 : 88, t("sottotitolo"), V ? 17 : 16, HEX.carta).setAlpha(0.85);

    const voliFatti = Object.values(record.volo).reduce((a, v) => a + v.stelle, 0);
    const riffFatti = Object.values(record.riff).reduce((a, v) => a + v.stelle, 0);
    const locandine: Locandina[] = [
      { chiave: "jamMenu", via: () => ["jam", { ...scelteJam }], titolo: t("jamTitolo"), testo: t("jamPoster"), colore: COL.ottone, inchiostro: HEX.inchiostro, disegno: (g) => this.disegnoJam(g),
        record: record.jam.jam ? `${t("record")} ${record.jam.punti} · lick ${record.lick.length}/${LICK.length}` : "" },
      { chiave: "riffMenu", via: () => ["riff", { id: (RIFF.find((r) => (record.riff[r.id]?.stelle ?? 0) < 3) ?? RIFF[0]).id, modo: "concerto", tempo: 1 }], titolo: t("riffTitolo"), testo: t("riffPoster"), colore: COL.rosso, inchiostro: HEX.carta, disegno: (g) => this.disegnoRiff(g),
        record: riffFatti ? `★ ${riffFatti}` : "" },
      { chiave: "voloMenu", via: () => ["volo", { id: (VOLI.find((v) => (record.volo[v.id]?.stelle ?? 0) < 3) ?? VOLI[0]).id }], titolo: t("voloTitolo"), testo: t("voloPoster"), colore: COL.indaco, inchiostro: HEX.carta, disegno: (g) => this.disegnoVolo(g),
        record: voliFatti ? `★ ${voliFatti}` : "" },
    ];
    if (V) {
      // locandine una sopra l'altra, alte quanto lo schermo permette
      const alto = 186, basso = H - 166, posto = (basso - alto) / 3;
      const hp = Math.min(250, posto - 22);
      locandine.forEach((l, i) => this.locandinaLarga(W / 2, alto + posto * (i + 0.5), l, [-1.2, 0.9, -0.6][i], hp));
      this.barraImpostazioniAlta();
    } else {
      locandine.forEach((l, i) => this.locandina(170 + i * 310, 272, l, [-2.5, 1.5, -1][i]));
      this.barraImpostazioni();
    }
    grana(this);
  }

  private disegnaEsterno() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0d1424, 0x0d1424, 0x2a1d14, 0x2a1d14, 1).fillRect(0, 0, W, H);
    // muro di assi del locale
    for (let x = 0; x < W; x += 40) {
      g.fillStyle(x % 80 ? 0x3a2818 : 0x412d1c, 1).fillRect(x, 112, 38, 360);
      g.fillStyle(0x24170f, 1).fillRect(x + 38, 112, 2, 360);
    }
    g.fillStyle(COL.legno, 1).fillRect(0, 104, W, 10);
    g.fillStyle(0x1a120c, 1).fillRect(0, 472, W, 68);
    // stelle
    for (let i = 0; i < 40; i++) g.fillStyle(COL.carta, Math.random() * 0.6 + 0.2).fillCircle(Math.random() * W, Math.random() * 100, Math.random() * 1.5 + 0.3);
    const luce = textureLuce(this);
    for (let i = 0; i < 22; i++) {
      const x = 22 + i * 44, y = 118 + Math.sin(i * 0.9) * 4;
      const l = this.add.image(x, y, luce).setScale(0.4).setTint(COL.lampada).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.tweens.add({ targets: l, alpha: 0.35, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1 });
      this.add.circle(x, y, 3.5, 0xffe2a0);
    }
  }

  /** Il locale visto dal telefono tenuto dritto: cielo in alto, muro di assi lungo, pavimento in basso. */
  private disegnaEsternoAlto() {
    const g = this.add.graphics();
    const muro = 172, pavimento = H - 172;
    g.fillGradientStyle(0x0d1424, 0x0d1424, 0x2a1d14, 0x2a1d14, 1).fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 40) {
      g.fillStyle(x % 80 ? 0x3a2818 : 0x412d1c, 1).fillRect(x, muro, 38, pavimento - muro);
      g.fillStyle(0x24170f, 1).fillRect(x + 38, muro, 2, pavimento - muro);
    }
    g.fillStyle(COL.legno, 1).fillRect(0, muro - 8, W, 10);
    g.fillStyle(0x1a120c, 1).fillRect(0, pavimento, W, H - pavimento);
    for (let i = 0; i < 40; i++) g.fillStyle(COL.carta, Math.random() * 0.6 + 0.2).fillCircle(Math.random() * W, Math.random() * (muro - 20), Math.random() * 1.5 + 0.3);
    const luce = textureLuce(this);
    for (let i = 0; i < 13; i++) {
      const x = 21 + i * 41.5, y = muro + 6 + Math.sin(i * 0.9) * 4;
      const l = this.add.image(x, y, luce).setScale(0.4).setTint(COL.lampada).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.tweens.add({ targets: l, alpha: 0.35, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1 });
      this.add.circle(x, y, 3.5, 0xffe2a0);
    }
  }

  /** Locandina larga (telefono dritto): disegno a sinistra, titolo e "Suona"/"Scegli" a destra. */
  private locandinaLarga(x: number, y: number, l: Locandina, angolo: number, h: number) {
    const w = 500;
    const c = this.add.container(x, y).setAngle(angolo);
    const g = this.add.graphics();
    g.fillStyle(COL.inchiostro, 1).fillRect(-w / 2 + 7, -h / 2 + 7, w, h);
    g.fillStyle(l.colore, 1).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle(COL.carta, 1).fillCircle(-w / 2 + 14, -h / 2 + 12, 5); // puntina
    // il disegno (circa 240×170) rimpicciolito nella colonna di sinistra
    const k = Math.min(0.8, (h - 50) / 170);
    const sx = -w / 2 + 18 + 120 * k;
    const disegno = this.add.graphics().setPosition(sx, 12 * k - 12).setScale(k);
    l.disegno(disegno);
    const x0 = -w / 2 + 40 + 240 * k, x1 = w / 2 - 16, cx = (x0 + x1) / 2, tw = x1 - x0;
    const tit = titolo(this, cx, -h / 2 + 32, l.titolo, 25, l.inchiostro, l.colore === COL.ottone ? HEX.rosso : HEX.inchiostro, tw);
    const desc = testo(this, cx, -h / 2 + 58, l.testo, 16, l.inchiostro).setOrigin(0.5, 0).setWordWrapWidth(tw);
    const rec = testo(this, sx, h / 2 - 18, l.record, 15, l.inchiostro, "fori").setAlpha(0.9);
    if (rec.width > 240 * k + 20) rec.setScale((240 * k + 20) / rec.width);
    c.add([g, disegno, tit, desc, rec]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.02, angle: 0, duration: 160 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, angle: angolo, duration: 160 }));
    c.on("pointerup", () => { this.ascolto.accendiMicrofono(); const [k2, d] = l.via(); vaiA(this, k2, d); });
    // in fondo a destra: "Suona" parte subito, "Scegli" apre il menu
    const yb = h / 2 - 36, bw = 128;
    const play = testo(this, x0 + (tw - bw - 8) / 2, yb, "▶ " + t("gioca").toUpperCase(), 21, l.inchiostro, "titoli");
    c.add(play);
    this.tweens.add({ targets: play, scale: 1.1, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    bottone(this, x + x1 - bw / 2, y + yb, "≡ " + (impostazioni.lingua === "it" ? "Scegli" : "Choose"), () => vaiA(this, l.chiave), { w: bw, h: 54, primario: false, size: 17 });
  }

  private locandina(x: number, y: number, l: Locandina, angolo: number) {
    const w = 270, h = 300;
    const c = this.add.container(x, y).setAngle(angolo);
    const g = this.add.graphics();
    g.fillStyle(COL.inchiostro, 1).fillRect(-w / 2 + 7, -h / 2 + 7, w, h);
    g.fillStyle(l.colore, 1).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle(COL.carta, 1).fillCircle(-w / 2 + 14, -h / 2 + 12, 5); // puntina
    const disegno = this.add.graphics();
    disegno.setPosition(0, -50);
    l.disegno(disegno);
    const tit = titolo(this, 0, 52, l.titolo, 25, l.inchiostro, l.colore === COL.ottone ? HEX.rosso : HEX.inchiostro, w - 30);
    const desc = testo(this, 0, 86, l.testo, 14, l.inchiostro).setWordWrapWidth(w - 40);
    const rec = testo(this, 0, 112, l.record, 13, l.inchiostro, "fori").setAlpha(0.85);
    c.add([g, disegno, tit, desc, rec]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, angle: 0, duration: 160 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, angle: angolo, duration: 160 }));
    c.on("pointerup", () => { this.ascolto.accendiMicrofono(); const [k, d] = l.via(); vaiA(this, k, d); });
    // sotto la locandina: "Suona" parte subito, "Scegli" apre il menu
    const play = testo(this, 0, h / 2 - 22, "▶ " + t("gioca").toUpperCase(), 18, l.inchiostro, "titoli");
    c.add(play);
    this.tweens.add({ targets: play, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const menu = bottone(this, x, y + h / 2 + 26, "≡ " + (impostazioni.lingua === "it" ? "Scegli" : "Choose"), () => vaiA(this, l.chiave), { w: 120, h: 30, primario: false, size: 13 });
    void menu;
  }

  private disegnoJam(g: Phaser.GameObjects.Graphics) {
    // un microfono d'epoca con le onde sonore
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-22, -62, 44, 64, 20).fillRect(-3, 2, 6, 44).fillRect(-26, 44, 52, 6);
    g.fillStyle(COL.carta, 1);
    for (let i = 0; i < 4; i++) g.fillRect(-16, -50 + i * 12, 32, 3);
    g.lineStyle(5, COL.rosso, 1);
    for (const r of [44, 62, 80]) { g.beginPath(); g.arc(0, -30, r, -0.7, 0.7); g.strokePath(); g.beginPath(); g.arc(0, -30, r, Math.PI - 0.7, Math.PI + 0.7); g.strokePath(); }
  }

  private disegnoRiff(g: Phaser.GameObjects.Graphics) {
    // la strada che scende verso l'armonica, con le note in arrivo
    g.fillStyle(COL.inchiostro, 1).fillTriangle(-20, -80, 20, -80, 110, 40).fillTriangle(-20, -80, -110, 40, 110, 40);
    g.lineStyle(3, COL.carta, 0.8);
    for (let i = -2; i <= 2; i++) g.lineBetween(i * 6, -80, i * 40, 40);
    const note = [[-0.5, -50, COL.ottone], [1, -20, COL.indaco], [-1.6, 10, COL.ottone], [0.4, 26, COL.prugna]] as const;
    for (const [k, y, col] of note) {
      const scala = 0.5 + (y + 80) / 160;
      g.fillStyle(col, 1).fillCircle(k * 30 * scala, y, 9 * scala);
      g.lineStyle(2, COL.carta, 1).strokeCircle(k * 30 * scala, y, 9 * scala);
    }
    g.fillStyle(0xc9c6bd, 1).fillRoundedRect(-112, 36, 224, 22, 6);
    g.lineStyle(2, COL.inchiostro, 1).strokeRoundedRect(-112, 36, 224, 22, 6);
  }

  private disegnoVolo(g: Phaser.GameObjects.Graphics) {
    // luna, canne della palude e la lucciola con la scia
    g.fillStyle(COL.carta, 1).fillCircle(70, -60, 26);
    g.fillStyle(COL.indaco, 1).fillCircle(80, -66, 22);
    g.lineStyle(4, 0xffd27a, 0.9);
    g.beginPath(); g.moveTo(-110, 20);
    for (let x = -110; x <= 20; x += 10) g.lineTo(x, 10 - Math.sin((x + 110) / 26) * 30);
    g.strokePath();
    g.fillStyle(0xffd27a, 0.35).fillCircle(26, -2, 22);
    g.fillStyle(0xfff1b8, 1).fillCircle(26, -2, 9);
    g.fillStyle(COL.inchiostro, 1);
    for (let i = 0; i < 9; i++) g.fillRect(-120 + i * 30, 30 - (i % 3) * 14, 5, 40 + (i % 3) * 14);
  }

  private barraImpostazioni() {
    const y = 506;
    const g = this.add.graphics();
    g.fillStyle(COL.inchiostro, 0.9).fillRoundedRect(16, y - 24, W - 32, 48, 12);
    // tonalità dell'armonica
    testo(this, 70, y, t("tuaArmonica").toUpperCase(), 12, HEX.grigio, "fori");
    const nome = () => { const k = keyById(impostazioni.tonalita); return impostazioni.lingua === "it" ? k.it : k.en; };
    const ton = testo(this, 180, y, nome(), 20, HEX.ottone, "titoli");
    const cambia = (d: number) => {
      const i = TONALITA.indexOf(impostazioni.tonalita);
      impostazioni.tonalita = TONALITA[(i + d + TONALITA.length) % TONALITA.length];
      ton.setText(nome()); salva();
    };
    bottone(this, 128, y, "◀", () => cambia(-1), { w: 32, h: 30, primario: false, size: 14 });
    bottone(this, 232, y, "▶", () => cambia(1), { w: 32, h: 30, primario: false, size: 14 });
    // lingua
    bottone(this, 296, y, impostazioni.lingua.toUpperCase(), () => {
      impostazioni.lingua = impostazioni.lingua === "it" ? "en" : "it"; salva(); this.scene.restart();
    }, { w: 54, h: 30, primario: false, size: 14 });
    // microfono
    this.micTesto = testo(this, 470, y, "", 14, HEX.carta, "titoli");
    const mic = this.add.zone(470, y, 210, 40).setInteractive({ useHandCursor: true });
    mic.on("pointerup", async () => { this.micTesto.setText("…"); await this.ascolto.accendiMicrofono(); this.aggiornaMic(); });
    this.livello = this.add.graphics();
    this.notaTesto = testo(this, 610, y, "", 16, HEX.lampada, "fori");
    testo(this, 790, y, t("tastiera"), 11, HEX.grigio).setWordWrapWidth(300);
    this.aggiornaMic();
  }

  /** Impostazioni su due righe (telefono dritto): armonica e lingua, poi il microfono. */
  private barraImpostazioniAlta() {
    const y1 = H - 122, y2 = H - 52;
    const g = this.add.graphics();
    g.fillStyle(COL.inchiostro, 0.9).fillRoundedRect(12, H - 158, W - 24, 144, 14);
    testo(this, 30, y1, t("tuaArmonica").toUpperCase(), 15, HEX.grigio, "fori").setOrigin(0, 0.5);
    const nome = () => { const k = keyById(impostazioni.tonalita); return impostazioni.lingua === "it" ? k.it : k.en; };
    const ton = testo(this, 262, y1, nome(), 24, HEX.ottone, "titoli");
    const cambia = (d: number) => {
      const i = TONALITA.indexOf(impostazioni.tonalita);
      impostazioni.tonalita = TONALITA[(i + d + TONALITA.length) % TONALITA.length];
      ton.setText(nome()); salva();
    };
    bottone(this, 180, y1, "◀", () => cambia(-1), { w: 56, h: 54, primario: false, size: 18 });
    bottone(this, 344, y1, "▶", () => cambia(1), { w: 56, h: 54, primario: false, size: 18 });
    bottone(this, 460, y1, impostazioni.lingua.toUpperCase(), () => {
      impostazioni.lingua = impostazioni.lingua === "it" ? "en" : "it"; salva(); this.scene.restart();
    }, { w: 84, h: 54, primario: false, size: 18 });
    // microfono: un pulsante largo, con il livello che si muove sotto la scritta
    const mw = 340, mx = 30 + mw / 2;
    g.lineStyle(2, COL.ottone, 0.8).strokeRoundedRect(mx - mw / 2, y2 - 27, mw, 54, 10);
    this.micTesto = testo(this, mx, y2 - 4, "", 17, HEX.carta, "titoli").setWordWrapWidth(mw - 20);
    const mic = this.add.zone(mx, y2, mw, 56).setInteractive({ useHandCursor: true });
    mic.on("pointerup", async () => { this.micTesto.setText("…"); await this.ascolto.accendiMicrofono(); this.aggiornaMic(); });
    this.barraLivello = { x: mx - mw / 2 + 14, y: y2 + 17, w: mw - 28 };
    this.livello = this.add.graphics();
    this.notaTesto = testo(this, 450, y2, "", 24, HEX.lampada, "fori");
    this.aggiornaMic();
  }

  private aggiornaMic() {
    const s = this.ascolto.engine.micStatus;
    this.micTesto.setText(s === "on" ? "🎤 " + t("micAcceso") : s === "off" ? "🎤 " + t("micAccendi") : t("micNegato"))
      .setColor(s === "on" ? HEX.lampada : s === "off" ? HEX.carta : HEX.grigio);
    const piccolo = s === "denied" || s === "unsupported";
    this.micTesto.setFontSize(verticale() ? (piccolo ? 15 : 17) : piccolo ? 11 : 14);
  }

  update(_: number, dms: number) {
    this.ascolto.aggiorna(dms / 1000);
    const lv = Math.min(1, this.ascolto.livello * 12);
    const b = this.barraLivello;
    this.livello.clear().fillStyle(COL.ottone, 1).fillRect(b.x, b.y, b.w * lv, 3);

    const m = this.ascolto.midi;
    this.notaTesto.setText(m === null ? "" : `♪ ${this.foro(m)}`);
  }

  private foro(m: number) {
    const tab = foroPerMidi(m, impostazioni.tonalita);
    return tab ? scriviForo(tab) : noteName(m, impostazioni.lingua);
  }
}
