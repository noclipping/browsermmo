import type { CharacterClass } from "@prisma/client";

/** Enemy pose URLs: `/sprites/enemies/` or `/sprites/enemies/{region}/` plus `{prefix}-{pose}.png`. */
export type EnemySpritePose = "idle" | "attack";

/** Pose filenames follow `{assetKey}-{pose}.png` under `/sprites/players/`. */
export type PlayerSpritePose = "idle" | "attack";

/** Default critter line — `sewer-rat-{idle|attack}.png`. */
const DEFAULT_ENEMY_SPRITE_PREFIX = "sewer-rat";

/** Bump when replacing files under `public/sprites/enemies/` so clients drop stale cached PNGs. */
const ENEMY_SPRITE_CACHE_QUERY = "?v=9";

/** Region subfolders under `/public/sprites/enemies/{folder}/`. */
const ENEMY_SPRITE_FOLDER_BY_REGION: Partial<Record<string, string>> = {
  town_outskirts: "town_outskirts",
  forest_edge: "forest_edge",
  ancient_ruins: "ancient_ruins",
  murk_catacombs: "murk_catacombs",
};

/**
 * Regions where art uses `{stem}_{idle|attack}.png` under the region folder.
 * `town_outskirts` uses hyphenated stems instead (`sewer-rat-idle.png`, …).
 */
const ENEMY_SPRITE_REGION_USES_UNDERSCORE_POSE = new Set([
  "forest_edge",
  "ancient_ruins",
  "murk_catacombs",
]);

/** DB `Enemy.key` → filename stem when it differs from the key (underscore regions only). */
const ENEMY_SPRITE_STEM_OVERRIDE: Record<string, string> = {
  forest_tree_ent: "tree_ent",
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
  const folderKey = regionKey ?? undefined;
  const folder = folderKey ? ENEMY_SPRITE_FOLDER_BY_REGION[folderKey] : undefined;
  const sub = folder ? `${folder}/` : "";

  if (folderKey && ENEMY_SPRITE_REGION_USES_UNDERSCORE_POSE.has(folderKey)) {
    const stem = ENEMY_SPRITE_STEM_OVERRIDE[enemyKey] ?? enemyKey;
    return `/sprites/enemies/${sub}${stem}_${pose}.png${ENEMY_SPRITE_CACHE_QUERY}`;
  }

  const prefix = ENEMY_SPRITE_PREFIX_BY_KEY[enemyKey] ?? DEFAULT_ENEMY_SPRITE_PREFIX;
  return `/sprites/enemies/${sub}${prefix}-${pose}.png${ENEMY_SPRITE_CACHE_QUERY}`;
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
