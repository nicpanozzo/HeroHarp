// Il Juke Joint dentro il gioco: le modalità libere (jam, riff, volo) arrivano da modes/ (copiate in src/modi).
// Sono disegnate a 960×540: qui si ingrandisce la camera di 4/3 e si tengono allineate lingua, tonalità e cuffie.

import Phaser from "phaser";
import { HubScene } from "./modi/scene/HubScene";
import { JamMenuScene } from "./modi/jam/JamMenuScene";
import { JamScene } from "./modi/jam/JamScene";
import { JamFineScene } from "./modi/jam/JamFineScene";
import { RiffMenuScene } from "./modi/riff/RiffMenuScene";
import { RiffScene } from "./modi/riff/RiffScene";
import { RiffFineScene } from "./modi/riff/RiffFineScene";
import { VoloMenuScene } from "./modi/volo/VoloMenuScene";
import { VoloScene } from "./modi/volo/VoloScene";
import { impostazioni, record } from "./modi/core/impostazioni";
import { bottone } from "./modi/core/ui";
import { getLang, setLang } from "./i18n";
import { save, persist } from "./state";
import { grooveOnGesture, hush } from "./audio/music";
import type { TonalitaArmonica } from "./style/basi";

export const MODE_SCENES = [HubScene, JamMenuScene, JamScene, JamFineScene, RiffMenuScene, RiffScene, RiffFineScene, VoloMenuScene, VoloScene];
/** Le scene in cui suona la band della modalità: la base del gioco tace. */
const OWN_MUSIC = new Set(["jam", "riff", "volo"]);
let inModes = false;

/** true mentre si gioca nel Juke Joint (la tastiera la gestiscono le modalità, con il bend sullo Spazio). */
export const modesActive = (): boolean => inModes;

function enterModes(): void {
  if (!inModes) {
    impostazioni.lingua = getLang();
    impostazioni.tonalita = save.keyId as TonalitaArmonica;
    record.cuffie = save.settings.headphones;
  }
  inModes = true;
}

function leaveModes(): void {
  if (!inModes) return;
  inModes = false;
  // la tonalità o la lingua scelte nel Juke Joint valgono anche nel viaggio
  setLang(impostazioni.lingua);
  save.lang = impostazioni.lingua;
  save.keyId = impostazioni.tonalita;
  persist();
}

/** Da chiamare una volta creato il gioco: aggancia zoom, musica e salvataggi alle scene. */
export function wireModes(game: Phaser.Game): void {
  const keys = new Set(["hub", "jamMenu", "jam", "jamFine", "riffMenu", "riff", "riffFine", "voloMenu", "volo"]);
  // le scene esistono solo dopo l'avvio del gioco
  game.events.once(Phaser.Core.Events.READY, () => game.scene.getScenes(false).forEach(hook));
  const hook = (scene: Phaser.Scene): void => {
    const key = scene.sys.settings.key;
    const mode = keys.has(key);
    scene.sys.events.on(Phaser.Scenes.Events.CREATE, () => {
      if (!mode) return leaveModes();
      enterModes();
      scene.cameras.main.setZoom(4 / 3).centerOn(480, 270);
      if (OWN_MUSIC.has(key)) hush();
      else grooveOnGesture(scene, "juke");
      // dall'ingresso del locale si torna al viaggio
      if (key === "hub")
        bottone(scene, 64, 24, "‹ " + (getLang() === "it" ? "Indietro" : "Back"), () => scene.scene.start("title"), {
          w: 112,
          h: 32,
          primario: false,
          size: 13,
        }).setName("hub-back");
    });
  };
}
