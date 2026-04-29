"use server";

import { ItemSlot, RogueSkill } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import {
  CLASS_BASE_STATS,
  CLASS_STARTING_ATTRIBUTES,
  CON_HP_PER_POINT,
  FORGE_MAX_BY_RARITY,
  FORGE_UPGRADE_GOLD_COST,
  HEALTH_POTION_ITEM_KEY,
  MAX_POTIONS_IN_PACK,
  SMITHING_STONE_ITEM_KEY,
  STAT_POINTS_ON_CREATE,
  TOWN_REST_COOLDOWN_MS,
} from "@/lib/game/constants";
import { returnGearToInventoryTx } from "@/lib/game/inventory-gear";
import { addItemQuantityCapped } from "@/lib/game/inventory-potions";
import { characterMeetsItemLevelAndStats, characterMeetsItemStatRequirements } from "@/lib/game/item-requirements";
import {
  recommendedShopTier,
  shopBuyPriceForItem,
  shopEquipmentTierFromKey,
  shopPotionBuyPrice,
  shopStoneBuyPrice,
} from "@/lib/game/shop";
import type { ShopTransactionResult } from "@/lib/game/shop-transaction";
import { potionHealAmount } from "@/lib/game/combat-turn";
import {
  executeAdventureStart,
  executeAdventureEventChoice,
  type AdventureEventChoice,
  type AdventureEventKind,
  type AdventureStartSuccessBody,
} from "@/lib/game/adventure-start-execute";
import { executeCombatAction, type CombatActionSuccessBody } from "@/lib/game/combat-action-execute";
import { executeCombatFlee } from "@/lib/game/combat-flee-execute";
import { rollOutskirtsBossInterval } from "@/lib/game/outskirts-boss";
import { setOutskirtsBossCountersSql } from "@/lib/game/outskirts-sql";
import { prisma } from "@/lib/prisma";

const regionSchema = z.object({ regionId: z.string().min(1) });

const allocateStatSchema = z.object({
  stat: z.enum(["STRENGTH", "CONSTITUTION", "INTELLIGENCE", "DEXTERITY"]),
});

const rogueSkillSchema = z.object({
  skill: z.enum(["VOLLEY", "DAGGER_STORM", "SHADOW"]),
});

/** Spend one stat point on STR / CON / INT / DEX (CON also bumps current and max HP). */
export async function allocateStatAction(formData: FormData) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = allocateStatSchema.safeParse({ stat: formData.get("stat") });
  if (!parsed.success) return;
  if (character.statPoints < 1) return;

  const key = parsed.data.stat;
  const statField =
    key === "STRENGTH"
      ? "strength"
      : key === "CONSTITUTION"
        ? "constitution"
        : key === "INTELLIGENCE"
          ? "intelligence"
          : "dexterity";

  await prisma.character.update({
    where: { id: character.id },
    data: {
      [statField]: { increment: 1 },
      statPoints: { decrement: 1 },
      ...(key === "CONSTITUTION"
        ? { hp: { increment: CON_HP_PER_POINT }, maxHp: { increment: CON_HP_PER_POINT } }
        : {}),
    },
  });
  revalidatePath("/town", "layout");
}

/** Character-only: switch active rogue combat skill loadout. */
export async function updateRogueSkillAction(formData: FormData) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  if (character.class !== "ROGUE") return;
  const parsed = rogueSkillSchema.safeParse({ skill: formData.get("skill") });
  if (!parsed.success) return;
  const skill = parsed.data.skill as RogueSkill;
  await prisma.character.update({
    where: { id: character.id },
    data: { rogueSkill: skill },
  });
  revalidatePath("/character", "page");
  revalidatePath("/town", "layout");
  revalidatePath("/adventure", "page");
}

export async function changeRegionAction(formData: FormData) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = regionSchema.safeParse({ regionId: formData.get("regionId") });
  if (!parsed.success) return;

  const inCombat = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (inCombat) return;

  const region = await prisma.region.findUnique({ where: { id: parsed.data.regionId } });
  if (!region) return;
  const allRegions = await prisma.region.findMany({ orderBy: { minLevel: "asc" } });
  const targetIndex = allRegions.findIndex((r) => r.id === region.id);
  if (targetIndex < 0) return;
  // Stable unlock window: starts with first 2 regions unlocked, expands by level.
  const unlockedCount = character.level >= 8 ? 4 : character.level >= 4 ? 3 : 2;
  const allowedByWindow = targetIndex < unlockedCount;
  if (!(character.level >= region.minLevel || allowedByWindow)) return;
  await prisma.character.update({
    where: { id: character.id },
    data: { region: { connect: { id: parsed.data.regionId } } },
  });
  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
}

/** Leave the wilds: set region to town and open the hub (blocked during active combat). */
export async function returnToTownAction() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const inCombat = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (inCombat) return;

  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town) return;

  await prisma.character.update({
    where: { id: character.id },
    data: { region: { connect: { id: town.id } } },
  });
  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
  redirect("/town");
}

/** Leave the wilds and open the market in one step (blocked during active combat). */
export async function returnToTownAndShopAction() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const inCombat = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (inCombat) return;

  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town) return;

  await prisma.character.update({
    where: { id: character.id },
    data: { region: { connect: { id: town.id } } },
  });
  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
  redirect("/shop");
}

/** Form / `useActionState` result for the adventure roll (works when client click handlers never fire). */
export type AdventureRollFormState =
  | { ok: true; rolledAt: number; payload: AdventureStartSuccessBody }
  | { ok: false; rolledAt: number; error: string };

export type AdventureEventChoiceFormState =
  | { ok: true; rolledAt: number; payload: AdventureStartSuccessBody }
  | { ok: false; rolledAt: number; error: string };

const adventureEventChoiceSchema = z.object({
  kind: z.enum(["POTION", "GOLD", "XP"]),
  choice: z.enum(["SAFE", "RISK"]),
});

export async function startAdventureRollAction(
  _prevState: AdventureRollFormState | null,
  _formData: FormData,
): Promise<AdventureRollFormState> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const result = await executeAdventureStart(character);
  const rolledAt = Date.now();
  if (!result.ok) {
    return { ok: false, rolledAt, error: result.error };
  }
  return { ok: true, rolledAt, payload: result.body };
}

export async function resolveAdventureEventChoiceAction(
  _prevState: AdventureEventChoiceFormState | null,
  formData: FormData,
): Promise<AdventureEventChoiceFormState> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = adventureEventChoiceSchema.safeParse({
    kind: formData.get("kind"),
    choice: formData.get("choice"),
  });
  const rolledAt = Date.now();
  if (!parsed.success) return { ok: false, rolledAt, error: "Invalid event choice." };
  const result = await executeAdventureEventChoice({
    character,
    kind: parsed.data.kind as AdventureEventKind,
    choice: parsed.data.choice as AdventureEventChoice,
  });
  if (!result.ok) return { ok: false, rolledAt, error: result.error };
  return { ok: true, rolledAt, payload: result.body };
}

export type CombatTurnFormState =
  | {
    ok: true;
    rolledAt: number;
    action: "ATTACK" | "DEFEND" | "POTION" | "SKILL" | "AUTO";
    payload: CombatActionSuccessBody;
  }
  | { ok: false; rolledAt: number; error: string };

export type CombatFleeFormState = { ok: true; rolledAt: number } | { ok: false; rolledAt: number; error: string };

const combatTurnSchema = z.object({
  encounterId: z.string().min(1),
  action: z.enum(["ATTACK", "DEFEND", "POTION", "SKILL", "AUTO"]),
});

export async function combatTurnAction(
  _prevState: CombatTurnFormState | null,
  formData: FormData,
): Promise<CombatTurnFormState> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = combatTurnSchema.safeParse({
    encounterId: formData.get("encounterId"),
    action: formData.get("action"),
  });
  const rolledAt = Date.now();
  if (!parsed.success) return { ok: false, rolledAt, error: "Invalid combat action." };
  const result = await executeCombatAction(character, parsed.data);
  if (!result.ok) return { ok: false, rolledAt, error: result.error };
  return { ok: true, rolledAt, action: parsed.data.action, payload: result.body };
}

const combatFleeSchema = z.object({ encounterId: z.string().min(1) });

export async function fleeCombatAction(
  _prevState: CombatFleeFormState | null,
  formData: FormData,
): Promise<CombatFleeFormState> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = combatFleeSchema.safeParse({ encounterId: formData.get("encounterId") });
  const rolledAt = Date.now();
  if (!parsed.success) return { ok: false, rolledAt, error: "Invalid flee request." };
  const result = await executeCombatFlee(character, parsed.data.encounterId);
  if (!result.ok) return { ok: false, rolledAt, error: result.error };
  return { ok: true, rolledAt };
}

const buyShopEquipmentSchema = z.object({ itemId: z.string().min(1) });

/** Town market: buy one COMMON equipment piece; stock and prices follow recommended zone tier and item power. */
export async function buyShopEquipmentAction(formData: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || character.regionId !== town.id) return { ok: false };
  if (!(await assertNoActiveCombat(character.id))) return { ok: false };

  const parsed = buyShopEquipmentSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return { ok: false };

  const regions = await prisma.region.findMany({ orderBy: { minLevel: "asc" } });
  const tier = recommendedShopTier(character.level, regions);

  const item = await prisma.item.findUnique({ where: { id: parsed.data.itemId } });
  if (!item || item.rarity !== "COMMON" || item.slot === "CONSUMABLE") return { ok: false };
  const itemTier = shopEquipmentTierFromKey(item.key);
  if (itemTier == null || itemTier !== tier) return { ok: false };
  if (!characterMeetsItemLevelAndStats(character, item)) return { ok: false };

  const price = shopBuyPriceForItem(item);
  if (character.gold < price) return { ok: false };

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { decrement: price } },
    });
    await addItemQuantityCapped(tx, {
      characterId: character.id,
      itemId: item.id,
      itemKey: item.key,
      delta: 1,
    });
  });

  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
  return { ok: true, delta: -price };
}

const equipSchema = z.object({ inventoryEntryId: z.string().min(1) });

async function assertNoActiveCombat(characterId: string) {
  const active = await prisma.soloCombatEncounter.findFirst({
    where: { characterId, status: "ACTIVE" },
    select: { id: true },
  });
  return !active;
}

export async function equipItemAction(formData: FormData) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = equipSchema.safeParse({ inventoryEntryId: formData.get("inventoryEntryId") });
  if (!parsed.success) return;
  if (!(await assertNoActiveCombat(character.id))) return;

  const inventoryItem = await prisma.inventoryItem.findFirst({
    where: { id: parsed.data.inventoryEntryId, characterId: character.id },
    include: { item: true },
  });
  if (!inventoryItem) return;
  if (inventoryItem.item.slot === "CONSUMABLE") return;
  if (character.level < inventoryItem.item.requiredLevel) return;
  if (!characterMeetsItemStatRequirements(character, inventoryItem.item)) return;

  const slot = inventoryItem.item.slot as ItemSlot;
  const existing = await prisma.characterEquipment.findUnique({
    where: { characterId_slot: { characterId: character.id, slot } },
  });
  const samePiece = existing?.itemId === inventoryItem.itemId;

  await prisma.$transaction(async (tx) => {
    const invItem = await tx.inventoryItem.findUnique({
      where: { id: parsed.data.inventoryEntryId },
      include: { item: true },
    });
    if (!invItem || invItem.characterId !== character.id || invItem.item.slot === "CONSUMABLE") return;

    const slotRow = await tx.characterEquipment.findUnique({
      where: { characterId_slot: { characterId: character.id, slot: invItem.item.slot as ItemSlot } },
    });

    if (slotRow?.itemId && slotRow.itemId !== invItem.itemId) {
      await returnGearToInventoryTx(tx, {
        characterId: character.id,
        itemId: slotRow.itemId,
        forgeLevel: slotRow.forgeLevel ?? 0,
        quantity: 1,
        affixPrefix: slotRow.affixPrefix,
        bonusLifeSteal: slotRow.bonusLifeSteal,
        bonusCritChance: slotRow.bonusCritChance,
        bonusSkillPower: slotRow.bonusSkillPower,
        bonusStrength: slotRow.bonusStrength,
        bonusConstitution: slotRow.bonusConstitution,
        bonusIntelligence: slotRow.bonusIntelligence,
        bonusDexterity: slotRow.bonusDexterity,
      });
    }

    if (!samePiece) {
      if (invItem.quantity <= 1) {
        await tx.inventoryItem.delete({ where: { id: invItem.id } });
      } else {
        await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: 1 } },
        });
      }
    }

    await tx.characterEquipment.update({
      where: { characterId_slot: { characterId: character.id, slot: invItem.item.slot as ItemSlot } },
      data: {
        itemId: invItem.itemId,
        forgeLevel: samePiece ? (slotRow?.forgeLevel ?? 0) : invItem.forgeLevel,
        affixPrefix: samePiece ? (slotRow?.affixPrefix ?? null) : (invItem.affixPrefix ?? null),
        bonusLifeSteal: samePiece ? (slotRow?.bonusLifeSteal ?? 0) : (invItem.bonusLifeSteal ?? 0),
        bonusCritChance: samePiece ? (slotRow?.bonusCritChance ?? 0) : (invItem.bonusCritChance ?? 0),
        bonusSkillPower: samePiece ? (slotRow?.bonusSkillPower ?? 0) : (invItem.bonusSkillPower ?? 0),
        bonusStrength: samePiece ? (slotRow?.bonusStrength ?? 0) : (invItem.bonusStrength ?? 0),
        bonusConstitution: samePiece ? (slotRow?.bonusConstitution ?? 0) : (invItem.bonusConstitution ?? 0),
        bonusIntelligence: samePiece ? (slotRow?.bonusIntelligence ?? 0) : (invItem.bonusIntelligence ?? 0),
        bonusDexterity: samePiece ? (slotRow?.bonusDexterity ?? 0) : (invItem.bonusDexterity ?? 0),
      },
    });
  });

  revalidatePath("/town", "layout");
}

const unequipSchema = z.object({ slot: z.enum(["WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"]) });

/** Remove worn piece and return it to the pack with its smithing tier (only when not in active combat). */
export async function unequipSlotAction(formData: FormData) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = unequipSchema.safeParse({ slot: formData.get("slot") });
  if (!parsed.success) return;
  if (!(await assertNoActiveCombat(character.id))) return;

  const worn = await prisma.characterEquipment.findUnique({
    where: { characterId_slot: { characterId: character.id, slot: parsed.data.slot } },
  });
  if (!worn) return;
  const unequipItemId = worn.itemId;
  if (!unequipItemId) return;

  await prisma.$transaction(async (tx) => {
    await returnGearToInventoryTx(tx, {
      characterId: character.id,
      itemId: unequipItemId,
      forgeLevel: worn.forgeLevel ?? 0,
      quantity: 1,
      affixPrefix: worn.affixPrefix,
      bonusLifeSteal: worn.bonusLifeSteal,
      bonusCritChance: worn.bonusCritChance,
      bonusSkillPower: worn.bonusSkillPower,
      bonusStrength: worn.bonusStrength,
      bonusConstitution: worn.bonusConstitution,
      bonusIntelligence: worn.bonusIntelligence,
      bonusDexterity: worn.bonusDexterity,
    });
    await tx.characterEquipment.update({
      where: { characterId_slot: { characterId: character.id, slot: parsed.data.slot } },
      data: {
        itemId: null,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    });
  });

  revalidatePath("/town", "layout");
}

const sellSchema = z.object({
  inventoryEntryId: z.string().min(1),
  amount: z.enum(["ONE", "ALL"]).optional(),
});

/** Town shop: sell one or the full stack for sellPrice gold each. Blocked if equipped or in combat. */
export async function sellItemAction(formData: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || character.regionId !== town.id) return { ok: false };
  if (!(await assertNoActiveCombat(character.id))) return { ok: false };

  const parsed = sellSchema.safeParse({ inventoryEntryId: formData.get("inventoryEntryId"), amount: formData.get("amount") });
  if (!parsed.success) return { ok: false };

  const inv = await prisma.inventoryItem.findFirst({
    where: { id: parsed.data.inventoryEntryId, characterId: character.id },
    include: { item: true },
  });
  if (!inv || inv.quantity < 1) return { ok: false };
  if (inv.item.sellPrice < 1) return { ok: false };

  const worn = await prisma.characterEquipment.findFirst({
    where: { characterId: character.id, itemId: inv.itemId },
  });
  if (worn) return { ok: false };

  const sellAll = parsed.data.amount === "ALL";
  const sellQty = sellAll ? inv.quantity : 1;
  const goldGain = inv.item.sellPrice * sellQty;

  await prisma.$transaction(async (tx) => {
    if (sellQty >= inv.quantity) {
      await tx.inventoryItem.delete({ where: { id: inv.id } });
    } else {
      await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { decrement: sellQty } } });
    }
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { increment: goldGain } },
    });
  });

  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
  return { ok: true, delta: goldGain };
}

/** Town-only: buy health potions for gold (quantity from form, defaults to 1). */
export async function buyPotionAction(formData?: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || character.regionId !== town.id) return { ok: false };
  if (!(await assertNoActiveCombat(character.id))) return { ok: false };

  const regions = await prisma.region.findMany({ orderBy: { minLevel: "asc" } });
  const tier = recommendedShopTier(character.level, regions);
  const price = shopPotionBuyPrice(tier);

  if (character.gold < price) return { ok: false };

  const potion = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
  if (!potion) return { ok: false };

  const existingPotions = await prisma.inventoryItem.findFirst({
    where: {
      characterId: character.id,
      itemId: potion.id,
      forgeLevel: 0,
      affixPrefix: null,
      bonusLifeSteal: 0,
      bonusCritChance: 0,
      bonusSkillPower: 0,
      bonusStrength: 0,
      bonusConstitution: 0,
      bonusIntelligence: 0,
      bonusDexterity: 0,
    },
  });
  const currentPotions = existingPotions?.quantity ?? 0;
  if (currentPotions >= MAX_POTIONS_IN_PACK) return { ok: false };
  const requestedRaw = Number(formData?.get("quantity") ?? 1);
  const requested = Number.isFinite(requestedRaw) ? Math.floor(requestedRaw) : 1;
  if (requested < 1) return { ok: false };
  const room = Math.max(0, MAX_POTIONS_IN_PACK - currentPotions);
  const affordable = Math.floor(character.gold / price);
  const quantity = Math.min(requested, room, affordable);
  if (quantity < 1) return { ok: false };
  const totalPrice = price * quantity;

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { decrement: totalPrice } },
    });
    await addItemQuantityCapped(tx, {
      characterId: character.id,
      itemId: potion.id,
      itemKey: potion.key,
      delta: quantity,
    });
  });

  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
  return { ok: true, delta: -totalPrice };
}

/** Out-of-combat: consume one tonic from pack to heal immediately. */
export async function consumeTonicOutsideCombatAction() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  if (!(await assertNoActiveCombat(character.id))) return;
  if (character.hp >= character.maxHp) return;

  const potion = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
  if (!potion) return;
  const inv = await prisma.inventoryItem.findFirst({
    where: {
      characterId: character.id,
      itemId: potion.id,
      forgeLevel: 0,
      affixPrefix: null,
      bonusLifeSteal: 0,
      bonusCritChance: 0,
      bonusSkillPower: 0,
      bonusStrength: 0,
      bonusConstitution: 0,
      bonusIntelligence: 0,
      bonusDexterity: 0,
    },
  });
  if (!inv || inv.quantity < 1) return;

  const heal = potionHealAmount(character.maxHp);
  const nextHp = Math.min(character.maxHp, character.hp + heal);

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { hp: nextHp },
    });
    if (inv.quantity <= 1) {
      await tx.inventoryItem.delete({ where: { id: inv.id } });
    } else {
      await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
    }
  });

  revalidatePath("/town", "layout");
  revalidatePath("/adventure", "page");
  revalidatePath("/character", "page");
}

/** Town-only: buy smithing stones for premium gold cost (quantity from form, defaults to 1). */
export async function buySmithingStoneAction(formData?: FormData): Promise<ShopTransactionResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || character.regionId !== town.id) return { ok: false };
  if (!(await assertNoActiveCombat(character.id))) return { ok: false };

  const regions = await prisma.region.findMany({ orderBy: { minLevel: "asc" } });
  const tier = recommendedShopTier(character.level, regions);
  const price = shopStoneBuyPrice(tier);

  if (character.gold < price) return { ok: false };
  const requestedRaw = Number(formData?.get("quantity") ?? 1);
  const requested = Number.isFinite(requestedRaw) ? Math.floor(requestedRaw) : 1;
  if (requested < 1) return { ok: false };
  const affordable = Math.floor(character.gold / price);
  const quantity = Math.min(requested, affordable);
  if (quantity < 1) return { ok: false };
  const totalPrice = price * quantity;

  const stone = await prisma.item.findUnique({ where: { key: SMITHING_STONE_ITEM_KEY } });
  if (!stone) return { ok: false };

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { decrement: totalPrice } },
    });
    await addItemQuantityCapped(tx, {
      characterId: character.id,
      itemId: stone.id,
      itemKey: stone.key,
      delta: quantity,
    });
  });

  revalidatePath("/town", "layout");
  revalidatePath("/shop", "layout");
  revalidatePath("/forge", "layout");
  return { ok: true, delta: -totalPrice };
}

/** Town-only: free full heal at campfire, on a cooldown between uses. */
export async function restAtCampfireAction() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || character.regionId !== town.id) return;
  if (character.hp >= character.maxHp) return;

  const active = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (active) return;

  const now = Date.now();
  if (character.lastFreeRestAt) {
    const elapsed = now - character.lastFreeRestAt.getTime();
    if (elapsed < TOWN_REST_COOLDOWN_MS) return;
  }

  await prisma.character.update({
    where: { id: character.id },
    data: { hp: character.maxHp, lastFreeRestAt: new Date(now) },
  });
  revalidatePath("/town", "layout");
}

const forgeSchema = z.object({
  slot: z.enum(["WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"]),
});

/** Town-only forge: spend one smithing stone + gold to reinforce your currently equipped slot. */
export async function forgeUpgradeAction(formData: FormData) {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = forgeSchema.safeParse({ slot: formData.get("slot") });
  if (!parsed.success) return;

  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town || character.regionId !== town.id) return;
  if (character.gold < FORGE_UPGRADE_GOLD_COST) return;

  const stone = await prisma.item.findUnique({ where: { key: SMITHING_STONE_ITEM_KEY } });
  if (!stone) return;

  const [equip, stoneInv] = await Promise.all([
    prisma.characterEquipment.findUnique({
      where: { characterId_slot: { characterId: character.id, slot: parsed.data.slot } },
      include: { item: true },
    }),
    prisma.inventoryItem.findFirst({
      where: {
        characterId: character.id,
        itemId: stone.id,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    }),
  ]);
  if (!equip?.item) return;
  const maxForge = FORGE_MAX_BY_RARITY[equip.item.rarity];
  const currentForge = equip.forgeLevel ?? 0;
  if (currentForge >= maxForge) return;
  const stonesRequired = currentForge + 1;
  if (!stoneInv || stoneInv.quantity < stonesRequired) return;

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { decrement: FORGE_UPGRADE_GOLD_COST } },
    });
    await tx.characterEquipment.update({
      where: { characterId_slot: { characterId: character.id, slot: parsed.data.slot } },
      data: { forgeLevel: { increment: 1 } },
    });
    if (stoneInv.quantity === stonesRequired) {
      await tx.inventoryItem.delete({ where: { id: stoneInv.id } });
    } else {
      await tx.inventoryItem.update({ where: { id: stoneInv.id }, data: { quantity: { decrement: stonesRequired } } });
    }
  });

  revalidatePath("/town", "layout");
  revalidatePath("/forge", "layout");
}

/** Debug: reset character to level 1, base class stats, town, starter gold, empty pack except 4 tonics, no gear, no active combat. */
export async function debugResetCharacterAction() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  if (!town) return;

  const stats = CLASS_BASE_STATS[character.class];
  const attrs = CLASS_STARTING_ATTRIBUTES[character.class];
  const potion = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });

  await prisma.$transaction(async (tx) => {
    await tx.soloCombatEncounter.deleteMany({ where: { characterId: character.id } });
    await tx.inventoryItem.deleteMany({ where: { characterId: character.id } });
    await tx.characterEquipment.updateMany({
      where: { characterId: character.id },
      data: {
        itemId: null,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    });
    await tx.character.update({
      where: { id: character.id },
      data: {
        level: 1,
        xp: 0,
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        critChance: stats.critChance,
        ...attrs,
        statPoints: STAT_POINTS_ON_CREATE,
        gold: 25,
        region: { connect: { id: town.id } },
        lastFreeRestAt: null,
      },
    });
    await setOutskirtsBossCountersSql(tx, character.id, 0, rollOutskirtsBossInterval());
    if (potion) {
      await tx.inventoryItem.create({ data: { characterId: character.id, itemId: potion.id, quantity: 3 } });
    }
  });

  revalidatePath("/town", "layout");
  redirect("/town");
}
