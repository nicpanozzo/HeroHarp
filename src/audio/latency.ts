// Stima del ritardo del dispositivo: il giocatore suona sui colpi del metronomo,
// la differenza tipica tra colpo e attacco sentito è il ritardo da compensare.

/** Ritardo massimo credibile: oltre, probabilmente il giocatore ha saltato un colpo. */
export const MAX_LATENCY = 0.4;
/** Quanti colpi devono avere un attacco abbinato perché la misura valga. */
export const MIN_MATCHES = 5;

export interface LatencyResult {
  /** Secondi; null se gli attacchi abbinati sono troppo pochi. */
  latency: number | null;
  matched: number;
  /** Quanto sono sparsi gli scarti (differenza tra i quartili), in secondi. */
  spread: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Abbina a ogni colpo il primo attacco tra poco prima del colpo e MAX_LATENCY dopo,
 * poi prende la mediana degli scarti (resiste a qualche colpo anticipato o mancato).
 */
export function estimateLatency(clicks: number[], onsets: number[]): LatencyResult {
  const used = new Set<number>();
  const offsets: number[] = [];
  for (const c of clicks) {
    const i = onsets.findIndex((o, j) => !used.has(j) && o >= c - 0.1 && o <= c + MAX_LATENCY);
    if (i < 0) continue;
    used.add(i);
    offsets.push(onsets[i] - c);
  }
  if (offsets.length < MIN_MATCHES) return { latency: null, matched: offsets.length, spread: 0 };
  const s = [...offsets].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { latency: Math.max(0, median(offsets)), matched: offsets.length, spread: q(0.75) - q(0.25) };
}
