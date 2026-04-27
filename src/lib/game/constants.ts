import { CharacterClass, ItemSlot, Rarity } from "@prisma/client";

export const EQUIPMENT_SLOTS: ItemSlot[] = ["WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"];
/** Crimson Tonic carry cap in backpack. */
export const MAX_POTIONS_IN_PACK = 20;
/** Max tonics usable per single encounter. */
export const MAX_POTIONS_PER_BATTLE = 3;
/** After sipping in manual combat, wait this many of your turns before another. */
export const POTION_COOLDOWN_AFTER_USE_TURNS = 2;
/** Level-up row stat bumps (tighter power curve). */
export const LEVEL_UP_MAX_HP = 5;
export const LEVEL_UP_ATTACK = 1;
export const LEVEL_UP_DEFENSE = 1;
export const LEVEL_UP_HP_BUMP = 5;

/** Used by combat + seed — potions are CONSUMABLE, not equippable. */
export const HEALTH_POTION_ITEM_KEY = "health_potion";
export const SMITHING_STONE_ITEM_KEY = "smithing_stone";

/** Town apothecary (debug / loop smoothing). */
export const POTION_SHOP_PRICE = 8;
export const SMITHING_STONE_SHOP_PRICE = 120;
export const FORGE_UPGRADE_GOLD_COST = 35;
export const FORGE_MAX_COMMON = 3;
export const FORGE_MAX_BY_RARITY: Record<Rarity, number> = {
  COMMON: 3,
  UNCOMMON: 5,
  RARE: 7,
  EPIC: 10,
  LEGENDARY: Number.MAX_SAFE_INTEGER,
  GODLY: Number.MAX_SAFE_INTEGER,
};

/**
 * Stat bonus per forge level (+1, +2, …) on an equipped piece in that slot.
 * Totals are (base item stats) + forgeLevel × these values (see buildCharacterStats).
 */
export const FORGE_BONUS_PER_LEVEL: Record<
  string,
  { attack: number; defense: number; hp: number; speed: number }
> = {
  WEAPON: { attack: 2, defense: 0, hp: 0, speed: 0 },
  HELMET: { attack: 0, defense: 1, hp: 2, speed: 0 },
  CHEST: { attack: 0, defense: 1, hp: 4, speed: 0 },
  GLOVES: { attack: 1, defense: 0, hp: 0, speed: 1 },
  BOOTS: { attack: 0, defense: 0, hp: 1, speed: 1 },
  RING: { attack: 1, defense: 1, hp: 0, speed: 0 },
  AMULET: { attack: 1, defense: 0, hp: 2, speed: 0 },
};

/** Milliseconds between free full heals at town campfire. */
export const TOWN_REST_COOLDOWN_MS = 120_000;

/** Solo adventure pacing: strong early hero, short fights in starting regions. */
export const CLASS_BASE_STATS = {
  WARRIOR: { hp: 54, attack: 9, defense: 7, speed: 3, critChance: 0.07 },
  MAGE: { hp: 44, attack: 9, defense: 4, speed: 4, critChance: 0.1 },
  ROGUE: { hp: 48, attack: 9, defense: 5, speed: 6, critChance: 0.12 },
};

/** Starting core attributes (Phase 3). ROGUE = archer-style in UI. */
export const CLASS_STARTING_ATTRIBUTES: Record<
  CharacterClass,
  { strength: number; constitution: number; intelligence: number; dexterity: number }
> = {
  WARRIOR: { strength: 14, constitution: 12, intelligence: 5, dexterity: 7 },
  MAGE: { strength: 5, constitution: 8, intelligence: 15, dexterity: 8 },
  ROGUE: { strength: 7, constitution: 9, intelligence: 7, dexterity: 14 },
};

export const STAT_POINTS_ON_CREATE = 2;
export const STAT_POINTS_PER_LEVEL = 2;

/** Added to max HP (computed) per constitution point. */
export const CON_HP_PER_POINT = 2;
/** Bonus attack from strength (floor strength × this). */
export const STR_ATK_FACTOR = 0.35;
/** Bonus magic damage from intelligence. */
export const INT_MAGIC_ATK_FACTOR = 0.4;
/** Base mana granted from intelligence. */
export const INT_MANA_PER_POINT = 2;
/** Bonus ranged damage from dexterity. */
export const DEX_RANGED_ATK_FACTOR = 0.2;
/** Crit chance per dexterity point (capped in build). */
export const DEX_CRIT_PER_POINT = 0.003;
export const MAX_CRIT_FROM_STATS = 0.42;
/** Flee chance scaling from dexterity. */
export const DEX_FLEE_CHANCE_PER_POINT = 0.015;
export const BASE_FLEE_CHANCE = 0.2;
export const MIN_FLEE_CHANCE = 0.05;
export const MAX_FLEE_CHANCE = 0.9;

/** Enemy Enrage: multiplies into pending damage for the next STRIKE / HEAVY_ATTACK. */
export const ENRAGE_PENDING_MULT = 1.35;
export const MAX_ENEMY_PENDING_DAMAGE_MULT = 2.25;
/** Enemy Harden: armor vs your damage on your next action. */
export const HARDEN_ARMOR_BASE = 2;
export const HARDEN_ARMOR_PER_ENEMY_DEF = 0.35;

export const CLASS_DISPLAY_NAME: Record<CharacterClass, string> = {
  WARRIOR: "Warrior",
  MAGE: "Mage",
  ROGUE: "Rogue (Archer)",
};

export const CLASS_SKILLS: Record<
  CharacterClass,
  { name: string; emoji: string; cooldown: number; description: string }
> = {
  WARRIOR: {
    name: "Heavy Strike",
    emoji: "⚔️",
    cooldown: 2,
    description: "150% weapon damage. 2-turn cooldown.",
  },
  MAGE: {
    name: "Fireball",
    emoji: "🔥",
    cooldown: 2,
    description: "Spell hit (~130% power, scales with INT, slightly reduced). 2-turn cooldown.",
  },
  ROGUE: {
    name: "Volley",
    emoji: "🏹",
    cooldown: 3,
    description: "Two hits at 70% damage each. 3-turn cooldown.",
  },
};
