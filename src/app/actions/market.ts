"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import {
  addLifetimeGoldEarnedTx,
  addLifetimeGoldSpentTx,
  reevaluateMilestoneAchievements,
} from "@/lib/game/milestone-achievements";
import { grantMarketStackToCharacterTx, type MarketListingSnapshot } from "@/lib/game/market-transfer";
import type { ShopTransactionResult } from "@/lib/game/shop-transaction";
import { queueAchievementToasts } from "@/lib/achievement-toast-server";
import { prisma } from "@/lib/prisma";

const MIN_PRICE_GOLD = 1;
const MAX_PRICE_GOLD = 1_000_000_000;

async function assertTownOutskirtsNoCombat(characterId: string, regionId: string) {
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || regionId !== town.id) return false;
  const active = await prisma.soloCombatEncounter.findFirst({
    where: { characterId, status: "ACTIVE" },
    select: { id: true },
  });
  return !active;
}

function listingRowToSnapshot(row: {
  itemId: string;
  quantity: number;
  forgeLevel: number;
  affixPrefix: string | null;
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
}): MarketListingSnapshot {
  return {
    itemId: row.itemId,
    quantity: row.quantity,
    forgeLevel: row.forgeLevel,
    affixPrefix: row.affixPrefix,
    bonusLifeSteal: row.bonusLifeSteal,
    bonusCritChance: row.bonusCritChance,
    bonusSkillPower: row.bonusSkillPower,
    bonusStrength: row.bonusStrength,
    bonusConstitution: row.bonusConstitution,
    bonusIntelligence: row.bonusIntelligence,
    bonusDexterity: row.bonusDexterity,
  };
}

const createListingSchema = z.object({
  inventoryEntryId: z.string().min(1),
  priceGold: z.coerce.number().int().min(MIN_PRICE_GOLD).max(MAX_PRICE_GOLD),
  quantity: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).optional(),
  ),
});

/** Escrow unequipped items from your pack at a player-set gold price (Town Outskirts only). */
export async function createMarketListingAction(formData: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  if (!(await assertTownOutskirtsNoCombat(character.id, character.regionId))) return { ok: false };

  const parsed = createListingSchema.safeParse({
    inventoryEntryId: formData.get("inventoryEntryId"),
    priceGold: formData.get("priceGold"),
    quantity: formData.get("quantity") ?? undefined,
  });
  if (!parsed.success) return { ok: false };

  try {
    const keys = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventoryItem.findFirst({
        where: { id: parsed.data.inventoryEntryId, characterId: character.id },
        include: { item: true },
      });
      if (!inv || inv.quantity < 1) throw new Error("no_inv");

      const wantQty = parsed.data.quantity ?? inv.quantity;
      const listQty = Math.min(wantQty, inv.quantity);
      if (listQty < 1) throw new Error("qty");

      await tx.marketListing.create({
        data: {
          sellerCharacterId: character.id,
          itemId: inv.itemId,
          priceGold: parsed.data.priceGold,
          quantity: listQty,
          forgeLevel: inv.forgeLevel,
          affixPrefix: inv.affixPrefix,
          bonusLifeSteal: inv.bonusLifeSteal,
          bonusCritChance: inv.bonusCritChance,
          bonusSkillPower: inv.bonusSkillPower,
          bonusStrength: inv.bonusStrength,
          bonusConstitution: inv.bonusConstitution,
          bonusIntelligence: inv.bonusIntelligence,
          bonusDexterity: inv.bonusDexterity,
        },
      });

      if (listQty >= inv.quantity) {
        await tx.inventoryItem.delete({ where: { id: inv.id } });
      } else {
        await tx.inventoryItem.update({
          where: { id: inv.id },
          data: { quantity: { decrement: listQty } },
        });
      }

      return reevaluateMilestoneAchievements(tx, character.id);
    });
    await queueAchievementToasts(keys);
  } catch {
    return { ok: false };
  }

  revalidatePath("/market");
  revalidatePath("/town", "layout");
  revalidatePath("/character", "page");
  return { ok: true, delta: 0 };
}

const listingIdSchema = z.object({ listingId: z.string().min(1) });

/** Return escrowed items from your active listing back into your pack. */
export async function cancelMarketListingAction(formData: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  if (!(await assertTownOutskirtsNoCombat(character.id, character.regionId))) return { ok: false };

  const parsed = listingIdSchema.safeParse({ listingId: formData.get("listingId") });
  if (!parsed.success) return { ok: false };

  try {
    const keys = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findFirst({
        where: { id: parsed.data.listingId, sellerCharacterId: character.id },
        include: { item: true },
      });
      if (!listing) throw new Error("missing");

      await tx.marketListing.delete({ where: { id: listing.id } });
      await grantMarketStackToCharacterTx(tx, {
        characterId: character.id,
        item: listing.item,
        snapshot: listingRowToSnapshot(listing),
      });
      return reevaluateMilestoneAchievements(tx, character.id);
    });
    await queueAchievementToasts(keys);
  } catch {
    return { ok: false };
  }

  revalidatePath("/market");
  revalidatePath("/town", "layout");
  revalidatePath("/character", "page");
  return { ok: true, delta: 0 };
}

/** Buy another player's listing. Cannot purchase your own listing. */
export async function buyMarketListingAction(formData: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const buyer = await requireCharacter(user.id);
  if (!(await assertTownOutskirtsNoCombat(buyer.id, buyer.regionId))) return { ok: false };

  const parsed = listingIdSchema.safeParse({ listingId: formData.get("listingId") });
  if (!parsed.success) return { ok: false };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: parsed.data.listingId },
        include: { item: true },
      });
      if (!listing) throw new Error("gone");
      if (listing.sellerCharacterId === buyer.id) throw new Error("self");

      const price = listing.priceGold;
      const sellerId = listing.sellerCharacterId;

      const paid = await tx.character.updateMany({
        where: { id: buyer.id, gold: { gte: price } },
        data: { gold: { decrement: price } },
      });
      if (paid.count !== 1) throw new Error("gold");

      const removed = await tx.marketListing.deleteMany({
        where: { id: listing.id, sellerCharacterId: { not: buyer.id } },
      });
      if (removed.count !== 1) throw new Error("race");

      await tx.character.update({
        where: { id: sellerId },
        data: { gold: { increment: price } },
      });

      await addLifetimeGoldSpentTx(tx, buyer.id, price);
      await addLifetimeGoldEarnedTx(tx, sellerId, price);

      await grantMarketStackToCharacterTx(tx, {
        characterId: buyer.id,
        item: listing.item,
        snapshot: listingRowToSnapshot(listing),
      });

      const kBuy = await reevaluateMilestoneAchievements(tx, buyer.id);
      const kSell = await reevaluateMilestoneAchievements(tx, sellerId);
      return { price, keys: [...kBuy, ...kSell] };
    });

    await queueAchievementToasts(outcome.keys);
    revalidatePath("/market");
    revalidatePath("/town", "layout");
    revalidatePath("/character", "page");
    return { ok: true, delta: -outcome.price };
  } catch {
    return { ok: false };
  }
}
