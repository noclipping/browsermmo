import { revalidatePath } from "next/cache";
import type { Character, Prisma } from "@prisma/client";
import { buildVictoryCharacterUpdate, rollDrops, rollGoldReward, xpForOutcome } from "@/lib/game/combat-rewards";
import { applyGuildBonusToCombatXp } from "@/lib/game/guild-progression";
import { getGuildXpForUser } from "@/lib/game/guild-xp";
import { ACHIEVEMENT_KEYS, tryUnlockRatbaneGuildBossTx } from "@/lib/game/achievements";
import { resolveGuildBossEncounterEnd } from "@/lib/game/guild-boss-resolve";
import {
  addCombatRoundMilestoneAgg,
  emptyCombatRoundMilestoneAgg,
  encounterToTurnState,
  nextEnemyStrikeStreak,
  potionHealAmount,
  resolveCombatRound,
  rollEnemyIntent,
  runAutoBattle,
} from "@/lib/game/combat-turn";
import {
  mergeGuildBossFightMilestonesTx,
  mergeSoloCombatFightIntoCharacterTx,
  reevaluateMilestoneAchievements,
} from "@/lib/game/milestone-achievements";
import {
  activeSkillForCharacter,
  HEALTH_POTION_ITEM_KEY,
  LEVEL_UP_ATTACK,
  LEVEL_UP_DEFENSE,
  LEVEL_UP_MAX_HP,
  MAX_POTIONS_PER_BATTLE,
  POTION_COOLDOWN_AFTER_USE_TURNS,
  STAT_POINTS_PER_LEVEL,
} from "@/lib/game/constants";
import { addItemQuantityCapped } from "@/lib/game/inventory-potions";
import { rollAffixesForItem } from "@/lib/game/item-affixes";
import { applyXp } from "@/lib/game/progression";
import { rollOutskirtsBossInterval } from "@/lib/game/outskirts-boss";
import { incrementOutskirtsWinsSql, setOutskirtsBossCountersSql } from "@/lib/game/outskirts-sql";
import { enemyKindFromRow } from "@/lib/game/start-encounter";
import { computeFleeChance } from "@/lib/game/combat-flee-execute";
import {
  buildSoloEncounterUpdateData,
} from "@/lib/game/encounter-domain";
import { logCombatTelemetry } from "@/lib/game/combat-telemetry";
import type { AchievementToastItem } from "@/lib/achievement-toast-types";
import { achievementToastItemsForKeys } from "@/lib/achievement-toast-server";
import { mergeAchievementKeys } from "@/lib/merge-achievement-keys";
import { prisma } from "@/lib/prisma";

type CombatActionKind = "ATTACK" | "DEFEND" | "POTION" | "SKILL" | "AUTO";

export type CombatActionSuccessBody =
  | {
      status: "ACTIVE";
      round: number;
      enemyIntent: string;
      enemyKind: "normal" | "elite" | "miniboss";
      player: { hp: number; maxHp: number };
      enemy: { name: string; emoji: string; level: number; hp: number; maxHp: number };
      log: string[];
      potionCount: number;
      potionCooldownRemaining: number;
      potionMaxCooldown: number;
      skillCooldownRemaining: number;
      skillMaxCooldown: number;
      skillName: string;
      skillEmoji: string;
      playerMana: number;
      playerMaxMana: number;
      fleeChance: number;
    }
  | {
      status: "ENDED";
      outcome: "VICTORY";
      round: number;
      xpGained: number;
      goldGained: number;
      droppedItemIds: string[];
      droppedItems: Array<{
        id: string;
        key: string;
        name: string;
        emoji: string;
        rarity: string;
        slot: string | null;
        description: string;
        attack: number;
        defense: number;
        hp: number;
        speed: number;
        sellPrice: number;
        requiredLevel: number;
        requiredStrength: number;
        requiredConstitution: number;
        requiredIntelligence: number;
        requiredDexterity: number;
      }>;
      leveled: boolean;
      log: string[];
      potionCount: number;
      guildBoss?: { appliedDamage: number; guildDefeated: boolean };
      achievementToasts?: AchievementToastItem[];
    }
  | {
      status: "ENDED";
      outcome: "DEFEAT";
      round: number;
      xpGained: number;
      goldLost: number;
      finalHp: number;
      returnedToTown: boolean;
      log: string[];
      potionCount: number;
      leveled: boolean;
      guildBoss?: { appliedDamage: number; guildDefeated: boolean };
      achievementToasts?: AchievementToastItem[];
    };

export type CombatActionExecuteResult =
  | { ok: true; body: CombatActionSuccessBody }
  | { ok: false; error: string; httpStatus: number };

function asLog(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

async function potionCountForCharacter(characterId: string): Promise<number> {
  const potionItem = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
  if (!potionItem) return 0;
  const inv = await prisma.inventoryItem.findFirst({
    where: {
      characterId,
      itemId: potionItem.id,
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
  return inv?.quantity ?? 0;
}

async function consumeOnePotion(characterId: string, potionItemId: string) {
  const inv = await prisma.inventoryItem.findFirst({
    where: {
      characterId,
      itemId: potionItemId,
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
  if (!inv || inv.quantity < 1) return false;
  if (inv.quantity <= 1) {
    await prisma.inventoryItem.delete({ where: { id: inv.id } });
  } else {
    await prisma.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { decrement: 1 } } });
  }
  return true;
}

async function addDroppedItemTx(
  tx: Prisma.TransactionClient,
  params: { characterId: string; itemId: string; characterClass: Character["class"] },
) {
  const dropped = await tx.item.findUniqueOrThrow({ where: { id: params.itemId } });
  if (dropped.slot === "CONSUMABLE") {
    await addItemQuantityCapped(tx, {
      characterId: params.characterId,
      itemId: params.itemId,
      itemKey: dropped.key,
      delta: 1,
    });
    return;
  }
  const inv = await tx.inventoryItem.findFirst({
    where: {
      characterId: params.characterId,
      itemId: params.itemId,
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
  if (!inv) {
    const rolled = rollAffixesForItem({ item: dropped, characterClass: params.characterClass });
    await tx.inventoryItem.create({
      data: {
        characterId: params.characterId,
        itemId: params.itemId,
        quantity: 1,
        forgeLevel: 0,
        ...rolled,
      },
    });
    return;
  }
  await tx.inventoryItem.update({
    where: { id: inv.id },
    data: { quantity: { increment: 1 } },
  });
}

export async function executeCombatAction(
  character: Character,
  input: { encounterId: string; action: CombatActionKind },
): Promise<CombatActionExecuteResult> {
  const encounter = await prisma.soloCombatEncounter.findFirst({
    where: { id: input.encounterId, characterId: character.id, status: "ACTIVE" },
    include: { enemy: { include: { region: { select: { key: true } } } } },
  });

  if (!encounter) return { ok: false, error: "No active encounter.", httpStatus: 400 };

  const enemy = encounter.enemy;
  const enemyRegionKey = enemy.region?.key ?? null;
  const enemyLabel = `${enemy.emoji} ${enemy.name}`;
  const baseLog = asLog(encounter.log);
  const potionsUsedSoFar = baseLog.reduce((sum, line) => (line.toLowerCase().includes("crimson tonic") ? sum + 1 : sum), 0);
  let state = encounterToTurnState(encounter);
  const nextRound = encounter.round + 1;
  const newLines: string[] = [];
  let potionsUsedInAction = 0;
  let fightMilestone = emptyCombatRoundMilestoneAgg();

  if (input.action === "AUTO") {
    const potionStart = Math.max(0, Math.min(await potionCountForCharacter(character.id), MAX_POTIONS_PER_BATTLE - potionsUsedSoFar));
    const potionItem = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
    const { state: autoState, lines, potionsRemaining, milestone: autoMile } = runAutoBattle({
      state,
      enemyShortName: enemy.name,
      enemyLabel,
      startRound: encounter.round,
      initialEnemyStrikeStreak: encounter.enemyStrikeStreak,
      initialPotionCount: potionStart,
      initialPotionCooldown: encounter.potionCooldownRemaining,
      potionCooldownAfterUse: POTION_COOLDOWN_AFTER_USE_TURNS,
      playerClass: character.class,
      rogueSkill: character.rogueSkill,
      playerIntelligence: encounter.playerIntelligence,
    });
    state = autoState;
    fightMilestone = autoMile;
    newLines.push(...lines);
    const used = potionStart - potionsRemaining;
    potionsUsedInAction = Math.max(0, used);
    if (potionItem && used > 0) {
      for (let i = 0; i < used; i++) {
        await consumeOnePotion(character.id, potionItem.id);
      }
    }
  } else {
    newLines.push(`—— Round ${encounter.round} ——`);
    const currentIntent = encounter.enemyIntent;

    if (input.action === "ATTACK") {
      const res = resolveCombatRound({
        state,
        enemyIntent: currentIntent,
        playerAction: "ATTACK",
        enemyShortName: enemy.name,
        enemyLabel,
        playerClass: character.class,
      });
      state = res.state;
      fightMilestone = addCombatRoundMilestoneAgg(fightMilestone, res.milestone);
      newLines.push(...res.lines);
    } else if (input.action === "DEFEND") {
      const res = resolveCombatRound({
        state,
        enemyIntent: currentIntent,
        playerAction: "DEFEND",
        enemyShortName: enemy.name,
        enemyLabel,
      });
      state = res.state;
      fightMilestone = addCombatRoundMilestoneAgg(fightMilestone, res.milestone);
      newLines.push(...res.lines);
    } else if (input.action === "SKILL") {
      if (encounter.skillCooldownRemaining > 0) {
        return { ok: false, error: `Skill on cooldown (${encounter.skillCooldownRemaining} turn(s)).`, httpStatus: 400 };
      }
      const res = resolveCombatRound({
        state,
        enemyIntent: currentIntent,
        playerAction: "SKILL",
        enemyShortName: enemy.name,
        enemyLabel,
        playerClass: character.class,
        rogueSkill: character.rogueSkill,
        playerIntelligence: encounter.playerIntelligence,
      });
      state = res.state;
      fightMilestone = addCombatRoundMilestoneAgg(fightMilestone, res.milestone);
      newLines.push(...res.lines);
    } else {
      const potionItem = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
      if (!potionItem) return { ok: false, error: "Potions are not configured.", httpStatus: 400 };
      if (potionsUsedSoFar >= MAX_POTIONS_PER_BATTLE) {
        return { ok: false, error: `You can only drink ${MAX_POTIONS_PER_BATTLE} tonics per battle.`, httpStatus: 400 };
      }
      const inv = await prisma.inventoryItem.findFirst({
        where: {
          characterId: character.id,
          itemId: potionItem.id,
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
      if (!inv || inv.quantity < 1) return { ok: false, error: "You have no potions.", httpStatus: 400 };
      if (encounter.potionCooldownRemaining > 0) {
        return {
          ok: false,
          error: `Tonic on cooldown — ${encounter.potionCooldownRemaining} more turn(s) before you can sip again.`,
          httpStatus: 400,
        };
      }
      if (state.playerHp >= state.playerMaxHp) return { ok: false, error: "You are already at full health.", httpStatus: 400 };
      const heal = potionHealAmount(state.playerMaxHp);
      const res = resolveCombatRound({
        state,
        enemyIntent: currentIntent,
        playerAction: "POTION",
        potionHeal: heal,
        enemyShortName: enemy.name,
        enemyLabel,
      });
      state = res.state;
      fightMilestone = addCombatRoundMilestoneAgg(fightMilestone, res.milestone);
      newLines.push(...res.lines);
      await consumeOnePotion(character.id, potionItem.id);
      potionsUsedInAction = 1;
    }

    state = { ...state, round: nextRound };
  }

  const log = [...baseLog, ...newLines];
  const victory = state.enemyHp <= 0 && state.playerHp > 0;
  const defeat = state.playerHp <= 0;
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });

  if (!victory && !defeat) {
    const nextIntent = rollEnemyIntent(state.enemyHp, state.enemyMaxHp, state.enemyStrikeStreak);
    const nextStrikeStreak = nextEnemyStrikeStreak(state.enemyStrikeStreak, nextIntent);
    const skillMeta = activeSkillForCharacter(character.class, character.rogueSkill);
    const nextSkillCd =
      input.action === "AUTO"
        ? encounter.skillCooldownRemaining
        : input.action === "SKILL"
          ? skillMeta.cooldown
          : Math.max(0, encounter.skillCooldownRemaining - 1);
    const nextPotionCd =
      input.action === "AUTO"
        ? encounter.potionCooldownRemaining
        : input.action === "POTION"
          ? POTION_COOLDOWN_AFTER_USE_TURNS
          : Math.max(0, encounter.potionCooldownRemaining - 1);

    const updateData = buildSoloEncounterUpdateData({
      row: encounter,
      next: {
        round: state.round,
        enemyIntent: nextIntent,
        enemyStrikeStreak: nextStrikeStreak,
        playerHp: state.playerHp,
        enemyHp: state.enemyHp,
        playerMana: state.playerMana,
        playerLifeSteal: state.playerLifeSteal,
        playerSkillPowerBonus: state.playerSkillPowerBonus,
        enemyPendingDamageMult: state.enemyPendingDamageMult,
        enemyPendingArmorVsPlayer: state.enemyPendingArmorVsPlayer,
        playerInvulnerableTurns: state.playerInvulnerableTurns,
      },
      skillCooldownRemaining: nextSkillCd,
      potionCooldownRemaining: nextPotionCd,
      log,
    });

    await prisma.soloCombatEncounter.update({
      where: { id: encounter.id },
      data: updateData,
    });

    const potionCount = Math.max(
      0,
      Math.min(await potionCountForCharacter(character.id), MAX_POTIONS_PER_BATTLE - potionsUsedSoFar - potionsUsedInAction),
    );
    return {
      ok: true,
      body: {
        status: "ACTIVE",
        round: state.round,
        enemyIntent: nextIntent,
        enemyKind: enemyKindFromRow(enemy),
        player: { hp: state.playerHp, maxHp: state.playerMaxHp },
        enemy: { name: enemy.name, emoji: enemy.emoji, level: enemy.level, hp: state.enemyHp, maxHp: state.enemyMaxHp },
        log,
        potionCount,
        potionCooldownRemaining: nextPotionCd,
        potionMaxCooldown: POTION_COOLDOWN_AFTER_USE_TURNS,
        skillCooldownRemaining: nextSkillCd,
        skillMaxCooldown: skillMeta.cooldown,
        skillName: skillMeta.name,
        skillEmoji: skillMeta.emoji,
        playerMana: state.playerMana,
        playerMaxMana: state.playerMaxMana,
        fleeChance: computeFleeChance({ character, enemy }),
      },
    };
  }

  if (victory) {
    const guildBossAttemptId = encounter.guildBossAttemptId;
    if (guildBossAttemptId) {
      log.push(`★ Sortie complete — your guild drives the raid boss back (${enemyLabel}).`);
      const gb = await prisma.$transaction(async (tx) => {
        const r = await resolveGuildBossEncounterEnd(tx, {
          characterId: character.id,
          userId: character.userId,
          encounterId: encounter.id,
          guildBossAttemptId,
          endEnemyHp: state.enemyHp,
          outcome: "WIN",
        });
        await mergeGuildBossFightMilestonesTx(tx, character.id, {
          ...fightMilestone,
          guildBossDamage: r.appliedDamage,
          tonicsConsumed: potionsUsedInAction,
        });
        const ratNew = await tryUnlockRatbaneGuildBossTx(tx, character.id, r.guildDefeated, r.bossKey);
        await tx.character.update({
          where: { id: character.id },
          data: { hp: state.playerHp },
        });
        const reKeys = await reevaluateMilestoneAchievements(tx, character.id);
        const achievementKeys = mergeAchievementKeys(ratNew ? [ACHIEVEMENT_KEYS.RATBANE] : [], reKeys);
        return { ...r, achievementKeys };
      });
      const achievementToasts =
        gb.achievementKeys.length > 0 ? await achievementToastItemsForKeys(gb.achievementKeys) : undefined;
      logCombatTelemetry({
        mode: "GUILD_BOSS",
        outcome: "VICTORY",
        characterClass: character.class,
        characterLevel: character.level,
        enemyKey: enemy.key,
        enemyLevel: enemy.level,
        turns: state.round,
        playerHpRemaining: state.playerHp,
        log,
      });
      revalidatePath("/guild");
      revalidatePath("/town", "layout");
      revalidatePath("/adventure", "page");
      revalidatePath("/character");
      const potionCount = await potionCountForCharacter(character.id);
      return {
        ok: true,
        body: {
          status: "ENDED",
          outcome: "VICTORY",
          round: state.round,
          xpGained: 0,
          goldGained: 0,
          droppedItemIds: [],
          droppedItems: [],
          leveled: false,
          log,
          potionCount,
          guildBoss: { appliedDamage: gb.appliedDamage, guildDefeated: gb.guildDefeated },
          achievementToasts,
        },
      };
    }

    log.push(`★ Victory! ${enemyLabel} falls — you live to fight again, still carrying your scrapes.`);
    const lootEntries = await prisma.lootTableEntry.findMany({ where: { enemyId: enemy.id }, include: { item: true } });
    const goldGained = rollGoldReward(enemy);
    const droppedItemIds = rollDrops(lootEntries);
    const baseXp = xpForOutcome(enemy, true, character.level);
    const guildXpVal = await getGuildXpForUser(character.userId);
    const { totalXp: xpGained } = applyGuildBonusToCombatXp(baseXp, guildXpVal);
    const char = await prisma.character.findUniqueOrThrow({ where: { id: character.id } });
    const { data: charUpdate, leveled } = buildVictoryCharacterUpdate(char, state.playerHp, xpGained, goldGained);
    const reg = await prisma.region.findUnique({ where: { id: char.regionId } });

    const achievementKeys = await prisma.$transaction(async (tx) => {
      await tx.character.update({ where: { id: character.id }, data: charUpdate });
      if (reg?.key === "town_outskirts") {
        if (enemy.isAdventureMiniBoss) {
          await setOutskirtsBossCountersSql(tx, character.id, 0, rollOutskirtsBossInterval());
        } else {
          await incrementOutskirtsWinsSql(tx, character.id);
        }
      }
      for (const itemId of droppedItemIds) {
        await addDroppedItemTx(tx, { characterId: character.id, itemId, characterClass: character.class });
      }
      await tx.combatLog.create({
        data: { characterId: character.id, enemyId: enemy.id, outcome: "WIN", turns: state.round, log, xpGained, goldGained },
      });
      await tx.soloCombatEncounter.delete({ where: { id: encounter.id } });
      const soloKeys = await mergeSoloCombatFightIntoCharacterTx(tx, character.id, {
        ...fightMilestone,
        outcome: "WIN",
        endHp: state.playerHp,
        endMaxHp: state.playerMaxHp,
        tonicsConsumed: potionsUsedInAction,
        enemyRegionKey,
        goldGainedOnWin: goldGained,
      });
      const reKeys = await reevaluateMilestoneAchievements(tx, character.id);
      return mergeAchievementKeys(soloKeys, reKeys);
    });
    const achievementToasts =
      achievementKeys.length > 0 ? await achievementToastItemsForKeys(achievementKeys) : undefined;
    logCombatTelemetry({
      mode: "SOLO",
      outcome: "VICTORY",
      characterClass: character.class,
      characterLevel: character.level,
      enemyKey: enemy.key,
      enemyLevel: enemy.level,
      turns: state.round,
      playerHpRemaining: state.playerHp,
      log,
    });

    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    const potionCount = await potionCountForCharacter(character.id);
    const droppedItems = droppedItemIds.length === 0 ? [] : await prisma.item.findMany({ where: { id: { in: droppedItemIds } } });
    return {
      ok: true,
      body: {
        status: "ENDED",
        outcome: "VICTORY",
        round: state.round,
        xpGained,
        goldGained,
        droppedItemIds,
        droppedItems: droppedItems.map((it) => ({
          id: it.id,
          key: it.key,
          name: it.name,
          emoji: it.emoji,
          rarity: it.rarity,
          slot: it.slot,
          description: it.description,
          attack: it.attack,
          defense: it.defense,
          hp: it.hp,
          speed: it.speed,
          sellPrice: it.sellPrice,
          requiredLevel: it.requiredLevel,
          requiredStrength: it.requiredStrength,
          requiredConstitution: it.requiredConstitution,
          requiredIntelligence: it.requiredIntelligence,
          requiredDexterity: it.requiredDexterity,
        })),
        leveled,
        log,
        potionCount,
        achievementToasts,
      },
    };
  }

  const defeatGuildBossAttemptId = encounter.guildBossAttemptId;
  if (defeatGuildBossAttemptId) {
    log.push(`☠ You fall — your blows still counted toward the guild raid.`);
    const gb = await prisma.$transaction(async (tx) => {
      const r = await resolveGuildBossEncounterEnd(tx, {
        characterId: character.id,
        userId: character.userId,
        encounterId: encounter.id,
        guildBossAttemptId: defeatGuildBossAttemptId,
        endEnemyHp: state.enemyHp,
        outcome: "LOSS",
      });
      const finalHp = Math.max(1, Math.floor(character.maxHp * 0.35));
      await mergeGuildBossFightMilestonesTx(tx, character.id, {
        ...fightMilestone,
        guildBossDamage: r.appliedDamage,
        tonicsConsumed: potionsUsedInAction,
      });
      await tx.character.update({
        where: { id: character.id },
        data: { hp: finalHp },
      });
      const achievementKeys = await reevaluateMilestoneAchievements(tx, character.id);
      return { ...r, finalHp, achievementKeys };
    });
    const defeatAchievementToasts =
      gb.achievementKeys.length > 0 ? await achievementToastItemsForKeys(gb.achievementKeys) : undefined;
    logCombatTelemetry({
      mode: "GUILD_BOSS",
      outcome: "DEFEAT",
      characterClass: character.class,
      characterLevel: character.level,
      enemyKey: enemy.key,
      enemyLevel: enemy.level,
      turns: state.round,
      playerHpRemaining: 0,
      log,
    });
    revalidatePath("/guild");
    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    const potionCount = await potionCountForCharacter(character.id);
    return {
      ok: true,
      body: {
        status: "ENDED",
        outcome: "DEFEAT",
        round: state.round,
        xpGained: 0,
        goldLost: 0,
        finalHp: gb.finalHp,
        returnedToTown: false,
        log,
        potionCount,
        leveled: false,
        guildBoss: { appliedDamage: gb.appliedDamage, guildDefeated: gb.guildDefeated },
        achievementToasts: defeatAchievementToasts,
      },
    };
  }

  log.push(`☠ You go down — you're dragged back to town with barely enough strength to stand.`);
  const char = await prisma.character.findUniqueOrThrow({ where: { id: character.id } });
  const baseXp = xpForOutcome(enemy, false, character.level);
  const guildXpVal = await getGuildXpForUser(character.userId);
  const { totalXp: xpGained } = applyGuildBonusToCombatXp(baseXp, guildXpVal);
  const progression = applyXp(char.level, char.xp, xpGained);
  const leveledOnDefeat = progression.level > char.level;

  const soloDefeatKeys = await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: {
        hp: leveledOnDefeat ? Math.max(1, Math.floor((char.maxHp + LEVEL_UP_MAX_HP) * 0.35)) : Math.max(1, Math.floor(char.maxHp * 0.35)),
        xp: progression.xp,
        level: progression.level,
        ...(leveledOnDefeat
          ? {
              maxHp: { increment: LEVEL_UP_MAX_HP },
              attack: { increment: LEVEL_UP_ATTACK },
              defense: { increment: LEVEL_UP_DEFENSE },
              statPoints: { increment: STAT_POINTS_PER_LEVEL },
            }
          : {}),
        ...(town ? { region: { connect: { id: town.id } } } : {}),
      },
    });
    // If you lose in Town Outskirts, reset boss progress so you aren't forced
    // straight back into the miniboss check without rebuilding momentum.
    if (enemy.isAdventureMiniBoss) {
      await setOutskirtsBossCountersSql(tx, character.id, 0, rollOutskirtsBossInterval());
    }
    await tx.combatLog.create({
      data: { characterId: character.id, enemyId: enemy.id, outcome: "LOSS", turns: state.round, log, xpGained, goldGained: 0 },
    });
    await tx.soloCombatEncounter.delete({ where: { id: encounter.id } });
    const soloKeys = await mergeSoloCombatFightIntoCharacterTx(tx, character.id, {
      ...fightMilestone,
      outcome: "LOSS",
      endHp: state.playerHp,
      endMaxHp: state.playerMaxHp,
      tonicsConsumed: potionsUsedInAction,
      enemyRegionKey,
    });
    const reKeys = await reevaluateMilestoneAchievements(tx, character.id);
    return mergeAchievementKeys(soloKeys, reKeys);
  });
  const soloDefeatToasts =
    soloDefeatKeys.length > 0 ? await achievementToastItemsForKeys(soloDefeatKeys) : undefined;
  logCombatTelemetry({
    mode: "SOLO",
    outcome: "DEFEAT",
    characterClass: character.class,
    characterLevel: character.level,
    enemyKey: enemy.key,
    enemyLevel: enemy.level,
    turns: state.round,
    playerHpRemaining: 0,
    log,
  });

  revalidatePath("/town", "layout");
  revalidatePath("/adventure", "page");
  const potionCount = await potionCountForCharacter(character.id);
  return {
    ok: true,
    body: {
      status: "ENDED",
      outcome: "DEFEAT",
      round: state.round,
      xpGained,
      goldLost: 0,
      finalHp: leveledOnDefeat ? Math.max(1, Math.floor((char.maxHp + LEVEL_UP_MAX_HP) * 0.35)) : Math.max(1, Math.floor(char.maxHp * 0.35)),
      returnedToTown: !!town,
      log,
      potionCount,
      leveled: leveledOnDefeat,
      achievementToasts: soloDefeatToasts,
    },
  };
}
