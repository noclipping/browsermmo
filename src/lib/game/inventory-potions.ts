import type { Prisma } from "@prisma/client";
import { HEALTH_POTION_ITEM_KEY, MAX_POTIONS_IN_PACK } from "@/lib/game/constants";

/** Add quantity to inventory, capping Crimson Tonic at MAX_POTIONS_IN_PACK. */
export async function addItemQuantityCapped(
  tx: Prisma.TransactionClient,
  params: { characterId: string; itemId: string; itemKey: string; delta: number },
): Promise<void> {
  const { characterId, itemId, itemKey, delta } = params;
  if (delta <= 0) return;

  if (itemKey === HEALTH_POTION_ITEM_KEY) {
    const row = await tx.inventoryItem.findUnique({
      where: { characterId_itemId: { characterId, itemId } },
    });
    const current = row?.quantity ?? 0;
    const target = Math.min(MAX_POTIONS_IN_PACK, current + delta);
    if (target <= current) return;
    await tx.inventoryItem.upsert({
      where: { characterId_itemId: { characterId, itemId } },
      update: { quantity: target },
      create: { characterId, itemId, quantity: target },
    });
    return;
  }

    await tx.inventoryItem.upsert({
      where: { characterId_itemId: { characterId, itemId } },
      update: { quantity: { increment: delta } },
      create: { characterId, itemId, quantity: delta, forgeLevel: 0 },
    });
}
