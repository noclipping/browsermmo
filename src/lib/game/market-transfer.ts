import type { Item } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { addItemQuantityCapped } from "@/lib/game/inventory-potions";
import { returnGearToInventoryTx } from "@/lib/game/inventory-gear";

export type MarketListingSnapshot = {
  itemId: string;
  quantity: number;
  forgeLevel: number;
  affixPrefix: string | null;
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusDefensePercent: number;
  bonusConstitutionPercent: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
};

/** Grant a listed stack to a character (buy flow or cancel restoring seller stock). */
export async function grantMarketStackToCharacterTx(
  tx: Prisma.TransactionClient,
  params: {
    characterId: string;
    item: Pick<Item, "id" | "key" | "slot">;
    snapshot: MarketListingSnapshot;
  },
): Promise<void> {
  const { characterId, item, snapshot } = params;
  const qty = Math.max(1, Math.floor(snapshot.quantity));

  if (item.slot === "CONSUMABLE") {
    await addItemQuantityCapped(tx, {
      characterId,
      itemId: item.id,
      itemKey: item.key,
      delta: qty,
    });
    return;
  }

  await returnGearToInventoryTx(tx, {
    characterId,
    itemId: snapshot.itemId,
    forgeLevel: snapshot.forgeLevel,
    quantity: qty,
    affixPrefix: snapshot.affixPrefix,
    bonusLifeSteal: snapshot.bonusLifeSteal,
    bonusCritChance: snapshot.bonusCritChance,
    bonusSkillPower: snapshot.bonusSkillPower,
    bonusDefensePercent: snapshot.bonusDefensePercent,
    bonusConstitutionPercent: snapshot.bonusConstitutionPercent,
    bonusStrength: snapshot.bonusStrength,
    bonusConstitution: snapshot.bonusConstitution,
    bonusIntelligence: snapshot.bonusIntelligence,
    bonusDexterity: snapshot.bonusDexterity,
  });
}
