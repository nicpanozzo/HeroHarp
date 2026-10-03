// Copiato da modes/src/riff/RiffScene.ts con scripts/sync-content.mjs, non modificare qui.
// La Strada dei Riff: le note arrivano lungo una highway notturna, una corsia per foro,
// e vanno suonate quando toccano l'armonica. Concerto = a tempo con la band; Prova = il riff ti aspetta.

import Phaser from "phaser";
import { noteName } from "../../harp";
import { prendiAscolto } from "../core/ascolto";
import { prendiSuono } from "../core/suono";
import { impostazioni, record, salva } from "../core/impostazioni";
import { foroMidi, foroPerMidi, leggiForo, scriviForo } from "../core/armonica";
import { COL, HEX, W, H, testo, pop, grana, textureLuce, vaiA, bottone, coriandoli } from "../core/ui";
import { VistaArmonica } from "../core/vistaArmonica";
import { t } from "../core/testi";
import { Partitura, moltiplicatoreCombo, type NotaInGioco } from "./partitura";
import { TUTTI_I_RIFF, type Riff } from "./riff";

export interface OpzioniRiff { id: string; modo: "concerto" | "prova"; tempo: number }

const CX = W / 2, HIT = 432, HOR = 118, CORSIA = 56;
const ANTICIPO = 1.7; // secondi di strada visibili: corta = arcade

export class RiffScene extends Phaser.Scene {
  private o!: OpzioniRiff;
  private riff!: Riff;
  private ascolto = prendiAscolto();
  private suono = prendiSuono();
  private partitura!: Partitura;
  private battito = 0.75;
  private t0 = 0;
  private tempoCanzone = -3;
  private fine = 0;
  private finito = false;
  private attesa = false;
  private sordoFino = 0;
  private gStrada!: Phaser.GameObjects.Graphics;
  private gNote!: Phaser.GameObjects.Graphics;
  private armonica!: VistaArmonica;
  private etichette = new Map<number, Phaser.GameObjects.Text>();
  private puntiTesto!: Phaser.GameObjects.Text;
  private comboTesto!: Phaser.GameObjects.Text;
  private moltTesto!: Phaser.GameObjects.Text;
  private barra!: Phaser.GameObjects.Graphics;
  private scintille!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fiamme!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lampi: number[] = new Array(11).fill(0);
  private avviso!: Phaser.GameObjects.Text;
  private ultimoMolt = 1;

  constructor() { super("riff"); }

  init(o: Partial<OpzioniRiff>) {
    this.o = { id: TUTTI_I_RIFF[0].id, modo: "concerto", tempo: 1, ...o };
    this.riff = TUTTI_I_RIFF.find((r) => r.id === this.o.id) ?? TUTTI_I_RIFF[0];
    this.finito = false; this.attesa = false; this.sordoFino = 0; this.etichette.clear(); this.lampi.fill(0); this.ultimoMolt = 1;
  }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.ascolto.accendiMicrofono();
    const r = this.riff;
    this.battito = 60 / (r.bpm * this.o.tempo);
    const ton = impostazioni.tonalita;
    this.partitura = new Partitura(r.note.map((n, i) => ({
      i, midi: foroMidi(n.foro, ton), foro: n.foro, t: n.inizio * this.battito, durata: n.durata * this.battito, giudizio: null, tenuta: 0,
    })));
    const ultima = r.note[r.note.length - 1];
    this.fine = (ultima.inizio + ultima.durata) * this.battito + 1.2;

    this.disegnaPaesaggio();
    this.gStrada = this.add.graphics().setDepth(2);
    this.gNote = this.add.graphics().setDepth(6);
    this.armonica = new VistaArmonica(this, CX, 474, CORSIA * 10, 46).setDepth(10);
    const luce = textureLuce(this);
    this.scintille = this.add.particles(0, 0, luce, {
      speed: { min: 80, max: 260 }, angle: { min: 200, max: 340 }, lifespan: 500, scale: { start: 0.5, end: 0 },
      blendMode: "ADD", emitting: false, gravityY: 300,
    }).setDepth(12);
    this.fiamme = this.add.particles(0, HIT + 18, luce, {
      x: { min: CX - CORSIA * 5, max: CX + CORSIA * 5 }, speedY: { min: -160, max: -60 }, lifespan: 600,
      scale: { start: 0.45, end: 0 }, tint: [COL.ottone, COL.rosso, 0xffd27a], blendMode: "ADD", frequency: 30, emitting: false,
    }).setDepth(9);
    this.interfaccia();
    grana(this, 0.35);

    // Orologio: in concerto parte la band con una battuta di attacco; in prova il tempo avanza solo se suoni.
    const s = this.suono;
    if (this.o.modo === "concerto") {
      const avvio = s.ctx.currentTime + 0.3;
      s.basi.avvia({ area: r.area, armonica: ton, forma: r.forma, posizione: r.posizione, bpm: r.bpm * this.o.tempo, swing: r.swing, band: s.bandSicura(r.band, record.cuffie) }, avvio);
      this.t0 = avvio + 4 * this.battito;
      for (let i = 0; i < 4; i++) this.time.delayedCall((avvio - s.ctx.currentTime + i * this.battito) * 1000, () => this.mostraAvviso(i === 3 ? "VIA!" : String(3 - i), i === 3 ? HEX.lampada : HEX.carta));
    } else {
      this.tempoCanzone = -1.5;
      this.time.delayedCall(200, () => this.mostraAvviso(t("pratica"), HEX.carta));
    }
    s.effetti.tonica = foroMidi(r.posizione === 2 ? "2↓" : "1↑", ton);

    const sgancia = this.ascolto.suNota((on) => {
      if (this.finito || on.time < this.sordoFino) return;
      const tc = this.o.modo === "concerto" ? on.time - this.t0 : this.tempoCanzone;
      const e = this.partitura.attacco(on.midi, tc, this.o.modo === "prova");
      if (!e) return;
      this.colpo(e.nota, e.giudizio === "perfetto");
    });
    this.events.once("shutdown", () => { sgancia(); this.suono.pulisci(); });
    this.input.keyboard?.on("keydown-ESC", () => vaiA(this, "riffMenu"));
  }

  private xCorsia(foro: number) { return CX + (foro - 5.5) * CORSIA; }

  /** Proiezione prospettica: z = 0 sulla linea di colpo, 1 all'orizzonte. */
  private proietta(foro: number, dtempo: number) {
    const z = dtempo / ANTICIPO;
    const p = 1 / (1 + 3 * Math.max(-0.3, z));
    const y = HOR + (HIT - HOR) * (p - 0.25) / 0.75;
    return { x: CX + (this.xCorsia(foro) - CX) * p, y, s: p };
  }

  private disegnaPaesaggio() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b1022, 0x0b1022, 0x3a2340, 0x3a2340, 1).fillRect(0, 0, W, HOR + 10);
    for (let i = 0; i < 50; i++) g.fillStyle(COL.carta, Math.random() * 0.7 + 0.1).fillCircle(Math.random() * W, Math.random() * (HOR - 20), Math.random() * 1.4 + 0.3);
    g.fillStyle(COL.carta, 1).fillCircle(790, 52, 24);
    g.fillStyle(0x0b1022, 1).fillCircle(800, 46, 20);
    // colline e campi ai lati
    g.fillStyle(0x1b1a2a, 1);
    g.beginPath(); g.moveTo(0, HOR + 6);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, HOR - 10 - Math.sin(x / 90) * 10 - Math.sin(x / 37) * 4);
    g.lineTo(W, HOR + 10); g.lineTo(0, HOR + 10); g.closePath(); g.fillPath();
    g.fillStyle(0x15120f, 1).fillRect(0, HOR + 4, W, H - HOR);
    // insegna stradale
    g.fillStyle(COL.carta, 1).fillRect(118, 72, 52, 40);
    g.lineStyle(3, COL.inchiostro, 1).strokeRect(118, 72, 52, 40);
    g.fillStyle(COL.inchiostro, 1).fillRect(141, 112, 5, 20);
    testo(this, 144, 82, "HWY", 11, HEX.inchiostro, "titoli");
    testo(this, 144, 99, "61", 16, HEX.inchiostro, "titoli");
  }

  private interfaccia() {
    const r = this.riff;
    testo(this, 20, 22, r.nome[impostazioni.lingua].toUpperCase(), 18, HEX.lampada, "titoli").setOrigin(0, 0.5).setDepth(20);
    testo(this, 20, 44, `${"★".repeat(r.livello)}  ·  ${Math.round(r.bpm * this.o.tempo)} bpm  ·  ${t(this.o.modo === "concerto" ? "concerto" : "pratica")}`, 12, HEX.carta, "fori").setOrigin(0, 0.5).setDepth(20);
    this.barra = this.add.graphics().setDepth(20);
    this.puntiTesto = testo(this, W - 24, 24, "0", 28, HEX.carta, "titoli").setOrigin(1, 0.5).setStroke(HEX.inchiostro, 5).setDepth(20);
    this.comboTesto = testo(this, W - 24, 54, "", 14, HEX.carta, "fori").setOrigin(1, 0.5).setDepth(20);
    this.moltTesto = testo(this, W - 120, 214, "", 30, HEX.ottone, "titoli").setStroke(HEX.inchiostro, 6).setDepth(20).setAngle(8);
    this.avviso = testo(this, CX, 250, "", 54, HEX.carta, "titoli").setStroke(HEX.inchiostro, 8).setDepth(30).setAlpha(0);
    bottone(this, 52, 520, t("esci"), () => vaiA(this, "riffMenu"), { w: 84, h: 30, primario: false, size: 14 }).setDepth(20);
  }

  private mostraAvviso(s: string, colore: string) {
    this.tweens.killTweensOf(this.avviso);
    this.avviso.setText(s).setColor(colore).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.avviso, scale: 1, duration: 200, ease: "Back.easeOut" });
    this.tweens.add({ targets: this.avviso, alpha: 0, delay: 450, duration: 300 });
  }

  private colpo(n: NotaInGioco, perfetto: boolean) {
    const tab = leggiForo(n.foro);
    const x = this.xCorsia(tab.hole);
    this.lampi[tab.hole] = 1;
    const colore = tab.bend ? COL.prugna : tab.draw ? COL.indacoChiaro : COL.ottone;
    this.scintille.setParticleTint(colore);
    this.scintille.explode(perfetto ? 18 : 9, x, HIT);
    pop(this, x, HIT - 50, t(perfetto ? "perfetto" : "bene"), perfetto ? HEX.lampada : HEX.carta, perfetto ? 20 : 16, 600);
    const molt = moltiplicatoreCombo(this.partitura.combo);
    if (molt > this.ultimoMolt) {
      this.mostraAvviso(`${t("fuoco")}${molt}`, HEX.ottone);
      this.suono.effetti.critico();
      this.cameras.main.shake(220, 0.008);
      this.cameras.main.flash(160, 255, 200, 120);
    }
    this.ultimoMolt = molt;
    if (perfetto) this.suono.effetti.notaGiusta(this.partitura.combo);
    // l'armonica "salta" a ogni colpo
    this.tweens.add({ targets: this.armonica, scale: { from: perfetto ? 1.06 : 1.03, to: 1 }, duration: 120 });
    if (this.partitura.combo > 0 && this.partitura.combo % 25 === 0) { pop(this, CX, 300, `${this.partitura.combo}!`, HEX.lampada, 48); this.cameras.main.flash(120, 255, 230, 160); }
  }

  update(_: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.ascolto.aggiorna(dt);
    const p = this.partitura;
    if (this.o.modo === "concerto") this.tempoCanzone = this.ascolto.ora - this.t0;
    else if (!this.finito) {
      // Prova: il tempo si ferma sulla prossima nota finché non la suoni
      const prossima = p.prossima();
      const prima = this.tempoCanzone;
      this.tempoCanzone += dt;
      if (prossima && this.tempoCanzone >= prossima.t) {
        this.tempoCanzone = prossima.t;
        if (!this.attesa) {
          this.attesa = true;
          // un aiuto per l'orecchio: la nota suona una volta, a volume basso (e il microfono la ignora)
          if (prima < prossima.t) {
            const ora = this.suono.ctx.currentTime;
            this.suono.effetti.voceNemico(prossima.midi, 0.45, "normale", ora + 0.05);
            this.sordoFino = ora + 0.65;
          }
        }
      } else this.attesa = false;
    }
    const tc = this.tempoCanzone;
    if (!this.finito) this.suono.abbassaBand(this.ascolto.midi !== null, record.cuffie);

    if (!this.finito) {
      if (this.o.modo === "concerto") for (const n of p.scadute(tc)) this.mancata(n);
      p.tieni(this.ascolto.midi, dt, tc);
      if ((this.o.modo === "concerto" && tc > this.fine) || (this.o.modo === "prova" && p.finita && tc > this.fine - 1)) this.chiudi();
    }

    this.disegnaStrada(tc);
    this.disegnaNote(tc);
    const midi = this.ascolto.midi;
    const tab = midi === null ? null : foroPerMidi(midi, impostazioni.tonalita);
    this.armonica.accendi(tab, tab && midi !== null ? `${scriviForo(tab)} · ${noteName(midi, impostazioni.lingua)}` : "");
    const molt = moltiplicatoreCombo(p.combo);
    this.fiamme.emitting = molt >= 2;
    this.fiamme.frequency = molt >= 4 ? 8 : molt >= 3 ? 16 : 30;
    this.moltTesto.setText(molt > 1 ? `×${molt}` : "");
    this.puntiTesto.setText(String(Math.round(p.punti)));
    this.comboTesto.setText(p.combo >= 2 ? `${p.combo} ${t("combo")}` : "");
    const avanzamento = Phaser.Math.Clamp(tc / this.fine, 0, 1);
    this.barra.clear().fillStyle(COL.inchiostro, 0.8).fillRoundedRect(20, 60, 220, 6, 3).fillStyle(COL.ottone, 1).fillRoundedRect(20, 60, 220 * avanzamento, 6, 3);
    for (let i = 1; i <= 10; i++) this.lampi[i] = Math.max(0, this.lampi[i] - dt * 4);
  }

  private mancata(n: NotaInGioco) {
    const tab = leggiForo(n.foro);
    pop(this, this.xCorsia(tab.hole), HIT - 40, t("mancata"), HEX.grigio, 14, 500);
    if (this.ultimoMolt > 1) this.suono.effetti.notaMancata();
    this.ultimoMolt = 1;
  }

  private disegnaStrada(tc: number) {
    const g = this.gStrada;
    g.clear();
    const molt = moltiplicatoreCombo(this.partitura.combo);
    const sx = this.proietta(0.5, ANTICIPO), dx = this.proietta(10.5, ANTICIPO);
    const sxb = this.proietta(0.5, -0.35), dxb = this.proietta(10.5, -0.35);
    // campi a strisce che scorrono (come nei vecchi giochi di corse): danno il senso della velocità
    const meta = this.battito / 2;
    for (let k = Math.floor((tc - 0.4) / meta); k * meta - tc < ANTICIPO; k++) {
      if (k % 2) continue;
      const y1 = this.proietta(0, Math.max(-0.35, k * meta - tc)).y, y2 = this.proietta(0, Math.min(ANTICIPO, (k + 1) * meta - tc)).y;
      g.fillStyle(0x221c15, 1).fillRect(0, Math.min(y1, y2), W, Math.abs(y1 - y2));
    }
    // asfalto
    g.fillStyle(0x2a2520, 1).fillPoints([{ x: sx.x, y: sx.y }, { x: dx.x, y: dx.y }, { x: dxb.x, y: dxb.y }, { x: sxb.x, y: sxb.y }], true);
    // bordi che si accendono quando sei in fiamme
    const bordo = molt >= 4 ? 0xff5fa2 : molt >= 3 ? COL.rosso : molt >= 2 ? COL.ottone : COL.carta;
    g.lineStyle(molt > 1 ? 5 : 3, bordo, molt > 1 ? 1 : 0.6).lineBetween(sx.x, sx.y, sxb.x, sxb.y).lineBetween(dx.x, dx.y, dxb.x, dxb.y);
    // corsie (una per foro), con il lampo quando colpisci
    for (let f = 1; f <= 10; f++) {
      const a = this.proietta(f, ANTICIPO), b = this.proietta(f, -0.35);
      if (this.lampi[f] > 0) {
        const a1 = this.proietta(f - 0.5, ANTICIPO), a2 = this.proietta(f + 0.5, ANTICIPO), b1 = this.proietta(f - 0.5, -0.35), b2 = this.proietta(f + 0.5, -0.35);
        g.fillStyle(COL.lampada, 0.25 * this.lampi[f]).fillPoints([{ x: a1.x, y: a1.y }, { x: a2.x, y: a2.y }, { x: b2.x, y: b2.y }, { x: b1.x, y: b1.y }], true);
      }
      void a; void b;
      if (f < 10) {
        const c = this.proietta(f + 0.5, ANTICIPO), d = this.proietta(f + 0.5, -0.35);
        g.lineStyle(1, COL.carta, 0.12).lineBetween(c.x, c.y, d.x, d.y);
      }
    }
    // righe dei battiti che scorrono verso di te
    const primo = Math.ceil((tc - 0.3) / this.battito);
    for (let b = primo; b * this.battito - tc < ANTICIPO; b++) {
      if (b < 0) continue;
      const dtb = b * this.battito - tc;
      const l = this.proietta(0.5, dtb), r = this.proietta(10.5, dtb);
      const battuta = b % 4 === 0;
      g.lineStyle(battuta ? 3 : 1, COL.carta, (battuta ? 0.3 : 0.1) * Math.min(1, l.s * 1.4)).lineBetween(l.x, l.y, r.x, r.y);
    }
    // tratteggio sui bordi della strada
    for (let k = Math.floor((tc - 0.4) / meta); k * meta - tc < ANTICIPO; k++) {
      if (k % 2) continue;
      const d1 = Math.max(-0.35, k * meta - tc), d2 = Math.min(ANTICIPO, (k + 1) * meta - tc);
      for (const lato of [0.2, 10.8]) {
        const a = this.proietta(lato, d1), b = this.proietta(lato, d2);
        g.lineStyle(Math.max(1, 5 * a.s), COL.lampada, 0.7).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    // linea di colpo
    const l = this.proietta(0.5, 0), r = this.proietta(10.5, 0);
    g.lineStyle(4, COL.ottone, 0.9).lineBetween(l.x, l.y, r.x, r.y);
    // pali ai lati della strada, per sentire la velocità
    const passo = this.battito * 2;
    for (let k = Math.ceil((tc - 0.3) / passo); k * passo - tc < ANTICIPO; k++) {
      const d = k * passo - tc;
      for (const lato of [-1.6, 12.6]) {
        const q = this.proietta(lato, d);
        g.fillStyle(0x3a2818, Math.min(1, q.s * 1.2)).fillRect(q.x - 3 * q.s, q.y - 60 * q.s, 6 * q.s, 60 * q.s);
        g.fillStyle(COL.lampada, 0.8 * q.s).fillCircle(q.x, q.y - 60 * q.s, 4 * q.s);
      }
    }
  }

  private disegnaNote(tc: number) {
    const g = this.gNote;
    g.clear();
    const visibili = new Set<number>();
    // dalle più lontane alle più vicine, così le vicine stanno sopra
    const note = this.partitura.note.filter((n) => n.t - tc < ANTICIPO && n.t + n.durata - tc > -0.4);
    for (let k = note.length - 1; k >= 0; k--) {
      const n = note[k];
      const tab = leggiForo(n.foro);
      const dtn = n.t - tc;
      const testa = this.proietta(tab.hole, Math.max(dtn, n.giudizio && n.giudizio !== "mancata" ? 0 : dtn));
      const colore = n.giudizio === "mancata" ? 0x555555 : tab.bend ? COL.prugna : tab.draw ? COL.indaco : COL.ottone;
      // coda delle note lunghe
      if (n.durata >= this.battito * 1.4) {
        const fine = this.proietta(tab.hole, n.t + n.durata - tc);
        const w1 = 14 * testa.s, w2 = 14 * fine.s;
        const tenuta = n.giudizio && n.giudizio !== "mancata" && this.ascolto.midi === n.midi && tc >= n.t;
        g.fillStyle(colore, tenuta ? 0.95 : 0.5).fillPoints([
          { x: testa.x - w1, y: testa.y }, { x: testa.x + w1, y: testa.y }, { x: fine.x + w2, y: fine.y }, { x: fine.x - w2, y: fine.y }], true);
        if (tenuta) { this.lampi[tab.hole] = Math.max(this.lampi[tab.hole], 0.6); }
      }
      if (n.giudizio && n.giudizio !== "mancata") continue;
      // Leggibilità prima di tutto: dischetto pieno, numero del foro grande e scuro/chiaro ad alto contrasto,
      // freccia fuori dal disco (su = soffio, giù = aspirato). Mai più piccolo di metà grandezza.
      const sc = Math.max(0.55, testa.s);
      const r = 25 * sc;
      const alfa = dtn < -0.1 ? Math.max(0, 1 + dtn * 3) : 1;
      const pieno = tab.bend ? COL.prugna : tab.draw ? COL.indaco : COL.ottone;
      const freccia = 11 * sc, dir = tab.draw ? 1 : -1;
      const yF = testa.y + dir * (r + freccia * 0.2);
      g.fillStyle(COL.inchiostro, alfa).fillCircle(testa.x + 3 * sc, testa.y + 3 * sc, r + 3 * sc);
      g.fillStyle(COL.inchiostro, alfa).fillTriangle(testa.x - freccia, yF - dir * freccia * 0.2, testa.x + freccia, yF - dir * freccia * 0.2, testa.x, yF + dir * freccia * 1.1);
      g.fillStyle(pieno, alfa).fillTriangle(testa.x - freccia * 0.7, yF, testa.x + freccia * 0.7, yF, testa.x, yF + dir * freccia * 0.8);
      g.fillStyle(COL.inchiostro, alfa).fillCircle(testa.x, testa.y, r + 3 * sc);
      g.fillStyle(pieno, alfa).fillCircle(testa.x, testa.y, r);
      for (let b = 0; b < tab.bend; b++) g.lineStyle(Math.max(2, 3 * sc), COL.prugna, alfa).strokeCircle(testa.x, testa.y, r + (7 + b * 6) * sc);
      visibili.add(n.i);
      let et = this.etichette.get(n.i);
      if (!et) {
        // soffio: numero scuro su ottone; aspirato e bend: numero bianco su indaco/prugna
        et = testo(this, 0, 0, `${tab.hole}${"'".repeat(tab.bend)}`, 30, tab.draw || tab.bend ? "#FFFFFF" : HEX.inchiostro, "titoli").setDepth(7);
        if (tab.draw || tab.bend) et.setStroke(HEX.inchiostro, 3);
        this.etichette.set(n.i, et);
      }
      et.setPosition(testa.x, testa.y + 1).setScale(sc * (tab.hole === 10 ? 0.8 : 1)).setAlpha(alfa).setDepth(7 + (ANTICIPO - dtn));
      // in prova, la nota attesa pulsa
      if (this.attesa && n === this.partitura.prossima()) {
        g.lineStyle(4, COL.lampada, 0.5 + 0.5 * Math.sin(this.time.now / 120)).strokeCircle(testa.x, testa.y, r + 14);
      }
    }
    for (const [i, et] of this.etichette) if (!visibili.has(i)) { et.destroy(); this.etichette.delete(i); }
  }

  private chiudi() {
    this.finito = true;
    const p = this.partitura;
    const prima = record.riff[this.riff.id];
    const nuovo = !prima || p.punti > prima.punti;
    record.riff[this.riff.id] = {
      punti: Math.max(prima?.punti ?? 0, Math.round(p.punti)), stelle: Math.max(prima?.stelle ?? 0, p.stelle),
      precisione: Math.max(prima?.precisione ?? 0, p.precisione),
    };
    salva();
    this.suono.basi.ferma(0.8);
    if (p.stelle >= 2) { this.suono.effetti.vittoria(); coriandoli(this); } else this.suono.effetti.sconfitta();
    this.time.delayedCall(900, () => vaiA(this, "riffFine", {
      opzioni: this.o, nome: this.riff.nome, punti: Math.round(p.punti), stelle: p.stelle, precisione: p.precisione,
      comboMax: p.comboMax, conteggio: { ...p.conteggio }, nuovo,
    }));
  }
}
