import type { Item } from "@prisma/client";
import { gearStatSummary } from "@/lib/game/item-display";
import { formatItemStatRequirements } from "@/lib/game/item-requirements";

export type ItemTooltipFields = Pick<
  Item,
  | "name"
  | "emoji"
  | "slot"
  | "rarity"
  | "attack"
  | "defense"
  | "hp"
  | "speed"
  | "description"
  | "sellPrice"
  | "requiredLevel"
  | "requiredStrength"
  | "requiredConstitution"
  | "requiredIntelligence"
  | "requiredDexterity"
>;

export function formatItemStatBlock(item: ItemTooltipFields, forgeLevel = 0): string {
  const line = gearStatSummary(item as Item, item.slot, forgeLevel);
  return line || "No combat stats.";
}

export function itemTooltipTitle(item: ItemTooltipFields, forgeLevel = 0): string {
  const stats = formatItemStatBlock(item, forgeLevel);
  const req = formatItemStatRequirements(item as Item);
  const parts = [`${item.emoji} ${item.name}`, item.rarity, `Lv ${item.requiredLevel}+`, stats];
  if (req) parts.push(`Req: ${req}`);
  parts.push(`Sell: ${item.sellPrice}g`);
  if (item.description?.trim()) parts.push(item.description.trim());
  return parts.join(" · ");
}
