import Phaser from "phaser";
import { t } from "../i18n";
import { save } from "../state";
import { applySettings, updateSettings } from "../settings";
import { getEngine } from "../audio/engine";
import { estimateLatency } from "../audio/latency";
import { W, HEX, C, txt, button, paper, panel, reducedMotion } from "../ui";
import { HearingReadout } from "./readout";

const BEAT = 0.75; // 80 BPM: abbastanza lento da suonare comodi
const COUNT_IN = 4;
const TARGETS = 8;

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

  constructor() {
    super("latency");
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? this.from;
    this.running = false;
  }

  create(): void {
    paper(this);
    txt(this, W / 2, 80, t("latTitle").toUpperCase(), 42, HEX.inchiostro, "titoli");
    panel(this, 160, 150, W - 320, 400);
    this.add.image(320, 360, "personaggi-zia-mae-spiega").setScale(0.9);
    this.message = txt(this, 760, 250, "", 24, HEX.inchiostro).setWordWrapWidth(600).setName("lat-message");
    this.dots = Array.from({ length: TARGETS }, (_, i) => this.add.circle(530 + i * 66, 400, 22, C.carta2).setStrokeStyle(4, C.inchiostro));
    this.count = txt(this, 760, 330, "", 44, HEX.rosso, "titoli");
    this.readout = new HearingReadout(this, 760, 470);
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
