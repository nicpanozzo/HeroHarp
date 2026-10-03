import Phaser from "phaser";
import { KEYS, keyById } from "../harp";
import { getLang, setLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, txt, button, stage } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    stage(this);
    txt(this, W / 2, 120, t("title"), 64, C.brass, true).setStroke("#000", 6);
    txt(this, W / 2, 180, t("tagline"), 20, C.muted);

    // armonica decorativa
    const g = this.add.graphics();
    g.fillStyle(C.brassDark, 1).fillRoundedRect(W / 2 - 170, 220, 340, 54, 12);
    g.fillStyle(C.brass, 1).fillRoundedRect(W / 2 - 166, 224, 332, 46, 10);
    for (let i = 0; i < 10; i++) g.fillStyle(C.bg, 1).fillRoundedRect(W / 2 - 150 + i * 31, 238, 20, 18, 4);

    // tonalità dell'armonica
    txt(this, W / 2, 312, t("harpKey").toUpperCase(), 14, C.muted).setLetterSpacing(2);
    const keyLabel = txt(this, W / 2, 346, "", 30, C.cream, true);
    const showKey = () => {
      const k = keyById(save.keyId);
      keyLabel.setText(getLang() === "it" ? k.it : k.en);
    };
    showKey();
    const step = (d: number) => {
      const i = KEYS.findIndex((k) => k.id === save.keyId);
      save.keyId = KEYS[(i + d + KEYS.length) % KEYS.length].id;
      persist();
      showKey();
    };
    button(this, W / 2 - 110, 346, "‹", () => step(-1), 48, false);
    button(this, W / 2 + 110, 346, "›", () => step(1), 48, false);

    // lingua
    const langBtn = button(this, W - 90, 40, getLang() === "it" ? "English" : "Italiano", () => {
      setLang(getLang() === "it" ? "en" : "it");
      save.lang = getLang();
      persist();
      this.scene.restart();
    }, 130, false);
    langBtn.setName("lang");

    const status = txt(this, W / 2, 470, t("micAsk"), 16, C.muted);
    button(this, W / 2, 420, t("start"), async () => {
      const engine = getEngine();
      await engine.resume();
      const mic = engine.micStatus === "on" ? "on" : await engine.startMic();
      if (mic !== "on") {
        status.setText(t("micDenied")).setColor("#e88468");
        this.time.delayedCall(2500, () => this.scene.start("map"));
      } else {
        this.scene.start("map");
      }
    }).setName("start");
    txt(this, W / 2, H - 17, t("keyboardHint"), 13, C.muted);
  }
}
