import type { Item } from "@prisma/client";
import { forgedStatsForEntry } from "@/lib/game/item-affixes";
import { isMagicWeapon } from "@/lib/game/weapon-classification";

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
