import type { Prisma } from "@prisma/client";

const stackSelect = {
  itemId: true,
  forgeLevel: true,
  affixPrefix: true,
  bonusLifeSteal: true,
  bonusCritChance: true,
  bonusSkillPower: true,
  bonusStrength: true,
  bonusConstitution: true,
  bonusIntelligence: true,
  bonusDexterity: true,
} as const;

export async function moveInventoryStackToTreasury(
  tx: Prisma.TransactionClient,
  params: { guildId: string; inventoryItemId: string; characterId: string; quantity?: number },
): Promise<number> {
  const row = await tx.inventoryItem.findFirst({
    where: { id: params.inventoryItemId, characterId: params.characterId },
    select: { id: true, quantity: true, ...stackSelect },
  });
  if (!row) throw new Error("inventory_not_found");
  const take = Math.min(params.quantity ?? row.quantity, row.quantity);
  if (take < 1) throw new Error("nothing_to_move");

  const affixPrefix = row.affixPrefix ?? null;
  const bonusLifeSteal = row.bonusLifeSteal ?? 0;
  const bonusCritChance = row.bonusCritChance ?? 0;
  const bonusSkillPower = row.bonusSkillPower ?? 0;
  const bonusStrength = row.bonusStrength ?? 0;
  const bonusConstitution = row.bonusConstitution ?? 0;
  const bonusIntelligence = row.bonusIntelligence ?? 0;
  const bonusDexterity = row.bonusDexterity ?? 0;

  const existing = await tx.guildTreasuryItem.findFirst({
    where: {
      guildId: params.guildId,
      itemId: row.itemId,
      forgeLevel: row.forgeLevel,
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

  if (take === row.quantity) {
    await tx.inventoryItem.delete({ where: { id: row.id } });
  } else {
    await tx.inventoryItem.update({
      where: { id: row.id },
      data: { quantity: { decrement: take } },
    });
  }

  if (existing) {
    await tx.guildTreasuryItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: take } },
    });
  } else {
    await tx.guildTreasuryItem.create({
      data: {
        guildId: params.guildId,
        itemId: row.itemId,
        quantity: take,
        forgeLevel: row.forgeLevel,
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
  }

  return take;
}

export async function moveTreasuryStackToInventory(
  tx: Prisma.TransactionClient,
  params: { guildId: string; treasuryItemId: string; characterId: string; quantity?: number },
): Promise<void> {
  const row = await tx.guildTreasuryItem.findFirst({
    where: { id: params.treasuryItemId, guildId: params.guildId },
    select: { id: true, quantity: true, ...stackSelect },
  });
  if (!row) throw new Error("treasury_not_found");
  const take = Math.min(params.quantity ?? row.quantity, row.quantity);
  if (take < 1) throw new Error("nothing_to_move");

  const affixPrefix = row.affixPrefix ?? null;
  const bonusLifeSteal = row.bonusLifeSteal ?? 0;
  const bonusCritChance = row.bonusCritChance ?? 0;
  const bonusSkillPower = row.bonusSkillPower ?? 0;
  const bonusStrength = row.bonusStrength ?? 0;
  const bonusConstitution = row.bonusConstitution ?? 0;
  const bonusIntelligence = row.bonusIntelligence ?? 0;
  const bonusDexterity = row.bonusDexterity ?? 0;

  const inv = await tx.inventoryItem.findFirst({
    where: {
      characterId: params.characterId,
      itemId: row.itemId,
      forgeLevel: row.forgeLevel,
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

  if (take === row.quantity) {
    await tx.guildTreasuryItem.delete({ where: { id: row.id } });
  } else {
    await tx.guildTreasuryItem.update({
      where: { id: row.id },
      data: { quantity: { decrement: take } },
    });
  }

  if (inv) {
    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: { quantity: { increment: take } },
    });
  } else {
    await tx.inventoryItem.create({
      data: {
        characterId: params.characterId,
        itemId: row.itemId,
        quantity: take,
        forgeLevel: row.forgeLevel,
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
  }
}
