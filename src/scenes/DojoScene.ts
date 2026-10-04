import Phaser from "phaser";
import { BLOW, DRAW, formatTab, keyById, maxBend, midiToTabs, noteName, tabToMidi, type Tab } from "../harp";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { groove, hush } from "../audio/music";
import { C, W, H, HEX, txt, button, paper, panel, portrait } from "../ui";

/**
 * Dove stanno l'armonica e il misuratore. In orizzontale le misure di sempre;
 * in verticale l'armonica occupa tutta la larghezza e lo spazio in altezza si divide tra nota, armonica e misuratore.
 */
function dojoLayout() {
  if (!portrait()) {
    const holeW = 96;
    return { P: false, holeW, pad: 10, harp: { x: W / 2 - 5 * holeW, y: 300, h: 96 }, meter: { x: 240, y: 560, w: 800 }, tab: 178, note: 238, keys: 690 };
  }
  const e = H - 1180;
  const holeW = 58;
  const tab = 296 + e * 0.2;
  const harpY = tab + 236 + e * 0.22;
  const h = 112 + e * 0.12;
  const meterY = harpY + h + 210 + e * 0.22;
  return { P: true, holeW, pad: 5, harp: { x: 100, y: harpY, h }, meter: { x: 70, y: meterY, w: W - 140 }, tab, note: tab + 100, keys: H - 54 };
}
/** Dopo il silenzio la nota resta a schermo ancora un attimo, per leggerla. */
const LINGER = 0.35;

/**
 * Il Dojo: pratica libera. Suoni e vedi quale foro stai suonando, che nota è,
 * se sei intonato e quanto stai piegando la nota (bend).
 */
export class DojoScene extends Phaser.Scene {
  private holes: Phaser.GameObjects.Graphics[] = [];
  private bigTab!: Phaser.GameObjects.Text;
  private bigNote!: Phaser.GameObjects.Text;
  private meter!: Phaser.GameObjects.Graphics;
  private meterLabels: Phaser.GameObjects.Text[] = [];
  private meterTitle!: Phaser.GameObjects.Text;
  private shown: { tab: Tab; pitch: number } | null = null;
  private lastHeard = -Infinity;
  private smooth = 0;
  private backing = false;
  private meterKey = "";
  private L = dojoLayout();

  constructor() {
    super("dojo");
  }

  create(): void {
    const lang = getLang();
    const key = keyById(save.keyId);
    paper(this);
    hush();
    this.backing = false;
    const L = (this.L = dojoLayout());
    const { P, holeW: HOLE_W, harp: HARP, meter: METER } = L;
    this.holes = [];
    this.meterLabels = [];
    this.meterKey = "";
    txt(this, W / 2, P ? 70 : 56, "DOJO", P ? 64 : 52, HEX.inchiostro, "titoli").setShadow(4, 3, HEX.rosso, 0, false, true);
    txt(this, W / 2, P ? 150 : 100, t("dojoSub"), P ? 23 : 19, HEX.inchiostro)
      .setAlpha(0.8)
      .setWordWrapWidth(P ? W - 80 : null);
    button(this, P ? 76 : 70, P ? 70 : 56, "‹", () => this.scene.start("title"), P ? 84 : 64, false, P ? 72 : 48).setName("dojo-back");
    const music = button(
      this,
      P ? W - 134 : W - 130,
      P ? 70 : 56,
      t("dojoBacking"),
      () => {
        this.backing = !this.backing;
        if (this.backing) groove("portico");
        else hush();
        music.setAlpha(this.backing ? 1 : 0.7);
      },
      200,
      false,
      P ? 72 : 44,
    ).setName("dojo-backing");
    music.setAlpha(0.7);

    // il foro e la nota che senti, in grande
    this.bigTab = txt(this, W / 2, L.tab, "", P ? 150 : 84, HEX.inchiostro, "fori").setName("dojo-tab");
    this.bigNote = txt(this, W / 2, L.note, "", P ? 32 : 24, HEX.inchiostro).setAlpha(0.8);

    // l'armonica: note soffiate sopra, aspirate sotto, nella tonalità scelta
    panel(this, HARP.x - 20, HARP.y - 14, 10 * HOLE_W + 40, HARP.h + 28, C.carta2);
    for (let i = 0; i < 10; i++) {
      const x = HARP.x + i * HOLE_W + HOLE_W / 2;
      this.holes.push(this.add.graphics());
      txt(this, x, HARP.y - 34, noteName(key.root + BLOW[i], lang).replace(/\d+$/, ""), P ? 22 : 17, HEX.ottone);
      txt(this, x, HARP.y + HARP.h + 36, noteName(key.root + DRAW[i], lang).replace(/\d+$/, ""), P ? 22 : 17, HEX.indaco);
      txt(this, x, HARP.y + HARP.h / 2, String(i + 1), 34, HEX.inchiostro, "fori");
    }
    txt(this, HARP.x - (P ? 52 : 60), HARP.y - 34, "↑", P ? 34 : 22, HEX.ottone, "fori");
    txt(this, HARP.x - (P ? 52 : 60), HARP.y + HARP.h + 36, "↓", P ? 34 : 22, HEX.indaco, "fori");
    this.paintHoles(null);

    // misuratore: intonazione, o quanto pieghi sui fori che si piegano
    this.meterTitle = txt(this, W / 2, METER.y - (P ? 72 : 58), "", P ? 23 : 18, HEX.inchiostro).setAlpha(0.8);
    if (P) this.meterTitle.setWordWrapWidth(W - 80);
    this.meter = this.add.graphics();
    txt(this, W / 2, L.keys, t("dojoKeys"), P ? 20 : 16, HEX.inchiostro)
      .setAlpha(0.6)
      .setWordWrapWidth(P ? W - 80 : null);
  }

  private paintHoles(tab: Tab | null): void {
    const { holeW: HOLE_W, harp: HARP, pad } = this.L;
    this.holes.forEach((g, i) => {
      const x = HARP.x + i * HOLE_W;
      g.clear();
      const on = tab?.hole === i + 1;
      g.fillStyle(on ? (tab!.bend ? C.prugna : tab!.draw ? C.indaco : C.ottone) : C.carta, 1).fillRoundedRect(
        x + pad,
        HARP.y + 8,
        HOLE_W - 2 * pad,
        HARP.h - 16,
        8,
      );
      g.lineStyle(3, C.inchiostro, 1).strokeRoundedRect(x + pad, HARP.y + 8, HOLE_W - 2 * pad, HARP.h - 16, 8);
    });
  }

  /** La scelta del foro per una nota: si resta sullo stesso foro se possibile (2↓ e 3↑ sono la stessa nota). */
  private pickTab(midi: number): Tab | null {
    const tabs = midiToTabs(midi, keyById(save.keyId));
    if (!tabs.length) return null;
    return tabs.find((x) => x.hole === this.shown?.tab.hole) ?? tabs.find((x) => x.bend === 0 && x.draw) ?? tabs[0];
  }

  private drawMeter(tab: Tab, pitch: number): void {
    const g = this.meter;
    const key = keyById(save.keyId);
    g.clear();
    // le etichette si rifanno solo quando cambia il foro (o il bend), non a ogni frame
    const k = formatTab(tab);
    const relabel = k !== this.meterKey;
    if (relabel) {
      this.meterLabels.forEach((l) => l.destroy());
      this.meterLabels = [];
      this.meterKey = k;
    }
    const P = this.L.P;
    const label = (lx: number, ly: number, s: string, size: number, color: string) => {
      if (relabel) this.meterLabels.push(txt(this, lx, ly, s, P ? size + 6 : size, color, "fori"));
    };
    const max = maxBend(tab.hole, tab.draw);
    const { x, y, w } = this.L.meter;
    g.fillStyle(C.inchiostro, 1).fillRect(x + 5, y - 15, w, 36);
    g.fillStyle(C.carta2, 1).fillRect(x, y - 20, w, 36);
    g.lineStyle(3, C.inchiostro, 1).strokeRect(x, y - 20, w, 36);
    let pos: number;
    if (max > 0) {
      // da sinistra (nota piena) a destra (piegata al massimo)
      const open = tabToMidi({ ...tab, bend: 0 }, key);
      const span = max + 0.5;
      this.meterTitle.setText(t("dojoBend"));
      for (let b = 0; b <= max; b++) {
        const bx = x + (b / span) * w + 30;
        g.lineStyle(3, C.prugna, b === tab.bend ? 1 : 0.4).lineBetween(bx, y - 20, bx, y + 16);
        label(bx, y + 40, `${tab.hole}${tab.draw ? "↓" : "↑"}${"'".repeat(b)}`, 18, b === tab.bend ? HEX.prugna : HEX.inchiostro);
      }
      pos = x + 30 + Phaser.Math.Clamp((open - pitch) / span, -0.05, 1) * w;
    } else {
      // accordatore: ±50 centesimi attorno alla nota
      const cents = (pitch - Math.round(pitch)) * 100;
      this.meterTitle.setText(t("dojoTune", { cents: `${cents > 0 ? "+" : ""}${Math.round(cents)}` }));
      g.lineStyle(3, C.inchiostro, 0.5).lineBetween(x + w / 2, y - 20, x + w / 2, y + 16);
      label(x + 20, y + 40, "−50", 15, HEX.inchiostro);
      label(x + w - 20, y + 40, "+50", 15, HEX.inchiostro);
      pos = x + w / 2 + (cents / 50) * (w / 2 - 20);
    }
    this.smooth = this.smooth ? Phaser.Math.Linear(this.smooth, pos, 0.35) : pos;
    g.fillStyle(C.rosso, 1).fillTriangle(this.smooth - 12, y - 32, this.smooth + 12, y - 32, this.smooth, y - 12);
    g.fillRect(this.smooth - 3, y - 20, 6, 36);
  }

  update(): void {
    const engine = getEngine();
    engine.poll();
    const now = engine.now;
    const stable = engine.tracker.state.midi;
    // l'altezza grezza segue il bend senza attese; con la tastiera vale la nota forzata
    const pitch = engine.keyboardHeld ? stable : (engine.lastPitch ?? stable);
    if (pitch !== null) {
      const tab = this.pickTab(Math.round(pitch));
      if (tab) {
        this.shown = { tab, pitch };
        this.lastHeard = now;
      }
    }
    if (this.shown && now - this.lastHeard > LINGER) {
      this.shown = null;
      this.smooth = 0;
    }
    if (!this.shown) {
      this.bigTab.setText("–").setColor(HEX.inchiostro).setAlpha(0.3);
      this.bigNote.setText(t("dojoPlay"));
      this.paintHoles(null);
      this.meter.clear();
      this.meterLabels.forEach((l) => l.destroy());
      this.meterLabels = [];
      this.meterKey = "";
      this.meterTitle.setText("");
      return;
    }
    const { tab, pitch: p } = this.shown;
    const color = tab.bend ? HEX.prugna : tab.draw ? HEX.indaco : HEX.ottone;
    this.bigTab.setText(formatTab(tab)).setColor(color).setAlpha(1);
    this.bigNote.setText(noteName(Math.round(p), getLang()));
    this.paintHoles(tab);
    this.drawMeter(tab, p);
  }
}
