import Phaser from "phaser";
import { getEngine } from "../audio/engine";
import { reducedMotion } from "../ui";

/** Chiama `cb` sul battito, quando lo si sente davvero (la base programma i battiti un po' in anticipo). */
export function onBeat(scene: Phaser.Scene, cb: (beat: number) => void): void {
  const engine = getEngine();
  const off = engine.basi.suBattito((n, tm) => {
    const delay = (tm - engine.ctx.currentTime + (engine.ctx.outputLatency || 0)) * 1000;
    scene.time.delayedCall(Math.max(0, delay), () => cb(n));
  });
  scene.events.once("shutdown", off);
}

/** Fa "respirare" gli oggetti a tempo: un piccolo colpo sul battito, più forte sul primo della battuta. */
export function pulse(scene: Phaser.Scene, targets: (Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject)[], amount = 0.05): void {
  if (reducedMotion()) return;
  const base = targets.map((t) => ({ x: t.scaleX, y: t.scaleY }));
  onBeat(scene, (n) => {
    const k = 1 + (n === 0 ? amount * 1.8 : amount);
    targets.forEach((t, i) => {
      if (!t.active) return;
      scene.tweens.add({
        targets: t,
        scaleX: { from: base[i].x * k, to: base[i].x },
        scaleY: { from: base[i].y * k, to: base[i].y },
        duration: 180,
        ease: "Quad.easeOut",
      });
    });
  });
}

/** Un saltello sul battito (personaggi). */
export function hop(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, height = 8): void {
  if (reducedMotion()) return;
  const y = target.y;
  onBeat(scene, () => {
    if (!target.active) return;
    scene.tweens.add({ targets: target, y: { from: y - height, to: y }, duration: 220, ease: "Quad.easeIn" });
  });
}
