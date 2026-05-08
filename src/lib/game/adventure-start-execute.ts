import { revalidatePath } from "next/cache";
import type { Character } from "@prisma/client";
import {
  ADVENTURE_REGIONS,
  combatIntroLine,
  regionFlavorLine,
  rollAdventureKind,
  rollCombatEnemyKey,
  rollGoldAmount,
  rollXpAmount,
} from "@/lib/game/adventure";
import {
  HEALTH_POTION_ITEM_KEY,
  LEVEL_UP_ATTACK,
  LEVEL_UP_DEFENSE,
  LEVEL_UP_MAX_HP,
  MAX_POTIONS_IN_PACK,
  STAT_POINTS_PER_LEVEL,
} from "@/lib/game/constants";
import { addItemQuantityCapped } from "@/lib/game/inventory-potions";
import { readOutskirtsBossState } from "@/lib/game/outskirts-sql";
import { applyXp, scaleXpGain } from "@/lib/game/progression";
import { addLifetimeGoldEarnedTx } from "@/lib/game/milestone-achievements";
import { createSoloEncounter, toStartResponse } from "@/lib/game/start-encounter";
import { prisma } from "@/lib/prisma";

export type AdventureEventKind = "POTION" | "GOLD" | "XP";
export type AdventureEventChoice = "SAFE" | "RISK";
export type AdventureEventPayload = {
  kind: AdventureEventKind;
  title: string;
  prompt: string;
  safeLabel: string;
  riskLabel: string;
};

/** Serializable success bodies (same shapes as `/api/adventure/start` JSON). */
export type AdventureStartSuccessBody =
  | ({ outcome: "COMBAT" } & Record<string, unknown>)
  | { outcome: "EVENT"; event: AdventureEventPayload; log: string[] }
  | { outcome: "QUICK_GOLD"; amount: number; log: string[] }
  | { outcome: "QUICK_POTION"; log: string[] }
  | { outcome: "QUICK_XP"; amount: number; leveled: boolean; newLevel?: number; log: string[] };

export type AdventureStartExecuteResult =
  | { ok: true; body: AdventureStartSuccessBody }
  | { ok: false; error: string; httpStatus: number };

function levelRewards(levelsGained: number) {
  return {
    maxHp: levelsGained * LEVEL_UP_MAX_HP,
    attack: levelsGained * LEVEL_UP_ATTACK,
    defense: levelsGained * LEVEL_UP_DEFENSE,
    statPoints: levelsGained * STAT_POINTS_PER_LEVEL,
  };
}

async function applyOutOfCombatXp(character: Character, amount: number) {
  const progressed = applyXp(character.level, character.xp, amount);
  const levelsGained = progressed.level - character.level;
  const rewards = levelRewards(levelsGained);
  await prisma.character.update({
    where: { id: character.id },
    data: {
      xp: progressed.xp,
      level: progressed.level,
      ...(levelsGained > 0
        ? {
            maxHp: { increment: rewards.maxHp },
            hp: { increment: rewards.maxHp },
            attack: { increment: rewards.attack },
            defense: { increment: rewards.defense },
            statPoints: { increment: rewards.statPoints },
          }
        : {}),
    },
  });
  return { leveled: levelsGained > 0, newLevel: progressed.level };
}

function eventPayloadFor(kind: AdventureEventKind): AdventureEventPayload {
  if (kind === "POTION") {
    return {
      kind,
      title: "Unsteady Rock",
      prompt: "A loose rock teeters over a glinting crevice.",
      safeLabel: "Give the crevice a wide berth",
      riskLabel: "Wedge the rock and reach inside",
    };
  }
  if (kind === "GOLD") {
    return {
      kind,
      title: "Locked Cache",
      prompt: "A weathered lockbox sits half-buried in mud.",
      safeLabel: "Leave the mud to swallow it",
      riskLabel: "Try to spring the latch",
    };
  }
  return {
    kind,
    title: "Old Monument",
    prompt: "A fractured monument hums with dormant runes.",
    safeLabel: "Admire the stones from a distance",
    riskLabel: "Lay a hand on the carved runes",
  };
}

export async function executeAdventureEventChoice(params: {
  character: Character;
  kind: AdventureEventKind;
  choice: AdventureEventChoice;
}): Promise<AdventureStartExecuteResult> {
  const fighting = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: params.character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (fighting) {
    return { ok: false, error: "You have a fight in progress — finish or flee it first.", httpStatus: 409 };
  }

  const region = await prisma.region.findUnique({ where: { id: params.character.regionId } });
  if (!region || !ADVENTURE_REGIONS[region.key]) {
    return { ok: false, error: "This region has no adventure routes yet.", httpStatus: 400 };
  }

  const baseLine = regionFlavorLine(region.key);
  const risk = params.choice === "RISK";
  if (!risk) {
    return {
      ok: true,
      body: {
        outcome: "QUICK_GOLD",
        amount: 0,
        log: [baseLine, "You move on and ignore the scene. Nothing gained, nothing lost."],
      },
    };
  }

  if (params.kind === "POTION") {
    const potion = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
    if (!potion) return { ok: false, error: "Potion item is not configured.", httpStatus: 500 };
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        characterId: params.character.id,
        itemId: potion.id,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusDefensePercent: 0,
        bonusConstitutionPercent: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    });
    const full = (inv?.quantity ?? 0) >= MAX_POTIONS_IN_PACK;
    if (Math.random() < 0.68) {
      if (full) {
        return {
          ok: true,
          body: {
            outcome: "QUICK_GOLD",
            amount: 0,
            log: [baseLine, "You crack open a stash, but your pack is full — no tonic recovered."],
          },
        };
      }
      await prisma.$transaction(async (tx) => {
        await addItemQuantityCapped(tx, {
          characterId: params.character.id,
          itemId: potion.id,
          itemKey: potion.key,
          delta: 2,
        });
      });
      revalidatePath("/town", "layout");
      return {
        ok: true,
        body: {
          outcome: "QUICK_POTION",
          log: [baseLine, "The rock cracks open a stash — you secure 2 Crimson Tonics!"],
        },
      };
    }
    const hpLoss = Math.max(1, Math.floor(params.character.maxHp * 0.12));
    await prisma.character.update({
      where: { id: params.character.id },
      data: { hp: Math.max(1, params.character.hp - hpLoss) },
    });
    revalidatePath("/town", "layout");
    return {
      ok: true,
      body: {
        outcome: "QUICK_GOLD",
        amount: 0,
        log: [baseLine, `The rock slips and crushes your arm — you lose ${hpLoss} HP and find nothing.`],
      },
    };
  }

  if (params.kind === "GOLD") {
    if (Math.random() < 0.62) {
      const amount = rollGoldAmount(region.key) * 2;
      await prisma.$transaction(async (tx) => {
        await tx.character.update({ where: { id: params.character.id }, data: { gold: { increment: amount } } });
        await addLifetimeGoldEarnedTx(tx, params.character.id, amount);
      });
      revalidatePath("/town", "layout");
      return {
        ok: true,
        body: {
          outcome: "QUICK_GOLD",
          amount,
          log: [baseLine, `You force the lockbox and haul out ${amount} gold.`],
        },
      };
    }
    const hpLoss = Math.max(1, Math.floor(params.character.maxHp * 0.1));
    await prisma.character.update({
      where: { id: params.character.id },
      data: { hp: Math.max(1, params.character.hp - hpLoss) },
    });
    revalidatePath("/town", "layout");
    return {
      ok: true,
      body: {
        outcome: "QUICK_GOLD",
        amount: 0,
        log: [baseLine, `A spring trap snaps shut — you lose ${hpLoss} HP and the cache is empty.`],
      },
    };
  }

  if (Math.random() < 0.64) {
    const amount = scaleXpGain(rollXpAmount(region.key) * 2);
    const { leveled, newLevel } = await applyOutOfCombatXp(params.character, amount);
    revalidatePath("/town", "layout");
    return {
      ok: true,
      body: {
        outcome: "QUICK_XP",
        amount,
        leveled,
        newLevel,
        log: [
          baseLine,
          risk
            ? `The rune surge teaches you through pain — +${amount} XP.`
            : `Careful study pays off — +${amount} XP.`,
        ],
      },
    };
  }
  const hpLoss = Math.max(1, Math.floor(params.character.maxHp * 0.14));
  await prisma.character.update({
    where: { id: params.character.id },
    data: { hp: Math.max(1, params.character.hp - hpLoss) },
  });
  revalidatePath("/town", "layout");
  return {
    ok: true,
    body: {
      outcome: "QUICK_XP",
      amount: 0,
      leveled: false,
      log: [baseLine, `Arcane backlash scorches you — lose ${hpLoss} HP, gain no insight.`],
    },
  };
}

/**
 * Core adventure roll used by the REST route and the server action (form submit).
 */
export async function executeAdventureStart(character: Character): Promise<AdventureStartExecuteResult> {
  const fighting = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: character.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (fighting) {
    return { ok: false, error: "You have a fight in progress — finish or flee it first.", httpStatus: 409 };
  }

  const region = await prisma.region.findUnique({ where: { id: character.regionId } });
  if (!region || !ADVENTURE_REGIONS[region.key]) {
    return { ok: false, error: "This region has no adventure routes yet.", httpStatus: 400 };
  }

  const kind = rollAdventureKind(region.key);

  if (kind === "POTION" || kind === "GOLD" || kind === "XP") {
    const event = eventPayloadFor(kind);
    return {
      ok: true,
      body: {
        outcome: "EVENT",
        event,
        log: [regionFlavorLine(region.key), event.prompt],
      },
    };
  }

  let enemyKey: string | null = null;
  if (region.key === "town_outskirts") {
    const { wins, bossAt } = await readOutskirtsBossState(prisma, character.id);
    if (wins >= bossAt) enemyKey = "sewer_fencer";
  }
  if (!enemyKey) enemyKey = rollCombatEnemyKey(region.key);
  if (!enemyKey) {
    return { ok: false, error: "No combat encounters for this region.", httpStatus: 400 };
  }

  const enemy = await prisma.enemy.findUnique({
    where: { key: enemyKey },
    include: { region: true },
  });
  if (!enemy || enemy.region.key !== region.key) {
    return {
      ok: false,
      error: !enemy
        ? `No enemy "${enemyKey}" in the database — run \`npx prisma db seed\`.`
        : `Enemy "${enemyKey}" is tied to ${enemy.region.key}, but you are in ${region.key}. Re-seed enemies or fix region links.`,
      httpStatus: 400,
    };
  }

  const prefix = [regionFlavorLine(region.key), combatIntroLine(enemyKey)];
  const { encounter, enemy: enemyRow, potionCount } = await createSoloEncounter(prisma, {
    character,
    enemy,
    flavorPrefixLines: prefix,
  });
  const encounterLog = encounter.log as string[];

  revalidatePath("/town", "layout");
  revalidatePath("/adventure", "page");

  return {
    ok: true,
    body: {
      outcome: "COMBAT",
      ...toStartResponse(encounter, enemyRow, character, potionCount, encounterLog),
    },
  };
}
