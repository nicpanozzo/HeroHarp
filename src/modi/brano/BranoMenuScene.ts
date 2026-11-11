// Copiato da modes/src/brano/BranoMenuScene.ts con scripts/sync-content.mjs, non modificare qui.
// Impara un brano: la libreria (brano di prova + i file caricati) e la mappa delle frasi del brano aperto.
// Il file audio non lascia mai il dispositivo: si sceglie, si ascolta qui, si salva in IndexedDB.

import Phaser from "phaser";
import { keyById } from "../../harp";
import { impostazioni, salva, TONALITA } from "../core/impostazioni";
import { COL, HEX, W, H, testo, titolo, grana, vaiA, bottone, scelta, verticale } from "../core/ui";
import { chiave, dimenticaProgressi, eliminaBrano, elencoBrani, progresso, salvaProgressi } from "./archivio";
import { DEMO_ID } from "./demo";
import { apriDemo, apriFile, apriSalvato, branoAperto, cambiaTonalita, type BranoAperto } from "./sessione";

export const L = (it: string, en: string) => (impostazioni.lingua === "it" ? it : en);

/** Tre stelle leggibili: quelle prese piene e dorate, quelle da prendere spente (mai il contorno ☆, che si confonde). */
export function stelleTesto(scene: Phaser.Scene, x: number, y: number, prese: number, size: number, spenta: string = HEX.grigio) {
  const c = scene.add.container(x, y);
  const passo = size * 1.05;
  const voci: Phaser.GameObjects.Text[] = [];
  for (let i = 0; i < 3; i++) {
    const t = testo(scene, (i - 1) * passo, 0, "★", size, HEX.lampada, "titoli");
    voci.push(t);
    c.add(t);
  }
  const imposta = (n: number) => voci.forEach((t, i) => {
    t.setColor(i < n ? HEX.lampada : spenta).setAlpha(i < n ? 1 : 0.35);
    if (i < n) t.setStroke(HEX.inchiostro, Math.max(3, size / 7)); else t.setStroke(HEX.inchiostro, 0);
  });
  imposta(prese);
  return Object.assign(c, { imposta });
}

/** Un pezzo da imparare: una frase, una catena di quattro frasi, o tutto l'assolo. */
export interface Pezzo { da: number; a: number; tipo: "frase" | "catena" | "tutto" }

export function pezzi(b: BranoAperto): Pezzo[] {
  const out: Pezzo[] = [];
  const n = b.frasi.length;
  for (let i = 0; i < n; i++) {
    out.push({ da: i, a: i, tipo: "frase" });
    if (i % 4 === 3 && i < n - 1) out.push({ da: i - 3, a: i, tipo: "catena" });
  }
  if (n > 1) out.push({ da: 0, a: n - 1, tipo: "tutto" });
  return out;
}

export const stelle = (id: string, p: Pezzo) => progresso(id).stelle[chiave(p.da, p.a)] ?? 0;

export function sbloccato(id: string, p: Pezzo) {
  if (p.tipo === "frase") return p.da === 0 || (progresso(id).stelle[chiave(p.da - 1, p.da - 1)] ?? 0) >= 1;
  for (let i = p.da; i <= p.a; i++) if ((progresso(id).stelle[chiave(i, i)] ?? 0) < 1) return false;
  return true;
}

/** Il prossimo pezzo da studiare: il primo sbloccato senza tre stelle. */
export function prossimo(b: BranoAperto): Pezzo | null {
  const tutti = pezzi(b);
  return tutti.find((p) => sbloccato(b.id, p) && stelle(b.id, p) < 3) ?? tutti[0] ?? null;
}

export const nomePezzo = (p: Pezzo, n: number) =>
  p.tipo === "tutto" ? L("Tutto l'assolo", "The whole solo") : p.tipo === "catena" ? L(`Catena ${p.da + 1}–${p.a + 1}`, `Chain ${p.da + 1}–${p.a + 1}`) : L(`Frase ${p.da + 1} di ${n}`, `Phrase ${p.da + 1} of ${n}`);

export class BranoMenuScene extends Phaser.Scene {
  private vista: "libreria" | "mappa" = "libreria";
  private V = false;
  private input$: HTMLInputElement | null = null;

  constructor() { super("branoMenu"); }

  init(d: { vista?: "libreria" | "mappa" }) {
    this.vista = d?.vista === "mappa" && branoAperto() ? "mappa" : "libreria";
  }

  create() {
    this.cameras.main.fadeIn(140, 21, 17, 14);
    this.V = verticale();
    this.sfondo();
    if (this.vista === "mappa") this.mappa(branoAperto()!);
    else void this.libreria();
    grana(this, 0.35);
    this.input.keyboard?.on("keydown-ESC", () => (this.vista === "mappa" ? vaiA(this, "branoMenu", { vista: "libreria" }) : vaiA(this, "hub")));
    this.events.once("shutdown", () => { this.input$?.remove(); this.input$ = null; });
  }

  private sfondo() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x14101c, 0x14101c, 0x2a1d14, 0x2a1d14, 1).fillRect(0, 0, W, H);
    // assi del palco e un faro che cade dall'alto
    for (let x = 0; x < W; x += 46) g.fillStyle(x % 92 ? 0x22180f : 0x281c12, 0.9).fillRect(x, H * 0.62, 44, H * 0.38);
    g.fillStyle(COL.lampada, 0.06).fillTriangle(W / 2 - 40, 0, W / 2 + 40, 0, W / 2 + 260, H);
    g.fillStyle(COL.lampada, 0.05).fillTriangle(W / 2 - 40, 0, W / 2 - 260, H, W / 2 + 260, H);
  }

  private indietro(azione: () => void) {
    const t = "‹ " + L("Indietro", "Back");
    if (this.V) bottone(this, 70, 40, t, azione, { w: 124, h: 54, primario: false, size: 17 });
    else bottone(this, 64, 26, t, azione, { w: 112, h: 34, primario: false, size: 13 });
  }

  // ---------------------------------------------------------------- libreria

  private async libreria() {
    const V = this.V;
    this.indietro(() => vaiA(this, "hub"));
    titolo(this, W / 2, V ? 112 : 58, L("Impara un brano", "Learn a song"), V ? 40 : 40, HEX.lampada, HEX.rosso, W - 60);
    testo(this, W / 2, V ? 168 : 100, L("Ascolti una frase dell'armonica, poi la rifai tu sulla stessa base, con l'armonica nascosta.",
      "Hear a harp phrase, then play it yourself over the same backing, with the harp hidden."), V ? 17 : 15, HEX.carta)
      .setWordWrapWidth(W - (V ? 60 : 200)).setAlpha(0.9);

    const salvati = await elencoBrani();
    if (!this.scene.isActive()) return;
    const voci = [{ id: DEMO_ID, titolo: L("Slow blues di prova", "Practice slow blues"), sotto: L("Brano originale HarpHero · armonica in Do", "HarpHero original · C harp") },
      ...salvati.map((s) => ({ id: s.id, titolo: s.titolo, sotto: `${Math.floor(s.durata / 60)}:${String(Math.round(s.durata % 60)).padStart(2, "0")} · ${L("sul tuo dispositivo", "on your device")}` }))];
    const w = V ? W - 50 : 620, h = V ? 92 : 62, y0 = V ? 240 : 150, passo = h + (V ? 16 : 10);
    const massimo = Math.max(1, Math.floor(((V ? H - 330 : H - 120) - y0) / passo));
    voci.slice(0, massimo).forEach((v, i) => this.voce(W / 2, y0 + h / 2 + i * passo, w, h, v));

    const yb = V ? H - 190 : H - 62;
    bottone(this, W / 2, yb, "＋ " + L("Carica un file audio", "Load an audio file"), () => this.scegliFile(), { w: V ? 400 : 340, h: V ? 66 : 48, size: V ? 22 : 18 });
    testo(this, W / 2, yb + (V ? 64 : 38), L("mp3, m4a o wav del brano con l'armonica · il file resta sul tuo dispositivo",
      "mp3, m4a or wav of the song with harp · the file stays on your device"), V ? 15 : 13, HEX.carta).setAlpha(0.7).setWordWrapWidth(W - 60);
  }

  private voce(x: number, y: number, w: number, h: number, v: { id: string; titolo: string; sotto: string }) {
    const V = this.V;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const demo = v.id === DEMO_ID;
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 5, -h / 2 + 5, w, h, 10);
    g.fillStyle(demo ? COL.ottone : COL.carta, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(3, COL.inchiostro, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    // disco in vinile
    const r = h * 0.36, dx = -w / 2 + r + 14;
    g.fillStyle(COL.inchiostro, 1).fillCircle(dx, 0, r);
    g.fillStyle(demo ? COL.rosso : COL.indaco, 1).fillCircle(dx, 0, r * 0.38);
    g.fillStyle(COL.carta, 1).fillCircle(dx, 0, 3);
    const x0 = dx + r + 16;
    const tit = testo(this, x0, -h * 0.17, v.titolo, V ? 22 : 18, HEX.inchiostro, "titoli").setOrigin(0, 0.5);
    if (tit.width > w - (x0 + w / 2) - 70) tit.setScale((w - (x0 + w / 2) - 70) / tit.width);
    const st = progresso(v.id);
    const totStelle = Object.entries(st.stelle).filter(([k]) => /^(\d+)-\1$/.test(k)).reduce((a, [, s]) => a + s, 0);
    const sotto = testo(this, x0, h * 0.22, v.sotto + (totStelle ? `  ·  ★ ${totStelle}` : ""), V ? 15 : 13, HEX.inchiostro).setOrigin(0, 0.5).setAlpha(0.8);
    if (sotto.width > w - (x0 + w / 2) - 70) sotto.setScale((w - (x0 + w / 2) - 70) / sotto.width);
    const play = testo(this, w / 2 - 34, 0, "▶", V ? 30 : 24, HEX.inchiostro, "titoli");
    c.add([g, tit, sotto, play]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.02, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerup", () => void this.apri(v.id));
    if (!demo) {
      // cestino: un tocco lungo sarebbe nascosto, meglio un bottoncino esplicito con conferma al secondo tocco
      const cx = x + w / 2 - 78, cs = V ? 22 : 18;
      const del = testo(this, cx, y, "✕", cs, HEX.rosso, "titoli").setInteractive({ useHandCursor: true }).setDepth(2);
      let armato = false;
      del.on("pointerup", (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        if (!armato) { armato = true; del.setText(L("Elimina?", "Delete?")).setFontSize(cs * 0.7); return; }
        void eliminaBrano(v.id).then(() => { dimenticaProgressi(v.id); this.scene.restart({ vista: "libreria" }); });
      });
    }
  }

  private async apri(id: string) {
    const fine = this.caricamento(L("Ascolto l'armonica…", "Listening to the harp…"));
    try {
      const b = id === DEMO_ID ? await apriDemo(fine.passo) : await apriSalvato(id);
      fine.chiudi();
      if (!b) return this.avviso(L("Non trovo più questo file", "This file is gone"));
      vaiA(this, "branoMenu", { vista: "mappa" });
    } catch {
      fine.chiudi();
      this.avviso(L("Qualcosa è andato storto", "Something went wrong"));
    }
  }

  private scegliFile() {
    if (!this.input$) {
      const el = document.createElement("input");
      el.type = "file";
      el.accept = "audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.webm";
      el.style.display = "none";
      document.body.appendChild(el);
      el.addEventListener("change", () => {
        const f = el.files?.[0];
        el.value = "";
        if (f) void this.carica(f);
      });
      this.input$ = el;
    }
    this.input$.click();
  }

  private async carica(f: File) {
    const fine = this.caricamento(L("Ascolto l'armonica…", "Listening to the harp…"));
    try {
      const b = await apriFile(f, impostazioni.tonalita, fine.passo);
      fine.chiudi();
      if (!b.frasi.length) this.avviso(L("Non ho sentito l'armonica: prova a cambiare tonalità", "I couldn't hear the harp: try another key"));
      vaiA(this, "branoMenu", { vista: "mappa" });
    } catch {
      fine.chiudi();
      this.avviso(L("Non riesco a leggere questo file audio", "I can't read this audio file"));
    }
  }

  /** Velo con la barra di avanzamento dell'ascolto. */
  private caricamento(msg: string) {
    const velo = this.add.rectangle(W / 2, H / 2, W, H, COL.notte, 0.86).setDepth(80).setInteractive();
    const t = testo(this, W / 2, H / 2 - 40, msg, this.V ? 24 : 20, HEX.lampada, "titoli").setDepth(81);
    const bw = Math.min(420, W - 80);
    const g = this.add.graphics().setDepth(81);
    const disegna = (p: number) => {
      g.clear();
      g.fillStyle(COL.inchiostro, 1).fillRoundedRect(W / 2 - bw / 2, H / 2, bw, 22, 11);
      g.fillStyle(COL.ottone, 1).fillRoundedRect(W / 2 - bw / 2 + 3, H / 2 + 3, Math.max(16, (bw - 6) * p), 16, 8);
    };
    disegna(0);
    const nota = testo(this, W / 2, H / 2 + 54, L("trovo le note e divido l'assolo in frasi", "finding the notes and splitting the solo into phrases"), this.V ? 16 : 14, HEX.carta).setDepth(81).setAlpha(0.8);
    return {
      passo: (p: number) => { disegna(p); return new Promise<void>((ok) => setTimeout(ok, 0)); },
      chiudi: () => { [velo, t, g, nota].forEach((o) => o.destroy()); },
    };
  }

  private avviso(s: string) {
    const t = testo(this, W / 2, H / 2, s, this.V ? 22 : 18, HEX.carta, "titoli").setStroke(HEX.inchiostro, 6).setDepth(90).setWordWrapWidth(W - 60);
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- mappa delle frasi

  private mappa(b: BranoAperto) {
    const V = this.V;
    this.indietro(() => vaiA(this, "branoMenu", { vista: "libreria" }));
    const p = progresso(b.id);
    titolo(this, W / 2 + (V ? 0 : 40), V ? 106 : 30, b.titolo, V ? 30 : 26, HEX.lampada, HEX.rosso, W - (V ? 60 : 260));

    // armonica e velocità
    const yc = V ? 168 : 76;
    const k = keyById(b.tonalita);
    const nomeK = impostazioni.lingua === "it" ? k.it : k.en;
    const consigliata = b.consigliate[0] === b.tonalita;
    bottone(this, V ? 150 : 170, yc, `${L("Armonica", "Harp")}: ${nomeK} ↻`, () => {
      // si gira tra le tre tonalità più probabili, poi tutte le altre
      const ordine = [...b.consigliate.slice(0, 3), ...TONALITA.filter((x) => !b.consigliate.slice(0, 3).includes(x))];
      const prossima = ordine[(ordine.indexOf(b.tonalita) + 1) % ordine.length];
      cambiaTonalita(b, prossima);
      impostazioni.tonalita = prossima; salva(); salvaProgressi();
      this.scene.restart({ vista: "mappa" });
    }, { w: V ? 250 : 220, h: V ? 54 : 38, primario: false, size: V ? 18 : 15 });
    if (consigliata) testo(this, V ? 150 : 170, yc + (V ? 40 : 30), L("consigliata dall'ascolto", "suggested by listening"), V ? 13 : 12, HEX.lampada).setAlpha(0.85);
    const vel = [0.6, 0.8, 1];
    vel.forEach((v, i) => scelta(this, (V ? 330 : 420) + i * (V ? 72 : 90), yc, `${Math.round(v * 100)}%`, () => p.velocita === v, () => { p.velocita = v; salvaProgressi(); }, V ? 66 : 80, true));
    if (!V) testo(this, 420 - 70, yc, L("Velocità", "Speed"), 13, HEX.carta).setOrigin(1, 0.5).setAlpha(0.8);

    if (!b.frasi.length) {
      testo(this, W / 2, H / 2, L("Non ho sentito l'armonica in questa traccia.\nProva con un'altra tonalità (bottone in alto).",
        "I couldn't hear the harp in this track.\nTry another key (button above)."), V ? 20 : 18, HEX.carta).setWordWrapWidth(W - 80);
      return;
    }

    const lista = pezzi(b);
    const cols = V ? 4 : 7;
    const tw = V ? 116 : 116, th = V ? 104 : 84, gx = V ? 10 : 12, gy = V ? 14 : 12;
    const x0 = W / 2 - (cols * tw + (cols - 1) * gx) / 2 + tw / 2;
    const y0 = V ? 250 : 136;
    const righeMax = Math.floor(((V ? H - 200 : H - 80) - y0 + gy) / (th + gy));
    const visibili = lista.slice(0, righeMax * cols);
    visibili.forEach((pz, i) => this.tessera(x0 + (i % cols) * (tw + gx), y0 + th / 2 + Math.floor(i / cols) * (th + gy), tw, th, b, pz));

    const righe = Math.ceil(visibili.length / cols);
    const yl = y0 + righe * (th + gy) + (V ? 30 : 14);
    if (yl < (V ? H - 290 : H - 80)) {
      testo(this, W / 2, yl, L("Ascolta la frase, poi tocca a te: la base resta, l'armonica originale sparisce.",
        "Hear the phrase, then it's your turn: the backing stays, the original harp vanishes."), V ? 16 : 13, HEX.carta).setWordWrapWidth(W - 60).setAlpha(0.85);
      testo(this, W / 2, yl + (V ? 52 : 22), L("★ con la tab   ★★ tab a scomparsa   ★★★ a memoria", "★ with the tab   ★★ fading tab   ★★★ by heart"), V ? 16 : 13, HEX.lampada, "fori").setWordWrapWidth(W - 40);
    }
    // il brano intero, solo da ascoltare, con la tab che scorre (per controllare la trascrizione)
    bottone(this, V ? W / 2 : W - 118, V ? H - 196 : H - 40, "🎧 " + L("Ascolta tutto", "Hear it all"), () => vaiA(this, "brano", { tutto: true }),
      { w: V ? 300 : 196, h: V ? 58 : 46, primario: false, size: V ? 19 : 15 });
    const pr = prossimo(b);
    if (pr) {
      const yb = V ? H - 110 : H - 40;
      const etichetta = "▶ " + (stelle(b.id, pr) || Object.keys(p.stelle).length ? L("Continua", "Continue") : L("Comincia", "Start")) + ": " + nomePezzo(pr, b.frasi.length);
      const bt = bottone(this, W / 2, yb, etichetta, () => vaiA(this, "brano", { da: pr.da, a: pr.a }), { w: V ? W - 60 : 460, h: V ? 70 : 46, size: V ? 21 : 18 });
      this.tweens.add({ targets: bt, scale: 1.04, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.input.keyboard?.once("keydown-ENTER", () => vaiA(this, "brano", { da: pr.da, a: pr.a }));
    }
  }

  private tessera(x: number, y: number, w: number, h: number, b: BranoAperto, pz: Pezzo) {
    const aperta = sbloccato(b.id, pz);
    const st = stelle(b.id, pz);
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const colore = pz.tipo === "frase" ? COL.carta : pz.tipo === "catena" ? COL.indaco : COL.rosso;
    const scuro = pz.tipo !== "frase";
    g.fillStyle(COL.inchiostro, 1).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w, h, 10);
    g.fillStyle(aperta ? colore : 0x4a4038, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(3, st === 3 ? COL.ottone : COL.inchiostro, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    const ink = !aperta ? HEX.grigio : scuro ? HEX.carta : HEX.inchiostro;
    const etichetta = pz.tipo === "frase" ? String(pz.da + 1) : pz.tipo === "catena" ? `${pz.da + 1}–${pz.a + 1}` : L("TUTTO", "ALL");
    const num = testo(this, 0, -h * 0.14, aperta ? etichetta : "🔒", pz.tipo === "frase" ? (this.V ? 36 : 30) : (this.V ? 24 : 20), ink, "titoli");
    const stelline = stelleTesto(this, 0, h * 0.3, st, this.V ? 22 : 18, aperta && !scuro ? HEX.inchiostro : HEX.carta);
    c.add([g, num, stelline]);
    if (pz.tipo !== "frase") c.add(testo(this, 0, -h / 2 + 11, pz.tipo === "catena" ? L("catena", "chain") : L("assolo", "solo"), 11, ink, "fori").setAlpha(0.85));
    c.setSize(w, h);
    if (!aperta) return;
    c.setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
    c.on("pointerup", () => vaiA(this, "brano", { da: pz.da, a: pz.a }));
  }
}
