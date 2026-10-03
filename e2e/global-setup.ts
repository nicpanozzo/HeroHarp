// Crea il file audio del microfono finto: un Do5 (foro 4 soffiato su armonica in Do) di 30 secondi.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { FAKE_MIC } from "./paths";

export default function setup(): void {
  const sr = 48000,
    n = sr * 30;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let k = 0; k < 4; k++) x += 0.3 * Math.pow(0.6, k) * Math.sin(((k + 1) * 2 * Math.PI * 523.25 * i) / sr);
    b.writeInt16LE(Math.round(x * 32000), 44 + i * 2);
  }
  mkdirSync(dirname(FAKE_MIC), { recursive: true });
  writeFileSync(FAKE_MIC, b);
}
