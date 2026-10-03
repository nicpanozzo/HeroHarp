// Cosa è aperto e cosa no: regole del viaggio, separate dalla grafica per poterle testare.
import { AREAS, JOURNEY, type AreaDef, type EnemyDef } from "./content/areas";

export interface Progress {
  beaten: readonly string[];
  /** Opzione "tutte le tappe aperte": per allenarsi dove si vuole. */
  openAll?: boolean;
}

const bossOf = (a: AreaDef) => a.enemies.find((e) => e.boss)!;

/**
 * Un'area si apre battendo il boss della precedente; l'Extra dopo il primo boss.
 * Le aree "in arrivo" (grafica o modalità non pronte) non bloccano il viaggio: si saltano.
 */
export function areaUnlocked(a: AreaDef, p: Progress): boolean {
  if (a.comingSoon) return false;
  if (p.openAll || a.order === 1) return true;
  if (a.extra) return p.beaten.includes(bossOf(JOURNEY[0]).id);
  const prev = JOURNEY.filter((x) => x.order < a.order && !x.comingSoon).pop();
  return !prev || p.beaten.includes(bossOf(prev).id);
}

/** Il boss si sfida dopo aver battuto gli altri nemici giocabili dell'area. */
export function enemyUnlocked(e: EnemyDef, p: Progress): boolean {
  if (e.comingSoon) return false;
  if (!e.boss || p.openAll) return true;
  const area = AREAS.find((a) => a.id === e.areaId)!;
  return area.enemies.filter((x) => !x.boss && !x.comingSoon).every((x) => p.beaten.includes(x.id));
}

export const areaCleared = (a: AreaDef, p: Progress): boolean => a.enemies.filter((e) => !e.comingSoon).every((e) => p.beaten.includes(e.id));

/** La prossima area da giocare: la prima aperta e non ancora completata. */
export function currentArea(p: Progress): AreaDef {
  return JOURNEY.find((a) => areaUnlocked(a, p) && !areaCleared(a, p)) ?? JOURNEY.filter((a) => areaUnlocked(a, p)).pop() ?? JOURNEY[0];
}

/** Il prossimo nemico da sfidare: il primo aperto e non ancora battuto della tappa attuale. */
export function nextEnemy(p: Progress): EnemyDef {
  const area = currentArea(p);
  const open = area.enemies.filter((e) => enemyUnlocked(e, p));
  return open.find((e) => !p.beaten.includes(e.id)) ?? open[open.length - 1] ?? AREAS[0].enemies[0];
}

/** Stelle di una battaglia vinta: 3 se quasi tutto giusto e quasi nessun colpo preso. */
export function starsFor(won: boolean, s: { notesHit: number; notesExpected: number; missed: number }): number {
  if (!won) return 0;
  const acc = s.notesExpected ? s.notesHit / s.notesExpected : 1;
  return acc >= 0.9 && s.missed <= 1 ? 3 : acc >= 0.7 ? 2 : 1;
}
