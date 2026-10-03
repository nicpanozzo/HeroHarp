import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene";
import { MapScene } from "./scenes/MapScene";
import { BattleScene } from "./scenes/BattleScene";
import { ResultScene } from "./scenes/ResultScene";
import { installKeyboard } from "./input";
import { W, H, C } from "./ui";
import { getEngine } from "./audio/engine";

// Aspetta i caratteri (se c'è rete), altrimenti parte con quelli di sistema.
async function fontsReady(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([document.fonts.load("32px Rye"), document.fonts.load("600 16px Barlow"), document.fonts.load("700 16px Barlow")]),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch {
    /* si usano i caratteri di riserva */
  }
}

fontsReady().then(() => {
  installKeyboard();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: C.bg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [TitleScene, MapScene, BattleScene, ResultScene],
  });
  // accesso per i test automatici e il debug dalla console
  Object.assign(window, { __game: game, __engine: getEngine });
});
