import type { Item, Rarity } from "@prisma/client";
import { forgedAffixScaledBonuses, forgedStatsForEntry } from "@/lib/game/item-affixes";
import { isMagicWeapon } from "@/lib/game/weapon-classification";

/** Stored legendary/godly roll on `CharacterEquipment` / inventory row (before forge scaling). */
export type GearStoredAffixBonuses = {
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
};

/** Smithing tier from DB/UI — coerces so stale clients or missing fields never become "+undefined". */
export function normalizeForgeLevel(forgeLevel?: number | null): number {
  const n = Number(forgeLevel);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** UI label: base item name with smithing suffix when reinforced. */
export function itemDisplayName(
  item: { name: string },
  forgeLevel?: number | null,
  affixPrefix?: string | null,
): string {
  const t = normalizeForgeLevel(forgeLevel);
  const prefixed = affixPrefix ? `${affixPrefix} ${item.name}` : item.name;
  if (t < 1) return prefixed;
  return `${prefixed} +${t}`;
}

/** Short stat line: base item numbers plus cumulative forge bonus. */
export function gearStatSummary(item: Item, slot: string, forgeLevel?: number | null): string {
  const t = normalizeForgeLevel(forgeLevel);
  const forged = forgedStatsForEntry({ slot, rarity: item.rarity, forgeLevel: t });
  const atk = item.attack + forged.attack;
  const def = item.defense + forged.defense;
  const hp = item.hp + forged.hp;
  const parts: string[] = [];
  if (atk) parts.push(`+${atk} ${isMagicWeapon({ ...item, slot }) ? "INT" : "ATK"}`);
  if (def) parts.push(`+${def} DEF`);
  if (hp) parts.push(`+${hp} HP`);
  return parts.join(" ");
}

/**
 * Legendary/Godly affix bonuses after forge-tier scaling (`forgedAffixMultiplier`).
 * Matches {@link ItemHoverCard} wording for consistency with tooltips.
 */
export function gearAffixBonusLine(
  rarity: Rarity,
  forgeLevel: number | null | undefined,
  stored: GearStoredAffixBonuses,
): string {
  if (rarity !== "LEGENDARY" && rarity !== "GODLY") return "";
  const t = normalizeForgeLevel(forgeLevel);
  const scaled = forgedAffixScaledBonuses(
    {
      bonusLifeSteal: stored.bonusLifeSteal,
      bonusCritChance: stored.bonusCritChance,
      bonusSkillPower: stored.bonusSkillPower,
      bonusStrength: stored.bonusStrength,
      bonusConstitution: stored.bonusConstitution,
      bonusIntelligence: stored.bonusIntelligence,
      bonusDexterity: stored.bonusDexterity,
    },
    { forgeLevel: t, rarity },
  );
  const lines = [
    scaled.bonusLifeSteal > 0 ? `Lifesteal +${(scaled.bonusLifeSteal * 100).toFixed(1)}%` : null,
    scaled.bonusCritChance > 0 ? `Crit +${(scaled.bonusCritChance * 100).toFixed(1)}%` : null,
    scaled.bonusSkillPower > 0 ? `Skill power +${(scaled.bonusSkillPower * 100).toFixed(1)}%` : null,
    scaled.bonusStrength > 0 ? `STR +${scaled.bonusStrength}` : null,
    scaled.bonusConstitution > 0 ? `CON +${scaled.bonusConstitution}` : null,
    scaled.bonusIntelligence > 0 ? `INT +${scaled.bonusIntelligence}` : null,
    scaled.bonusDexterity > 0 ? `DEX +${scaled.bonusDexterity}` : null,
  ].filter(Boolean) as string[];
  return lines.join(" · ");
}
