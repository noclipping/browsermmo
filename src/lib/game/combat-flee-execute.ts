import { revalidatePath } from "next/cache";
import type { Character, Prisma } from "@prisma/client";
import {
  emptyCombatRoundMilestoneAgg,
  encounterToTurnState,
  nextEnemyStrikeStreak,
  resolveCombatRound,
  rollEnemyIntent,
  type CombatRoundMilestoneAgg,
} from "@/lib/game/combat-turn";
import {
  mergeGuildBossFightMilestonesTx,
  mergeSoloCombatFightIntoCharacterTx,
  reevaluateMilestoneAchievements,
} from "@/lib/game/milestone-achievements";
import {
  BASE_FLEE_CHANCE,
  DEX_FLEE_CHANCE_PER_POINT,
  LEVEL_UP_ATTACK,
  LEVEL_UP_DEFENSE,
  LEVEL_UP_MAX_HP,
  MAX_FLEE_CHANCE,
  MIN_FLEE_CHANCE,
  STAT_POINTS_PER_LEVEL,
} from "@/lib/game/constants";
import { applyXp } from "@/lib/game/progression";
import { resetForestDireWolfStreakSql, setForestBossCountersSql } from "@/lib/game/forest-edge-sql";
import { rollOutskirtsBossInterval } from "@/lib/game/outskirts-boss";
import { setOutskirtsBossCountersSql } from "@/lib/game/outskirts-sql";
import { xpForOutcome } from "@/lib/game/combat-rewards";
import { applyGuildBonusToCombatXp } from "@/lib/game/guild-progression";
import { getGuildXpForUser } from "@/lib/game/guild-xp";
import { resolveGuildBossEncounterEnd } from "@/lib/game/guild-boss-resolve";
import { buildSoloEncounterUpdateData } from "@/lib/game/encounter-domain";
import { logCombatTelemetry } from "@/lib/game/combat-telemetry";
import type { AchievementToastItem } from "@/lib/achievement-toast-types";
import { achievementToastItemsForKeys } from "@/lib/achievement-toast-server";
import { mergeAchievementKeys } from "@/lib/merge-achievement-keys";
import { prisma } from "@/lib/prisma";

type EncounterWithEnemy = Prisma.SoloCombatEncounterGetPayload<{ include: { enemy: true } }>;

export type CombatFleeExecuteResult =
  | { ok: true; achievementToasts?: AchievementToastItem[] }
  | { ok: false; error: string; httpStatus: number; achievementToasts?: AchievementToastItem[] };

export function computeFleeChance(params: {
  character: Pick<Character, "dexterity" | "level">;
  enemy: { level: number; isElite: boolean; isAdventureMiniBoss: boolean; isDungeonBoss: boolean };
}) {
  const dexBonus = params.character.dexterity * DEX_FLEE_CHANCE_PER_POINT;
  const enemyPenalty = Math.max(0, params.enemy.level - params.character.level) * 0.06;
  const elitePenalty = params.enemy.isElite ? 0.12 : 0;
  const bossPenalty = params.enemy.isAdventureMiniBoss || params.enemy.isDungeonBoss ? 0.22 : 0;
  return Math.min(
    MAX_FLEE_CHANCE,
    Math.max(MIN_FLEE_CHANCE, BASE_FLEE_CHANCE + dexBonus - enemyPenalty - elitePenalty - bossPenalty),
  );
}

function asLog(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

async function handleFleeDefeat(
  character: Character,
  encounter: EncounterWithEnemy,
  log: string[],
  finalEnemyHp?: number,
  lastRoundMilestone: CombatRoundMilestoneAgg = emptyCombatRoundMilestoneAgg(),
): Promise<string[]> {
  const endEnemyHp = finalEnemyHp ?? encounter.enemyHp;

  const defeatAttemptId = encounter.guildBossAttemptId;
  if (defeatAttemptId) {
    const keys = await prisma.$transaction(async (tx) => {
      const r = await resolveGuildBossEncounterEnd(tx, {
        characterId: character.id,
        userId: character.userId,
        encounterId: encounter.id,
        guildBossAttemptId: defeatAttemptId,
        endEnemyHp,
        outcome: "LOSS",
      });
      const finalHp = Math.max(1, Math.floor(character.maxHp * 0.35));
      await mergeGuildBossFightMilestonesTx(tx, character.id, {
        ...lastRoundMilestone,
        guildBossDamage: r.appliedDamage,
        tonicsConsumed: 0,
      });
      await tx.character.update({
        where: { id: character.id },
        data: { hp: finalHp },
      });
      return reevaluateMilestoneAchievements(tx, character.id);
    });
    logCombatTelemetry({
      mode: "GUILD_BOSS",
      outcome: "DEFEAT",
      characterClass: character.class,
      characterLevel: character.level,
      enemyKey: encounter.enemy.key,
      enemyLevel: encounter.enemy.level,
      turns: encounter.round,
      playerHpRemaining: 0,
      log,
    });
    revalidatePath("/guild");
    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    return keys;
  }

  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  const baseXp = xpForOutcome(encounter.enemy, false, character.level);
  const guildXpVal = await getGuildXpForUser(character.userId);
  const { totalXp: xpGained } = applyGuildBonusToCombatXp(baseXp, guildXpVal);
  const progression = applyXp(character.level, character.xp, xpGained);
  const leveledOnDefeat = progression.level > character.level;
  const finalHp = leveledOnDefeat
    ? Math.max(1, Math.floor((character.maxHp + LEVEL_UP_MAX_HP) * 0.35))
    : Math.max(1, Math.floor(character.maxHp * 0.35));

  const keys = await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: {
        hp: finalHp,
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
    if (encounter.enemy.isAdventureMiniBoss && encounter.enemy.key === "sewer_fencer") {
      await setOutskirtsBossCountersSql(tx, character.id, 0, rollOutskirtsBossInterval());
    }
    if (encounter.enemy.isAdventureMiniBoss && encounter.enemy.key === "forest_tree_ent") {
      await setForestBossCountersSql(tx, character.id, 0, rollOutskirtsBossInterval());
    }
    if (
      encounter.enemy.key === "dire_wolf" ||
      encounter.enemy.key === "alpha_dire_wolf" ||
      encounter.enemy.key === "forest_tree_ent"
    ) {
      await resetForestDireWolfStreakSql(tx, character.id);
    }
    await tx.combatLog.create({
      data: {
        characterId: character.id,
        enemyId: encounter.enemy.id,
        outcome: "LOSS",
        turns: encounter.round,
        log,
        xpGained,
        goldGained: 0,
      },
    });
    await tx.soloCombatEncounter.delete({ where: { id: encounter.id } });
    const soloKeys = await mergeSoloCombatFightIntoCharacterTx(tx, character.id, {
      ...lastRoundMilestone,
      outcome: "LOSS",
      endHp: finalHp,
      endMaxHp: character.maxHp,
      tonicsConsumed: 0,
    });
    const reKeys = await reevaluateMilestoneAchievements(tx, character.id);
    return mergeAchievementKeys(soloKeys, reKeys);
  });
  logCombatTelemetry({
    mode: "SOLO",
    outcome: "DEFEAT",
    characterClass: character.class,
    characterLevel: character.level,
    enemyKey: encounter.enemy.key,
    enemyLevel: encounter.enemy.level,
    turns: encounter.round,
    playerHpRemaining: 0,
    log,
  });
  return keys;
}

export async function executeCombatFlee(character: Character, encounterId: string): Promise<CombatFleeExecuteResult> {
  const encounter = await prisma.soloCombatEncounter.findFirst({
    where: { id: encounterId, characterId: character.id, status: "ACTIVE" },
    include: { enemy: { include: { region: { select: { key: true } } } } },
  });
  if (!encounter) return { ok: false, error: "No active encounter.", httpStatus: 400 };
  if (encounter.playerHp <= 0) {
    const defeatLog = [...asLog(encounter.log), "☠ You collapse before you can escape."];
    const keys = await handleFleeDefeat(character, encounter as EncounterWithEnemy, defeatLog);
    const achievementToasts = keys.length > 0 ? await achievementToastItemsForKeys(keys) : undefined;
    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    return { ok: false, error: "You were defeated before you could flee.", httpStatus: 400, achievementToasts };
  }
  const fleeChance = computeFleeChance({ character, enemy: encounter.enemy });
  if (Math.random() > fleeChance) {
    const state = encounterToTurnState(encounter);
    const result = resolveCombatRound({
      state,
      enemyIntent: encounter.enemyIntent,
      playerAction: "FLEE",
      enemyShortName: encounter.enemy.name,
      enemyLabel: `${encounter.enemy.emoji} ${encounter.enemy.name}`,
    });
    const nextIntent = rollEnemyIntent(result.state.enemyHp, result.state.enemyMaxHp, result.state.enemyStrikeStreak);
    const nextStrikeStreak = nextEnemyStrikeStreak(result.state.enemyStrikeStreak, nextIntent);
    const nextRound = encounter.round + 1;
    const log = [
      ...(Array.isArray(encounter.log) ? (encounter.log.filter((x): x is string => typeof x === "string")) : []),
      `🏃 You attempt to flee… but ${encounter.enemy.name} cuts you off!`,
      ...result.lines,
    ];
    if (result.state.playerHp <= 0) {
      const keys = await handleFleeDefeat(
        character,
        encounter as EncounterWithEnemy,
        [...log, "☠ The failed getaway gets you killed."],
        result.state.enemyHp,
        result.milestone,
      );
      const achievementToasts = keys.length > 0 ? await achievementToastItemsForKeys(keys) : undefined;
      revalidatePath("/town", "layout");
      revalidatePath("/adventure", "page");
      return { ok: false, error: "Flee failed, and you were defeated.", httpStatus: 400, achievementToasts };
    }
    const updateData = buildSoloEncounterUpdateData({
      row: encounter,
      next: {
        round: nextRound,
        enemyIntent: nextIntent,
        enemyStrikeStreak: nextStrikeStreak,
        playerHp: result.state.playerHp,
        enemyHp: result.state.enemyHp,
        playerMana: result.state.playerMana,
        playerLifeSteal: result.state.playerLifeSteal,
        playerSkillPowerBonus: result.state.playerSkillPowerBonus,
        enemyPendingDamageMult: result.state.enemyPendingDamageMult,
        enemyPendingArmorVsPlayer: result.state.enemyPendingArmorVsPlayer,
        playerInvulnerableTurns: result.state.playerInvulnerableTurns,
      },
      skillCooldownRemaining: Math.max(0, encounter.skillCooldownRemaining - 1),
      potionCooldownRemaining: Math.max(0, encounter.potionCooldownRemaining - 1),
      log,
    });

    await prisma.soloCombatEncounter.update({
      where: { id: encounter.id },
      data: updateData,
    });
    logCombatTelemetry({
      mode: "SOLO",
      outcome: "FLEE_FAIL",
      characterClass: character.class,
      characterLevel: character.level,
      enemyKey: encounter.enemy.key,
      enemyLevel: encounter.enemy.level,
      turns: nextRound,
      playerHpRemaining: result.state.playerHp,
      log,
    });
    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    return { ok: false, error: "Flee failed. You are still locked in combat.", httpStatus: 400 };
  }

  const fleeSuccessAttemptId = encounter.guildBossAttemptId;
  if (fleeSuccessAttemptId) {
    await prisma.$transaction(async (tx) => {
      await resolveGuildBossEncounterEnd(tx, {
        characterId: character.id,
        userId: character.userId,
        encounterId: encounter.id,
        guildBossAttemptId: fleeSuccessAttemptId,
        endEnemyHp: encounter.enemyHp,
        outcome: "FLEE",
      });
      await tx.character.update({
        where: { id: character.id },
        data: { hp: Math.max(1, encounter.playerHp) },
      });
    });
    logCombatTelemetry({
      mode: "GUILD_BOSS",
      outcome: "FLEE_SUCCESS",
      characterClass: character.class,
      characterLevel: character.level,
      enemyKey: encounter.enemy.key,
      enemyLevel: encounter.enemy.level,
      turns: encounter.round,
      playerHpRemaining: encounter.playerHp,
      log: asLog(encounter.log),
    });
    revalidatePath("/guild");
    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    return { ok: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { hp: Math.max(1, encounter.playerHp) },
    });
    if (encounter.enemy.region?.key === "forest_edge") {
      await resetForestDireWolfStreakSql(tx, character.id);
    }
    await tx.soloCombatEncounter.delete({ where: { id: encounter.id } });
  });
  logCombatTelemetry({
    mode: "SOLO",
    outcome: "FLEE_SUCCESS",
    characterClass: character.class,
    characterLevel: character.level,
    enemyKey: encounter.enemy.key,
    enemyLevel: encounter.enemy.level,
    turns: encounter.round,
    playerHpRemaining: encounter.playerHp,
    log: asLog(encounter.log),
  });

  revalidatePath("/town", "layout");
  revalidatePath("/adventure", "page");
  return { ok: true };
}
