/**
 * Per-enemy hurt clips under `/public/sfx/hurt_sounds/{region}/`.
 * Only enemies with a dedicated file are listed — others fall back to silence.
 */
const TOWN_OUTSKIRTS_HURT: Record<string, string> = {
  sewer_rat: "/sfx/hurt_sounds/town_outskirts/rat_hurt.wav",
  ditch_scrapper: "/sfx/hurt_sounds/town_outskirts/ditch_scrapper_hurt.wav",
  sewer_fencer: "/sfx/hurt_sounds/town_outskirts/sewer_fencer_hurt.wav",
  colossal_snail: "/sfx/hurt_sounds/town_outskirts/colossal_snail_hurt.wav",
  gutter_cur: "/sfx/hurt_sounds/town_outskirts/gutter_cur_hurt.wav",
  plague_burrower: "/sfx/hurt_sounds/town_outskirts/plague_burrower_hurt.wav",
};

const FOREST_EDGE_HURT: Record<string, string> = {
  dire_wolf: "/sfx/hurt_sounds/forest_edge/dire_wolf_hurt.wav",
};

/** Extra multiplier on global SFX volume for specific clips (0–1). */
const TOWN_OUTSKIRTS_RELATIVE_GAIN: Partial<Record<string, number>> = {
  gutter_cur: 0.5,
  plague_burrower: 0.5,
};

const FOREST_EDGE_RELATIVE_GAIN: Partial<Record<string, number>> = {
  dire_wolf: 0.25,
};

export type EnemyHurtSfxSpec = { url: string; relativeGain: number };

export function getEnemyHurtSfxSpec(regionKey: string, enemyKey: string): EnemyHurtSfxSpec | null {
  if (regionKey === "town_outskirts") {
    const url = TOWN_OUTSKIRTS_HURT[enemyKey];
    if (!url) return null;
    return { url, relativeGain: TOWN_OUTSKIRTS_RELATIVE_GAIN[enemyKey] ?? 1 };
  }
  if (regionKey === "forest_edge") {
    const url = FOREST_EDGE_HURT[enemyKey];
    if (!url) return null;
    return { url, relativeGain: FOREST_EDGE_RELATIVE_GAIN[enemyKey] ?? 1 };
  }
  return null;
}
