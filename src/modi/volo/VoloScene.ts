// Copiato da modes/src/volo/VoloScene.ts con scripts/sync-content.mjs, non modificare qui.
// Il Volo della Lucciola: l'altezza della nota che suoni è l'altezza della lucciola.
// Le luci arrivano da destra; tienile con note pulite e con i bend (le scivolate viola).
// Sul telefono tenuto dritto il cielo è alto: la lucciola ha più strada per salire e i bend si vedono meglio.

import Phaser from "phaser";
import { noteName } from "../../harp";
import { prendiAscolto } from "../core/ascolto";
import { prendiSuono } from "../core/suono";
import { impostazioni, record, salva } from "../core/impostazioni";
import { foroMidi, foroPerMidi, scriviForo } from "../core/armonica";
import { COL, HEX, W, H, testo, titolo, grana, textureLuce, vaiA, bottone, pop, coriandoli, verticale } from "../core/ui";
import { t } from "../core/testi";
import { VOLI, luciDelVolo, presa, TOLLERANZA, type Luce, type Volo } from "./voli";

/** Impaginazione in orizzontale (960×540): dove vola la lucciola, quanto corrono le luci, fin dove sale. */
const CIELO = { X_LUCCIOLA: 250, VELOCITA: 210, ALTO: 70, BASSO: 450 };

export class VoloScene extends Phaser.Scene {
  private V = false;
  private X_LUCCIOLA = CIELO.X_LUCCIOLA;
  private VELOCITA = CIELO.VELOCITA;
  private ALTO = CIELO.ALTO;
  private BASSO = CIELO.BASSO;
  private volo!: Volo;
  private ascolto = prendiAscolto();
  private suono = prendiSuono();
  private luci: Luce[] = [];
  private battito = 1;
  private t0 = 0;
  private fine = 0;
  private finito = false;
  private min = 60;
  private max = 80;
  private yLucciola = CIELO.BASSO;
  private gLuci!: Phaser.GameObjects.Graphics;
  private gGuide!: Phaser.GameObjects.Graphics;
  private lucciola!: Phaser.GameObjects.Container;
  private alone!: Phaser.GameObjects.Image;
  private scia!: Phaser.GameObjects.Particles.ParticleEmitter;
  private presaFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private contatore!: Phaser.GameObjects.Text;
  private notaTesto!: Phaser.GameObjects.Text;
  private serie = 0;
  private strati: { img: Phaser.GameObjects.TileSprite; v: number }[] = [];
  private barattolo!: Phaser.GameObjects.Graphics;

  constructor() { super("volo"); }

  init(d: { id?: string }) {
    this.volo = VOLI.find((v) => v.id === d?.id) ?? VOLI[0];
    this.finito = false; this.serie = 0; this.strati = [];
  }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.ascolto.accendiMicrofono();
    this.V = verticale();
    // in verticale la lucciola sta più a sinistra (si vedono arrivare le luci) e sale dai cipressi fin sotto i comandi
    Object.assign(this, this.V ? { X_LUCCIOLA: 150, VELOCITA: 170, ALTO: 200, BASSO: H - 92 } : CIELO);
    this.yLucciola = this.BASSO;
    const ton = impostazioni.tonalita;
    this.battito = 60 / this.volo.bpm;
    this.luci = luciDelVolo(this.volo, ton, this.battito);
    const altezze = this.luci.map((l) => l.midi);
    this.min = Math.min(...altezze) - 1.5;
    this.max = Math.max(...altezze) + 1.5;
    // con pochi semitoni lo schermo si "zooma": i bend diventano salti ben visibili
    if (this.max - this.min < 5) { const c = (this.max + this.min) / 2; this.min = c - 2.5; this.max = c + 2.5; }

    this.paesaggio();
    this.gGuide = this.add.graphics().setDepth(3);
    this.gLuci = this.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    const luce = textureLuce(this);
    this.scia = this.add.particles(0, 0, luce, {
      speedX: { min: -this.VELOCITA - 30, max: -this.VELOCITA + 10 }, speedY: { min: -12, max: 12 }, lifespan: 900,
      scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xffe27a, blendMode: "ADD", frequency: 25,
    }).setDepth(7);
    this.presaFx = this.add.particles(0, 0, luce, {
      speed: { min: 40, max: 160 }, lifespan: 450, scale: { start: 0.4, end: 0 }, tint: [0xffe27a, 0xfff6d0], blendMode: "ADD", emitting: false,
    }).setDepth(8);
    this.alone = this.add.image(0, 0, luce).setScale(2.2).setTint(0xffd27a).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
    const corpo = this.add.graphics();
    corpo.fillStyle(0x2a2a2a, 1).fillEllipse(-6, 0, 16, 9);
    corpo.fillStyle(0xfff1b8, 1).fillCircle(5, 0, 7);
    corpo.fillStyle(0xd8e6ff, 0.55).fillEllipse(-6, -8, 12, 8).fillEllipse(-1, -9, 10, 7);
    this.lucciola = this.add.container(this.X_LUCCIOLA, this.BASSO, [this.alone, corpo]).setDepth(9);
    this.tweens.add({ targets: corpo, scaleY: 0.85, duration: 90, yoyo: true, repeat: -1 });

    this.barattolo = this.add.graphics().setDepth(20);
    this.contatore = testo(this, W - 72, 34, "0", this.V ? 24 : 20, HEX.lampada, "titoli").setDepth(21).setStroke(HEX.inchiostro, 4);
    this.notaTesto = testo(this, this.X_LUCCIOLA, 0, "", this.V ? 26 : 20, "#FFF1B8", "titoli").setDepth(10).setStroke(HEX.inchiostro, 4);
    if (this.V) {
      // in alto: Esci a sinistra, il barattolo a destra, il nome del volo sotto; l'aiuto sull'acqua
      bottone(this, 64, 36, t("esci"), () => vaiA(this, "voloMenu"), { w: 108, h: 54, primario: false, size: 18 }).setDepth(20);
      titolo(this, W / 2 - 30, 52, this.volo.nome[impostazioni.lingua], 24, HEX.lampada, HEX.inchiostro, W - 290).setDepth(20);
      testo(this, W / 2, H - 38, t("voloAiuto"), 15, HEX.carta).setAlpha(0.8).setDepth(20).setWordWrapWidth(W - 40);
    } else {
      titolo(this, 20, 24, this.volo.nome[impostazioni.lingua], 20, HEX.lampada, HEX.inchiostro).list.forEach((o) => (o as Phaser.GameObjects.Text).setOrigin(0, 0.5));
      testo(this, W / 2, 516, t("voloAiuto"), 13, HEX.carta).setAlpha(0.7).setDepth(20);
      bottone(this, 52, 516, t("esci"), () => vaiA(this, "voloMenu"), { w: 84, h: 30, primario: false, size: 14 }).setDepth(20);
    }
    grana(this, 0.3);

    // un battito di cuore nella palude: solo il piede, così il microfono sente bene la nota
    const s = this.suono;
    const avvio = s.ctx.currentTime + 0.3;
    s.basi.avvia({ area: "portico", armonica: ton, forma: "vamp", posizione: 1, bpm: this.volo.bpm, band: ["piede"] }, avvio);
    s.effetti.tonica = foroMidi("1↑", ton);
    this.t0 = avvio + 2 * this.battito;
    this.fine = this.volo.battiti * this.battito + 1.5;
    this.events.once("shutdown", () => this.suono.pulisci());
    this.input.keyboard?.on("keydown-ESC", () => vaiA(this, "voloMenu"));
  }

  private y(m: number) { return this.BASSO - ((m - this.min) / (this.max - this.min)) * (this.BASSO - this.ALTO); }

  private paesaggio() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0f26, 0x0a0f26, 0x1d2a4a, 0x1d2a4a, 1).fillRect(0, 0, W, H);
    const cielo = this.V ? H * 0.6 : 300;
    for (let i = 0; i < 70; i++) g.fillStyle(COL.carta, Math.random() * 0.6 + 0.15).fillCircle(Math.random() * W, Math.random() * cielo, Math.random() * 1.3 + 0.3);
    const [lx, ly] = this.V ? [420, 250] : [760, 110];
    g.fillStyle(0xf1e4c8, 0.12).fillCircle(lx, ly, 70);
    g.fillStyle(COL.carta, 1).fillCircle(lx, ly, 40);
    // strati di cipressi in parallasse (texture generate al volo)
    const strato = (chiave: string, colore: number, base: number, alt: number, v: number, seme: number) => {
      if (!this.textures.exists(chiave)) {
        const s = this.make.graphics({}, false);
        s.fillStyle(colore, 1);
        let x = 0, r = seme;
        while (x < 960) {
          r = (r * 9301 + 49297) % 233280;
          const w = 30 + (r % 60), h = alt * (0.5 + (r % 100) / 200);
          s.fillTriangle(x, base, x + w / 2, base - h, x + w, base);
          s.fillRect(x + w / 2 - 3, base - 10, 6, 20);
          x += w * 0.7;
        }
        s.fillRect(0, base, 960, 540 - base);
        s.generateTexture(chiave, 960, 540); s.destroy();
      }
      // in verticale i cipressi (disegnati su 540 di altezza) stanno in fondo allo schermo
      const img = this.V ? this.add.tileSprite(W / 2, H - 270, W, 540, chiave).setDepth(1) : this.add.tileSprite(W / 2, H / 2, W, H, chiave).setDepth(1);
      this.strati.push({ img, v });
    };
    strato("cipressi-1", 0x16203a, 400, 220, 0.15, 7);
    strato("cipressi-2", 0x0f1628, 450, 160, 0.4, 13);
    // acqua
    const acqua = this.add.graphics().setDepth(2);
    const ya = this.V ? H - 70 : 470;
    acqua.fillStyle(0x0b1120, 1).fillRect(0, ya, W, 70);
    for (let i = 0; i < 18; i++) acqua.fillStyle(COL.carta, 0.08).fillRect(Math.random() * W, ya + 10 + Math.random() * 50, 30 + Math.random() * 60, 2);
  }

  update(_: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.ascolto.aggiorna(dt);
    const tc = this.ascolto.ora - this.t0;
    const midiF = this.ascolto.midiF;

    // la lucciola segue la nota; in silenzio scende piano verso l'acqua
    const meta = midiF === null ? Math.min(this.BASSO + 10, this.yLucciola + 60 * dt) : this.y(midiF);
    this.yLucciola += (meta - this.yLucciola) * Math.min(1, dt * (midiF === null ? 3 : 14));
    this.lucciola.setY(this.yLucciola);
    this.lucciola.setAngle(Phaser.Math.Clamp((meta - this.yLucciola) * 0.6, -30, 30));
    this.scia.setPosition(this.X_LUCCIOLA - 6, this.yLucciola);
    this.scia.emitting = midiF !== null;
    this.alone.setAlpha(midiF === null ? 0.2 : 0.55 + 0.1 * Math.sin(this.time.now / 80));
    const tab = this.ascolto.midi === null ? null : foroPerMidi(this.ascolto.midi, impostazioni.tonalita);
    this.notaTesto.setText(tab ? scriviForo(tab) : "").setPosition(this.X_LUCCIOLA, this.yLucciola - 32);

    for (const s of this.strati) s.img.tilePositionX += this.VELOCITA * s.v * dt;

    // luci prese e perse
    if (!this.finito) {
      for (const l of this.luci) {
        if (l.presa || l.persa) continue;
        const d = tc - l.t;
        if (d < -0.12) break;
        if (d <= 0.12 && presa(l, midiF)) {
          l.presa = true;
          this.serie++;
          this.presaFx.explode(4, this.X_LUCCIOLA + 8, this.y(l.midi));
          if (this.serie % 16 === 0) { pop(this, this.X_LUCCIOLA + 40, this.y(l.midi) - 30, `${this.serie}!`, HEX.lampada, 20); this.suono.effetti.notaGiusta(); }
        } else if (d > 0.12) { l.persa = true; this.serie = 0; }
      }
      if (tc > this.fine) this.chiudi();
    }
    this.disegna(tc);
  }

  private disegna(tc: number) {
    const g = this.gLuci, gg = this.gGuide;
    g.clear(); gg.clear();
    // righe guida: le note del volo, con il nome del foro
    const viste = new Set<number>();
    for (const l of this.luci) {
      const x = this.X_LUCCIOLA + (l.t - tc) * this.VELOCITA;
      if (x < -20 || x > W + 20) continue;
      const m = Math.round(l.midi);
      if (Math.abs(l.midi - m) < 0.05) viste.add(m);
    }
    for (const m of viste) {
      const tab = foroPerMidi(m, impostazioni.tonalita);
      const y = this.y(m);
      const col = tab?.bend ? COL.prugna : tab?.draw ? COL.indacoChiaro : COL.ottone;
      const lw = this.V ? 76 : 64, lh = this.V ? 36 : 30;
      for (let x = lw + 6; x < W; x += 16) gg.lineStyle(1, col, 0.25).lineBetween(x, y, x + 8, y);
      gg.fillStyle(COL.inchiostro, 0.85).fillRoundedRect(4, y - lh / 2, lw, lh, 7);
    }
    this.etichette(viste);
    // luci: quelle prese spariscono, quelle perse diventano fioche
    let prese = 0;
    for (const l of this.luci) {
      if (l.presa) { prese++; continue; }
      const x = this.X_LUCCIOLA + (l.t - tc) * this.VELOCITA;
      if (x < -20 || x > W + 20) continue;
      const y = this.y(l.midi);
      const col = l.bend ? 0xc79be8 : 0xffd27a;
      const a = l.persa ? 0.15 : 0.9;
      g.fillStyle(col, a * 0.25).fillCircle(x, y, 13);
      g.fillStyle(col, a).fillCircle(x, y, 5);
      // fascia di tolleranza appena davanti alla lucciola
      if (!l.persa && Math.abs(x - this.X_LUCCIOLA) < 30) g.fillStyle(col, 0.12).fillRect(x - 4, this.y(l.midi + TOLLERANZA), 8, this.y(l.midi - TOLLERANZA) - this.y(l.midi + TOLLERANZA));
    }
    // barattolo delle luci
    const b = this.barattolo;
    b.clear();
    const frazione = prese / this.luci.length;
    // in verticale il barattolo sale in cima, accanto al nome del volo
    const by = this.V ? -28 : 0;
    if (frazione > 0) b.fillStyle(0xffd27a, 0.3 + 0.5 * frazione).fillRect(W - 104, by + 54 + 74 * (1 - frazione), 64, 74 * frazione);
    b.lineStyle(3, COL.carta, 0.8).strokeRoundedRect(W - 108, by + 50, 72, 82, 10);
    b.fillStyle(COL.legno, 1).fillRect(W - 112, by + 42, 80, 10);
    this.contatore.setText(`${prese}`).setPosition(W - 72, by + 92);
  }

  private testiEtichette = new Map<number, Phaser.GameObjects.Text>();
  private etichette(viste: Set<number>) {
    for (const m of viste) {
      let tt = this.testiEtichette.get(m);
      if (!tt) {
        const tab = foroPerMidi(m, impostazioni.tonalita);
        tt = testo(this, this.V ? 42 : 35, this.y(m), tab ? scriviForo(tab) : noteName(m, impostazioni.lingua), this.V ? 23 : 19, tab?.bend ? "#E6C8FF" : tab?.draw ? "#BFD3FF" : "#FFD27A", "titoli").setStroke(HEX.inchiostro, 4).setDepth(4);
        this.testiEtichette.set(m, tt);
      }
      tt.setVisible(true);
    }
    for (const [m, tt] of this.testiEtichette) if (!viste.has(m)) tt.setVisible(false);
  }

  private chiudi() {
    this.finito = true;
    this.suono.basi.ferma(0.6);
    const prese = this.luci.filter((l) => l.presa).length;
    const p = prese / this.luci.length;
    const stelle = p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.45 ? 1 : 0;
    const prima = record.volo[this.volo.id];
    const nuovo = !prima || prese > prima.punti;
    record.volo[this.volo.id] = { punti: Math.max(prima?.punti ?? 0, prese), stelle: Math.max(prima?.stelle ?? 0, stelle) };
    salva();
    if (stelle >= 2) { this.suono.effetti.vittoria(); coriandoli(this); } else this.suono.effetti.sconfitta();

    const c = this.add.container(W / 2, H / 2).setDepth(50).setAlpha(0);
    const g = this.add.graphics();
    // in verticale il cartello è un po' più alto e i pulsanti più grandi
    const [pw, ph] = this.V ? [500, 340] : [460, 300];
    g.fillStyle(COL.inchiostro, 1).fillRect(-pw / 2 + 4, -ph / 2 + 4, pw, ph);
    g.fillStyle(COL.indaco, 1).fillRect(-pw / 2, -ph / 2, pw, ph);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(-pw / 2, -ph / 2, pw, ph);
    c.add(g);
    const dy = this.V ? -14 : 0;
    c.add(titolo(this, 0, -112 + dy, this.volo.nome[impostazioni.lingua], this.V ? 28 : 26, HEX.carta, HEX.inchiostro, pw - 40));
    for (let i = 0; i < 3; i++) c.add(testo(this, -70 + i * 70, -50 + dy, "★", 56, i < stelle ? HEX.lampada : "#22385c", "titoli").setStroke(HEX.inchiostro, 5));
    c.add(testo(this, 0, 14 + dy, `${t("luci")}: ${prese} / ${this.luci.length}  (${Math.round(p * 100)}%)`, this.V ? 22 : 20, HEX.carta, "titoli"));
    if (nuovo && prese > 0) c.add(testo(this, 0, 48 + dy, t("nuovoRecord").toUpperCase(), this.V ? 19 : 16, HEX.lampada, "titoli"));
    if (this.V) {
      c.add(bottone(this, -122, 116, t("riprova"), () => this.scene.restart({ id: this.volo.id }), { w: 216, h: 56, size: 20 }));
      c.add(bottone(this, 118, 116, t("scegliVolo"), () => vaiA(this, "voloMenu"), { w: 224, h: 56, primario: false, size: 18 }));
    } else {
      c.add(bottone(this, -110, 100, t("riprova"), () => this.scene.restart({ id: this.volo.id }), { w: 170 }));
      c.add(bottone(this, 100, 100, t("scegliVolo"), () => vaiA(this, "voloMenu"), { w: 190, primario: false, size: 16 }));
    }

    this.tweens.add({ targets: c, alpha: 1, duration: 250, delay: 300 });
    this.input.keyboard?.once("keydown-ENTER", () => this.scene.restart({ id: this.volo.id }));
  }
}
