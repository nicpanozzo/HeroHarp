import Phaser from "phaser";
import manifest from "../assets/manifest.json";
import { C, W, H, txt, HEX } from "../ui";

// Gli SVG sono inclusi nel file del gioco come testo, così funziona anche aperto con doppio clic.
const SVGS = import.meta.glob("../assets/**/*.svg", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.add.rectangle(W / 2, H / 2, W, H, C.carta);
    const label = txt(this, W / 2, H / 2, "…", 28, HEX.inchiostro, "titoli");
    this.load.on("progress", (p: number) => label.setText(`${Math.round(p * 100)}%`));
    for (const f of manifest.file) {
      const raw = SVGS[`../assets/${f.file}`];
      if (!raw) continue;
      const url = URL.createObjectURL(new Blob([raw], { type: "image/svg+xml" }));
      this.load.svg(f.key, url, { width: f.w, height: f.h });
    }
  }

  create(): void {
    this.scene.start("title");
  }
}
