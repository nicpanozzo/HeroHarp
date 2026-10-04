import Phaser from "phaser";
import { formatTab, keyById, midiToTabs, noteName } from "../harp";
import { getLang, t } from "../i18n";
import { save } from "../state";
import { getEngine } from "../audio/engine";
import { HEX, txt } from "../ui";

/** Una riga che dice cosa sta sentendo il gioco: utile per capire se il microfono funziona. */
export class HearingReadout {
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, color: string = HEX.inchiostro, size = 20) {
    this.label = txt(scene, x, y, "", size, color).setName("hearing");
  }

  update(): void {
    const m = getEngine().tracker.state.midi;
    if (m === null) return void this.label.setText(`${t("hearing")}: ${t("silence")}`).setAlpha(0.6);
    const tabs = midiToTabs(m, keyById(save.keyId));
    const holes = tabs.length ? tabs.map(formatTab).join(" / ") : "–";
    this.label.setText(`${t("hearing")}: ${holes} · ${noteName(m, getLang())}`).setAlpha(1);
  }
}
