// Dove sta ogni cosa in battaglia: in orizzontale come sempre, in verticale (telefono dritto) tutto impilato.
// Lo usano sia la battaglia del viaggio sia il duello della Lunga Notte.
import { W, H, portrait } from "../ui";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BattleLayout {
  portrait: boolean;
  /** Riquadro dello sfondo del luogo. */
  stage: Box;
  /** Pannello delle corsie, dove scendono i colpi. */
  board: Box;
  laneTop: number;
  hitY: number;
  laneLabelSize: number;
  /** Raggio dei gettoni che scendono. */
  badgeR: number;
  player: { x: number; y: number; size: number };
  enemy: { x: number; y: number; size: number; bossSize: number };
  /** Cartello con il titolo del turno. */
  bannerBox: Box;
  bannerY: number;
  subY: number;
  subWrap: number;
  beatY: number;
  /** Targa con la frase del nemico. */
  chipY: number;
  chipSpan: number;
  /** Grandezza delle note della frase (1 = come in orizzontale). */
  chipScale: number;
  streakY: number;
  feedbackY: number;
  comboY: number;
  keepPlayingY: number;
  bigY: number;
  enemyHitY: number;
  enemyOnTimeY: number;
  enemyHealY: number;
  playerHitY: number;
}

/** In orizzontale i valori di sempre; in verticale lo spazio in più va a personaggi e corsie. */
export function battleLayout(player: { x: number; y: number; size: number } = { x: 175, y: 470, size: 250 }): BattleLayout {
  if (!portrait()) {
    const board = { x: 300, y: 370, w: 680, h: 340 };
    const enemy = { x: 1110, y: 440, size: 260, bossSize: 330 };
    return {
      portrait: false,
      stage: { x: 0, y: 0, w: W, h: H },
      board,
      laneTop: board.y + 14,
      hitY: board.y + board.h - 62,
      laneLabelSize: 34,
      badgeR: 32,
      player,
      enemy,
      bannerBox: { x: W / 2 - 290, y: 126, w: 580, h: 102 },
      bannerY: 158,
      subY: 200,
      subWrap: 540,
      beatY: 242,
      chipY: 300,
      chipSpan: 1000,
      chipScale: 1,
      streakY: 112,
      feedbackY: 430,
      comboY: 300,
      keepPlayingY: 380,
      bigY: 330,
      enemyHitY: 200,
      enemyOnTimeY: 262,
      enemyHealY: 210,
      playerHitY: 300,
    };
  }
  // 0 su un telefono corto (palco alto 1180), 1 su uno lungo (1560)
  const extra = H - 1180;
  const charsY = 450 + extra * 0.16;
  const chipY = 670 + extra * 0.34;
  const boardY = chipY + 84;
  const board = { x: 20, y: boardY, w: W - 40, h: H - 22 - boardY };
  return {
    portrait: true,
    stage: { x: 0, y: 0, w: W, h: boardY },
    board,
    laneTop: board.y + 14,
    hitY: board.y + board.h - 74,
    laneLabelSize: 40,
    badgeR: 44,
    player: { x: 160, y: charsY + 10, size: 260 },
    enemy: { x: 550, y: charsY, size: 280, bossSize: 320 },
    bannerBox: { x: 48, y: 164, w: W - 96, h: 104 },
    bannerY: 198,
    subY: 242,
    subWrap: W - 140,
    beatY: 284,
    chipY,
    chipSpan: W - 80,
    chipScale: 1.3,
    streakY: 316,
    feedbackY: boardY + 64,
    comboY: charsY - 40,
    keepPlayingY: boardY + 120,
    bigY: charsY,
    enemyHitY: charsY - 120,
    enemyOnTimeY: charsY - 60,
    enemyHealY: charsY - 110,
    playerHitY: charsY - 110,
  };
}
