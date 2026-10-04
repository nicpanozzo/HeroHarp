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
import { DojoScene } from "./scenes/DojoScene";
import { StatsScene } from "./scenes/StatsScene";
import { installKeyboard } from "./input";
import { W, H, C, fitStage } from "./ui";
import { getEngine } from "./audio/engine";
import { MODE_SCENES, wireModes } from "./modi";
import { RUN_SCENES } from "./roguelike";

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
  // telefono dritto: palco verticale; telefono girato, tablet o computer: palco orizzontale
  fitStage();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: C.carta,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [
      BootScene,
      TitleScene,
      JourneyScene,
      MapScene,
      BattleScene,
      ResultScene,
      OptionsScene,
      CalibrationScene,
      LatencyScene,
      DojoScene,
      StatsScene,
      ...MODE_SCENES,
      ...RUN_SCENES,
    ],
  });
  wireModes(game);
  // girando il telefono il palco cambia forma e la scena in corso si ridisegna (i salvataggi restano)
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!fitStage()) return;
      game.scale.setGameSize(W, H);
      game.scene.getScenes(true).forEach((s) => s.scene.restart());
    }, 250);
  });
  // accesso per i test automatici e il debug dalla console
  Object.assign(window, { __game: game, __engine: getEngine });
});

// app installabile e giocabile offline: solo dal web (https o localhost), non aprendo il file direttamente
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => undefined));
}
