import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getGuildLevelFromXp } from "@/lib/game/guild-progression";
import { getBossDefinitionByKey, highestUnlockedBoss } from "@/lib/game/guild-boss-definitions";

type Db = PrismaClient | Prisma.TransactionClient;

/** Per-guild respawn delay after a boss is defeated (ms). */
export const GUILD_BOSS_RESPAWN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function computeSeasonMaxHp(bossKey: string, memberCount: number): number {
  const def = getBossDefinitionByKey(bossKey);
  if (!def) return 0;
  return def.baseSharedHp + memberCount * def.hpPerMember;
}

/**
 * If the guild has no ACTIVE season but the last defeat’s cooldown has passed (or is unset/legacy), create the next season.
 * Does not create while `nextSpawnAt` is still in the future.
 */
export async function trySpawnNextGuildBossIfReady(db: Db, guildId: string): Promise<void> {
  const active = await db.guildBossSeason.findFirst({
    where: { guildId, status: "ACTIVE" },
  });
  if (active) return;

  const lastDefeated = await db.guildBossSeason.findFirst({
    where: { guildId, status: "DEFEATED" },
    orderBy: { defeatedAt: "desc" },
  });

  const now = Date.now();

  if (lastDefeated) {
    if (lastDefeated.nextSpawnAt && lastDefeated.nextSpawnAt.getTime() > now) {
      return;
    }

    const memberCount = await db.guildMember.count({ where: { guildId } });
    const maxHp = computeSeasonMaxHp(lastDefeated.bossKey, memberCount);
    await db.guildBossSeason.create({
      data: {
        guildId,
        bossKey: lastDefeated.bossKey,
        maxHp,
        currentHp: maxHp,
        memberCountAtStart: memberCount,
        status: "ACTIVE",
      },
    });
    return;
  }

  const guild = await db.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw new Error("Guild not found");
  const level = getGuildLevelFromXp(guild.xp);
  const boss = highestUnlockedBoss(level);
  if (!boss) throw new Error("No guild boss unlocked for this guild level");

  const memberCount = await db.guildMember.count({ where: { guildId } });
  const maxHp = computeSeasonMaxHp(boss.key, memberCount);

  await db.guildBossSeason.create({
    data: {
      guildId,
      bossKey: boss.key,
      maxHp,
      currentHp: maxHp,
      memberCountAtStart: memberCount,
      status: "ACTIVE",
    },
  });
}

/**
 * @deprecated Prefer trySpawnNextGuildBossIfReady + query ACTIVE; kept for any legacy imports.
 */
export async function ensureActiveGuildBossSeason(db: Db, guildId: string) {
  await trySpawnNextGuildBossIfReady(db, guildId);
  const active = await db.guildBossSeason.findFirst({
    where: { guildId, status: "ACTIVE" },
  });
  if (!active) {
    throw new Error("Guild boss is in respawn cooldown or unavailable.");
  }
  return active;
}
