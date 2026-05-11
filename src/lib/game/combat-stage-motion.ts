/** Lunge in / hold / out — keep in sync with `CombatActorPanel` transform transition. */
export const JRPG_LUNGE_IN_MS = 280;
/** How long attack sprites stay on the strike pose after lunge-in (player + enemy). */
export const JRPG_STRIKE_HOLD_MS = 220;

/** Enemy pancake + fade after the killing blow (solo victory finale). */
export const ENEMY_DEATH_SQUASH_MS = 520;

/** Ms after strike presentation start until the squash cue (no lunge tail). */
export function victoryStrikePresentationEndMs(params: {
  playerCharged: boolean;
  enemyStrikeVisual: boolean;
  dmgPlayer: number;
  skillNoChargeSfx: boolean;
}): number {
  const settle = JRPG_LUNGE_IN_MS + JRPG_STRIKE_HOLD_MS;
  if (params.playerCharged) {
    if (params.enemyStrikeVisual) return 2 * settle + JRPG_LUNGE_IN_MS;
    return settle;
  }
  if (params.dmgPlayer > 0 && params.enemyStrikeVisual) return settle + JRPG_LUNGE_IN_MS;
  if (params.skillNoChargeSfx) return 0;
  return 0;
}
