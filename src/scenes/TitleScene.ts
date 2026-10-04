import Phaser from "phaser";
import { KEYS, keyById } from "../harp";
import { getLang, setLang, t } from "../i18n";
import { save, persist } from "../state";
import { getEngine } from "../audio/engine";
import { applySettings } from "../settings";
import { currentArea, nextEnemy } from "../progress";
import { groove, grooveOnGesture } from "../audio/music";
import { pulse } from "./beat";
import { C, W, H, HEX, txt, button, paper, panel, portrait } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    paper(this);
    const P = portrait();
    // in verticale (telefono dritto) il manifesto si impila: titolo, personaggi, tonalità, Suona e le altre strade
    // `e` distribuisce lo spazio in più dei telefoni lunghi (0 su un palco alto 1180)
    const e = P ? (H - 1180) / 380 : 0;
    const L = P
      ? {
          titleY: 200 + 46 * e,
          titleSize: Math.round(80 + 20 * e),
          tagY: 318 + 80 * e,
          hero: { x: 190, y: 430 + 155 * e, s: 0.62 + 0.33 * e },
          mae: { x: W - 190, y: 435 + 155 * e, s: 0.6 + 0.32 * e },
          keyY: 612 + 200 * e,
          playY: 760 + 264 * e,
          gridY: 870 + 295 * e,
          statusY: H - 44 - 20 * e,
        }
      : null;
    // manifesto: titolo, protagonista, sottotitolo
    const title = txt(this, W / 2, L ? L.titleY : 110, t("title").toUpperCase(), 92, HEX.inchiostro, "titoli").setShadow(5, 4, HEX.rosso, 0, false, true);
    // sul telefono il titolo va su due righe, grande come un manifesto
    if (L) {
      title.setFontSize(L.titleSize).setLineSpacing(-14);
      // a capo a metà (senza spazi in coda, così ogni riga resta centrata)
      if (title.width > W - 60)
        title.setText(
          t("title")
            .toUpperCase()
            .replace(/ (?=\S+$)/, "\n"),
        );
    }
    const music = () => currentArea({ beaten: save.beaten, openAll: save.settings.openAll }).music;
    grooveOnGesture(this, music());
    const tag = txt(this, W / 2, L ? L.tagY : 182, t("tagline"), 26, HEX.inchiostro);
    if (L) tag.setFontSize(28).setWordWrapWidth(W - 100);
    this.add.image(L ? L.hero.x : 200, L ? L.hero.y : 330, "personaggi-protagonista-suona").setScale(L ? L.hero.s : 0.95);
    this.add.image(L ? L.mae.x : W - 200, L ? L.mae.y : 335, "personaggi-zia-mae-sorride").setScale(L ? L.mae.s : 0.92);

    // tonalità dell'armonica
    const keyY = L ? L.keyY : 342;
    panel(this, W / 2 - 220, keyY - 92, 440, 150);
    txt(this, W / 2, keyY - 60, t("harpKey").toUpperCase(), L ? 20 : 18, HEX.inchiostro).setLetterSpacing(3);
    const keyLabel = txt(this, W / 2, keyY, "", 52, HEX.inchiostro, "titoli");
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
    const arrowW = L ? 84 : 64;
    const arrowH = L ? 84 : 58;
    const arrows = [
      button(this, W / 2 - 150, keyY, "‹", () => step(-1), arrowW, false, arrowH).setName("key-prev"),
      button(this, W / 2 + 150, keyY, "›", () => step(1), arrowW, false, arrowH).setName("key-next"),
    ];
    if (L) arrows.forEach((a) => (a.list[1] as Phaser.GameObjects.Text).setFontSize(48));

    button(
      this,
      L ? W - 186 : W - 120,
      L ? 64 : 56,
      getLang() === "it" ? "English" : "Italiano",
      () => {
        setLang(getLang() === "it" ? "en" : "it");
        save.lang = getLang();
        persist();
        this.scene.restart();
      },
      L ? 300 : 180,
      false,
      L ? 72 : 58,
    ).setName("lang");
    button(this, L ? 186 : 120, L ? 64 : 56, t("options"), () => this.scene.start("options", { from: "title" }), L ? 300 : 180, false, L ? 72 : 58).setName(
      "options",
    );

    const status = txt(this, W / 2, L ? L.statusY : 588, t("micAsk"), L ? 22 : 18, HEX.inchiostro).setWordWrapWidth(L ? W - 80 : 560);
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
    const playBtn = button(this, W / 2, L ? L.playY : 452, `${t("play")} ▶`, play, L ? 560 : 320, true, L ? 100 + 12 * e : 70).setName("start");
    if (L) (playBtn.list[1] as Phaser.GameObjects.Text).setFontSize(44);
    pulse(this, [title], 0.03);
    pulse(this, [playBtn], 0.05);
    const ways: [string, string, () => void][] = [
      ["to-journey", t("journeyShort"), () => enter("journey")],
      ["to-night", getLang() === "it" ? "Lunga Notte ☾" : "Long Night ☾", () => enter("runStart")],
      ["to-juke", "Juke Joint ♪", () => enter("hub")],
      ["to-dojo", t("dojo"), () => enter("dojo")],
    ];
    // la pagella: statistiche, errori più frequenti e lezioni mirate
    const stats = `${t("stats")} ★`;
    if (L) {
      // due colonne di strade, poi la pagella a tutta larghezza: pulsanti grandi per il pollice
      const rowH = 96 + 16 * e;
      ways.forEach(([name, label, go], i) =>
        button(this, W / 2 + (i % 2 ? 168 : -168), L.gridY + Math.floor(i / 2) * rowH, label, go, 320, false, 80).setName(name),
      );
      button(this, W / 2, L.gridY + 2 * rowH, stats, () => enter("stats"), 656, false, 80).setName("to-stats");
    } else {
      ways.forEach(([name, label, go], i) => button(this, W / 2 - 378 + i * 252, 518, label, go, 236, false, 44).setName(name));
      button(this, 120, 128, stats, () => enter("stats"), 180, false, 50).setName("to-stats");
    }
    this.input.keyboard?.once("keydown-ENTER", play);
    // sul telefono non c'è tastiera: niente riga dei tasti
    if (!L) {
      this.add.rectangle(W / 2, H - 40, W, 2, C.inchiostro, 0.3);
      txt(this, W / 2, H - 22, t("keyboardHint"), 17, HEX.inchiostro).setAlpha(0.7);
    }
  }
}
