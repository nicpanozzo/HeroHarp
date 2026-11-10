// Copiato da modes/src/brano/demo.ts con scripts/sync-content.mjs, non modificare qui.
// Il brano di prova: uno slow blues in Sol scritto per HarpHero (armonica in Do, seconda posizione).
// Si genera al volo, campione per campione, così non pesa sul download e si prova anche nei test:
// band (basso, chitarra, batteria) + un'armonica sintetica che suona sei frasi di due battute.

export const DEMO_ID = "demo-slow-blues";
export const DEMO_BPM = 66;

/** [foro, inizio, durata] in battiti dall'inizio del giro (12/8: il battito è una terzina). */
type NotaDemo = [string, number, number];

/** Le sei frasi, una ogni due battute, con una battuta d'attacco della band prima. */
export const FRASI_DEMO: NotaDemo[] = [
  // battute 1-2 (Sol)
  ["2↓", 0, 1], ["3↓", 1, 0.67], ["4↑", 1.67, 0.33], ["4↓", 2, 2], ["4↑", 4, 0.67], ["3↓", 4.67, 0.33], ["2↓", 5, 2],
  // battute 3-4 (Sol)
  ["4↓", 8, 0.67], ["5↓", 8.67, 0.33], ["6↑", 9, 1.5], ["5↓", 10.67, 0.33], ["4↓", 11, 1], ["4↑", 12, 0.67], ["3↓", 12.67, 0.33], ["2↓", 13, 2],
  // battute 5-6 (Do)
  ["4↑", 16, 1], ["5↑", 17, 0.67], ["5↓", 17.67, 0.33], ["4↓", 18, 1.5], ["4↑", 19.67, 0.33], ["3↓", 20, 1], ["4↑", 21, 1.5],
  // battute 7-8 (Sol)
  ["2↓", 24, 0.67], ["3↓", 24.67, 0.33], ["4↑", 25, 0.67], ["4↓", 25.67, 0.33], ["5↓", 26, 0.67], ["4↓", 26.67, 0.33], ["4↑", 27, 1], ["2↓", 28, 2.5],
  // battute 9-10 (Re, Do)
  ["4↓", 32, 1.5], ["4↓", 33.67, 0.33], ["5↓", 34, 1], ["6↑", 35, 0.67], ["5↓", 35.67, 0.33], ["4↓", 36, 1], ["4↑", 37, 1], ["3↓", 38, 1],
  // battute 11-12 (Sol, giro di chiusura)
  ["2↓", 40, 0.67], ["3↓", 40.67, 0.33], ["4↑", 41, 0.67], ["3↓", 41.67, 0.33], ["2↓", 42, 1.8], ["1↓", 44, 0.67], ["2↑", 44.67, 0.33], ["2↓", 45, 2.5],
];

/** Note MIDI dei fori dell'armonica in Do usati qui. */
const FORI: Record<string, number> = { "1↓": 62, "2↑": 64, "2↓": 67, "3↓": 71, "4↑": 72, "4↓": 74, "5↑": 76, "5↓": 77, "6↑": 79 };
/** Accordo di ogni battuta del giro (radice MIDI del basso). */
const GIRO = [43, 43, 43, 43, 48, 48, 43, 43, 50, 48, 43, 50];
const ATTACCO = 4; // battiti d'attacco della band

export interface Demo {
  campioni: Float32Array;
  sr: number;
  /** Le note dell'armonica: inizio (s), durata (s), MIDI. Servono ai test. */
  verita: { t: number; durata: number; midi: number }[];
}

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Generatore di numeri casuali con seme: la traccia è identica a ogni avvio. */
function casuale(seme: number) {
  return () => { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296 * 2 - 1; };
}

export function generaDemo(sr = 22050, conArmonica = true): Demo {
  const b = 60 / DEMO_BPM;
  const battiti = ATTACCO + 48 + 4;
  const n = Math.ceil(battiti * b * sr);
  const out = new Float32Array(n);
  const rnd = casuale(7);
  const aggiungi = (t0: number, durata: number, voce: (t: number, i: number) => number) => {
    const i0 = Math.floor(t0 * sr), i1 = Math.min(n, Math.floor((t0 + durata) * sr));
    for (let i = Math.max(0, i0); i < i1; i++) out[i] += voce((i - i0) / sr, i);
  };
  // shuffle: in ogni battito, la prima e la terza croma della terzina
  for (let bt = 0; bt < battiti - 2; bt++) {
    const t = bt * b, battuta = Math.max(0, Math.floor((bt - ATTACCO) / 4)) % 12;
    const radice = GIRO[bt < ATTACCO ? 0 : battuta];
    const nelBattito = bt % 4;
    // cassa sull'1 e sul 3, rullante sul 2 e sul 4
    if (nelBattito % 2 === 0) aggiungi(t, 0.25, (x) => Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-x * 30)) * x) * Math.exp(-x * 14) * 0.45);
    if (nelBattito % 2 === 1) aggiungi(t, 0.18, (x) => rnd() * 0.12 * Math.exp(-x * 30));
    // charleston sulle due crome dello shuffle
    for (const s of [0, 2 / 3]) aggiungi(t + s * b, 0.05, (x) => rnd() * 0.05 * Math.exp(-x * 90));
    // basso: radice, quinta, sesta, quinta (lungo-corto)
    const passi = [0, 7, 9, 7];
    for (const [k, s] of [[0, 0], [1, 2 / 3]] as const) {
      const m = radice + (k === 0 ? passi[nelBattito] : passi[nelBattito] + (nelBattito === 2 ? 1 : 0));
      const f = hz(m);
      aggiungi(t + s * b, k === 0 ? 0.55 * b : 0.3 * b, (x) => (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x)) * 0.28 * Math.min(1, x * 200) * Math.exp(-x * 3));
    }
    // chitarra: accordo di settima sul 2 e sul 4, pizzicato
    if (nelBattito % 2 === 1) {
      const acc = [radice + 12, radice + 16, radice + 19, radice + 22];
      aggiungi(t, 0.6, (x) => acc.reduce((s, m, j) => {
        const f = hz(m), xx = Math.max(0, x - j * 0.012);
        return s + (Math.sin(2 * Math.PI * f * xx) + 0.5 * Math.sin(4 * Math.PI * f * xx) + 0.25 * Math.sin(6 * Math.PI * f * xx)) * Math.exp(-xx * 7);
      }, 0) * 0.035);
    }
  }
  const verita: Demo["verita"] = [];
  for (const [foro, inizio, durata] of FRASI_DEMO) {
    const midi = FORI[foro];
    const t0 = (ATTACCO + inizio) * b, d = durata * b * 0.94;
    verita.push({ t: t0, durata: d, midi });
    if (!conArmonica) continue;
    const f = hz(midi);
    // ancia: armoniche dispari e pari, attacco e rilascio rapidi, vibrato sulle note lunghe
    const amp = [1, 0.75, 0.5, 0.35, 0.22, 0.15, 0.1, 0.06];
    aggiungi(t0, d, (x) => {
      const vib = d > 0.6 ? 0.006 * Math.sin(2 * Math.PI * 5.5 * x) * Math.min(1, x * 2) : 0;
      const ph = 2 * Math.PI * f * (x + vib / (2 * Math.PI * 5.5));
      let s = 0;
      for (let k = 0; k < amp.length; k++) s += amp[k] * Math.sin((k + 1) * ph);
      const inv = Math.min(1, x / 0.02) * Math.min(1, (d - x) / 0.04);
      return s * inv * 0.16;
    });
  }
  // normalizza
  let picco = 0;
  for (let i = 0; i < n; i++) picco = Math.max(picco, Math.abs(out[i]));
  if (picco > 0.95) for (let i = 0; i < n; i++) out[i] *= 0.95 / picco;
  return { campioni: out, sr, verita };
}

/** Trasforma i campioni in un file WAV a 16 bit, da dare al lettore audio. */
export function wav(campioni: Float32Array, sr: number): Blob {
  const buf = new ArrayBuffer(44 + campioni.length * 2);
  const v = new DataView(buf);
  const s = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  s(0, "RIFF"); v.setUint32(4, 36 + campioni.length * 2, true); s(8, "WAVE"); s(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data");
  v.setUint32(40, campioni.length * 2, true);
  for (let i = 0; i < campioni.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, campioni[i])) * 32767, true);
  return new Blob([buf], { type: "audio/wav" });
}
