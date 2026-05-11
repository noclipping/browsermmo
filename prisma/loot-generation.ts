import type { ItemSlot, Rarity } from "@prisma/client";

export type WeaponClassKey = "warrior" | "ranger" | "mage";
export type EnemyDropType = "COMMON" | "ELITE" | "BOSS";

export const LOOT_RARITIES: Rarity[] = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"];
export const LOOT_CLASSES: WeaponClassKey[] = ["warrior", "ranger", "mage"];
export const REQUIRED_CLASS_SLOTS: ItemSlot[] = ["WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"];

/** Per-rarity bucket targets; COMMON rarity uses a 35% floor across enemy tiers. */
export const ENEMY_TYPE_RARITY_BUCKET_CHANCE: Record<EnemyDropType, Record<Rarity, number>> = {
  COMMON: { COMMON: 0.35, UNCOMMON: 0.025, RARE: 0.009, EPIC: 0.0025, LEGENDARY: 0.0005, GODLY: 0.00005 },
  ELITE: { COMMON: 0.35, UNCOMMON: 0.04, RARE: 0.018, EPIC: 0.0065, LEGENDARY: 0.0015, GODLY: 0.00015 },
  BOSS: { COMMON: 0.35, UNCOMMON: 0.08, RARE: 0.04, EPIC: 0.0175, LEGENDARY: 0.006, GODLY: 0.00075 },
};

export type ItemSeedLike = {
  key: string;
  name: string;
  emoji: string;
  slot: ItemSlot;
  rarity: Rarity;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  value: number;
  requiredLevel?: number;
  requiredStrength?: number;
  requiredConstitution?: number;
  requiredIntelligence?: number;
  requiredDexterity?: number;
  description?: string;
  sellPrice?: number;
};

export type RegionLootDefinition = {
  key: string;
  name: string;
  tier: number;
  itemThemePrefix: string;
  enemyKeysByType: Record<EnemyDropType, string[]>;
  specialDropExceptions?: Array<{ enemyKey: string; itemKey: string; chance: number }>;
};

const RARITY_WORD: Record<Rarity, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
  GODLY: "Godly",
};

const CLASS_TITLE: Record<WeaponClassKey, string> = {
  warrior: "Warrior",
  ranger: "Ranger",
  mage: "Mage",
};

const CLASS_EMOJI: Record<WeaponClassKey, string> = {
  warrior: "⚔️",
  ranger: "🏹",
  mage: "🪄",
};

const SLOT_EMOJI: Record<ItemSlot, string> = {
  WEAPON: "⚔️",
  HELMET: "🪖",
  CHEST: "🧥",
  GLOVES: "🧤",
  BOOTS: "🥾",
  RING: "💍",
  AMULET: "🔮",
  CONSUMABLE: "🧪",
};

const SLOT_NAME: Record<ItemSlot, string> = {
  WEAPON: "Weapon",
  HELMET: "Helm",
  CHEST: "Chestguard",
  GLOVES: "Gloves",
  BOOTS: "Boots",
  RING: "Ring",
  AMULET: "Amulet",
  CONSUMABLE: "Consumable",
};

const SLOT_POWER_WEIGHT: Record<ItemSlot, number> = {
  WEAPON: 1,
  HELMET: 0.66,
  CHEST: 0.92,
  GLOVES: 0.58,
  BOOTS: 0.58,
  RING: 0.62,
  AMULET: 0.65,
  CONSUMABLE: 0,
};

const RARITY_MULT: Record<Rarity, number> = {
  COMMON: 1,
  UNCOMMON: 1.25,
  RARE: 1.62,
  EPIC: 2.08,
  LEGENDARY: 2.7,
  GODLY: 3.5,
};

const CLASS_STAT_DIST: Record<WeaponClassKey, Record<ItemSlot, { attack: number; defense: number; hp: number; speed: number }>> = {
  warrior: {
    WEAPON: { attack: 1.45, defense: 0.2, hp: 0.55, speed: 0.05 },
    HELMET: { attack: 0.15, defense: 0.95, hp: 1.05, speed: 0 },
    CHEST: { attack: 0.1, defense: 1.15, hp: 1.35, speed: 0 },
    GLOVES: { attack: 0.2, defense: 0.6, hp: 0.65, speed: 0.05 },
    BOOTS: { attack: 0.1, defense: 0.55, hp: 0.55, speed: 0.1 },
    RING: { attack: 0.22, defense: 0.5, hp: 0.72, speed: 0.05 },
    AMULET: { attack: 0.2, defense: 0.45, hp: 0.95, speed: 0.05 },
    CONSUMABLE: { attack: 0, defense: 0, hp: 0, speed: 0 },
  },
  ranger: {
    WEAPON: { attack: 1.34, defense: 0.08, hp: 0.22, speed: 0.72 },
    HELMET: { attack: 0.25, defense: 0.5, hp: 0.5, speed: 0.4 },
    CHEST: { attack: 0.33, defense: 0.58, hp: 0.68, speed: 0.45 },
    GLOVES: { attack: 0.42, defense: 0.35, hp: 0.3, speed: 0.7 },
    BOOTS: { attack: 0.32, defense: 0.35, hp: 0.28, speed: 0.88 },
    RING: { attack: 0.46, defense: 0.22, hp: 0.25, speed: 0.72 },
    AMULET: { attack: 0.42, defense: 0.25, hp: 0.36, speed: 0.72 },
    CONSUMABLE: { attack: 0, defense: 0, hp: 0, speed: 0 },
  },
  mage: {
    WEAPON: { attack: 1.25, defense: 0.12, hp: 0.62, speed: 0.12 },
    HELMET: { attack: 0.35, defense: 0.35, hp: 0.62, speed: 0.18 },
    CHEST: { attack: 0.42, defense: 0.42, hp: 0.84, speed: 0.15 },
    GLOVES: { attack: 0.52, defense: 0.2, hp: 0.22, speed: 0.22 },
    BOOTS: { attack: 0.4, defense: 0.2, hp: 0.16, speed: 0.35 },
    RING: { attack: 0.62, defense: 0.12, hp: 0.32, speed: 0.3 },
    AMULET: { attack: 0.78, defense: 0.1, hp: 0.44, speed: 0.25 },
    CONSUMABLE: { attack: 0, defense: 0, hp: 0, speed: 0 },
  },
};

export const REGIONAL_LOOT_DEFINITIONS: RegionLootDefinition[] = [
  {
    key: "town_outskirts",
    name: "Town Outskirts",
    tier: 0,
    itemThemePrefix: "Outskirts",
    enemyKeysByType: {
      COMMON: ["sewer_rat", "ditch_scrapper", "gutter_cur"],
      ELITE: ["plague_burrower", "colossal_snail"],
      BOSS: ["sewer_fencer"],
    },
    specialDropExceptions: [
      { enemyKey: "sewer_rat", itemKey: "health_potion", chance: 0.2 },
      { enemyKey: "plague_burrower", itemKey: "smithing_stone", chance: 0.05 },
      { enemyKey: "sewer_fencer", itemKey: "smithing_stone", chance: 0.12 },
    ],
  },
  {
    key: "forest_edge",
    name: "Forest Edge",
    tier: 1,
    itemThemePrefix: "Forest",
    enemyKeysByType: {
      COMMON: ["dire_wolf"],
      ELITE: ["alpha_dire_wolf"],
      BOSS: ["forest_tree_ent"],
    },
    specialDropExceptions: [
      { enemyKey: "dire_wolf", itemKey: "health_potion", chance: 0.18 },
      { enemyKey: "alpha_dire_wolf", itemKey: "smithing_stone", chance: 0.08 },
      { enemyKey: "forest_tree_ent", itemKey: "smithing_stone", chance: 0.14 },
    ],
  },
  {
    key: "ancient_ruins",
    name: "Ancient Ruins",
    tier: 2,
    itemThemePrefix: "Ruins",
    enemyKeysByType: {
      COMMON: ["gloom_jackal", "ash_crawler"],
      ELITE: ["cave_imp", "tomb_revenant"],
      BOSS: ["ruins_colossus"],
    },
    specialDropExceptions: [
      { enemyKey: "gloom_jackal", itemKey: "health_potion", chance: 0.18 },
      { enemyKey: "cave_imp", itemKey: "smithing_stone", chance: 0.1 },
      { enemyKey: "ruins_colossus", itemKey: "smithing_stone", chance: 0.14 },
    ],
  },
  {
    key: "murk_catacombs",
    name: "Murk Catacombs",
    tier: 3,
    itemThemePrefix: "Catacomb",
    enemyKeysByType: {
      COMMON: ["crypt_wraith"],
      ELITE: ["bone_knight"],
      BOSS: ["grave_warden"],
    },
    specialDropExceptions: [
      { enemyKey: "crypt_wraith", itemKey: "smithing_stone", chance: 0.1 },
      { enemyKey: "grave_warden", itemKey: "smithing_stone", chance: 0.14 },
    ],
  },
];

function basePowerForTier(tier: number): number {
  return 4 + tier * 6;
}

function attributeFloor(itemClass: WeaponClassKey, tier: number, rarity: Rarity): Pick<ItemSeedLike, "requiredStrength" | "requiredConstitution" | "requiredIntelligence" | "requiredDexterity" | "requiredLevel"> {
  const level = Math.max(1, 1 + tier * 4 + Math.floor(LOOT_RARITIES.indexOf(rarity) * 0.9));
  const rarityTax = Math.floor(LOOT_RARITIES.indexOf(rarity) * 2);
  if (itemClass === "warrior") {
    return {
      requiredLevel: level,
      requiredStrength: 10 + tier * 2 + rarityTax,
      requiredConstitution: 9 + tier * 2 + Math.floor(rarityTax * 0.75),
      requiredIntelligence: 0,
      requiredDexterity: 0,
    };
  }
  if (itemClass === "ranger") {
    return {
      requiredLevel: level,
      requiredStrength: 0,
      requiredConstitution: 7 + tier + Math.floor(rarityTax * 0.25),
      requiredIntelligence: 0,
      requiredDexterity: 10 + tier * 2 + rarityTax,
    };
  }
  return {
    requiredLevel: level,
    requiredStrength: 0,
    requiredConstitution: 7 + tier + Math.floor(rarityTax * 0.4),
    requiredIntelligence: 10 + tier * 2 + rarityTax,
    requiredDexterity: 0,
  };
}

function toStat(v: number): number {
  return Math.max(0, Math.round(v));
}

function itemValueFromPower(power: number, slot: ItemSlot, rarity: Rarity): number {
  const slotAdj = slot === "WEAPON" ? 1.2 : slot === "RING" || slot === "AMULET" ? 1.05 : 1;
  const rarityAdj = 1 + LOOT_RARITIES.indexOf(rarity) * 0.4;
  return Math.max(8, Math.floor(power * 8 * slotAdj * rarityAdj));
}

function classWeaponName(prefix: string, cls: WeaponClassKey, rarity: Rarity): string {
  const base =
    cls === "warrior"
      ? "Warblade"
      : cls === "ranger"
        ? "Longbow"
        : "Channelstaff";
  return `${prefix} ${RARITY_WORD[rarity]} ${CLASS_TITLE[cls]} ${base}`;
}

function classGearName(prefix: string, cls: WeaponClassKey, slot: ItemSlot, rarity: Rarity): string {
  if (slot === "WEAPON") return classWeaponName(prefix, cls, rarity);
  return `${prefix} ${RARITY_WORD[rarity]} ${CLASS_TITLE[cls]} ${SLOT_NAME[slot]}`;
}

function buildClassGearItem(params: { region: RegionLootDefinition; cls: WeaponClassKey; slot: ItemSlot; rarity: Rarity }): ItemSeedLike {
  const { region, cls, slot, rarity } = params;
  const power = basePowerForTier(region.tier) * RARITY_MULT[rarity] * SLOT_POWER_WEIGHT[slot];
  const dist = CLASS_STAT_DIST[cls][slot];
  const attack = toStat(power * dist.attack);
  const defense = toStat(power * dist.defense);
  const hp = toStat(power * dist.hp * 1.7);
  const speed = toStat(power * dist.speed * 0.75);
  return {
    key: `loot_reg${region.tier}_${cls}_${slot.toLowerCase()}_${rarity}`,
    name: classGearName(region.itemThemePrefix, cls, slot, rarity),
    emoji: slot === "WEAPON" ? CLASS_EMOJI[cls] : SLOT_EMOJI[slot],
    slot,
    rarity,
    attack,
    defense,
    hp,
    speed,
    value: itemValueFromPower(power, slot, rarity),
    ...attributeFloor(cls, region.tier, rarity),
    description: `${region.name} ${CLASS_TITLE[cls].toLowerCase()} ${slot.toLowerCase()} gear, ${RARITY_WORD[rarity].toLowerCase()} grade.`,
  };
}

function buildDaggerItem(region: RegionLootDefinition, rarity: Rarity): ItemSeedLike {
  const power = basePowerForTier(region.tier) * RARITY_MULT[rarity];
  return {
    key: `loot_reg${region.tier}_dagger_${rarity}`,
    name: `${region.itemThemePrefix} ${RARITY_WORD[rarity]} Dagger`,
    emoji: "🗡️",
    slot: "WEAPON",
    rarity,
    attack: toStat(power * 1.2),
    defense: toStat(power * 0.05),
    hp: toStat(power * 0.2),
    speed: toStat(power * 0.95),
    value: itemValueFromPower(power, "WEAPON", rarity),
    requiredLevel: Math.max(1, 1 + region.tier * 4 + Math.floor(LOOT_RARITIES.indexOf(rarity) * 0.9)),
    requiredStrength: 0,
    requiredConstitution: 0,
    requiredIntelligence: 0,
    requiredDexterity: 10 + region.tier * 2 + LOOT_RARITIES.indexOf(rarity) * 2,
    description: `${region.name} assassin blade, ${RARITY_WORD[rarity].toLowerCase()} make.`,
  };
}

export function buildCompleteRegionalLootItems(): ItemSeedLike[] {
  const out: ItemSeedLike[] = [];
  for (const region of REGIONAL_LOOT_DEFINITIONS) {
    for (const rarity of LOOT_RARITIES) {
      for (const cls of LOOT_CLASSES) {
        for (const slot of REQUIRED_CLASS_SLOTS) {
          out.push(buildClassGearItem({ region, cls, slot, rarity }));
        }
      }
      out.push(buildDaggerItem(region, rarity));
    }
  }
  return out;
}

export type GeneratedDropRow = { enemyKey: string; itemKey: string; chance: number; regionKey: string; enemyType: EnemyDropType; rarity: Rarity };

function chancePerItemForBucket(bucketChance: number, poolSize: number): number {
  if (bucketChance <= 0 || poolSize <= 0) return 0;
  return 1 - Math.pow(1 - bucketChance, 1 / poolSize);
}

export function buildRegionalDropRows(items: ItemSeedLike[]): GeneratedDropRow[] {
  const rows: GeneratedDropRow[] = [];
  for (const region of REGIONAL_LOOT_DEFINITIONS) {
    const regionItems = items.filter((item) => item.key.startsWith(`loot_reg${region.tier}_`));
    for (const [enemyType, enemyKeys] of Object.entries(region.enemyKeysByType) as Array<[EnemyDropType, string[]]>) {
      for (const rarity of LOOT_RARITIES) {
        const rarityItems = regionItems.filter((item) => item.rarity === rarity);
        const perItemChance = chancePerItemForBucket(ENEMY_TYPE_RARITY_BUCKET_CHANCE[enemyType][rarity], rarityItems.length);
        for (const enemyKey of enemyKeys) {
          for (const item of rarityItems) {
            rows.push({ enemyKey, itemKey: item.key, chance: perItemChance, regionKey: region.key, enemyType, rarity });
          }
        }
      }
    }
    for (const row of region.specialDropExceptions ?? []) {
      rows.push({
        enemyKey: row.enemyKey,
        itemKey: row.itemKey,
        chance: row.chance,
        regionKey: region.key,
        enemyType: inferEnemyType(region, row.enemyKey),
        rarity: "COMMON",
      });
    }
  }
  return rows;
}

function inferEnemyType(region: RegionLootDefinition, enemyKey: string): EnemyDropType {
  for (const type of ["COMMON", "ELITE", "BOSS"] as EnemyDropType[]) {
    if (region.enemyKeysByType[type].includes(enemyKey)) return type;
  }
  throw new Error(`Enemy '${enemyKey}' not found in region '${region.key}' enemy type map`);
}

export function validateLootConfiguration(items: ItemSeedLike[], drops: GeneratedDropRow[]): string[] {
  const errors: string[] = [];
  const globalRaritySet = new Set<Rarity>(items.map((i) => i.rarity));
  for (const rarity of LOOT_RARITIES) {
    if (!globalRaritySet.has(rarity)) errors.push(`Global rarity missing from generated items: ${rarity}`);
  }
  for (const region of REGIONAL_LOOT_DEFINITIONS) {
    const prefix = `loot_reg${region.tier}_`;
    const regionItems = items.filter((item) => item.key.startsWith(prefix));
    for (const rarity of LOOT_RARITIES) {
      const byRarity = regionItems.filter((item) => item.rarity === rarity);
      if (!byRarity.length) errors.push(`${region.key}: missing rarity pool ${rarity}`);
      for (const cls of LOOT_CLASSES) {
        for (const slot of REQUIRED_CLASS_SLOTS) {
          const key = `loot_reg${region.tier}_${cls}_${slot.toLowerCase()}_${rarity}`;
          if (!regionItems.some((item) => item.key === key)) {
            errors.push(`${region.key}: missing ${cls} ${slot} at ${rarity}`);
          }
        }
      }
      const daggerKey = `loot_reg${region.tier}_dagger_${rarity}`;
      if (!regionItems.some((item) => item.key === daggerKey)) {
        errors.push(`${region.key}: missing dagger at ${rarity}`);
      }
    }
    const epicCount = regionItems.filter((item) => item.rarity === "EPIC").length;
    if (epicCount === 0) errors.push(`${region.key}: EPIC items missing`);

    const enemySeen = new Set<string>();
    for (const type of ["COMMON", "ELITE", "BOSS"] as EnemyDropType[]) {
      for (const enemyKey of region.enemyKeysByType[type]) {
        if (enemySeen.has(enemyKey)) errors.push(`${region.key}: enemy '${enemyKey}' assigned multiple enemy types`);
        enemySeen.add(enemyKey);
      }
    }
    for (const [enemyType, enemyKeys] of Object.entries(region.enemyKeysByType) as Array<[EnemyDropType, string[]]>) {
      for (const rarity of LOOT_RARITIES) {
        const bucketRows = drops.filter(
          (row) =>
            row.regionKey === region.key &&
            row.enemyType === enemyType &&
            row.rarity === rarity &&
            enemyKeys.includes(row.enemyKey) &&
            row.itemKey.startsWith(prefix),
        );
        if (!bucketRows.length) {
          errors.push(`${region.key}: missing drop rows for ${enemyType} ${rarity}`);
          continue;
        }
        const perEnemy = new Map<string, number>();
        for (const row of bucketRows) {
          perEnemy.set(row.enemyKey, (perEnemy.get(row.enemyKey) ?? 0) + 1);
        }
        const counts = new Set(perEnemy.values());
        if (counts.size > 1) {
          errors.push(`${region.key}: non-standardized row count within ${enemyType} ${rarity}`);
        }
      }
    }
  }
  return errors;
}
