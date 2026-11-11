// Copiato da modes/src/brano/BranoScene.ts con scripts/sync-content.mjs, non modificare qui.
// Lo studio di una frase: ASCOLTA (la traccia originale, la tab scorre e si accende) → TOCCA A TE
// (stessa base, armonica nascosta, il microfono giudica) → esito, e si riparte da solo.
// Tre gradini per frase, una stella ciascuno: con la tab, tab a scomparsa, a memoria.

import Phaser from "phaser";
import { prendiAscolto } from "../core/ascolto";
import { prendiSuono } from "../core/suono";
import { COL, HEX, W, H, testo, pop, grana, textureLuce, vaiA, bottone, coriandoli, verticale } from "../core/ui";
import { VistaArmonica } from "../core/vistaArmonica";
import { foroPerMidi } from "../core/armonica";
import { GiudiceFrase, SOGLIE, type NotaBrano } from "./analisi";
import { chiave, progresso, salvaProgressi } from "./archivio";
import { Lettore } from "./lettore";
import { branoAperto, notePezzo, type BranoAperto } from "./sessione";
import { L, nomePezzo, pezzi, sbloccato, stelle, stelleTesto, type Pezzo } from "./BranoMenuScene";

type Fase = "ascolta" | "tocca" | "esito";
/** Secondi di base prima della frase, per entrare nel groove. */
const ATTACCO = 1.8;
const CODA = 0.5;

export class BranoScene extends Phaser.Scene {
  private b!: BranoAperto;
  private pz!: Pezzo;
  private note: NotaBrano[] = [];
  private inizio = 0;
  private fine = 0;
  private passo = 0;
  private fase: Fase = "ascolta";
  private lettore!: Lettore;
  private giudice: GiudiceFrase | null = null;
  private ascolto = prendiAscolto();
  private V = false;
  private pxs = 220;
  private xTesta = 0;
  private yRullo = 0;
  private gRullo!: Phaser.GameObjects.Graphics;
  private gNote!: Phaser.GameObjects.Graphics;
  private etichette = new Map<number, Phaser.GameObjects.Text>();
  private armonica!: VistaArmonica;
  private banner!: Phaser.GameObjects.Container;
  private bannerTit!: Phaser.GameObjects.Text;
  private bannerSotto!: Phaser.GameObjects.Text;
  private stelleTxt!: ReturnType<typeof stelleTesto>;
  private avviso!: Phaser.GameObjects.Text;
  private salta: Phaser.GameObjects.Container | null = null;
  private scintille!: Phaser.GameObjects.Particles.ParticleEmitter;
  private overlay: Phaser.GameObjects.GameObject[] = [];
  /** Coppie orologio audio ↔ tempo della traccia, per portare gli attacchi del microfono sulla traccia. */
  private ancora = { c: 0, s: 0 };
  private contoFatto = -1;
  private sgancia: (() => void) | null = null;
  private pausa = false;
  private lati = false;
  /** Ascolta tutto: la traccia intera con la tab che scorre, senza giudizio. */
  private soloAscolto = false;

  constructor() { super("brano"); }

  init(d: { da?: number; a?: number; tutto?: boolean }) {
    const b = branoAperto();
    if (!b) return;
    this.b = b;
    const da = Math.max(0, Math.min(b.frasi.length - 1, d?.da ?? 0));
    const a = Math.max(da, Math.min(b.frasi.length - 1, d?.a ?? da));
    this.pz = pezzi(b).find((p) => p.da === da && p.a === a) ?? { da, a, tipo: da === a ? "frase" : "catena" };
    this.note = notePezzo(b, da, a);
    this.inizio = b.frasi[da].inizio;
    this.fine = b.frasi[a].fine;
    // si riparte dal gradino non ancora conquistato
    this.passo = Math.min(2, stelle(b.id, this.pz));
    this.etichette.clear();
    this.overlay = [];
    this.pausa = false;
    this.lati = false;
    this.soloAscolto = !!d?.tutto && b.note.length > 0;
    if (this.soloAscolto) {
      this.pz = { da: 0, a: Math.max(0, b.frasi.length - 1), tipo: "tutto" };
      this.note = b.note;
      this.inizio = 0;
      this.fine = b.durata;
    }
  }

  create() {
    if (!this.b) { this.scene.start("branoMenu"); return; }
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.V = verticale();
    void this.ascolto.accendiMicrofono();
    prendiSuono().basi.ferma(0.1);
    this.pxs = this.V ? 210 : 240;
    this.xTesta = this.V ? 150 : 250;
    this.yRullo = this.V ? Math.round(H * 0.45) : 290;
    this.sfondo();
    this.gRullo = this.add.graphics().setDepth(4);
    this.gNote = this.add.graphics().setDepth(6);
    const yArm = this.V ? H - 112 : H - 52;
    this.armonica = new VistaArmonica(this, W / 2, yArm, this.V ? 500 : 520, this.V ? 48 : 40, this.V).setDepth(10);
    this.scintille = this.add.particles(0, 0, textureLuce(this), {
      speed: { min: 80, max: 240 }, lifespan: 450, scale: { start: 0.5, end: 0 }, blendMode: "ADD", emitting: false, tint: [COL.ottone, COL.lampada, 0x9fe08a],
    }).setDepth(12);
    this.intestazione();
    grana(this, 0.3);

    this.lettore = new Lettore(this.b.url, this.b.traccia);
    this.lettore.suFine = () => this.fineGiro();
    this.sgancia = this.ascolto.suNota((on) => {
      if (this.fase !== "tocca" || !this.giudice || !this.lettore.inPosizione) return;
      const i = this.giudice.attacco(this.tempoTraccia(on.time), on.midi);
      if (i >= 0) this.preso(i);
    });
    this.events.once("shutdown", () => { this.sgancia?.(); this.lettore.distruggi(); });
    this.input.keyboard?.on("keydown-ESC", () => this.esci());
    this.input.keyboard?.on("keydown-ENTER", () => { if (this.fase === "ascolta") this.vaiTocca(); });
    // ascolta subito, tranne l'assolo intero (lo conosci già: si va dritti al tuo turno)
    void this.lettore.attendi().then(() => (this.soloAscolto ? this.vaiAscolta() : this.pz.tipo === "tutto" ? this.vaiTocca() : this.vaiAscolta()));
  }

  private get velocita() { return progresso(this.b.id).velocita || 1; }

  /** L'istante dell'orologio audio (attacco del microfono) portato sul tempo della traccia. */
  private tempoTraccia(c: number) {
    const uscita = this.lettore.ctx.outputLatency || 0.02;
    return this.ancora.s + (c - this.ancora.c - uscita) * this.velocita;
  }

  // ---------------------------------------------------------------- giro

  private vaiAscolta() {
    this.fase = "ascolta";
    this.giudice = null;
    this.pulisciOverlay();
    this.contoFatto = -1;
    if (this.soloAscolto) {
      this.mostraBanner(L("Ascolta tutto", "Hear it all"), L("il brano intero, con la tab che scorre", "the whole track, with the tab scrolling"), COL.ottone, HEX.inchiostro);
      void this.lettore.suona(0, this.fine, this.velocita, false);
      this.comandiAscolto();
      return;
    }
    this.mostraBanner(L("Ascolta", "Listen"), L("l'armonica originale, sulla base", "the original harp, over the backing"), COL.ottone, HEX.inchiostro);
    void this.lettore.suona(this.inizio - ATTACCO, this.fine + CODA, this.velocita, false);
    this.bottoneSalta();
  }

  private vaiTocca() {
    if (this.fase === "tocca") return;
    this.fase = "tocca";
    this.salta?.destroy(); this.salta = null;
    this.pulisciOverlay();
    this.giudice = new GiudiceFrase(this.note, 0.3 * this.velocita);
    this.etichette.forEach((e) => e.destroy()); this.etichette.clear();
    const gradino = [L("★ con la tab", "★ with the tab"), L("★★ tab a scomparsa", "★★ fading tab"), L("★★★ a memoria", "★★★ by heart")][this.passo];
    this.mostraBanner(L("Tocca a te!", "Your turn!"), `${gradino} · ${L("armonica nascosta", "harp hidden")}`, COL.rosso, HEX.carta);
    this.contoFatto = -1;
    void this.lettore.suona(this.inizio - ATTACCO, this.fine + CODA, this.velocita, true);
  }

  private fineGiro() {
    if (this.soloAscolto) { if (!this.pausa) this.esci(); return; }
    if (this.fase === "ascolta") { if (!this.pausa) this.vaiTocca(); return; }
    if (this.fase !== "tocca" || !this.giudice) return;
    this.giudice.aggiorna(Infinity);
    this.fase = "esito";
    this.esito(this.giudice);
  }

  private esito(g: GiudiceFrase) {
    const prec = g.precisione;
    const p = progresso(this.b.id);
    const k = chiave(this.pz.da, this.pz.a);
    const guadagnate = g.stelleAl(this.passo);
    const prima = p.stelle[k] ?? 0;
    p.meglio[k] = Math.max(p.meglio[k] ?? 0, prec);
    if (guadagnate > prima) p.stelle[k] = guadagnate;
    salvaProgressi();
    const passato = guadagnate > 0;
    const finito = passato && this.passo === 2;
    this.aggiornaStelle();

    const V = this.V;
    const velo = this.add.rectangle(W / 2, H / 2, W, H, COL.notte, 0.55).setDepth(40);
    const y = V ? H * 0.36 : H * 0.42;
    const pct = testo(this, W / 2, y - (V ? 70 : 56), `${Math.round(prec * 100)}%`, V ? 76 : 64, passato ? HEX.lampada : HEX.carta, "titoli").setStroke(HEX.inchiostro, 8).setDepth(41).setScale(0.3);
    this.tweens.add({ targets: pct, scale: 1, duration: 220, ease: "Back.easeOut" });
    const st = stelleTesto(this, W / 2, y + (V ? 8 : 4), p.stelle[k] ?? 0, V ? 48 : 40, HEX.carta).setDepth(41);
    const soglia = Math.round(SOGLIE[this.passo] * 100);
    const msg = finito ? L("Frase imparata!", "Phrase learned!")
      : passato ? L(`Ottimo! Prossimo gradino: ${this.passo === 0 ? "tab a scomparsa" : "a memoria"}`, `Great! Next step: ${this.passo === 0 ? "fading tab" : "by heart"}`)
      : L(`Serve il ${soglia}%: riascolta e riprova`, `You need ${soglia}%: listen again and retry`);
    const m = testo(this, W / 2, y + (V ? 66 : 52), msg, V ? 22 : 19, HEX.carta, "titoli").setStroke(HEX.inchiostro, 5).setDepth(41).setWordWrapWidth(W - 60);
    this.overlay.push(velo, pct, st, m);
    if (passato) { prendiSuono().effetti.notaGiusta(finito ? 6 : 2); coriandoli(this, W / 2, -10, finito ? 90 : 30); }

    const prossimo = finito ? this.prossimoPezzo() : null;
    const yb = y + (V ? 150 : 112);
    const continua = () => {
      if (this.fase !== "esito") return;
      if (finito) {
        if (prossimo) vaiA(this, "brano", { da: prossimo.da, a: prossimo.a });
        else vaiA(this, "branoMenu", { vista: "mappa" });
        return;
      }
      if (passato) this.passo++;
      // dopo un gradino superato si riprova subito al gradino nuovo, dopo un errore si riascolta
      if (passato) { this.fase = "esito"; this.vaiAscolta(); } else this.vaiAscolta();
    };
    const etichetta = finito ? (prossimo ? "▶ " + nomePezzo(prossimo, this.b.frasi.length) : L("▶ Mappa del brano", "▶ Song map")) : "▶ " + L("Avanti", "Go on");
    const b1 = bottone(this, W / 2, yb, etichetta, continua, { w: V ? 400 : 340, h: V ? 64 : 46, size: V ? 20 : 17 }).setDepth(42);
    const b2 = bottone(this, W / 2, yb + (V ? 80 : 58), L("Mappa", "Map"), () => this.esci(), { w: V ? 220 : 160, h: V ? 52 : 36, primario: false, size: V ? 17 : 14 }).setDepth(42);
    const rip = this.passo > 0 || finito ? bottone(this, W / 2, yb + (V ? 146 : 104), L("Rifai questo gradino", "Redo this step"), () => this.vaiAscolta(), { w: V ? 300 : 240, h: V ? 48 : 34, primario: false, size: V ? 15 : 13 }).setDepth(42) : null;
    this.overlay.push(b1, b2, ...(rip ? [rip] : []));
    // arcade: si riparte da soli dopo un attimo
    const auto = this.time.delayedCall(finito ? 3200 : 2200, continua);
    this.overlay.push({ destroy: () => auto.remove(false) } as unknown as Phaser.GameObjects.GameObject);
    this.input.keyboard?.once("keydown-SPACE", continua);
  }

  private prossimoPezzo(): Pezzo | null {
    const tutti = pezzi(this.b);
    const i = tutti.findIndex((p) => p.da === this.pz.da && p.a === this.pz.a);
    for (let j = i + 1; j < tutti.length; j++) if (sbloccato(this.b.id, tutti[j]) && stelle(this.b.id, tutti[j]) < 3) return tutti[j];
    return null;
  }

  private esci() {
    this.pausa = true;
    this.lettore.ferma();
    vaiA(this, "branoMenu", { vista: "mappa" });
  }

  // ---------------------------------------------------------------- disegno

  private sfondo() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x120e18, 0x120e18, 0x241a12, 0x241a12, 1).fillRect(0, 0, W, H);
    // il palco: assi in basso, sipario ai lati
    for (let x = 0; x < W; x += 46) g.fillStyle(x % 92 ? 0x1f160e : 0x251a10, 1).fillRect(x, this.yRullo + 120, 44, H);
    g.fillStyle(0x5a1a22, 1).fillRect(0, 0, 26, H).fillRect(W - 26, 0, 26, H);
    for (let y = 0; y < H; y += 18) g.fillStyle(0x3d1118, 1).fillRect(8, y, 4, 12).fillRect(W - 14, y, 4, 12);
    g.fillStyle(COL.lampada, 0.05).fillTriangle(this.xTesta - 30, 0, this.xTesta + 30, 0, this.xTesta + 140, H);
    g.fillStyle(COL.lampada, 0.04).fillTriangle(this.xTesta - 30, 0, this.xTesta - 140, H, this.xTesta + 140, H);
  }

  private intestazione() {
    const V = this.V;
    bottone(this, V ? 60 : 56, V ? 40 : 26, "‹", () => this.esci(), { w: V ? 80 : 64, h: V ? 54 : 34, primario: false, size: V ? 26 : 20 }).setDepth(30);
    testo(this, W / 2, V ? 32 : 20, this.b.titolo, V ? 15 : 13, HEX.carta, "fori").setAlpha(0.7).setDepth(30);
    testo(this, W / 2, V ? 62 : 44, this.soloAscolto ? L("Tutto il brano", "The whole track") : nomePezzo(this.pz, this.b.frasi.length), V ? 24 : 20, HEX.lampada, "titoli").setStroke(HEX.inchiostro, 5).setDepth(30);
    this.stelleTxt = stelleTesto(this, W - (V ? 70 : 80), V ? 40 : 26, 0, V ? 24 : 20, HEX.carta).setDepth(30).setVisible(!this.soloAscolto);
    testo(this, W - (V ? 70 : 80), V ? 72 : 50, `${L("velocità", "speed")} ${Math.round(this.velocita * 100)}%`, V ? 13 : 12, HEX.carta, "fori").setAlpha(0.75).setDepth(30);
    this.aggiornaStelle();
    const yb = V ? 150 : 96;
    this.banner = this.add.container(W / 2, yb).setDepth(20);
    const gb = this.add.graphics();
    this.bannerTit = testo(this, 0, -8, "", V ? 40 : 34, HEX.inchiostro, "titoli");
    this.bannerSotto = testo(this, 0, V ? 30 : 24, "", V ? 16 : 14, HEX.carta, "fori").setStroke(HEX.inchiostro, 4);
    this.banner.add([gb, this.bannerTit, this.bannerSotto]);
    this.banner.setData("g", gb);
    this.avviso = testo(this, this.xTesta, this.yRullo - (V ? 150 : 120), "", V ? 54 : 46, HEX.lampada, "titoli").setStroke(HEX.inchiostro, 8).setDepth(25).setAlpha(0);
  }

  private aggiornaStelle() {
    const s = stelle(this.b.id, this.pz);
    this.stelleTxt.imposta(s);
  }

  private mostraBanner(t: string, sotto: string, colore: number, ink: string) {
    const g = this.banner.getData("g") as Phaser.GameObjects.Graphics;
    const w = this.V ? W - 70 : 460, h = this.V ? 74 : 60;
    g.clear();
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 5, -h / 2 - 8 + 5, w, h, 12);
    g.fillStyle(colore, 1).fillRoundedRect(-w / 2, -h / 2 - 8, w, h, 12);
    g.lineStyle(3, COL.inchiostro, 1).strokeRoundedRect(-w / 2, -h / 2 - 8, w, h, 12);
    this.bannerTit.setText(t.toUpperCase()).setColor(ink).setY(-8);
    this.bannerSotto.setText(sotto).setY(h / 2 + (this.V ? 12 : 8));
    this.banner.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.banner, scale: 1, alpha: 1, duration: 200, ease: "Back.easeOut" });
  }

  /** Ascolta tutto: pausa e salti di 5 secondi, per fermarsi su un punto e guardare la tab. */
  private comandiAscolto() {
    const V = this.V, y = this.yRullo + (V ? 210 : 118);
    const el = this.lettore.el;
    const salta = (d: number) => { el.currentTime = Math.max(0, Math.min(this.fine - 0.1, el.currentTime + d)); };
    const o = { h: V ? 58 : 36, primario: false, size: V ? 20 : 15 };
    bottone(this, W / 2 - (V ? 150 : 130), y, "« 5s", () => salta(-5), { ...o, w: V ? 110 : 90 }).setDepth(30);
    const pp = bottone(this, W / 2, y, "❚❚", () => {
      if (el.paused) { void el.play(); pp.label.setText("❚❚"); } else { el.pause(); pp.label.setText("▶"); }
    }, { ...o, w: V ? 130 : 100, primario: true }).setDepth(30);
    bottone(this, W / 2 + (V ? 150 : 130), y, "5s »", () => salta(5), { ...o, w: V ? 110 : 90 }).setDepth(30);
    this.input.keyboard?.on("keydown-SPACE", () => pp.emit("pointerup"));
  }

  private bottoneSalta() {
    this.salta?.destroy();
    const V = this.V;
    this.salta = bottone(this, V ? W / 2 : W - 110, this.yRullo + (V ? 210 : 118), L("Tocca a me ▶▶", "My turn ▶▶"), () => { this.lettore.ferma(); this.vaiTocca(); },
      { w: V ? 260 : 170, h: V ? 58 : 36, primario: false, size: V ? 19 : 14 }).setDepth(30);
  }

  private pulisciOverlay() {
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
  }

  private preso(i: number) {
    const n = this.note[i];
    const x = this.xTesta, y = this.yRiga(n);
    this.scintille.emitParticleAt(x, y, 12);
    if (n.conta) pop(this, x + 40, y - 20, "✓", HEX.lampada, this.V ? 30 : 26, 600);
  }

  private yRiga(n: NotaBrano) {
    const d = this.V ? 74 : 46;
    return this.yRullo + (n.tab.draw ? d : -d);
  }

  update(_t: number, dms: number) {
    if (!this.lettore) return;
    const dt = dms / 1000;
    this.ascolto.aggiorna(dt);
    this.lettore.aggiorna();
    const s = this.lettore.tempo;
    this.ancora = { c: this.lettore.ctx.currentTime, s };
    // conto alla rovescia sulla base, prima della frase
    const manca = (this.inizio - s) / this.velocita;
    const n = Math.ceil(manca / 0.5);
    if (this.fase !== "esito" && manca > 0 && manca < 1.6 && n !== this.contoFatto && n >= 1 && n <= 3) {
      this.contoFatto = n;
      this.mostraAvviso(String(n));
    } else if (this.fase !== "esito" && manca <= 0 && this.contoFatto > 0) {
      this.contoFatto = 0;
      this.mostraAvviso(this.fase === "tocca" ? L("VIA!", "GO!") : "♪");
    }
    if (this.fase === "tocca" && this.giudice && this.lettore.inPosizione) {
      const ts = this.tempoTraccia(this.ascolto.engine.ctx.currentTime);
      const tenuta = this.giudice.tenuta(ts, this.ascolto.midi);
      if (tenuta >= 0) this.preso(tenuta);
      this.giudice.aggiorna(ts);
    }
    this.disegnaRullo(s);
    // l'armonica in basso: in ascolto si accende sulla nota dell'originale, al tuo turno sulla tua
    if (this.fase === "ascolta") {
      const m = this.lettore.notaA(s);
      const r = m === null ? null : Math.round(m);
      const nota = r === null ? null : this.note.find((x) => x.midi === r && s >= x.t - 0.05 && s <= x.t + x.durata + 0.05);
      this.armonica.accendi(nota ? nota.tab : null);
    } else {
      const tab = this.ascolto.midi === null ? null : foroPerMidi(this.ascolto.midi, this.b.tonalita);
      this.armonica.accendi(tab);
    }
  }

  private mostraAvviso(s: string) {
    this.avviso.setText(s).setAlpha(1).setScale(0.5);
    this.tweens.killTweensOf(this.avviso);
    this.tweens.add({ targets: this.avviso, scale: 1.1, duration: 140, ease: "Back.easeOut" });
    this.tweens.add({ targets: this.avviso, alpha: 0, delay: 320, duration: 200 });
  }

  /** Il rullo: le note scorrono verso la testina, soffi sopra la riga e aspirati sotto (come le due metà dell'armonica). */
  private disegnaRullo(s: number) {
    const g = this.gRullo, gn = this.gNote, V = this.V;
    g.clear(); gn.clear();
    const d = V ? 74 : 46, alto = this.yRullo - d * 2, basso = this.yRullo + d * 2;
    g.fillStyle(COL.inchiostro, 0.55).fillRoundedRect(34, alto, W - 68, basso - alto, 14);
    g.lineStyle(2, COL.carta, 0.25).lineBetween(40, this.yRullo, W - 40, this.yRullo);
    if (!this.lati) {
      this.lati = true;
      testo(this, 52, this.yRullo - d, "↑", V ? 22 : 18, HEX.ottone, "titoli").setDepth(5).setAlpha(0.8);
      testo(this, 52, this.yRullo + d, "↓", V ? 22 : 18, HEX.indaco, "titoli").setDepth(5).setAlpha(0.9).setStroke(HEX.carta, 2);
    }
    // battiti della frase: tacche leggere ogni mezzo secondo di traccia
    for (let t = Math.floor((s - 2) * 2) / 2; t < s + (W / this.pxs); t += 0.5) {
      const x = this.xTesta + (t - s) * this.pxs;
      if (x < 40 || x > W - 40) continue;
      g.lineStyle(1, COL.carta, 0.08).lineBetween(x, alto + 6, x, basso - 6);
    }
    // inizio e fine della frase
    for (const t of this.soloAscolto ? this.b.frasi.map((f) => f.inizio) : [this.inizio, this.fine]) {
      const x = this.xTesta + (t - s) * this.pxs;
      if (x > 40 && x < W - 40) g.lineStyle(3, COL.rosso, 0.5).lineBetween(x, alto + 4, x, basso - 4);
    }
    // testina
    const batte = 0.5 + 0.5 * Math.sin(this.time.now / 110);
    g.fillStyle(COL.lampada, 0.12 + 0.08 * batte).fillRect(this.xTesta - 22, alto, 44, basso - alto);
    g.lineStyle(4, COL.lampada, 0.9).lineBetween(this.xTesta, alto - 6, this.xTesta, basso + 6);

    const visibili = new Set<number>();
    const tocca = this.fase === "tocca" || (this.fase === "esito" && this.giudice);
    const memoria = tocca && this.passo === 2;
    const scomparsa = tocca && this.passo === 1;
    const r = V ? 31 : 24;
    for (let i = this.note.length - 1; i >= 0; i--) {
      const n = this.note[i];
      const x = this.xTesta + (n.t - s) * this.pxs;
      const xf = this.xTesta + (n.t + n.durata - s) * this.pxs;
      if (xf < 30 || x > W + r) continue;
      const y = this.yRiga(n);
      const esito = tocca ? this.giudice?.esiti[i] ?? null : null;
      const pieno = esito === "perso" ? 0x5a5550 : esito === "preso" ? 0x6fae5a : n.tab.bend ? COL.prugna : n.tab.draw ? COL.indaco : COL.ottone;
      // a memoria si vede solo l'esito, dopo che la nota è passata
      if (memoria && esito === null) continue;
      // coda della durata
      if (xf - x > r) gn.fillStyle(pieno, 0.45).fillRoundedRect(x, y - 7, xf - x, 14, 7);
      const sc = n.conta ? 1 : 0.62;
      const rr = r * sc;
      const fantasma = scomparsa && esito === null && i > 0;
      gn.fillStyle(COL.inchiostro, 1).fillCircle(x + 3, y + 3, rr + 3);
      gn.fillStyle(COL.inchiostro, 1).fillCircle(x, y, rr + 3);
      if (fantasma) gn.lineStyle(3, pieno, 1).strokeCircle(x, y, rr - 1);
      else gn.fillStyle(pieno, 1).fillCircle(x, y, rr);
      // freccia fuori dal disco: su = soffio, giù = aspirato
      const dir = n.tab.draw ? 1 : -1, f = 9 * sc, yF = y + dir * (rr + 4);
      gn.fillStyle(pieno, 1).fillTriangle(x - f, yF, x + f, yF, x, yF + dir * f * 1.1);
      for (let k = 0; k < n.tab.bend; k++) gn.lineStyle(3, COL.prugna, 1).strokeCircle(x, y, rr + 6 + k * 5);
      if (fantasma) continue;
      visibili.add(i);
      let et = this.etichette.get(i);
      if (!et) {
        const chiaro = n.tab.draw || n.tab.bend > 0 || esito !== null;
        et = testo(this, 0, 0, `${n.tab.hole}${"'".repeat(n.tab.bend)}`, V ? 36 : 28, chiaro ? "#FFFFFF" : HEX.inchiostro, "titoli").setDepth(7);
        if (chiaro) et.setStroke(HEX.inchiostro, 3);
        this.etichette.set(i, et);
      }
      et.setPosition(x, y + 1).setScale(sc * (n.tab.hole === 10 ? 0.8 : 1));
    }
    for (const [i, et] of this.etichette) if (!visibili.has(i)) { et.destroy(); this.etichette.delete(i); }
    // barra di avanzamento del pezzo
    const p = Math.max(0, Math.min(1, (s - (this.inizio - ATTACCO)) / (this.fine + CODA - (this.inizio - ATTACCO))));
    g.fillStyle(COL.inchiostro, 0.8).fillRect(40, basso + 12, W - 80, 6);
    g.fillStyle(this.fase === "ascolta" ? COL.ottone : COL.rosso, 1).fillRect(40, basso + 12, (W - 80) * p, 6);
  }
}
