// Rilevamento dell'altezza con l'algoritmo YIN (de Cheveigné & Kawahara, 2002).
// L'armonica è monofonica quando si suona un foro alla volta: YIN è preciso e leggero.

export interface PitchResult {
  hz: number;
  /** 0..1, quanto il segnale è periodico. Sotto ~0.8 è rumore o un accordo. */
  clarity: number;
}

export function yin(buf: Float32Array, sampleRate: number, threshold = 0.12, minHz = 140, maxHz = 2400): PitchResult | null {
  const half = buf.length >> 1;
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxTau = Math.min(half - 2, Math.floor(sampleRate / minHz));
  const d = new Float32Array(maxTau + 2);
  for (let tau = 1; tau <= maxTau + 1; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const x = buf[i] - buf[i + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  // differenza normalizzata cumulativa
  d[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= maxTau + 1; tau++) {
    run += d[tau];
    d[tau] = run ? (d[tau] * tau) / run : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // interpolazione parabolica per una stima sotto il campione
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const den = a + c - 2 * b;
  const shift = den ? (a - c) / (2 * den) : 0;
  return { hz: sampleRate / (tau + shift), clarity: 1 - b };
}

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}
