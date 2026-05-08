import type { CharacterClass, Item, ItemSlot, Rarity } from "@prisma/client";
import { FORGE_BONUS_PER_LEVEL } from "@/lib/game/constants";

export type AffixBonuses = {
  affixPrefix: string | null;
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusDefensePercent: number;
  bonusConstitutionPercent: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
};

type RollDef = {
  prefix: string;
  lifeSteal?: [number, number];
  critChance?: [number, number];
  skillPower?: [number, number];
  defensePercent?: [number, number];
  constitutionPercent?: [number, number];
  strength?: [number, number];
  constitution?: [number, number];
  intelligence?: [number, number];
  dexterity?: [number, number];
};

const WARRIOR_POOL: RollDef[] = [
  { prefix: "Vampiric", lifeSteal: [0.02, 0.05], constitution: [1, 3] },
  { prefix: "Titan", strength: [2, 5], skillPower: [0.08, 0.18] },
  { prefix: "Bulwark", constitution: [2, 5], critChance: [0.005, 0.02] },
];
const MAGE_POOL: RollDef[] = [
  { prefix: "Arcane", intelligence: [2, 5], skillPower: [0.1, 0.22] },
  { prefix: "Astral", critChance: [0.01, 0.03], intelligence: [1, 3] },
  { prefix: "Siphoning", lifeSteal: [0.01, 0.03], skillPower: [0.08, 0.16] },
];
const ROGUE_POOL: RollDef[] = [
  { prefix: "Shadow", dexterity: [2, 5], critChance: [0.015, 0.04] },
  { prefix: "Razor", skillPower: [0.1, 0.2], critChance: [0.01, 0.03] },
  { prefix: "Predator", lifeSteal: [0.02, 0.04], dexterity: [1, 3] },
];
const NEUTRAL_POOL: RollDef[] = [
  { prefix: "Mythic", critChance: [0.01, 0.03], skillPower: [0.08, 0.18] },
  { prefix: "Eternal", lifeSteal: [0.015, 0.04], constitution: [1, 4] },
  { prefix: "Ascendant", strength: [1, 4], intelligence: [1, 4], dexterity: [1, 4] },
];
const WORN_PERCENT_POOL: RollDef[] = [
  { prefix: "Bastioned", defensePercent: [0.015, 0.04] },
  { prefix: "Ironblooded", constitutionPercent: [0.02, 0.05] },
];

function randomFloat([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

function randomInt([min, max]: [number, number]) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function scaleForRarity(rarity: Rarity): number {
  return rarity === "GODLY" ? 1.45 : 1;
}

function zeroBonuses(prefix: string | null): AffixBonuses {
  return {
    affixPrefix: prefix,
    bonusLifeSteal: 0,
    bonusCritChance: 0,
    bonusSkillPower: 0,
    bonusDefensePercent: 0,
    bonusConstitutionPercent: 0,
    bonusStrength: 0,
    bonusConstitution: 0,
    bonusIntelligence: 0,
    bonusDexterity: 0,
  };
}

function rollOneAffix(def: RollDef, scale: number): Omit<AffixBonuses, "affixPrefix"> {
  return {
    bonusLifeSteal: def.lifeSteal ? Number((randomFloat(def.lifeSteal) * scale).toFixed(4)) : 0,
    bonusCritChance: def.critChance ? Number((randomFloat(def.critChance) * scale).toFixed(4)) : 0,
    bonusSkillPower: def.skillPower ? Number((randomFloat(def.skillPower) * scale).toFixed(4)) : 0,
    bonusDefensePercent: def.defensePercent ? Number((randomFloat(def.defensePercent) * scale).toFixed(4)) : 0,
    bonusConstitutionPercent: def.constitutionPercent ? Number((randomFloat(def.constitutionPercent) * scale).toFixed(4)) : 0,
    bonusStrength: def.strength ? Math.max(1, Math.round(randomInt(def.strength) * scale)) : 0,
    bonusConstitution: def.constitution ? Math.max(1, Math.round(randomInt(def.constitution) * scale)) : 0,
    bonusIntelligence: def.intelligence ? Math.max(1, Math.round(randomInt(def.intelligence) * scale)) : 0,
    bonusDexterity: def.dexterity ? Math.max(1, Math.round(randomInt(def.dexterity) * scale)) : 0,
  };
}

function hasPercentPayload(def: RollDef): boolean {
  return !!(def.lifeSteal || def.critChance || def.skillPower || def.defensePercent || def.constitutionPercent);
}

function isWornGearSlot(slot: ItemSlot): boolean {
  return slot !== "WEAPON" && slot !== "RING" && slot !== "AMULET" && slot !== "CONSUMABLE";
}

function poolForClass(characterClass: CharacterClass, slot: ItemSlot): RollDef[] {
  if (slot === "RING" || slot === "AMULET") return NEUTRAL_POOL;
  if (characterClass === "WARRIOR") return WARRIOR_POOL;
  if (characterClass === "MAGE") return MAGE_POOL;
  if (characterClass === "ROGUE") return ROGUE_POOL;
  return NEUTRAL_POOL;
}

export function rollAffixesForItem(params: {
  item: Pick<Item, "rarity" | "slot">;
  characterClass: CharacterClass;
}): AffixBonuses {
  if (params.item.rarity !== "LEGENDARY" && params.item.rarity !== "GODLY") {
    return zeroBonuses(null);
  }

  const scale = scaleForRarity(params.item.rarity);
  const classPool = poolForClass(params.characterClass, params.item.slot);
  const wornPool = isWornGearSlot(params.item.slot) ? WORN_PERCENT_POOL : [];
  const affixPool = (params.item.rarity === "GODLY" ? [...classPool, ...NEUTRAL_POOL] : classPool).concat(wornPool);
  if (!affixPool.length) return zeroBonuses(null);

  const rollCount = params.item.rarity === "GODLY" ? 2 + Math.floor(Math.random() * 2) : 1;
  const percentNeeded = params.item.rarity === "GODLY" ? 2 : 1;
  const percentPool = affixPool.filter(hasPercentPayload).sort(() => Math.random() - 0.5);
  const picks: RollDef[] = [];
  for (const def of percentPool) {
    if (picks.length >= Math.min(percentNeeded, rollCount)) break;
    picks.push(def);
  }
  const remaining = affixPool.filter((def) => !picks.includes(def)).sort(() => Math.random() - 0.5);
  for (const def of remaining) {
    if (picks.length >= Math.min(rollCount, affixPool.length)) break;
    picks.push(def);
  }
  const bonuses = zeroBonuses(
    params.item.rarity === "GODLY"
      ? `Godforged ${picks.map((pick) => pick.prefix).join("-")}`
      : (picks[0]?.prefix ?? null),
  );

  for (const pick of picks) {
    const rolled = rollOneAffix(pick, scale);
    bonuses.bonusLifeSteal = Number((bonuses.bonusLifeSteal + rolled.bonusLifeSteal).toFixed(4));
    bonuses.bonusCritChance = Number((bonuses.bonusCritChance + rolled.bonusCritChance).toFixed(4));
    bonuses.bonusSkillPower = Number((bonuses.bonusSkillPower + rolled.bonusSkillPower).toFixed(4));
    bonuses.bonusDefensePercent = Number((bonuses.bonusDefensePercent + rolled.bonusDefensePercent).toFixed(4));
    bonuses.bonusConstitutionPercent = Number((bonuses.bonusConstitutionPercent + rolled.bonusConstitutionPercent).toFixed(4));
    bonuses.bonusStrength += rolled.bonusStrength;
    bonuses.bonusConstitution += rolled.bonusConstitution;
    bonuses.bonusIntelligence += rolled.bonusIntelligence;
    bonuses.bonusDexterity += rolled.bonusDexterity;
  }

  return bonuses;
}

export function forgeMultiplierWithDiminishingReturns(forgeLevel: number): number {
  const tier = Math.max(0, Math.floor(forgeLevel));
  if (tier === 0) return 0;
  let total = 0;
  for (let i = 1; i <= tier; i += 1) {
    total += 1 / (1 + (i - 1) * 0.18);
  }
  return total;
}

/** Rolled legendary/godly affix potency scales with smithing tier (forge 0 = 1×). */
export function forgedAffixMultiplier(params: { forgeLevel: number; rarity: Rarity }): number {
  if (params.rarity !== "LEGENDARY" && params.rarity !== "GODLY") return 1;
  const tier = Math.max(0, Math.floor(params.forgeLevel));
  if (tier === 0) return 1;
  const baseStep = params.rarity === "GODLY" ? 0.055 : 0.048;
  let add = 0;
  for (let i = 1; i <= tier; i += 1) {
    add += baseStep / (1 + (i - 1) * 0.18);
  }
  return Number((1 + add).toFixed(5));
}

/**
 * Additive forge gain for percent-based affixes (lifesteal / crit / skill power).
 *
 * Values are stored as decimal fractions, so:
 * - +1.0% tooltip gain = +0.01 stored
 * - +0.5% tooltip gain = +0.005 stored
 * - +0.25% tooltip gain = +0.0025 stored
 */
export function forgedPercentAffixAdditiveBonus(params: { forgeLevel: number; rarity: Rarity }): number {
  if (params.rarity !== "LEGENDARY" && params.rarity !== "GODLY") return 0;
  const tier = Math.max(0, Math.floor(params.forgeLevel));
  if (tier === 0) return 0;
  let add = 0;
  for (let i = 1; i <= tier; i += 1) {
    if (i <= 25) {
      add += 0.01;
    } else if (i <= 50) {
      add += 0.005;
    } else {
      add += 0.0025;
    }
  }
  return Number(add.toFixed(4));
}

export type StoredAffixBonuses = {
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusDefensePercent: number;
  bonusConstitutionPercent: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
};

export function forgedAffixScaledBonuses(
  stored: StoredAffixBonuses,
  params: { forgeLevel: number; rarity: Rarity },
): StoredAffixBonuses {
  const m = forgedAffixMultiplier(params);
  const percentAdd = forgedPercentAffixAdditiveBonus(params);
  if (m === 1 && percentAdd === 0) return { ...stored };
  return {
    bonusLifeSteal: stored.bonusLifeSteal > 0 ? Number((stored.bonusLifeSteal + percentAdd).toFixed(4)) : 0,
    bonusCritChance: stored.bonusCritChance > 0 ? Number((stored.bonusCritChance + percentAdd).toFixed(4)) : 0,
    bonusSkillPower: stored.bonusSkillPower > 0 ? Number((stored.bonusSkillPower + percentAdd).toFixed(4)) : 0,
    bonusDefensePercent: stored.bonusDefensePercent > 0 ? Number((stored.bonusDefensePercent + percentAdd).toFixed(4)) : 0,
    bonusConstitutionPercent:
      stored.bonusConstitutionPercent > 0 ? Number((stored.bonusConstitutionPercent + percentAdd).toFixed(4)) : 0,
    bonusStrength: Math.round(stored.bonusStrength * m),
    bonusConstitution: Math.round(stored.bonusConstitution * m),
    bonusIntelligence: Math.round(stored.bonusIntelligence * m),
    bonusDexterity: Math.round(stored.bonusDexterity * m),
  };
}

export function forgedStatsForEntry(params: {
  slot: string;
  rarity: Rarity;
  forgeLevel: number;
}): { attack: number; defense: number; hp: number } {
  const bonus = FORGE_BONUS_PER_LEVEL[params.slot];
  if (!bonus) return { attack: 0, defense: 0, hp: 0 };
  const mult =
    params.rarity === "LEGENDARY" || params.rarity === "GODLY"
      ? forgeMultiplierWithDiminishingReturns(params.forgeLevel)
      : Math.max(0, Math.floor(params.forgeLevel));
  return {
    attack: Math.floor(bonus.attack * mult),
    defense: Math.floor(bonus.defense * mult),
    hp: Math.floor(bonus.hp * mult),
  };
}
