// Tastiera come alternativa al microfono (per provare senza armonica):
// 1..0 = fori 1..10 soffiati, Q..P = fori 1..10 aspirati.
import { tabToMidi, keyById } from "./harp";
import { getEngine } from "./audio/engine";
import { save } from "./state";

const BLOW_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const DRAW_KEYS = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];

let active: string | null = null;

function tabForKey(k: string) {
  const b = BLOW_KEYS.indexOf(k);
  if (b >= 0) return { hole: b + 1, draw: false, bend: 0 };
  const d = DRAW_KEYS.indexOf(k);
  if (d >= 0) return { hole: d + 1, draw: true, bend: 0 };
  return null;
}

export function installKeyboard(): void {
  window.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    const tab = tabForKey(k);
    if (!tab || ev.repeat) return;
    const engine = getEngine();
    active = k;
    engine.keyboardHeld = true;
    engine.tracker.force(engine.now, tabToMidi(tab, keyById(save.keyId)));
  });
  window.addEventListener("keyup", (ev) => {
    if (ev.key.toLowerCase() !== active) return;
    const engine = getEngine();
    active = null;
    engine.keyboardHeld = false;
    engine.tracker.force(engine.now, null);
  });
}
