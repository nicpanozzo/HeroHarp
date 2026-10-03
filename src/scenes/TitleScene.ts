import Phaser from "phaser";
import { KEYS, keyById } from "../harp";
import { getLang, setLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import { C, W, H, HEX, txt, button, paper, panel } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    paper(this);
    // manifesto: titolo, protagonista, sottotitolo
    txt(this, W / 2, 110, t("title").toUpperCase(), 92, HEX.inchiostro, "titoli").setShadow(5, 4, HEX.rosso, 0, false, true);
    txt(this, W / 2, 182, t("tagline"), 26, HEX.inchiostro);
    this.add.image(250, 430, "personaggi-protagonista-suona").setScale(1.25);
    this.add.image(W - 250, 440, "personaggi-zia-mae-sorride").setScale(1.2);

    // tonalità dell'armonica
    panel(this, W / 2 - 220, 250, 440, 150);
    txt(this, W / 2, 282, t("harpKey").toUpperCase(), 18, HEX.inchiostro).setLetterSpacing(3);
    const keyLabel = txt(this, W / 2, 342, "", 52, HEX.inchiostro, "titoli");
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
    button(this, W / 2 - 150, 342, "‹", () => step(-1), 64, false).setName("key-prev");
    button(this, W / 2 + 150, 342, "›", () => step(1), 64, false).setName("key-next");

    button(this, W - 120, 56, getLang() === "it" ? "English" : "Italiano", () => {
      setLang(getLang() === "it" ? "en" : "it");
      save.lang = getLang();
      persist();
      this.scene.restart();
    }, 180, false).setName("lang");

    const status = txt(this, W / 2, 530, t("micAsk"), 20, HEX.inchiostro).setWordWrapWidth(560);
    button(this, W / 2, 460, t("start"), async () => {
      const engine = getEngine();
      await engine.resume();
      const mic = engine.micStatus === "on" ? "on" : await engine.startMic();
      if (mic !== "on") {
        status.setText(t("micDenied")).setColor(HEX.rosso);
        this.time.delayedCall(2800, () => this.scene.start("map"));
      } else {
        this.scene.start("map");
      }
    }, 300).setName("start");
    this.add.rectangle(W / 2, H - 40, W, 2, C.inchiostro, 0.3);
    txt(this, W / 2, H - 22, t("keyboardHint"), 17, HEX.inchiostro).setAlpha(0.7);
  }
}
