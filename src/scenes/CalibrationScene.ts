import Phaser from "phaser";
import { hush } from "../audio/music";
import { t } from "../i18n";
import { save } from "../state";
import { updateSettings } from "../settings";
import { getEngine, DEFAULT_GATE } from "../audio/engine";
import { keyById, tabToMidi } from "../harp";
import { W, HEX, C, txt, button, paper, panel } from "../ui";
import { HearingReadout } from "./readout";

const STEP_SECONDS = 3;

/**
 * Calibrazione: 3 secondi di silenzio per misurare il rumore della stanza,
 * poi 3 secondi di foro 4 soffiato per controllare che la nota arrivi pulita.
 * La soglia di volume diventa il doppio del rumore misurato (mai sotto il valore predefinito).
 */
export class CalibrationScene extends Phaser.Scene {
  private from = "title";
  private step: "ready" | "quiet" | "play" | "done" = "ready";
  private stepStart = 0;
  private noise: number[] = [];
  private heard = 0;
  private frames = 0;
  private message!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private readout!: HearingReadout;
  private actions?: Phaser.GameObjects.Container;

  constructor() {
    super("calibration");
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? this.from;
    this.step = "ready";
    this.noise = [];
    this.heard = this.frames = 0;
  }

  create(): void {
    paper(this);
    hush();
    txt(this, W / 2, 80, t("calTitle").toUpperCase(), 42, HEX.inchiostro, "titoli");
    panel(this, 240, 150, W - 480, 380);
    this.add.image(380, 360, "personaggi-zia-mae-spiega").setScale(0.9);
    this.message = txt(this, 760, 260, "", 26, HEX.inchiostro).setWordWrapWidth(520).setName("cal-message");
    this.bar = this.add.graphics();
    this.readout = new HearingReadout(this, 760, 470);
    if (getEngine().micStatus !== "on") {
      this.message.setText(t("calNoMic")).setColor(HEX.rosso);
      button(this, W / 2, 620, t("back"), () => this.scene.start(this.from), 260);
      return;
    }
    this.message.setText(t("calQuiet"));
    this.showActions(t("start2"), () => this.begin());
  }

  private showActions(label: string | null, go?: () => void): void {
    this.actions?.destroy(true);
    const back = () => this.scene.start("options", { from: this.from });
    this.actions = label
      ? this.add.container(0, 0, [
          button(this, W / 2 - 150, 620, label, go!, 260).setName("cal-go"),
          button(this, W / 2 + 150, 620, t("back"), back, 260, false),
        ])
      : this.add.container(0, 0, [button(this, W / 2, 620, t("back"), back, 260)]);
  }

  private begin(): void {
    this.actions?.destroy(true);
    this.actions = undefined;
    this.noise = [];
    this.heard = this.frames = 0;
    this.step = "quiet";
    this.stepStart = getEngine().now;
    this.message.setText(t("calQuiet")).setColor(HEX.inchiostro);
  }

  update(): void {
    const engine = getEngine();
    engine.poll();
    this.readout.update();
    if (this.step !== "quiet" && this.step !== "play") return;
    const elapsed = engine.now - this.stepStart;
    this.drawBar(Math.min(1, elapsed / STEP_SECONDS));
    if (this.step === "quiet") {
      this.noise.push(engine.level);
      if (elapsed >= STEP_SECONDS) {
        this.step = "play";
        this.stepStart = engine.now;
        // durante la nota si usa già la soglia misurata
        engine.gate = this.measuredGate();
        this.message.setText(t("calPlay"));
      }
    } else {
      this.frames++;
      if (engine.tracker.state.midi === tabToMidi({ hole: 4, draw: false, bend: 0 }, keyById(save.keyId))) this.heard++;
      if (elapsed >= STEP_SECONDS) this.finish();
    }
  }

  private measuredGate(): number {
    const sorted = [...this.noise].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    return Math.max(DEFAULT_GATE, p95 * 2);
  }

  private finish(): void {
    this.step = "done";
    this.drawBar(1);
    const gate = this.measuredGate();
    const ok = this.frames > 0 && this.heard / this.frames > 0.5;
    if (ok) {
      updateSettings({ micGate: gate });
      this.message.setText(gate > 0.02 ? `${t("calDone")}\n\n${t("calNoisy")}` : t("calDone")).setColor(HEX.inchiostro);
      this.showActions(null);
    } else {
      updateSettings({});
      this.message.setText(t("calNoNote")).setColor(HEX.rosso);
      this.showActions(t("retryCal"), () => this.begin());
    }
  }

  private drawBar(frac: number): void {
    this.bar.clear();
    this.bar.fillStyle(C.carta2, 1).fillRect(520, 400, 480, 18);
    this.bar.fillStyle(this.step === "play" ? C.ottone : C.indaco, 1).fillRect(520, 400, 480 * frac, 18);
    this.bar.lineStyle(3, C.inchiostro, 1).strokeRect(520, 400, 480, 18);
  }
}
