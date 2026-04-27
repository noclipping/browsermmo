import { revalidatePath } from "next/cache";
import type { Character, Prisma } from "@prisma/client";
import { encounterToTurnState, resolveCombatRound, rollEnemyIntent } from "@/lib/game/combat-turn";
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
import { rollOutskirtsBossInterval } from "@/lib/game/outskirts-boss";
import { setOutskirtsBossCountersSql } from "@/lib/game/outskirts-sql";
import { xpForOutcome } from "@/lib/game/combat-rewards";
import { buildSoloEncounterUpdateData } from "@/lib/game/encounter-domain";
import { logCombatTelemetry } from "@/lib/game/combat-telemetry";
import { prisma } from "@/lib/prisma";

type EncounterWithEnemy = Prisma.SoloCombatEncounterGetPayload<{ include: { enemy: true } }>;

export type CombatFleeExecuteResult = { ok: true } | { ok: false; error: string; httpStatus: number };

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

async function handleFleeDefeat(character: Character, encounter: EncounterWithEnemy, log: string[]) {
  const town = await prisma.region.findUnique({ where: { key: "town_outskirts" } });
  const xpGained = xpForOutcome(encounter.enemy, false, character.level);
  const progression = applyXp(character.level, character.xp, xpGained);
  const leveledOnDefeat = progression.level > character.level;
  const finalHp = leveledOnDefeat
    ? Math.max(1, Math.floor((character.maxHp + LEVEL_UP_MAX_HP) * 0.35))
    : Math.max(1, Math.floor(character.maxHp * 0.35));

  await prisma.$transaction(async (tx) => {
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
    if (encounter.enemy.isAdventureMiniBoss) {
      await setOutskirtsBossCountersSql(tx, character.id, 0, rollOutskirtsBossInterval());
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
}

export async function executeCombatFlee(character: Character, encounterId: string): Promise<CombatFleeExecuteResult> {
  const encounter = await prisma.soloCombatEncounter.findFirst({
    where: { id: encounterId, characterId: character.id, status: "ACTIVE" },
    include: { enemy: true },
  });
  if (!encounter) return { ok: false, error: "No active encounter.", httpStatus: 400 };
  if (encounter.playerHp <= 0) {
    const defeatLog = [...asLog(encounter.log), "☠ You collapse before you can escape."];
    await handleFleeDefeat(character, encounter as EncounterWithEnemy, defeatLog);
    revalidatePath("/town", "layout");
    revalidatePath("/adventure", "page");
    return { ok: false, error: "You were defeated before you could flee.", httpStatus: 400 };
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
    const nextIntent = rollEnemyIntent(result.state.enemyHp, result.state.enemyMaxHp);
    const nextRound = encounter.round + 1;
    const log = [
      ...(Array.isArray(encounter.log) ? (encounter.log.filter((x): x is string => typeof x === "string")) : []),
      `🏃 You attempt to flee… but ${encounter.enemy.name} cuts you off!`,
      ...result.lines,
    ];
    if (result.state.playerHp <= 0) {
      await handleFleeDefeat(character, encounter as EncounterWithEnemy, [...log, "☠ The failed getaway gets you killed."]);
      revalidatePath("/town", "layout");
      revalidatePath("/adventure", "page");
      return { ok: false, error: "Flee failed, and you were defeated.", httpStatus: 400 };
    }
    const updateData = buildSoloEncounterUpdateData({
      row: encounter,
      next: {
        round: nextRound,
        enemyIntent: nextIntent,
        playerHp: result.state.playerHp,
        enemyHp: result.state.enemyHp,
        playerMana: result.state.playerMana,
        playerLifeSteal: result.state.playerLifeSteal,
        playerSkillPowerBonus: result.state.playerSkillPowerBonus,
        enemyPendingDamageMult: result.state.enemyPendingDamageMult,
        enemyPendingArmorVsPlayer: result.state.enemyPendingArmorVsPlayer,
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

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { hp: Math.max(1, encounter.playerHp) },
    });
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
