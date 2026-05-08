/** Region-based adventure rolls — weighted pools, no DB table yet. */

export type AdventureRegionConfig = {
  combatChance: number;
  goldChance: number;
  potionChance: number;
  xpChance: number;
  /** Enemy keys must exist in DB and belong to this region (same regionId). */
  combatEnemies: { key: string; weight: number }[];
  /** Optional elite key in same region — rolled before normal pool. */
  eliteEnemyKey?: string;
  /** Weighted elite pool (preferred over eliteEnemyKey when both exist). */
  eliteEnemies?: { key: string; weight: number }[];
  /** Chance (0–1) to spawn the elite instead of a normal pull. */
  eliteChance?: number;
  goldMin: number;
  goldMax: number;
};

export const ADVENTURE_REGIONS: Record<string, AdventureRegionConfig> = {
  town_outskirts: {
    combatChance: 0.7,
    goldChance: 0.18,
    potionChance: 0.12,
    xpChance: 0,
    combatEnemies: [
      { key: "sewer_rat", weight: 0.3 },
      { key: "ditch_scrapper", weight: 0.35 },
      { key: "gutter_cur", weight: 0.35 },
    ],
    eliteEnemies: [
      { key: "plague_burrower", weight: 0.42 },
      { key: "colossal_snail", weight: 0.58 },
    ],
    eliteChance: 0.16,
    goldMin: 3,
    goldMax: 9,
  },
  forest_edge: {
    combatChance: 0.78,
    goldChance: 0.08,
    potionChance: 0.07,
    xpChance: 0.07,
    combatEnemies: [{ key: "dire_wolf", weight: 1 }],
    eliteEnemies: [
      { key: "alpha_dire_wolf", weight: 0.7 },
      { key: "forest_tree_ent", weight: 0.3 },
    ],
    eliteChance: 0.14,
    goldMin: 6,
    goldMax: 16,
  },
  ancient_ruins: {
    combatChance: 0.8,
    goldChance: 0.07,
    potionChance: 0.06,
    xpChance: 0.07,
    combatEnemies: [
      { key: "gloom_jackal", weight: 0.52 },
      { key: "ash_crawler", weight: 0.48 },
    ],
    eliteEnemies: [
      { key: "tomb_revenant", weight: 0.5 },
      { key: "cave_imp", weight: 0.3 },
      { key: "ruins_colossus", weight: 0.2 },
    ],
    eliteChance: 0.25,
    goldMin: 10,
    goldMax: 24,
  },
  murk_catacombs: {
    combatChance: 0.82,
    goldChance: 0.06,
    potionChance: 0.05,
    xpChance: 0.07,
    combatEnemies: [
      { key: "crypt_wraith", weight: 0.55 },
      { key: "bone_knight", weight: 0.45 },
    ],
    eliteEnemies: [{ key: "grave_warden", weight: 1 }],
    eliteChance: 0.25,
    goldMin: 14,
    goldMax: 32,
  },
};

const FLAVOR_BY_REGION: Record<string, string[]> = {
  town_outskirts: [
    "You wander the outskirts — something stirs in the scrub.",
    "A loose flagstone shifts. You're not alone out here.",
    "Birds go quiet. Trouble has a smell.",
  ],
  forest_edge: [
    "Under the canopy, eyes glint from the ferns.",
    "The path narrows. Whatever hunts here knows the terrain.",
    "A branch snaps behind you — too heavy for a squirrel.",
  ],
  ancient_ruins: [
    "Dust motes hang in the stale air. Footsteps echo where none should be.",
    "Carved eyes seem to follow you between the pillars.",
    "A chill runs up your spine — the ruins remember violence.",
  ],
  murk_catacombs: [
    "Your torch guttering — the catacombs drink the light.",
    "Something scrapes on stone that hasn't been walked in years.",
    "The air tastes of rust and old magic.",
  ],
};

const COMBAT_FLAVOR: Record<string, string[]> = {
  sewer_rat: ["A sewer rat bursts from the refuse, teeth bared!", "Scraping claws — a rat has decided you're in its territory."],
  ditch_scrapper: [
    "A scrapper steps from the ditch, fists wrapped in stained cord.",
    "Someone mean and hungry blocks the path — this one has seen a few brawls.",
  ],
  gutter_cur: [
    "A lean cur slinks from the gutter, ribs showing, eyes too clever.",
    "Street dog energy — except this mutt bites like it means it.",
  ],
  colossal_snail: [
    "The ground trembles — a shell the size of a cart heaves into view!",
    "Slime trails shimmer — an oversized snail doesn't need speed to ruin your day.",
  ],
  sewer_fencer: [
    "Steel sings — a masked fencer drops from a low wall, blade already level.",
    "Footwork whispers on cobbles — a duelist has marked you as practice.",
  ],
  plague_burrower: [
    "A swollen burrower explodes from the filth — this one has fed well!",
    "Diseased fur and red eyes — an elite plague beast blocks the path!",
  ],
  dire_wolf: ["A dire wolf circles into view, hackles high.", "Yellow eyes lock on — the pack's scout has found you."],
  alpha_dire_wolf: [
    "The alpha drops from a ledge — scarred muzzle, murder in its stride.",
    "This wolf is bigger than the rest: the pack leader has come for you.",
  ],
  forest_tree_ent: [
    "Roots tear through stone — a towering Tree Ent lurches from the forest edge!",
    "Bark groans like thunder. An ancient ent turns its hollow gaze toward you.",
  ],
  cave_imp: ["A cave imp drops from above, cackling!", "Green fire dances in its hands — an imp blocks the way."],
  ruins_colossus: [
    "Stone grinds on stone — a Ruins Colossus tears free from a collapsed archway!",
    "Ancient masonry lurches to life. A colossal guardian bars your path.",
  ],
  gloom_jackal: ["A jackal built for the dark slips from the rubble.", "Low growl — a gloom jackal claims this hall."],
  ash_crawler: [
    "Chitin scrapes mortar — an ash crawler scuttles from a collapsed fresco.",
    "Many legs, no patience — a ruins beetle sizes you up for a meal.",
  ],
  tomb_revenant: [
    "Armor clatters — a revenant knight rises, blade humming with spite!",
    "Cold breath fogs your visor — an elite tomb guardian has found you.",
  ],
  crypt_wraith: ["A wraith coils from the dark, whispering your failures.", "Cold claws rake the air — the crypt does not forgive."],
  bone_knight: ["A bone knight clatters forward, hollow eyes burning.", "Rusted plate and marrow — the dead still march here."],
  grave_warden: [
    "The Grave Warden steps from the shadows — runes flare on its greaves!",
    "An elite sentinel — this one has kept the catacombs for centuries.",
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

export function rollAdventureKind(regionKey: string): "COMBAT" | "GOLD" | "POTION" | "XP" {
  const cfg = ADVENTURE_REGIONS[regionKey];
  if (!cfg) return "COMBAT";
  const r = Math.random();
  if (r < cfg.combatChance) return "COMBAT";
  if (r < cfg.combatChance + cfg.goldChance) return "GOLD";
  if (r < cfg.combatChance + cfg.goldChance + cfg.potionChance) return "POTION";
  return "XP";
}

export function rollCombatEnemyKey(regionKey: string): string | null {
  const cfg = ADVENTURE_REGIONS[regionKey];
  if (!cfg?.combatEnemies.length) return null;
  if (cfg.eliteChance != null && cfg.eliteChance > 0 && Math.random() < cfg.eliteChance) {
    if (cfg.eliteEnemies?.length) return weightedPick(cfg.eliteEnemies).key;
    if (cfg.eliteEnemyKey) return cfg.eliteEnemyKey;
  }
  return weightedPick(cfg.combatEnemies).key;
}

export function rollGoldAmount(regionKey: string): number {
  const cfg = ADVENTURE_REGIONS[regionKey];
  if (!cfg) return 5;
  return cfg.goldMin + Math.floor(Math.random() * (cfg.goldMax - cfg.goldMin + 1));
}

export function rollXpAmount(regionKey: string): number {
  switch (regionKey) {
    case "forest_edge":
      return 8 + Math.floor(Math.random() * 9);
    case "ancient_ruins":
      return 14 + Math.floor(Math.random() * 13);
    case "murk_catacombs":
      return 20 + Math.floor(Math.random() * 17);
    default:
      return 5 + Math.floor(Math.random() * 7);
  }
}

export function regionFlavorLine(regionKey: string): string {
  const pool = FLAVOR_BY_REGION[regionKey] ?? FLAVOR_BY_REGION.town_outskirts;
  return pick(pool);
}

export function combatIntroLine(enemyKey: string): string {
  const pool = COMBAT_FLAVOR[enemyKey] ?? ["Something hostile blocks your path!"];
  return pick(pool);
}
