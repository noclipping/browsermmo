import type { Prisma } from "@prisma/client";
import { HEALTH_POTION_ITEM_KEY, MAX_POTIONS_IN_PACK } from "@/lib/game/constants";

/** Add quantity to inventory, capping Crimson Tonic at MAX_POTIONS_IN_PACK. */
export async function addItemQuantityCapped(
  tx: Prisma.TransactionClient,
  params: { characterId: string; itemId: string; itemKey: string; delta: number },
): Promise<void> {
  const { characterId, itemId, itemKey, delta } = params;
  if (delta <= 0) return;

  const baseStackWhere = {
    characterId,
    itemId,
    forgeLevel: 0,
    affixPrefix: null,
    bonusLifeSteal: 0,
    bonusCritChance: 0,
    bonusSkillPower: 0,
    bonusStrength: 0,
    bonusConstitution: 0,
    bonusIntelligence: 0,
    bonusDexterity: 0,
  } as const;

  if (itemKey === HEALTH_POTION_ITEM_KEY) {
    const row = await tx.inventoryItem.findFirst({
      where: baseStackWhere,
    });
    const current = row?.quantity ?? 0;
    const target = Math.min(MAX_POTIONS_IN_PACK, current + delta);
    if (target <= current) return;
    if (row) {
      await tx.inventoryItem.update({ where: { id: row.id }, data: { quantity: target } });
    } else {
      await tx.inventoryItem.create({ data: { ...baseStackWhere, quantity: target } });
    }
    return;
  }

  const row = await tx.inventoryItem.findFirst({
    where: baseStackWhere,
  });
  if (row) {
    await tx.inventoryItem.update({ where: { id: row.id }, data: { quantity: { increment: delta } } });
  } else {
    await tx.inventoryItem.create({ data: { ...baseStackWhere, quantity: delta } });
  }
}
