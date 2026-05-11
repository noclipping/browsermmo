import type { CharacterClass } from "@prisma/client";

/** Enemy pose URLs: `/sprites/enemies/` or `/sprites/enemies/{region}/` plus `{prefix}-{pose}.png`. */
export type EnemySpritePose = "idle" | "attack";

/** Pose filenames follow `{assetKey}-{pose}.png` under `/sprites/players/`. */
export type PlayerSpritePose = "idle" | "attack";

/** Default critter line — `sewer-rat-{idle|attack}.png`. */
const DEFAULT_ENEMY_SPRITE_PREFIX = "sewer-rat";

/** Bump when replacing files under `public/sprites/enemies/` so clients drop stale cached PNGs. */
const ENEMY_SPRITE_CACHE_QUERY = "?v=6";

/** Region subfolders under `/public/sprites/enemies/{folder}/` (see `town_outskirts/`). */
const ENEMY_SPRITE_FOLDER_BY_REGION: Partial<Record<string, string>> = {
  town_outskirts: "town_outskirts",
  forest_edge: "forest_edge",
};

/** Files named `{prefix}_{pose}.png` instead of `{prefix}-{pose}.png` (DB key → prefix stem). */
const ENEMY_SPRITE_UNDERSCORE_POSE: Record<string, string> = {
  dire_wolf: "dire_wolf",
};

/**
 * Filename prefix (before `-idle.png` / `-attack.png`) for enemies that use non-default art.
 * Keys match `Enemy.key` from the DB; others use {@link DEFAULT_ENEMY_SPRITE_PREFIX}.
 */
export const ENEMY_SPRITE_PREFIX_BY_KEY: Record<string, string> = {
  sewer_rat: "sewer-rat",
  guild_boss_sewer_rat_king: "sewer-rat",
  plague_burrower: "plague-burrower",
  ditch_scrapper: "ditch-scrapper",
  gutter_cur: "gutter-cur",
  colossal_snail: "collossal-snail",
  sewer_fencer: "sewer-fencer",
};

export function getEnemySpritePath(
  enemyKey: string,
  pose: EnemySpritePose = "idle",
  /** Adventure / encounter region (`town_outskirts` uses the regional sprite subfolder). */
  regionKey?: string | null,
): string {
  const underscoreStem = ENEMY_SPRITE_UNDERSCORE_POSE[enemyKey];
  const prefix = underscoreStem ?? ENEMY_SPRITE_PREFIX_BY_KEY[enemyKey] ?? DEFAULT_ENEMY_SPRITE_PREFIX;
  const folder = regionKey ? ENEMY_SPRITE_FOLDER_BY_REGION[regionKey] : undefined;
  const sub = folder ? `${folder}/` : "";
  const sep = underscoreStem ? "_" : "-";
  return `/sprites/enemies/${sub}${prefix}${sep}${pose}.png${ENEMY_SPRITE_CACHE_QUERY}`;
}

/** Asset filename prefix before `-idle.png` / `-attack.png`. Expand when mage/rogue art lands. */
function playerSpriteAssetKey(characterClass: CharacterClass): string {
  switch (characterClass) {
    case "WARRIOR":
      return "warrior";
    case "MAGE":
    case "ROGUE":
    default:
      return "warrior";
  }
}

export function getPlayerSpritePath(characterClass: CharacterClass, pose: PlayerSpritePose = "idle"): string {
  const key = playerSpriteAssetKey(characterClass);
  return `/sprites/players/${key}-${pose}.png`;
}
