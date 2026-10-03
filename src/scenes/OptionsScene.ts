import Phaser from "phaser";
import { getLang, setLang, t, type StringId } from "../i18n";
import { save, persist, exportSave, pickSaveFile } from "../state";
import { updateSettings } from "../settings";
import { getEngine } from "../audio/engine";
import { keepGroove } from "../audio/music";
import { W, HEX, txt, button, paper, panel } from "../ui";

/** Opzioni: base musicale, metronomo, cuffie, movimento, lingua, calibrazione del microfono e del ritardo. */
export class OptionsScene extends Phaser.Scene {
  private from = "title";

  constructor() {
    super("options");
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? this.from;
  }

  create(): void {
    const s = save.settings;
    paper(this);
    keepGroove(this);
    txt(this, W / 2, 58, t("options").toUpperCase(), 48, HEX.inchiostro, "titoli");
    panel(this, 190, 112, W - 380, 538);

    let y = 158;
    const row = (label: StringId, value: string, onClick: () => void, name: string, hint?: StringId) => {
      txt(this, 240, y, t(label), 24, HEX.inchiostro).setOrigin(0, 0.5);
      button(this, W - 340, y, value, onClick, 220, false, 44).setName(name);
      if (hint)
        txt(this, 240, y + 38, t(hint), 16, HEX.inchiostro)
          .setOrigin(0, 0.5)
          .setWordWrapWidth(560)
          .setAlign("left")
          .setAlpha(0.75);
      y += hint ? 78 : 52;
    };
    const onOff = (v: boolean) => (v ? t("on") : t("off"));
    const toggle = (k: "music" | "metronome" | "headphones" | "reduceMotion" | "openAll") => () => {
      updateSettings({ [k]: !s[k] });
      this.scene.restart();
    };
    row("optMusic", onOff(s.music), toggle("music"), "opt-music");
    // volume: un clic passa al livello successivo (20%..100%)
    row(
      "optVolume",
      `${Math.round(s.musicVolume * 100)}%`,
      () => {
        const v = s.musicVolume >= 0.99 ? 0.2 : Math.min(1, Math.round((s.musicVolume + 0.2) * 10) / 10);
        updateSettings({ musicVolume: v });
        this.scene.restart();
      },
      "opt-volume",
    );
    row("optMetronome", onOff(s.metronome), toggle("metronome"), "opt-metronome");
    row("optHeadphones", onOff(s.headphones), toggle("headphones"), "opt-headphones", "optHeadphonesHint");
    row("optMotion", onOff(s.reduceMotion), toggle("reduceMotion"), "opt-motion");
    row(
      "language",
      getLang() === "it" ? "Italiano" : "English",
      () => {
        setLang(getLang() === "it" ? "en" : "it");
        save.lang = getLang();
        persist();
        this.scene.restart();
      },
      "opt-lang",
    );

    txt(this, 240, y, `${t("optMic")} · ${s.micGate === null ? t("notCalibrated") : t("calibrated")}`, 24, HEX.inchiostro).setOrigin(0, 0.5);
    button(this, W - 340, y, t("calibrate"), () => this.scene.start("calibration", { from: this.from }), 220, false, 44).setName("opt-calibrate");
    y += 52;
    const lat = s.latency === null ? t("notCalibrated") : `${Math.round(s.latency * 1000)} ms`;
    txt(this, 240, y, `${t("optLatency")} · ${lat}`, 24, HEX.inchiostro).setOrigin(0, 0.5);
    button(this, W - 340, y, t("calibrate"), () => this.scene.start("latency", { from: this.from }), 220, false, 44).setName("opt-latency");
    y += 52;
    row("optOpenAll", onOff(s.openAll), toggle("openAll"), "opt-open-all");

    button(this, W / 2, 686, t("back"), () => this.scene.start(this.from), 260).setName("back");
    // il salvataggio in un file: per cambiare dispositivo o tenerne una copia
    button(this, 300, 686, t("exportSave"), () => exportSave(), 220, false, 44).setName("opt-export");
    const imp = button(this, W - 300, 686, t("importSave"), () => pickSaveFile(() => pop()), 220, false, 44).setName("opt-import");
    const pop = () => {
      const msg = txt(this, imp.x, 640, t("importBad"), 16, HEX.rosso);
      this.time.delayedCall(2500, () => msg.destroy());
    };
  }

  update(): void {
    getEngine().poll();
  }
}
