import Phaser from "phaser";
import { hush } from "../audio/music";
import { t } from "../i18n";
import { save } from "../state";
import { updateSettings } from "../settings";
import { getEngine, DEFAULT_GATE } from "../audio/engine";
import { keyById, tabToMidi } from "../harp";
import { W, H, HEX, C, txt, button, paper, panel, portrait } from "../ui";
import { HearingReadout } from "./readout";

const STEP_SECONDS = 3;

/** Le posizioni della calibrazione: in orizzontale quelle di sempre, in verticale in colonna. */
function calLayout() {
  if (!portrait())
    return {
      P: false,
      msgX: 760,
      msgY: 260,
      msgW: 520,
      readY: 470,
      bar: { x: 520, y: 400, w: 480, h: 18 },
      panelTop: 150,
      panelBottom: 530,
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
  const mae = 220 + e * 0.15;
  // Zia Mae, il messaggio, la barra e cosa senti: un blocco centrato nel pannello
  const block = mae + 150 + e * 0.1 + 150 + e * 0.05 + 90;
  const maeY = panelTop + Math.max(16, (panelBottom - panelTop - block) / 2) + mae / 2;
  const msgY = maeY + mae / 2 + 150 + e * 0.1;
  const barY = msgY + 150 + e * 0.05;
  return {
    P: true,
    msgX: W / 2,
    msgY,
    msgW: W - 120,
    readY: barY + 74,
    bar: { x: 80, y: barY, w: W - 160, h: 26 },
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
  /** Posizioni: in verticale Zia Mae in alto, il messaggio sotto e i pulsanti grandi in fondo. */
  private L = calLayout();

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
    const L = (this.L = calLayout());
    if (L.P) {
      txt(this, W / 2, 96, t("calTitle").toUpperCase(), 46, HEX.inchiostro, "titoli").setWordWrapWidth(W - 80);
      panel(this, 24, L.panelTop, W - 48, L.panelBottom - L.panelTop);
      this.add.image(W / 2, L.maeY, "personaggi-zia-mae-spiega").setDisplaySize(L.mae, L.mae);
    } else {
      txt(this, W / 2, 80, t("calTitle").toUpperCase(), 42, HEX.inchiostro, "titoli");
      panel(this, 240, 150, W - 480, 380);
      this.add.image(380, 360, "personaggi-zia-mae-spiega").setScale(0.9);
    }
    this.message = txt(this, L.msgX, L.msgY, "", L.P ? 28 : 26, HEX.inchiostro)
      .setWordWrapWidth(L.msgW)
      .setName("cal-message");
    this.bar = this.add.graphics();
    this.readout = new HearingReadout(this, L.msgX, L.readY, HEX.inchiostro, L.P ? 22 : 20);
    if (getEngine().micStatus !== "on") {
      this.message.setText(t("calNoMic")).setColor(HEX.rosso);
      if (L.P) button(this, W / 2, L.back, t("back"), () => this.scene.start(this.from), W - 80, true, L.backH);
      else button(this, W / 2, 620, t("back"), () => this.scene.start(this.from), 260);
      return;
    }
    this.message.setText(t("calQuiet"));
    this.showActions(t("start2"), () => this.begin());
  }

  private showActions(label: string | null, go?: () => void): void {
    this.actions?.destroy(true);
    const back = () => this.scene.start("options", { from: this.from });
    const L = this.L;
    if (L.P) {
      // in verticale uno sopra l'altro, larghi quanto lo schermo
      this.actions = this.add.container(0, 0, [button(this, W / 2, L.back, t("back"), back, W - 80, !label, L.backH)]);
      if (label) this.actions.add(button(this, W / 2, L.go, label, go!, W - 80, true, 88).setName("cal-go"));
      return;
    }
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
    const { x, y, w, h } = this.L.bar;
    this.bar.clear();
    this.bar.fillStyle(C.carta2, 1).fillRect(x, y, w, h);
    this.bar.fillStyle(this.step === "play" ? C.ottone : C.indaco, 1).fillRect(x, y, w * frac, h);
    this.bar.lineStyle(3, C.inchiostro, 1).strokeRect(x, y, w, h);
  }
}
