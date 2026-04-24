import type { Character, Item } from "@prisma/client";

export function characterMeetsItemStatRequirements(character: Character, item: Item): boolean {
  if (item.requiredStrength > character.strength) return false;
  if (item.requiredConstitution > character.constitution) return false;
  if (item.requiredIntelligence > character.intelligence) return false;
  if (item.requiredDexterity > character.dexterity) return false;
  return true;
}

/** Level gate plus core stat gates (used by shop offers and equip UI). */
export function characterMeetsItemLevelAndStats(character: Character, item: Item): boolean {
  if (character.level < item.requiredLevel) return false;
  return characterMeetsItemStatRequirements(character, item);
}

export function formatItemStatRequirements(item: Item): string | null {
  const parts: string[] = [];
  if (item.requiredLevel > 1) parts.push(`LVL ${item.requiredLevel}+`);
  if (item.requiredStrength > 0) parts.push(`STR ${item.requiredStrength}+`);
  if (item.requiredConstitution > 0) parts.push(`CON ${item.requiredConstitution}+`);
  if (item.requiredIntelligence > 0) parts.push(`INT ${item.requiredIntelligence}+`);
  if (item.requiredDexterity > 0) parts.push(`DEX ${item.requiredDexterity}+`);
  return parts.length ? parts.join(" · ") : null;
}
