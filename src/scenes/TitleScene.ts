import Phaser from "phaser";
import { KEYS, keyById } from "../harp";
import { getLang, setLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import { applySettings } from "../settings";
import { currentArea, nextEnemy } from "../progress";
import { groove, grooveOnGesture } from "../audio/music";
import { pulse } from "./beat";
import { C, W, H, HEX, txt, button, paper, panel } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    paper(this);
    // manifesto: titolo, protagonista, sottotitolo
    const title = txt(this, W / 2, 110, t("title").toUpperCase(), 92, HEX.inchiostro, "titoli").setShadow(5, 4, HEX.rosso, 0, false, true);
    const music = () => currentArea({ beaten: save.beaten, openAll: save.settings.openAll }).music;
    grooveOnGesture(this, music());
    txt(this, W / 2, 182, t("tagline"), 26, HEX.inchiostro);
    this.add.image(200, 330, "personaggi-protagonista-suona").setScale(0.95);
    this.add.image(W - 200, 335, "personaggi-zia-mae-sorride").setScale(0.92);

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
      // la base si sposta nella nuova tonalità
      groove(music());
    };
    button(this, W / 2 - 150, 342, "‹", () => step(-1), 64, false).setName("key-prev");
    button(this, W / 2 + 150, 342, "›", () => step(1), 64, false).setName("key-next");

    button(
      this,
      W - 120,
      56,
      getLang() === "it" ? "English" : "Italiano",
      () => {
        setLang(getLang() === "it" ? "en" : "it");
        save.lang = getLang();
        persist();
        this.scene.restart();
      },
      180,
      false,
    ).setName("lang");
    button(this, 120, 56, t("options"), () => this.scene.start("options", { from: "title" }), 180, false).setName("options");
    // la pagella: statistiche, errori più frequenti e lezioni mirate
    button(this, 120, 128, `${t("stats")} ★`, () => enter("stats"), 180, false, 50).setName("to-stats");

    const status = txt(this, W / 2, 588, t("micAsk"), 18, HEX.inchiostro).setWordWrapWidth(560);
    // un tocco e si suona: il microfono si accende qui (serve un gesto), poi dritti in battaglia
    const enter = async (scene: string, data?: object) => {
      const engine = getEngine();
      applySettings();
      await engine.resume();
      groove(music());
      const mic = engine.micStatus === "on" ? "on" : await engine.startMic();
      if (mic !== "on") {
        status.setText(t("micDenied")).setColor(HEX.rosso);
        this.time.delayedCall(2200, () => this.scene.start(scene, data));
      } else this.scene.start(scene, data);
    };
    const play = () => enter("battle", { enemyId: nextEnemy({ beaten: save.beaten, openAll: save.settings.openAll }).id });
    const playBtn = button(this, W / 2, 452, `${t("play")} ▶`, play, 320, true, 70).setName("start");
    pulse(this, [title], 0.03);
    pulse(this, [playBtn], 0.05);
    button(this, W / 2 - 378, 518, t("journeyShort"), () => enter("journey"), 236, false, 44).setName("to-journey");
    button(this, W / 2 - 126, 518, getLang() === "it" ? "Lunga Notte ☾" : "Long Night ☾", () => enter("runStart"), 236, false, 44).setName("to-night");
    button(this, W / 2 + 126, 518, "Juke Joint ♪", () => enter("hub"), 236, false, 44).setName("to-juke");
    button(this, W / 2 + 378, 518, t("dojo"), () => enter("dojo"), 236, false, 44).setName("to-dojo");
    this.input.keyboard?.once("keydown-ENTER", play);
    this.add.rectangle(W / 2, H - 40, W, 2, C.inchiostro, 0.3);
    txt(this, W / 2, H - 22, t("keyboardHint"), 17, HEX.inchiostro).setAlpha(0.7);
  }
}
