export type CombatFxTone = "damage" | "heal" | "defend" | "flee";

/** Where to render floating combat text. `stage` uses legacy x/y % overlay; actors anchor above portraits. */
export type CombatFxTarget = "stage" | "player" | "enemy";

export type CombatFxItem = {
  id: number;
  emoji: string;
  text: string;
  tone: CombatFxTone;
  /** Used when `target` is `stage` (ignored for actor targets). */
  x: number;
  y: number;
  target?: CombatFxTarget;
};
