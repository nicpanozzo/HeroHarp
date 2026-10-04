import Phaser from "phaser";
import { getLang, setLang, t, type StringId } from "../i18n";
import { save, persist, exportSave, pickSaveFile } from "../state";
import { updateSettings } from "../settings";
import { getEngine } from "../audio/engine";
import { keepGroove } from "../audio/music";
import { W, H, HEX, txt, button, paper, panel, portrait } from "../ui";

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
    // in verticale: righe più alte e pulsanti grandi, i tre pulsanti in fondo su due file
    const P = portrait();
    const L = P
      ? (() => {
          const hintH = 84;
          const step = Math.min(100, (H - 256 - 116 - 24 - hintH) / 9);
          // il pannello è alto quanto le righe e sta al centro tra il titolo e i pulsanti in fondo
          const h = 9 * step + hintH + 24;
          const top = 116 + Math.round((H - 256 - 116 - h) / 2);
          const bottom = top + h;
          const y0 = top + 12 + step / 2;
          return { top, bottom, y0, step, hintH, lx: 52, bx: W - 52 - 125, bw: 250, bh: Math.min(70, step - 12), labelW: W - 104 - 250 - 20 };
        })()
      : { top: 112, bottom: 650, y0: 158, step: 52, hintH: 26, lx: 240, bx: W - 340, bw: 220, bh: 44, labelW: 0 };
    txt(this, W / 2, P ? 62 : 58, t("options").toUpperCase(), P ? 54 : 48, HEX.inchiostro, "titoli");
    if (P) panel(this, 24, L.top, W - 48, L.bottom - L.top);
    else panel(this, 190, 112, W - 380, 538);

    let y = L.y0;
    const label = (s: string) => {
      const l = txt(this, L.lx, y, s, P ? 25 : 24, HEX.inchiostro).setOrigin(0, 0.5);
      if (P) l.setAlign("left").setWordWrapWidth(L.labelW);
    };
    const row = (label: StringId, value: string, onClick: () => void, name: string, hint?: StringId) => {
      const l = txt(this, L.lx, y, t(label), P ? 25 : 24, HEX.inchiostro).setOrigin(0, 0.5);
      if (P) l.setAlign("left").setWordWrapWidth(L.labelW);
      button(this, L.bx, y, value, onClick, L.bw, false, L.bh).setName(name);
      if (hint)
        txt(this, L.lx, y + (P ? L.bh / 2 + 14 : 38), t(hint), P ? 20 : 16, HEX.inchiostro)
          .setOrigin(0, P ? 0 : 0.5)
          .setWordWrapWidth(P ? W - 2 * L.lx : 560)
          .setAlign("left")
          .setAlpha(0.75);
      y += hint ? L.step + L.hintH : L.step;
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

    label(`${t("optMic")} · ${s.micGate === null ? t("notCalibrated") : t("calibrated")}`);
    button(this, L.bx, y, t("calibrate"), () => this.scene.start("calibration", { from: this.from }), L.bw, false, L.bh).setName("opt-calibrate");
    y += L.step;
    const lat = s.latency === null ? t("notCalibrated") : `${Math.round(s.latency * 1000)} ms`;
    label(`${t("optLatency")} · ${lat}`);
    button(this, L.bx, y, t("calibrate"), () => this.scene.start("latency", { from: this.from }), L.bw, false, L.bh).setName("opt-latency");
    y += L.step;
    row("optOpenAll", onOff(s.openAll), toggle("openAll"), "opt-open-all");

    const half = (W - 104) / 2;
    if (P) button(this, W / 2, H - 66, t("back"), () => this.scene.start(this.from), W - 80, true, 86).setName("back");
    else button(this, W / 2, 686, t("back"), () => this.scene.start(this.from), 260).setName("back");
    // il salvataggio in un file: per cambiare dispositivo o tenerne una copia
    const sy = P ? H - 178 : 686;
    button(this, P ? 40 + half / 2 : 300, sy, t("exportSave"), () => exportSave(), P ? half : 220, false, P ? 70 : 44).setName("opt-export");
    const imp = button(this, P ? W - 40 - half / 2 : W - 300, sy, t("importSave"), () => pickSaveFile(() => pop()), P ? half : 220, false, P ? 70 : 44).setName(
      "opt-import",
    );
    const pop = () => {
      const msg = txt(this, imp.x, P ? H - 234 : 640, t("importBad"), P ? 20 : 16, HEX.rosso);
      this.time.delayedCall(2500, () => msg.destroy());
    };
  }

  update(): void {
    getEngine().poll();
  }
}
