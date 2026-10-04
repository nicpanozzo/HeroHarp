// Le statistiche salvate nel browser, a parte dai progressi del viaggio (incluse nel salvataggio esportato).

import { emptyStats, type StatsData } from "./stats";

export const STATS_KEY = "heroharp-stats";

function load(): StatsData {
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY) ?? "null");
    if (data?.v === 1) return { ...emptyStats(), ...data, totals: { ...emptyStats().totals, ...data.totals } };
  } catch {
    /* archiviazione non disponibile: le statistiche valgono solo per questa sessione */
  }
  return emptyStats();
}

export const stats: StatsData = load();

export function persistStats(): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignorato */
  }
}
