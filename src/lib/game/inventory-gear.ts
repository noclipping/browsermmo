import type { Prisma } from "@prisma/client";

/** Put one or more forged gear units back into the pack (merge only identical rolled stacks). */
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
  const affixPrefix = params.affixPrefix ?? null;
  const bonusLifeSteal = params.bonusLifeSteal ?? 0;
  const bonusCritChance = params.bonusCritChance ?? 0;
  const bonusSkillPower = params.bonusSkillPower ?? 0;
  const bonusStrength = params.bonusStrength ?? 0;
  const bonusConstitution = params.bonusConstitution ?? 0;
  const bonusIntelligence = params.bonusIntelligence ?? 0;
  const bonusDexterity = params.bonusDexterity ?? 0;

  const row = await tx.inventoryItem.findFirst({
    where: {
      characterId: params.characterId,
      itemId: params.itemId,
      forgeLevel: params.forgeLevel,
      affixPrefix,
      bonusLifeSteal,
      bonusCritChance,
      bonusSkillPower,
      bonusStrength,
      bonusConstitution,
      bonusIntelligence,
      bonusDexterity,
    },
  });
  if (!row) {
    await tx.inventoryItem.create({
      data: {
        characterId: params.characterId,
        itemId: params.itemId,
        quantity: qty,
        forgeLevel: params.forgeLevel,
        affixPrefix,
        bonusLifeSteal,
        bonusCritChance,
        bonusSkillPower,
        bonusStrength,
        bonusConstitution,
        bonusIntelligence,
        bonusDexterity,
      },
    });
    return;
  }
  await tx.inventoryItem.update({
    where: { id: row.id },
    data: {
      quantity: { increment: qty },
    },
  });
}
