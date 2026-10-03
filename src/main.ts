import "./fonts";
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { MapScene } from "./scenes/MapScene";
import { JourneyScene } from "./scenes/JourneyScene";
import { BattleScene } from "./scenes/BattleScene";
import { ResultScene } from "./scenes/ResultScene";
import { OptionsScene } from "./scenes/OptionsScene";
import { CalibrationScene } from "./scenes/CalibrationScene";
import { LatencyScene } from "./scenes/LatencyScene";
import { installKeyboard } from "./input";
import { W, H, C } from "./ui";
import { getEngine } from "./audio/engine";

// Aspetta che i caratteri inclusi siano pronti prima di disegnare i testi.
async function fontsReady(): Promise<void> {
  try {
    await Promise.race([
      Promise.all(
        ["32px 'Alfa Slab One'", "bold 16px 'Atkinson Hyperlegible'", "16px 'Atkinson Hyperlegible'", "800 16px 'Atkinson Hyperlegible Mono'"].map((f) =>
          document.fonts.load(f),
        ),
      ),
      new Promise((r) => setTimeout(r, 2500)),
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
    backgroundColor: C.carta,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, TitleScene, JourneyScene, MapScene, BattleScene, ResultScene, OptionsScene, CalibrationScene, LatencyScene],
  });
  // accesso per i test automatici e il debug dalla console
  Object.assign(window, { __game: game, __engine: getEngine });
});
