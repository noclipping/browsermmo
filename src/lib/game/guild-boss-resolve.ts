import type { Prisma } from "@prisma/client";
import { getBossDefinitionByKey } from "@/lib/game/guild-boss-definitions";
import { GUILD_BOSS_RESPAWN_COOLDOWN_MS } from "@/lib/game/guild-boss-season";
import { awardGuildXp } from "@/lib/game/guild-xp";

export type GuildBossEndKind = "WIN" | "LOSS" | "FLEE";

export type GuildBossResolveResult = {
  appliedDamage: number;
  guildDefeated: boolean;
  seasonId: string;
  bossKey: string;
};

/**
 * Apply raid damage, close attempt, bump contribution, optionally defeat season + roll a new one + guild XP.
 * Caller supplies transaction; must include character HP updates and telemetry.
 */
export async function resolveGuildBossEncounterEnd(
  tx: Prisma.TransactionClient,
  params: {
    characterId: string;
    userId: string;
    encounterId: string;
    guildBossAttemptId: string;
    endEnemyHp: number;
    outcome: GuildBossEndKind;
  },
): Promise<GuildBossResolveResult> {
  void params.outcome;

  const encounter = await tx.soloCombatEncounter.findFirst({
    where: {
      id: params.encounterId,
      characterId: params.characterId,
      guildBossAttemptId: params.guildBossAttemptId,
      status: "ACTIVE",
    },
  });
  if (!encounter) {
    throw new Error("Guild boss encounter not found.");
  }

  const attempt = await tx.guildBossAttempt.findFirst({
    where: { id: params.guildBossAttemptId, userId: params.userId, status: "PENDING" },
  });
  if (!attempt) {
    throw new Error("Guild boss attempt is not pending.");
  }

  const season = await tx.guildBossSeason.findUnique({ where: { id: attempt.seasonId } });
  if (!season || season.status !== "ACTIVE") {
    throw new Error("Guild boss season is not active.");
  }

  const rawDamage = Math.max(0, encounter.enemyMaxHp - Math.min(params.endEnemyHp, encounter.enemyMaxHp));
  const appliedDamage = Math.min(rawDamage, season.currentHp);
  const newHp = season.currentHp - appliedDamage;

  await tx.guildBossContribution.upsert({
    where: { userId_seasonId: { userId: params.userId, seasonId: season.id } },
    create: {
      userId: params.userId,
      guildId: season.guildId,
      seasonId: season.id,
      damageTotal: appliedDamage,
    },
    update: { damageTotal: { increment: appliedDamage } },
  });

  await tx.guildBossAttempt.update({
    where: { id: attempt.id },
    data: { status: "COMPLETED", damageDealt: appliedDamage, completedAt: new Date() },
  });

  let guildDefeated = false;
  if (newHp <= 0) {
    guildDefeated = true;
    await tx.guildBossSeason.update({
      where: { id: season.id },
      data: {
        status: "DEFEATED",
        defeatedAt: new Date(),
        currentHp: 0,
        nextSpawnAt: new Date(Date.now() + GUILD_BOSS_RESPAWN_COOLDOWN_MS),
      },
    });
    const def = getBossDefinitionByKey(season.bossKey);
    if (def) {
      await awardGuildXp(tx, season.guildId, def.defeatGuildXp, "guild_boss");
    }
  } else {
    await tx.guildBossSeason.update({
      where: { id: season.id },
      data: { currentHp: newHp },
    });
  }

  await tx.soloCombatEncounter.delete({ where: { id: encounter.id } });

  return {
    appliedDamage,
    guildDefeated,
    seasonId: season.id,
    bossKey: season.bossKey,
  };
}
