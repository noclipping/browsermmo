import type { Prisma } from "@prisma/client";

/** Put one or more forged gear units back into the pack (merge by itemId, keep higher forge tier). */
export async function returnGearToInventoryTx(
  tx: Prisma.TransactionClient,
  params: {
    characterId: string;
    itemId: string;
    forgeLevel: number;
    quantity?: number;
    affixPrefix?: string | null;
    bonusLifeSteal?: number;
    bonusCritChance?: number;
    bonusSkillPower?: number;
    bonusStrength?: number;
    bonusConstitution?: number;
    bonusIntelligence?: number;
    bonusDexterity?: number;
  },
): Promise<void> {
  const qty = params.quantity ?? 1;
  const row = await tx.inventoryItem.findUnique({
    where: { characterId_itemId: { characterId: params.characterId, itemId: params.itemId } },
  });
  if (!row) {
    await tx.inventoryItem.create({
      data: {
        characterId: params.characterId,
        itemId: params.itemId,
        quantity: qty,
        forgeLevel: params.forgeLevel,
        affixPrefix: params.affixPrefix ?? null,
        bonusLifeSteal: params.bonusLifeSteal ?? 0,
        bonusCritChance: params.bonusCritChance ?? 0,
        bonusSkillPower: params.bonusSkillPower ?? 0,
        bonusStrength: params.bonusStrength ?? 0,
        bonusConstitution: params.bonusConstitution ?? 0,
        bonusIntelligence: params.bonusIntelligence ?? 0,
        bonusDexterity: params.bonusDexterity ?? 0,
      },
    });
    return;
  }
  await tx.inventoryItem.update({
    where: { id: row.id },
    data: {
      quantity: { increment: qty },
      forgeLevel: Math.max(row.forgeLevel, params.forgeLevel),
      affixPrefix: row.affixPrefix ?? params.affixPrefix ?? null,
      bonusLifeSteal: Math.max(row.bonusLifeSteal, params.bonusLifeSteal ?? 0),
      bonusCritChance: Math.max(row.bonusCritChance, params.bonusCritChance ?? 0),
      bonusSkillPower: Math.max(row.bonusSkillPower, params.bonusSkillPower ?? 0),
      bonusStrength: Math.max(row.bonusStrength, params.bonusStrength ?? 0),
      bonusConstitution: Math.max(row.bonusConstitution, params.bonusConstitution ?? 0),
      bonusIntelligence: Math.max(row.bonusIntelligence, params.bonusIntelligence ?? 0),
      bonusDexterity: Math.max(row.bonusDexterity, params.bonusDexterity ?? 0),
    },
  });
}
