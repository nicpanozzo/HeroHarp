import Phaser from "phaser";
import { hush } from "../audio/music";
import { t } from "../i18n";
import { save } from "../state";
import { applySettings, updateSettings } from "../settings";
import { getEngine } from "../audio/engine";
import { estimateLatency } from "../audio/latency";
import { W, H, HEX, C, txt, button, paper, panel, portrait, reducedMotion } from "../ui";
import { HearingReadout } from "./readout";

const BEAT = 0.75; // 80 BPM: abbastanza lento da suonare comodi
const COUNT_IN = 4;
const TARGETS = 8;

/** Le posizioni: in orizzontale quelle di sempre, in verticale Zia Mae in alto e tutto in colonna. */
function latLayout() {
  if (!portrait())
    return {
      P: false,
      x: 760,
      msgY: 250,
      msgW: 600,
      countY: 330,
      dotsY: 400,
      dot0: 530,
      dotGap: 66,
      dotR: 22,
      readY: 470,
      panelTop: 150,
      panelBottom: 550,
      maeY: 360,
      mae: 0,
      go: 620,
      back: 620,
      backH: 58,
    };
  const e = H - 1180;
  const back = H - 64;
  const backH = 72;
  const go = back - backH / 2 - 24 - 44;
  const panelTop = 168;
  const panelBottom = go - 44 - 36;
  const mae = 180 + e * 0.12;
  // Zia Mae, il messaggio (fino a 6 righe), il conto, gli 8 colpi e cosa senti: un blocco centrato nel pannello
  const block = mae + 250 + e * 0.1 + 200 + e * 0.05 + 70;
  const maeY = panelTop + Math.max(16, (panelBottom - panelTop - block) / 2) + mae / 2;
  const msgY = maeY + mae / 2 + 130 + e * 0.1;
  const countY = msgY + 150 + e * 0.03;
  const dotsY = countY + 80 + e * 0.02;
  return {
    P: true,
    x: W / 2,
    msgY,
    msgW: W - 110,
    countY,
    dotsY,
    dot0: W / 2 - ((TARGETS - 1) / 2) * 74,
    dotGap: 74,
    dotR: 27,
    readY: dotsY + 70,
    panelTop,
    panelBottom,
    maeY,
    mae,
    go,
    back,
    backH,
  };
}

/**
 * Calibrazione del ritardo: 4 colpi di attesa, poi 8 colpi su cui suonare.
 * La mediana degli scarti tra colpo e attacco sentito diventa il ritardo da compensare.
 */
export class LatencyScene extends Phaser.Scene {
  private from = "title";
  private running = false;
  private clicks: number[] = [];
  private onsets: number[] = [];
  private message!: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];
  private count!: Phaser.GameObjects.Text;
  private countStart = 0;
  private readout!: HearingReadout;
  private actions?: Phaser.GameObjects.Container;
  private stopListening?: () => void;
  private L = latLayout();

  constructor() {
    super("latency");
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? this.from;
    this.running = false;
  }

  create(): void {
    paper(this);
    hush();
    const L = (this.L = latLayout());
    if (L.P) {
      txt(this, W / 2, 96, t("latTitle").toUpperCase(), 46, HEX.inchiostro, "titoli").setWordWrapWidth(W - 80);
      panel(this, 24, L.panelTop, W - 48, L.panelBottom - L.panelTop);
      this.add.image(W / 2, L.maeY, "personaggi-zia-mae-spiega").setDisplaySize(L.mae, L.mae);
    } else {
      txt(this, W / 2, 80, t("latTitle").toUpperCase(), 42, HEX.inchiostro, "titoli");
      panel(this, 160, 150, W - 320, 400);
      this.add.image(320, 360, "personaggi-zia-mae-spiega").setScale(0.9);
    }
    this.message = txt(this, L.x, L.msgY, "", L.P ? 26 : 24, HEX.inchiostro)
      .setWordWrapWidth(L.msgW)
      .setName("lat-message");
    this.dots = Array.from({ length: TARGETS }, (_, i) => this.add.circle(L.dot0 + i * L.dotGap, L.dotsY, L.dotR, C.carta2).setStrokeStyle(4, C.inchiostro));
    this.count = txt(this, L.x, L.countY, "", L.P ? 60 : 44, HEX.rosso, "titoli");
    this.readout = new HearingReadout(this, L.x, L.readY, HEX.inchiostro, L.P ? 22 : 20);
    this.events.once("shutdown", () => this.stop());
    const s = save.settings;
    if (getEngine().micStatus !== "on") {
      this.message.setText(t("calNoMic")).setColor(HEX.rosso);
      this.showActions(null);
      return;
    }
    this.message.setText(t("latIntro") + (s.latency === null ? "" : `\n\n${t("latDone", { ms: Math.round(s.latency * 1000) })}`));
    this.showActions(t("start2"), () => this.begin());
  }

  private showActions(label: string | null, go?: () => void): void {
    this.actions?.destroy(true);
    const back = () => this.scene.start("options", { from: this.from });
    const L = this.L;
    if (L.P) {
      // in verticale uno sopra l'altro, larghi quanto lo schermo
      this.actions = this.add.container(0, 0, [button(this, W / 2, L.back, t("back"), back, W - 80, !label, L.backH)]);
      if (label) this.actions.add(button(this, W / 2, L.go, label, go!, W - 80, true, 88).setName("lat-go"));
      return;
    }
    this.actions = label
      ? this.add.container(0, 0, [
          button(this, W / 2 - 150, 620, label, go!, 260).setName("lat-go"),
          button(this, W / 2 + 150, 620, t("back"), back, 260, false),
        ])
      : this.add.container(0, 0, [button(this, W / 2, 620, t("back"), back, 260)]);
  }

  private begin(): void {
    const engine = getEngine();
    this.actions?.destroy(true);
    this.actions = undefined;
    // si misura il ritardo grezzo: niente compensazione durante la prova
    engine.inputLatency = 0;
    const start = engine.now + 0.4;
    this.countStart = start;
    this.clicks = [];
    for (let i = 0; i < COUNT_IN + TARGETS; i++) {
      const at = start + i * BEAT;
      engine.click(at, i % 4 === 0);
      if (i >= COUNT_IN) this.clicks.push(at);
    }
    this.onsets = [];
    this.stopListening?.();
    this.stopListening = engine.tracker.onOnset((o) => this.onsets.push(o.time));
    this.dots.forEach((d) => d.setFillStyle(C.carta2));
    this.message.setText(t("latCount")).setColor(HEX.inchiostro);
    this.running = true;
  }

  update(): void {
    const engine = getEngine();
    engine.poll();
    this.readout.update();
    if (!this.running) return;
    const now = engine.now;
    if (now >= this.clicks[0] - BEAT / 2) this.message.setText(t("latPlay"));
    // conto alla rovescia sui 4 colpi d'attesa, poi il numero del colpo
    const beat = Math.floor((now - this.countStart) / BEAT);
    const label = beat < 0 ? "" : beat < COUNT_IN ? String(COUNT_IN - beat) : beat < COUNT_IN + TARGETS ? "♪" : "";
    if (this.count.text !== label) {
      this.count.setText(label);
      if (label && !reducedMotion()) {
        this.count.setScale(1.4);
        this.tweens.add({ targets: this.count, scale: 1, duration: 180 });
      }
    }
    this.clicks.forEach((c, i) => {
      const heard = this.onsets.some((o) => o >= c - 0.1 && o <= c + 0.4);
      if (heard) this.dots[i].setFillStyle(C.ottone);
      else if (now >= c && now < c + 0.15) this.dots[i].setFillStyle(C.indaco);
      else if (now >= c + 0.15) this.dots[i].setFillStyle(C.carta2);
    });
    if (now > this.clicks[TARGETS - 1] + 0.6) this.finish();
  }

  private finish(): void {
    this.running = false;
    this.count.setText("");
    this.stop();
    const r = estimateLatency(this.clicks, this.onsets);
    if (r.latency === null) {
      applySettings();
      this.message.setText(t("latFail", { n: r.matched })).setColor(HEX.rosso);
      this.showActions(t("retryCal"), () => this.begin());
      return;
    }
    updateSettings({ latency: r.latency });
    const uneven = r.spread > 0.08 ? `\n\n${t("latUneven")}` : "";
    this.message.setText(t("latDone", { ms: Math.round(r.latency * 1000) }) + uneven).setColor(HEX.inchiostro);
    this.showActions(t("retryCal"), () => this.begin());
  }

  private stop(): void {
    this.stopListening?.();
    this.stopListening = undefined;
    if (this.running) applySettings();
  }
}
