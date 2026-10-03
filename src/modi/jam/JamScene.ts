// Copiato da modes/src/jam/JamScene.ts con scripts/sync-content.mjs, non modificare qui.
// Jam Libera: il giocatore improvvisa su un blues a 12 battute in seconda posizione.
// Le note escono dall'armonica del protagonista e scorrono sul muro come nastri colorati
// (soffio ottone, aspirato indaco, bend prugna, con la curva vera del bend).
// Il pubblico (GiudiceJam) si scalda con il bel fraseggio e la band cresce con lui.

import Phaser from "phaser";
import { noteName } from "../../harp";
import type { Strumento } from "../../style/basi";
import { prendiAscolto } from "../core/ascolto";
import { prendiSuono, Registratore } from "../core/suono";
import { impostazioni, record, salva } from "../core/impostazioni";
import { foroPerMidi, foroMidi, scriviForo, estensione, soloConBend } from "../core/armonica";
import { COL, HEX, H, W, testo, titolo, pop, grana, textureLuce, coriandoli, vaiA, bottone } from "../core/ui";
import { VistaArmonica } from "../core/vistaArmonica";
import { t, tx, type IdExtra } from "../core/testi";
import { GiudiceJam, livelloHype, moltiplicatore, type EventoJam } from "./giudice";
import { LICK } from "./lick";

export interface OpzioniJam { modo: "assolo" | "scambio"; bpm: number; giri: number; registra: boolean }

interface Punto { t: number; m: number }
interface Nastro { punti: Punto[]; colore: number; etichetta: string; inizio: number; fine: number | null; mae: boolean }

const ORA_X = 228;         // dove nasce il nastro (davanti all'armonica del protagonista)
const VELOCITA = 92;       // pixel al secondo
const MURO = { alto: 92, basso: 318 };
const MAE_X = 790;

/** Musicisti che entrano a ogni livello di pubblico. */
const BAND_CUFFIE: Strumento[][] = [
  ["piede", "acustica"],
  ["piede", "acustica", "basso"],
  ["acustica", "basso", "piano", "spazzole"],
  ["acustica", "basso", "piano", "batteria"],
  ["basso", "piano", "batteria", "elettrica"],
];
const NUOVO_STRUMENTO: (IdExtra | null)[] = [null, "strumento_basso", "strumento_piano", "strumento_batteria", "strumento_elettrica"];

export class JamScene extends Phaser.Scene {
  private o!: OpzioniJam;
  private ascolto = prendiAscolto();
  private suono = prendiSuono();
  private giudice!: GiudiceJam;
  private reg: Registratore | null = null;
  private inizi = new Map<number, number>();
  private battutaCorrente = -1;
  private battuteTotali = 0;
  private finito = false;
  private nastri: Nastro[] = [];
  private nastroCorrente: Nastro | null = null;
  private storico: Nastro[] = [];
  private gNastri!: Phaser.GameObjects.Graphics;
  private gGuide!: Phaser.GameObjects.Graphics;
  private armonica!: VistaArmonica;
  private hypeBarra!: Phaser.GameObjects.Graphics;
  private hypeTesto!: Phaser.GameObjects.Text;
  private puntiTesto!: Phaser.GameObjects.Text;
  private moltTesto!: Phaser.GameObjects.Text;
  private giroTesto!: Phaser.GameObjects.Text;
  private celle: { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; grado: number }[] = [];
  private folla: { s: Phaser.GameObjects.Image; base: number; fase: number }[] = [];
  private lampadine: Phaser.GameObjects.Image[] = [];
  private fari: Phaser.GameObjects.Graphics[] = [];
  private strumenti: Phaser.GameObjects.Container[] = [];
  private insegna!: Phaser.GameObjects.Text;
  private protagonista!: Phaser.GameObjects.Image;
  private mae!: Phaser.GameObjects.Container;
  private maeTesto!: Phaser.GameObjects.Text;
  private livello = 0;
  private faseBattito = 0;
  private ultimoBattito = 0;
  private sordo: [number, number][] = [];
  private midiPrima: number | null = null;
  private scie!: Phaser.GameObjects.Particles.ParticleEmitter;
  private avvisoGrande!: Phaser.GameObjects.Text;
  private chiamataNote: { midi: number; t: number; d: number }[] = [];
  private etichetteMae = new Map<Nastro, Phaser.GameObjects.Text>();

  constructor() { super("jam"); }

  init(o: Partial<OpzioniJam>) {
    o = { modo: "assolo", bpm: 88, giri: 3, registra: false, ...o };
    this.o = o as OpzioniJam;
    this.inizi.clear(); this.battutaCorrente = -1; this.finito = false; this.nastri = []; this.storico = [];
    this.nastroCorrente = null; this.livello = 0; this.sordo = []; this.celle = []; this.folla = []; this.lampadine = [];
    this.fari = []; this.strumenti = []; this.midiPrima = null; this.chiamataNote = []; this.etichetteMae.clear();
    this.battuteTotali = this.o.giri * 12;
  }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.ascolto.accendiMicrofono();
    const tonalita = impostazioni.tonalita;
    // La base: blues a 12 battute in seconda posizione nella tonalità dell'armonica.
    const s = this.suono;
    s.basi.avvia({ area: "juke", armonica: tonalita, forma: "blues12", posizione: 2, bpm: this.o.bpm, swing: "shuffle", band: this.band(0) },
      s.ctx.currentTime + 0.3);
    s.effetti.tonica = s.basi.tonicaMidi;
    s.suBattuta((n, tempo) => this.inizi.set(n, tempo));
    s.suBattito((n, tempo) => this.time.delayedCall(Math.max(0, (tempo - s.ctx.currentTime) * 1000), () => this.battito(n)));

    this.disegnaLocale();
    this.gGuide = this.add.graphics().setDepth(3);
    this.gNastri = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.NORMAL);
    this.disegnaPalco();
    this.disegnaFolla();
    this.armonica = new VistaArmonica(this, W / 2 + 40, 474, 440, 50).setDepth(20);
    this.disegnaInterfaccia();
    this.scie = this.add.particles(0, 0, textureLuce(this), {
      speed: { min: 20, max: 90 }, lifespan: 600, scale: { start: 0.35, end: 0 }, alpha: { start: 0.9, end: 0 },
      blendMode: "ADD", emitting: false,
    }).setDepth(5);
    this.avvisoGrande = testo(this, W / 2 + 40, 200, "", 40, HEX.carta, "titoli").setStroke(HEX.inchiostro, 8).setDepth(40).setAlpha(0);
    grana(this);

    this.giudice = new GiudiceJam({
      tonalita, tonica: s.basi.tonicaMidi, scoperti: record.lick,
      orologio: {
        battito: 60 / this.o.bpm,
        battuta: (tm) => {
          let migliore: number | null = null;
          for (const [n, inizio] of this.inizi) if (inizio <= tm && (migliore === null || n > migliore)) migliore = n;
          if (migliore === null) return null;
          return { n: migliore, inizio: this.inizi.get(migliore)!, grado: s.basi.gradoInBattuta(migliore) };
        },
      },
    });

    const sgancia = this.ascolto.suNota((on) => {
      if (this.finito || this.inSordina(on.time)) return;
      this.giudice.attacco(on.midi, on.time);
    });
    this.events.once("shutdown", () => { sgancia(); this.suono.pulisci(); this.reg?.ferma(); });

    if (this.o.registra && Registratore.disponibile()) {
      this.reg = new Registratore();
      this.reg.avvia(this.ascolto.micAcceso).catch(() => (this.reg = null));
    }
    this.input.keyboard?.on("keydown-ESC", () => this.esci());
  }

  private band(livello: number) { return this.suono.bandSicura(BAND_CUFFIE[livello], record.cuffie); }

  private inSordina(tm: number) { return this.sordo.some(([a, b]) => tm >= a && tm <= b); }

  // ---------- Scenografia ----------

  private disegnaLocale() {
    const g = this.add.graphics();
    // muro di assi
    g.fillStyle(0x2a1d14, 1).fillRect(0, 0, W, 360);
    for (let x = 0; x < W; x += 48) {
      g.fillStyle(x % 96 === 0 ? 0x2f2117 : 0x281b12, 1).fillRect(x, 0, 46, 360);
      g.fillStyle(0x1a120c, 1).fillRect(x + 46, 0, 2, 360);
    }
    // vecchi manifesti appesi
    const manifesto = (x: number, y: number, w: number, h: number, colore: number, ang: number) => {
      const c = this.add.container(x, y).setAngle(ang).setAlpha(0.32);
      const m = this.add.graphics();
      m.fillStyle(colore, 1).fillRect(-w / 2, -h / 2, w, h);
      m.fillStyle(COL.inchiostro, 1).fillRect(-w / 2 + 8, -h / 2 + 10, w - 16, 10).fillRect(-w / 2 + 8, -h / 2 + 26, w - 30, 6);
      m.fillStyle(COL.rosso, 1).fillCircle(0, 8, w * 0.22);
      c.add(m);
    };
    manifesto(560, 170, 90, 120, COL.ottone, -4);
    manifesto(840, 210, 80, 110, COL.carta, 3);
    manifesto(380, 250, 70, 90, 0x8a9a5b, 2);
    // insegna al neon
    this.insegna = testo(this, 700, 112, "JUKE JOINT", 40, "#FF8FC0", "titoli").setStroke("#FF5FA2", 3).setAlpha(0.35)
      .setShadow(0, 0, "#FF5FA2", 18, true, true);
    // filo di lampadine
    const filo = this.add.graphics();
    filo.lineStyle(2, 0x111111, 1);
    const lampX = (i: number) => 20 + i * 47;
    const lampY = (i: number) => 74 + Math.sin((i / 19) * Math.PI * 4) * 6;
    filo.beginPath(); filo.moveTo(0, 72);
    for (let i = 0; i < 20; i++) filo.lineTo(lampX(i), lampY(i) - 6);
    filo.strokePath();
    const luce = textureLuce(this);
    for (let i = 0; i < 20; i++) {
      const l = this.add.image(lampX(i), lampY(i), luce).setScale(0.45).setTint(COL.lampada).setAlpha(0.15).setBlendMode(Phaser.BlendModes.ADD);
      this.add.circle(lampX(i), lampY(i), 4, 0x6b5a3a);
      this.lampadine.push(l);
    }
  }

  private disegnaPalco() {
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x4a321f, 1).fillRect(0, 360, W, 40);
    g.fillStyle(COL.legno, 1).fillRect(0, 352, W, 10);
    g.fillStyle(0x1a120c, 1).fillRect(0, 400, W, 140);
    for (let x = 0; x < W; x += 80) g.fillStyle(0x3e2a1a, 1).fillRect(x, 362, 2, 38);
    // fari
    for (const x of [300, 680]) {
      const f = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      f.fillStyle(COL.lampada, 0.18).fillTriangle(0, 0, -120, 380, 120, 380);
      f.setPosition(x, 0);
      this.fari.push(f);
    }
    // protagonista che suona
    this.protagonista = this.add.image(150, 300, "personaggi-protagonista-suona").setScale(0.78).setDepth(7);
    // gli strumenti della band compaiono quando entrano
    const xs = this.o.modo === "scambio" ? [380, 490, 600, 690] : [470, 600, 740, 860];
    this.strumenti = (["basso", "piano", "batteria", "elettrica"] as const).map((s, i) => this.strumento(s, xs[i]));
    // Zia Mae per il botta e risposta
    const ritratto = this.add.image(0, 0, "personaggi-zia-mae-spiega").setScale(0.62);
    const fumetto = this.add.graphics();
    fumetto.fillStyle(COL.inchiostro, 1).fillRoundedRect(-66, -142, 140, 46, 10);
    fumetto.fillStyle(COL.carta, 1).fillRoundedRect(-70, -146, 140, 46, 10).fillTriangle(-10, -102, 14, -102, 6, -86);
    fumetto.lineStyle(3, COL.inchiostro, 1).strokeRoundedRect(-70, -146, 140, 46, 10);
    this.maeTesto = testo(this, 0, -123, "", 15, HEX.inchiostro, "titoli");
    this.mae = this.add.container(MAE_X, 290, [ritratto, fumetto, this.maeTesto]).setDepth(8).setVisible(this.o.modo === "scambio");
  }

  private strumento(tipo: string, x: number) {
    const g = this.add.graphics();
    const y = 352;
    if (tipo === "basso") {
      g.fillStyle(0x7a4a22, 1).fillEllipse(0, -40, 46, 70).fillEllipse(0, -78, 34, 40);
      g.fillStyle(COL.inchiostro, 1).fillRect(-3, -150, 6, 120).fillCircle(-6, -46, 3).fillCircle(6, -46, 3);
      g.lineStyle(1, COL.carta, 0.6).lineBetween(-2, -150, -2, -30).lineBetween(2, -150, 2, -30);
    } else if (tipo === "piano") {
      g.fillStyle(0x24170f, 1).fillRect(-60, -90, 120, 90);
      g.fillStyle(COL.carta, 1).fillRect(-54, -52, 108, 14);
      for (let i = -54; i < 54; i += 9) g.fillStyle(COL.inchiostro, 1).fillRect(i + 6, -52, 4, 8);
      g.fillStyle(COL.ottone, 1).fillRect(-50, -84, 100, 4);
    } else if (tipo === "batteria") {
      g.fillStyle(COL.rosso, 1).fillCircle(0, -36, 34);
      g.fillStyle(COL.carta, 1).fillCircle(0, -36, 24);
      g.fillStyle(COL.inchiostro, 1).fillRect(36, -96, 3, 96);
      g.fillStyle(COL.ottone, 1).fillEllipse(38, -98, 56, 8).fillEllipse(-46, -70, 44, 7);
      g.fillStyle(0x777777, 1).fillRect(-30, -66, 28, 14);
    } else {
      g.fillStyle(0x222222, 1).fillRect(-34, -70, 68, 70);
      g.fillStyle(0x4a3a2a, 1).fillRect(-28, -62, 56, 44);
      g.fillStyle(COL.ottone, 1).fillRect(-28, -14, 56, 6);
      g.fillStyle(COL.rosso, 1).fillEllipse(-50, -110, 26, 48);
      g.fillStyle(COL.inchiostro, 1).fillRect(-52, -170, 4, 60);
    }
    const c = this.add.container(x, y, [g]).setDepth(5).setAlpha(0).setScale(0.7, 0.7);
    return c;
  }

  private disegnaFolla() {
    // Pubblico in controluce: sagome semplici, senza tratti (la guida vieta le caricature di persone).
    const tex = (chiave: string, braccia: boolean) => {
      if (this.textures.exists(chiave)) return;
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(50, 74, 22);
      g.fillRoundedRect(10, 98, 80, 100, 30);
      if (braccia) {
        // braccia alzate che partono dalle spalle
        g.lineStyle(14, 0xffffff, 1);
        g.lineBetween(20, 112, 8, 40).lineBetween(80, 112, 92, 40);
        g.fillCircle(8, 36, 9).fillCircle(92, 36, 9);
      }
      g.generateTexture(chiave, 100, 200); g.destroy();
    };
    tex("sagoma", false); tex("sagoma-braccia", true);
    const n = 15;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (W / n) + Phaser.Math.Between(-14, 14);
      const fila = i % 2;
      const base = 488 + fila * 22 + Phaser.Math.Between(-6, 6);
      const tinta = fila ? 0x120d0a : 0x2a1f17;
      const sc = 0.78 + Math.random() * 0.25;
      const s = this.add.image(x, base, "sagoma").setTint(tinta).setScale(sc).setDepth(11 + fila * 2);
      this.folla.push({ s, base, fase: Math.random() * Math.PI * 2 });
    }
  }

  private disegnaInterfaccia() {
    // Le 12 battute: si vede dove sei e quale accordo suona
    const tonica = this.suono.basi.tonicaMidi;
    const nomeAcc = (grado: number) => noteName(tonica + grado, impostazioni.lingua).replace(/-?\d+$/, "") + "7";
    for (let i = 0; i < 12; i++) {
      const grado = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7][i];
      const x = 22 + i * 44, y = 30;
      const g = this.add.graphics().setDepth(30);
      const tt = testo(this, x + 20, y, nomeAcc(grado), 12, HEX.carta, "fori").setDepth(31);
      g.setData("x", x).setData("y", y);
      this.celle.push({ g, t: tt, grado });
    }
    this.disegnaCelle(-1);
    this.giroTesto = testo(this, 22 + 12 * 44 + 40, 30, "", 14, HEX.carta, "fori").setDepth(31);
    this.puntiTesto = testo(this, W - 90, 24, "0", 30, HEX.carta, "titoli").setDepth(31).setStroke(HEX.inchiostro, 5);
    this.moltTesto = testo(this, W - 90, 52, "", 14, HEX.ottone, "fori").setDepth(31);
    // il termometro del pubblico
    const fondo = this.add.graphics().setDepth(30);
    fondo.fillStyle(COL.inchiostro, 0.85).fillRoundedRect(W - 46, 92, 30, 236, 15);
    fondo.lineStyle(3, COL.ottone, 1).strokeRoundedRect(W - 46, 92, 30, 236, 15);
    this.hypeBarra = this.add.graphics().setDepth(31);
    testo(this, W - 10, 344, t("hype").toUpperCase(), 11, HEX.carta, "fori").setOrigin(1, 0.5).setDepth(31);
    this.hypeTesto = testo(this, W - 10, 362, t("hype0"), 12, HEX.ottone, "titoli").setOrigin(1, 0.5).setDepth(31);
    bottone(this, 52, 520, t("esci"), () => this.esci(), { w: 84, h: 30, primario: false, size: 14 }).setDepth(35);
  }

  private disegnaCelle(attiva: number) {
    for (let i = 0; i < 12; i++) {
      const c = this.celle[i];
      const x = c.g.getData("x"), y = c.g.getData("y");
      const colore = c.grado === 0 ? COL.ottone : c.grado === 5 ? COL.indaco : COL.prugna;
      c.g.clear();
      c.g.fillStyle(i === attiva ? colore : COL.inchiostro, i === attiva ? 1 : 0.75).fillRoundedRect(x, y - 15, 40, 30, 6);
      c.g.lineStyle(2, colore, 1).strokeRoundedRect(x, y - 15, 40, 30, 6);
      c.t.setColor(i === attiva ? HEX.inchiostro : HEX.carta);
    }
  }

  // ---------- Tempo ----------

  private battito(n: number) {
    if (this.finito) return;
    this.faseBattito = 0;
    this.ultimoBattito = this.time.now;
    for (const l of this.lampadine) if (l.alpha > 0.3) this.tweens.add({ targets: l, scale: { from: 0.62, to: 0.45 }, duration: 260 });
    for (const s of this.strumenti) if (s.alpha > 0.5) this.tweens.add({ targets: s, scaleY: { from: 0.97, to: 1 }, duration: 180 });
    this.tweens.add({ targets: this.protagonista, scaleY: { from: 0.76, to: 0.78 }, duration: 200 });
    if (n === 0) this.nuovaBattuta();
  }

  private nuovaBattuta() {
    const ora = this.suono.ctx.currentTime;
    let n = -1;
    for (const [k, v] of this.inizi) if (v <= ora + 0.03 && k > n) n = k;
    if (n < 0 || n === this.battutaCorrente) return;
    this.battutaCorrente = n;
    if (n >= this.battuteTotali) return this.fine();
    const grado = this.suono.basi.gradoInBattuta(n), prima = n > 0 ? this.suono.basi.gradoInBattuta(n - 1) : grado;
    this.giudice.battuta(n, grado, prima);
    this.disegnaCelle(n % 12);
    this.giroTesto.setText(`${tx("giro")} ${Math.floor(n / 12) + 1}/${this.o.giri}`);
    // Nella prossima battuta, il cambio d'accordo vale doppio: lo segnaliamo un battito prima
    const g = this.suono.basi.gradoInBattuta(n + 1);
    if (g !== grado && n + 1 < this.battuteTotali) {
      const c = this.celle[(n + 1) % 12];
      this.tweens.add({ targets: c.t, scale: { from: 1.5, to: 1 }, duration: 400, delay: (60 / this.o.bpm) * 3000 });
    }
    if (this.o.modo === "scambio") this.scambio(n);
  }

  /** Botta e risposta: ogni 4 battute, Zia Mae suona due battute e il giocatore risponde nelle due seguenti. */
  private scambio(n: number) {
    const fase = n % 4;
    const b = 60 / this.o.bpm;
    if (fase === 0 && n + 2 < this.battuteTotali) {
      const lick = LICK[Phaser.Math.Between(0, LICK.length - 1)];
      const durate = lick.fori.map((_, i) => (i === lick.fori.length - 1 ? 2 : lick.fori.length > 5 ? 0.5 : 1));
      const inizio = this.inizi.get(n)!;
      const tempi = this.suono.effetti.suonaFrase(lick.fori, impostazioni.tonalita, b, inizio, "normale", durate);
      const fine = inizio + durate.reduce((a, x) => a + x, 0) * b;
      this.sordo.push([inizio - 0.05, fine + 0.3]);
      this.chiamataNote = lick.fori.map((f, i) => ({ midi: foroMidi(f, impostazioni.tonalita), t: tempi[i], d: durate[i] * b * 0.92 }));
      const midi = lick.fori.map((f) => foroMidi(f, impostazioni.tonalita));
      this.giudice.apriRisposta(midi, inizio + 8 * b, 8 * b);
      this.maeTesto.setText(t("ascoltaMae").split(" ")[0] + "…");
      this.tweens.add({ targets: this.mae, y: { from: 300, to: 290 }, duration: 300, ease: "Back.easeOut" });
      this.time.delayedCall(Math.max(0, (inizio + 8 * b - this.suono.ctx.currentTime) * 1000), () => {
        if (this.finito) return;
        this.maeTesto.setText(t("tuoTurno"));
        this.mostraAvviso(t("tuoTurno"), HEX.lampada);
      });
    }
  }

  private fine() {
    if (this.finito) return;
    this.finito = true;
    const s = this.suono;
    const quando = this.inizi.get(this.battuteTotali) ?? s.ctx.currentTime;
    s.basi.ferma(0.6);
    s.effetti.vittoria(quando + 0.05);
    this.mostraAvviso(t("fineJam"), HEX.ottone);
    if (this.giudice.hype > 60) coriandoli(this);
    const st = this.giudice.statistiche;
    record.lick = [...new Set([...record.lick, ...this.giudice.scoperti])];
    const nuovoRecord = this.giudice.punti > record.jam.punti;
    record.jam = {
      punti: Math.max(record.jam.punti, Math.round(this.giudice.punti)),
      hype: Math.max(record.jam.hype, Math.round(this.giudice.hypeMax)),
      jam: record.jam.jam + 1,
      minuti: record.jam.minuti + (this.battuteTotali * 4 * 60) / this.o.bpm / 60,
    };
    salva();
    this.time.delayedCall(1700, async () => {
      const url = this.reg ? await this.reg.ferma() : null;
      vaiA(this, "jamFine", {
        punti: Math.round(this.giudice.punti), hypeMax: Math.round(this.giudice.hypeMax), nuovoRecord,
        frasi: st.frasi, bend: st.bend, note: st.note, cambi: st.cambi, cambiTotali: st.cambiTotali,
        lick: [...st.lick], nuoviLick: [...st.nuoviLick], storico: this.storico.map((n) => ({ ...n, punti: n.punti.filter((_, i) => i % 3 === 0) })),
        durata: (this.battuteTotali * 4 * 60) / this.o.bpm, inizio: this.inizi.get(0) ?? 0,
        audio: url, estensione: this.reg?.estensione ?? "webm", opzioni: this.o,
      });
    });
  }

  private esci() {
    this.finito = true;
    vaiA(this, "jamMenu");
  }

  // ---------- Ogni frame ----------

  update(_: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    const a = this.ascolto;
    a.aggiorna(dt);
    const ora = a.ora;
    const sordina = this.inSordina(ora);
    const midi = sordina ? null : a.midi, midiF = sordina ? null : a.midiF;

    if (!this.finito) {
      if (this.midiPrima !== null && midi === null) this.giudice.rilascio(ora - a.engine.inputLatency);
      this.giudice.passo(ora, dt, midi !== null);
      for (const e of this.giudice.raccogli()) this.mostraEvento(e);
    }
    this.midiPrima = midi;
    if (!this.finito) this.suono.abbassaBand(midi !== null, record.cuffie);

    // Nastri: un punto per frame sulla nota corrente
    this.aggiornaNastro(ora, midi, midiF);
    // Zia Mae suona: anche le sue note diventano nastri (tratteggiati), così si vede cosa rispondere
    for (const c of this.chiamataNote) {
      if (ora >= c.t && ora <= c.t + c.d) {
        if (!this.nastri.some((n) => n.mae && n.inizio === c.t)) {
          this.nastri.push({ punti: [], colore: COL.carta, etichetta: scriviForo(foroPerMidi(c.midi, impostazioni.tonalita)!), inizio: c.t, fine: c.t + c.d, mae: true });
        }
        const n = this.nastri.find((x) => x.mae && x.inizio === c.t)!;
        n.punti.push({ t: ora, m: c.midi });
        this.armonica.accendi(foroPerMidi(c.midi, impostazioni.tonalita));
      }
    }
    this.disegnaNastri(ora);
    this.disegnaGuide(ora);

    // Armonica in basso
    if (!this.chiamataNote.some((c) => ora >= c.t && ora <= c.t + c.d)) {
      const tab = midi === null ? null : foroPerMidi(midi, impostazioni.tonalita);
      this.armonica.accendi(tab, tab && midi !== null ? `${scriviForo(tab)}  ·  ${noteName(midi, impostazioni.lingua)}` : "");
    }

    // Pubblico, luci, band
    const h = this.giudice?.hype ?? 0;
    const liv = livelloHype(h);
    if (liv !== this.livello && !this.finito) this.cambiaLivello(liv);
    this.aggiornaHype(h);
    const fase = (this.time.now - this.ultimoBattito) / ((60 / this.o.bpm) * 1000);
    const salto = Math.max(0, 1 - fase) * (2 + h * 0.12);
    for (const p of this.folla) {
      const y = p.base - salto * (0.6 + 0.4 * Math.sin(p.fase)) ;
      p.s.y = y;
      const tifo = liv >= 3 && Math.sin(p.fase * 3 + Math.floor(this.time.now / 2400)) > (liv >= 4 ? -0.6 : 0.3);
      p.s.setTexture(tifo ? "sagoma-braccia" : "sagoma");
    }
    const accese = Math.round((h / 100) * this.lampadine.length);
    this.lampadine.forEach((l, i) => (l.alpha = i < accese ? 0.85 : 0.12));
    this.insegna.setAlpha(0.3 + (h / 100) * 0.7 * (Math.random() < 0.03 ? 0.5 : 1));
    this.fari.forEach((f, i) => {
      f.alpha = liv >= 3 ? 0.9 : 0;
      f.rotation = Math.sin(this.time.now / 1400 + i * 2) * 0.35;
    });
    this.puntiTesto.setText(String(Math.round(this.giudice?.punti ?? 0)));
    const m = moltiplicatore(h);
    this.moltTesto.setText(m > 1 ? `× ${m}` : "");
  }

  private y(m: number) {
    const { min, max } = estensione(impostazioni.tonalita);
    return Phaser.Math.Clamp(MURO.basso - ((m - min) / (max - min)) * (MURO.basso - MURO.alto), MURO.alto - 10, MURO.basso + 10);
  }

  private aggiornaNastro(ora: number, midi: number | null, midiF: number | null) {
    if (midi === null || midiF === null) {
      if (this.nastroCorrente) this.nastroCorrente.fine = ora;
      this.nastroCorrente = null;
      return;
    }
    const tab = foroPerMidi(midi, impostazioni.tonalita);
    const colore = !tab ? COL.rosso : tab.bend || soloConBend(midi, impostazioni.tonalita) ? COL.prugna : tab.draw ? COL.indacoChiaro : COL.ottone;
    const etichetta = tab ? scriviForo(tab) : "";
    let n = this.nastroCorrente;
    // Un bend resta lo stesso nastro (si vede la curva); un salto di foro ne comincia uno nuovo.
    const ultimo = n?.punti[n.punti.length - 1];
    if (!n || (ultimo && Math.abs(ultimo.m - midiF) > 2.6)) {
      if (n) n.fine = ora;
      n = { punti: [], colore, etichetta, inizio: ora, fine: null, mae: false };
      this.nastri.push(n);
      this.storico.push(n);
      this.nastroCorrente = n;
      if (!this.finito) this.scie.explode(6, ORA_X, this.y(midiF));
    }
    if (colore === COL.prugna) n.colore = COL.prugna;
    if (colore === COL.prugna && tab) n.etichetta = scriviForo(tab);
    n.punti.push({ t: ora, m: midiF });
  }

  private disegnaNastri(ora: number) {
    const g = this.gNastri;
    g.clear();
    const xTu = (tm: number) => ORA_X + (ora - tm) * VELOCITA;
    // le note di Zia Mae partono da lei e volano verso di te
    const xMae = (tm: number) => MAE_X - 70 - (ora - tm) * VELOCITA;
    this.nastri = this.nastri.filter((n) => (n.fine === null ? true : n.mae ? xMae(n.fine) > ORA_X - 40 : xTu(n.fine) < W + 40));
    for (const n of this.nastri) {
      if (n.punti.length < 1) continue;
      const xDi = n.mae ? xMae : xTu;
      const spessore = n.mae ? 6 : 12;
      // alone
      g.lineStyle(spessore + 10, n.colore, n.mae ? 0.08 : 0.18);
      this.traccia(g, n, xDi);
      g.lineStyle(spessore + 4, COL.inchiostro, 0.9);
      this.traccia(g, n, xDi);
      g.lineStyle(spessore, n.colore, 1);
      this.traccia(g, n, xDi);
    }
    // le note di Zia Mae hanno il nome del foro: si legge cosa rispondere
    for (const n of this.nastri) {
      if (!n.mae || !n.punti.length) continue;
      let et = this.etichetteMae.get(n);
      if (!et) { et = testo(this, 0, 0, n.etichetta, 20, HEX.carta, "titoli").setStroke(HEX.inchiostro, 5).setDepth(5); this.etichetteMae.set(n, et); }
      const p0 = n.punti[0];
      et.setPosition(xMae(p0.t), this.y(p0.m) - 22);
    }
    for (const [n, et] of this.etichetteMae) if (!this.nastri.includes(n)) { et.destroy(); this.etichetteMae.delete(n); }
    // punta luminosa all'origine
    if (this.nastroCorrente) {
      const p = this.nastroCorrente.punti[this.nastroCorrente.punti.length - 1];
      g.fillStyle(COL.carta, 1).fillCircle(ORA_X, this.y(p.m), 7);
      g.fillStyle(this.nastroCorrente.colore, 0.4).fillCircle(ORA_X, this.y(p.m), 14);
    }
  }

  private traccia(g: Phaser.GameObjects.Graphics, n: Nastro, xDi: (t: number) => number) {
    const p = n.punti;
    if (p.length === 1) { g.lineBetween(xDi(p[0].t), this.y(p[0].m), xDi(p[0].t) + 2, this.y(p[0].m)); return; }
    g.beginPath();
    g.moveTo(xDi(p[0].t), this.y(p[0].m));
    for (let i = 1; i < p.length; i++) g.lineTo(xDi(p[i].t), this.y(p[i].m));
    g.strokePath();
  }

  /** Righe guida sul muro: le note dell'accordo che suona adesso (le più sicure su cui fermarsi). */
  private disegnaGuide(ora: number) {
    const g = this.gGuide;
    g.clear();
    const b = this.battutaCorrente >= 0 ? this.battutaCorrente : 0;
    const grado = this.suono.basi.gradoInBattuta(b);
    const tonica = this.suono.basi.tonicaMidi;
    const accordo = [0, 4, 7, 10].map((x) => (x + grado) % 12);
    const { min, max } = estensione(impostazioni.tonalita);
    const fori = [];
    for (let m = min; m <= max; m++) {
      const iv = (((m - tonica) % 12) + 12) % 12;
      if (!accordo.includes(iv)) continue;
      const tab = foroPerMidi(m, impostazioni.tonalita);
      if (!tab) continue;
      const radice = iv === grado % 12;
      const y = this.y(m);
      g.lineStyle(radice ? 2 : 1, COL.lampada, radice ? 0.35 : 0.14);
      for (let x = ORA_X + 30; x < W - 60; x += 18) g.lineBetween(x, y, x + 9, y);
      fori.push(tab);
    }
    if (!this.finito) this.armonica.suggerisci(fori.filter((f) => f.hole >= 1));
    void ora;
  }

  private aggiornaHype(h: number) {
    const g = this.hypeBarra;
    g.clear();
    const alt = 224 * (h / 100);
    const colori = [COL.indaco, COL.ottone, COL.ottone, COL.rosso, 0xff5fa2];
    g.fillStyle(colori[livelloHype(h)], 1).fillRoundedRect(W - 40, 322 - alt, 18, Math.max(6, alt), 9);
    g.lineStyle(2, COL.carta, 0.25);
    for (const l of [25, 50, 75, 95]) g.lineBetween(W - 44, 322 - 224 * (l / 100), W - 18, 322 - 224 * (l / 100));
  }

  private cambiaLivello(liv: number) {
    const su = liv > this.livello;
    this.livello = liv;
    this.hypeTesto.setText(t(`hype${liv}` as "hype0"));
    this.suono.impostaBand(this.band(liv));
    if (!su) return;
    this.mostraAvviso(`${tx("livelloSu")} ${t(`hype${liv}` as "hype0").toLowerCase()}!`, HEX.lampada);
    this.suono.effetti.critico();
    const nuovo = NUOVO_STRUMENTO[liv];
    // con le casse suonano solo i tamburi: si presenta sul palco solo chi si sente davvero
    if (nuovo && (record.cuffie || nuovo === "strumento_batteria")) {
      const s = this.strumenti[liv - 1];
      this.tweens.add({ targets: s, alpha: 1, scale: 1, duration: 500, ease: "Back.easeOut" });
      this.time.delayedCall(900, () => pop(this, s.x, 230, `${tx("entra")} ${tx(nuovo)}!`, HEX.carta, 18, 1800));
    }
    if (liv >= 4) coriandoli(this);
    this.cameras.main.shake(180, 0.004);
  }

  private mostraAvviso(s: string, colore: string) {
    const a = this.avvisoGrande;
    this.tweens.killTweensOf(a);
    a.setText(s).setColor(colore).setAlpha(1).setScale(0.5);
    this.tweens.add({ targets: a, scale: 1, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: a, alpha: 0, delay: 1400, duration: 500 });
  }

  private mostraEvento(e: EventoJam) {
    const y = this.nastroCorrente ? this.y(this.nastroCorrente.punti[this.nastroCorrente.punti.length - 1].m) - 34 : 200;
    const x = ORA_X + 60 + Phaser.Math.Between(-20, 60);
    const colori: Partial<Record<EventoJam["tipo"], string>> = {
      cambio: HEX.lampada, bend: "#C79BE8", blue: "#8FB3E6", lunga: HEX.carta, fiato: HEX.ottone, eco: HEX.lampada,
      tasca: HEX.carta, lick: HEX.ottone, lickNuovo: HEX.ottone, risposta: HEX.lampada, copia: HEX.lampada, risolta: HEX.carta, estensione: HEX.lampada,
    };
    if (e.tipo === "consiglioRespira") return this.consiglio(t("troppeNote"));
    if (e.tipo === "consiglioSilenzio") return this.consiglio(t("silenzioLungo"));
    if (e.tipo === "lickNuovo" || e.tipo === "lick") {
      const nome = e.lick ? e.lick.nome[impostazioni.lingua] : "";
      this.mostraAvviso(`${tx(e.tipo === "lickNuovo" ? "ev_lickNuovo" : "ev_lick")}: ${nome}`, HEX.ottone);
      if (e.tipo === "lickNuovo") { this.suono.effetti.critico(); coriandoli(this, W / 2, -10, 40); }
      return;
    }
    if (e.tipo === "frase") { pop(this, x, y, `+${e.punti} ${tx("ev_frase")}`, HEX.grigio, 15, 900); return; }
    const testoEv = tx(`ev_${e.tipo}` as IdExtra);
    pop(this, x, Math.max(110, y), `${testoEv} +${e.punti}`, colori[e.tipo] ?? HEX.carta, e.punti >= 10 ? 26 : 20);
    if (e.tipo === "cambio" || e.tipo === "copia" || e.tipo === "fiato") this.suono.effetti.notaGiusta();
  }

  private ultimoConsiglio = 0;
  private consiglio(s: string) {
    if (this.time.now - this.ultimoConsiglio < 6000) return;
    this.ultimoConsiglio = this.time.now;
    const box = this.add.container(W / 2 + 40, 420).setDepth(45).setAlpha(0);
    const tt = testo(this, 0, 0, s, 17, HEX.inchiostro, "titoli");
    const g = this.add.graphics();
    const w = tt.width + 40;
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 4, -20, w, 40, 10);
    g.fillStyle(COL.carta, 1).fillRoundedRect(-w / 2, -24, w, 40, 10);
    tt.setY(-4);
    box.add([g, tt]);
    this.tweens.add({ targets: box, alpha: 1, y: 410, duration: 250, yoyo: true, hold: 2600, onComplete: () => box.destroy() });
  }
}
