// Prova il rilevatore del gioco sulle registrazioni vere del banco di prova del progetto
// (tests/campioni nella cartella del progetto). Se la cartella non c'è, il test viene saltato.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { yin, rms } from "../src/audio/yin";
import { hzToMidi } from "../src/harp";
import { NoteTracker } from "../src/audio/tracker";

const DIR = process.env.CAMPIONI ?? "/mnt/project-files/tests/campioni";
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

function readWav(path: string): { sr: number; x: Float32Array } {
  const b = readFileSync(path);
  let p = 12, sr = 0, data: Buffer | null = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") sr = b.readUInt32LE(p + 12);
    if (id === "data") data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size & 1);
  }
  const x = new Float32Array(data!.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = data!.readInt16LE(i * 2) / 32768;
  return { sr, x };
}

/** Nota attesa dal nome del file, es. C_foro04_soffio_C5_Normal.wav → 72. */
function expected(file: string): number | null {
  const m = /_([A-G][b#]?)(\d)(?:_|\.wav)/.exec(file);
  if (!m) return null;
  const name = FLAT[m[1]] ?? m[1];
  return NAMES.indexOf(name) + 12 * (Number(m[2]) + 1);
}

const files = existsSync(DIR)
  ? ["reali", "derivati"].flatMap((d) => readdirSync(`${DIR}/${d}`).filter((f) => f.endsWith(".wav") && !f.includes("glide")).map((f) => `${d}/${f}`))
  : [];

describe.skipIf(files.length === 0)("rilevatore sulle registrazioni del banco di prova", () => {
  it("ogni nota attaccata dal gioco è quella giusta, nella grande maggioranza dei file", () => {
    let pass = 0;
    const failed: string[] = [];
    for (const f of files) {
      const want = expected(f);
      if (want === null) continue;
      const { sr, x } = readWav(`${DIR}/${f}`);
      // come nel gioco: 60 letture al secondo, note accettate solo dopo letture stabili
      const tr = new NoteTracker();
      const onsets: number[] = [];
      tr.onOnset((o) => onsets.push(o.midi));
      for (let i = 0; i + 2048 <= x.length; i += Math.round(sr / 60)) {
        const buf = x.subarray(i, i + 2048);
        const level = rms(buf);
        const r = level >= 0.002 ? yin(buf, sr) : null;
        tr.feed(i / sr, r && r.clarity > 0.7 ? hzToMidi(r.hz) : null, level);
      }
      if (onsets.length > 0 && onsets.every((m) => m === want)) pass++;
      else failed.push(`${f}: atteso ${want}, attacchi ${onsets.join(",") || "nessuno"}`);
    }
    const n = files.filter((f) => expected(f) !== null).length;
    console.log(`campioni: ${pass}/${n} file riconosciuti senza errori`);
    expect(pass / n, failed.join("\n")).toBeGreaterThan(0.95);
  }, 120_000);
});
