import type { Character, Item, Region } from "@prisma/client";
import { EQUIPMENT_SLOTS, POTION_SHOP_PRICE, SMITHING_STONE_SHOP_PRICE } from "@/lib/game/constants";
/** Tier 0 starter commons (no `loot_reg` prefix in DB). */
const SHOP_TIER_0_ITEM_KEYS = new Set([
  "rusty_sword",
  "slingshot",
  "apprentice_staff",
  "tin_helm",
  "worn_chestpiece",
  "leather_gloves",
  "traveler_boots",
]);

/**
 * Highest region index (0 = Town Outskirts …) the hero is "meant" for by level,
 * matching `region.minLevel` ordering ascending.
 */
export function recommendedShopTier(level: number, regionsSortedByMinLevel: Pick<Region, "minLevel">[]): number {
  let best = 0;
  for (let i = 0; i < regionsSortedByMinLevel.length; i++) {
    if (level >= regionsSortedByMinLevel[i].minLevel) best = i;
  }
  return best;
}

/** Map seeded regional weapons: `loot_reg{N}_warrior_COMMON` → N */
export function shopEquipmentTierFromKey(itemKey: string): number | null {
  const m = /^loot_reg(\d)_/.exec(itemKey);
  if (m) return Number(m[1]);
  if (SHOP_TIER_0_ITEM_KEYS.has(itemKey)) return 0;
  return null;
}

/** Gold to buy one copy; scales with item value and combat-relevant stats. */
export function shopBuyPriceForItem(item: Item): number {
  const statPower = item.attack * 14 + item.defense * 14 + item.hp * 9 + item.speed * 16;
  const reqGate =
    item.requiredLevel * 3 +
    item.requiredStrength +
    item.requiredConstitution +
    item.requiredIntelligence +
    item.requiredDexterity;
  return Math.max(6, Math.floor(item.value * 1.75 + statPower * 0.85 + reqGate));
}

export function shopPotionBuyPrice(recommendedTier: number): number {
  return POTION_SHOP_PRICE + recommendedTier * 6;
}

export function shopStoneBuyPrice(recommendedTier: number): number {
  return SMITHING_STONE_SHOP_PRICE + recommendedTier * 42;
}

/** All COMMON non-consumable items for this tier (every class / slot — buy still gated server-side). */
export function filterShopEquipmentForTier(items: Item[], tier: number): Item[] {
  return items.filter((item) => {
    if (item.rarity !== "COMMON" || item.slot === "CONSUMABLE") return false;
    const itemTier = shopEquipmentTierFromKey(item.key);
    return itemTier != null && itemTier === tier;
  });
}

export type ShopPlaystyle = "WARRIOR" | "MAGE" | "ROGUE" | "NEUTRAL";

/** Warrior / ranger / mage stock lines from seed keys; starter pieces map to a role; everything else is neutral. */
export function shopPlaystyleFromKey(itemKey: string): ShopPlaystyle {
  const m = /^loot_reg\d_(warrior|ranger|mage)_/.exec(itemKey);
  if (m?.[1] === "warrior") return "WARRIOR";
  if (m?.[1] === "mage") return "MAGE";
  if (m?.[1] === "ranger") return "ROGUE";
  if (itemKey === "rusty_sword") return "WARRIOR";
  if (itemKey === "slingshot") return "ROGUE";
  if (itemKey === "apprentice_staff") return "MAGE";
  return "NEUTRAL";
}

export type ShopStatTag = "STR" | "DEX" | "INT" | "CON";

export function shopStatTagsFromItem(item: Item): ShopStatTag[] {
  const out: ShopStatTag[] = [];
  if (item.requiredStrength > 0) out.push("STR");
  if (item.requiredDexterity > 0) out.push("DEX");
  if (item.requiredIntelligence > 0) out.push("INT");
  if (item.requiredConstitution > 0) out.push("CON");
  return out;
}

/** First reason the character cannot buy (requirements before gold). */
export function shopFirstRequirementBlock(character: Character, item: Item): string | null {
  if (character.level < item.requiredLevel) return `Need Lv ${item.requiredLevel}`;
  if (item.requiredStrength > character.strength) return `Need STR ${item.requiredStrength}`;
  if (item.requiredConstitution > character.constitution) return `Need CON ${item.requiredConstitution}`;
  if (item.requiredIntelligence > character.intelligence) return `Need INT ${item.requiredIntelligence}`;
  if (item.requiredDexterity > character.dexterity) return `Need DEX ${item.requiredDexterity}`;
  return null;
}

export function shopPurchaseBlockReason(character: Character, item: Item, price: number): string | null {
  const req = shopFirstRequirementBlock(character, item);
  if (req) return req;
  if (character.gold < price) return `Need ${price}g (have ${character.gold})`;
  return null;
}

export function sortShopEquipment(a: Item, b: Item): number {
  const ia = EQUIPMENT_SLOTS.indexOf(a.slot);
  const ib = EQUIPMENT_SLOTS.indexOf(b.slot);
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.name.localeCompare(b.name);
}

/** Client `ShopGearList` row (full `item` for tooltips and buy id). */
export type ShopGearClientRow = {
  item: Item;
  price: number;
  purchaseBlock: string | null;
  statLine: string;
  reqLine: string | null;
  playstyle: ShopPlaystyle;
  statTags: ShopStatTag[];
};
