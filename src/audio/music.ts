// La base non si ferma mai: suona nei menu, continua in battaglia, accompagna i risultati.
// Ogni scena chiede il suo "groove" e il direttore decide se basta cambiare tempo o se serve ripartire.

import { getEngine } from "./engine";
import { save } from "../state";
import { PRESET, type Area, type TonalitaArmonica } from "../style/basi";

let playing: { area: Area; key: string } | null = null;

/**
 * Fa suonare la base di un luogo. Se suona già quella giusta, cambia solo tempo e arrangiamento (dalla prossima battuta).
 * `livello` sceglie l'arrangiamento del luogo: 0 nei menu, poi uno diverso per ogni avversario e per le fasi del boss.
 */
export function groove(area: Area, bpm = PRESET[area].bpm, livello = 0): void {
  const engine = getEngine();
  // senza un gesto il browser non suona: si riprova al prossimo tocco
  if (engine.ctx.state !== "running") return;
  const b = engine.basi;
  if (b.inRiproduzione && playing?.area === area && playing.key === save.keyId) {
    if (b.bpm !== bpm) b.impostaTempo(bpm);
    b.impostaStile(livello);
    return;
  }
  b.avvia({ area, armonica: save.keyId as TonalitaArmonica, bpm, stile: livello });
  playing = { area, key: save.keyId };
  engine.fx.tonica = b.tonicaMidi;
  engine.fx.minore = b.minore;
}

/** Il primo tocco o tasto della scena accende l'audio e la base. */
export function grooveOnGesture(scene: Phaser.Scene, area: Area): void {
  groove(area);
  const go = async () => {
    await getEngine().resume();
    groove(area);
  };
  scene.input.once("pointerdown", go);
  scene.input.keyboard?.once("keydown", go);
}

/** Le scene di servizio (opzioni) tengono la base che suonava già. */
export function keepGroove(scene: Phaser.Scene): void {
  grooveOnGesture(scene, playing?.area ?? "portico");
}

/** Cambia arrangiamento senza fermare la base (nuova fase del boss). */
export function grooveLevel(livello: number): void {
  const b = getEngine().basi;
  if (b.inRiproduzione) b.impostaStile(livello);
}

/** Silenzio per le prove del microfono: la base disturberebbe la misura. */
export function hush(): void {
  const b = getEngine().basi;
  if (b.inRiproduzione) b.ferma(0.3);
}
