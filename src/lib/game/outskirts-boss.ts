export const OUTSKIRTS_BOSS_KILL_MIN = 3;
export const OUTSKIRTS_BOSS_KILL_MAX = 5;

/** Random wins required before the Sewer Fencer miniboss gate fires. */
export function rollOutskirtsBossInterval(): number {
  return OUTSKIRTS_BOSS_KILL_MIN + Math.floor(Math.random() * (OUTSKIRTS_BOSS_KILL_MAX - OUTSKIRTS_BOSS_KILL_MIN + 1));
}
