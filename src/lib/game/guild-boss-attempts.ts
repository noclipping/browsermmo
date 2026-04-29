import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { GUILD_BOSS_ATTEMPTS_PER_24H } from "@/lib/game/guild-boss-definitions";

type Db = PrismaClient | Prisma.TransactionClient;

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function countGuildBossAttemptsLast24h(db: Db, userId: string, guildId: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS);
  return db.guildBossAttempt.count({
    where: {
      userId,
      guildId,
      status: "COMPLETED",
      completedAt: { gte: since },
    },
  });
}

export async function assertGuildBossAttemptBudget(db: Db, userId: string, guildId: string): Promise<void> {
  const n = await countGuildBossAttemptsLast24h(db, userId, guildId);
  if (n >= GUILD_BOSS_ATTEMPTS_PER_24H) {
    throw new Error(`Guild boss attempts exhausted (${GUILD_BOSS_ATTEMPTS_PER_24H} per 24h).`);
  }
}
