import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type SqlDb = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

export async function readForestBossState(db: SqlDb, characterId: string): Promise<{ wins: number; bossAt: number }> {
  const rows = await db.$queryRaw<Array<{ wins: number | bigint; at: number | bigint }>>(
    Prisma.sql`SELECT "forestWinsSinceBoss" AS wins, "forestBossAt" AS at FROM "Character" WHERE "id" = ${characterId} LIMIT 1`,
  );
  const r = rows[0];
  return {
    wins: Number(r?.wins ?? 0),
    bossAt: Number(r?.at ?? 4),
  };
}

export async function setForestBossCountersSql(db: SqlDb, characterId: string, wins: number, bossAt: number) {
  await db.$executeRaw(
    Prisma.sql`UPDATE "Character" SET "forestWinsSinceBoss" = ${wins}, "forestBossAt" = ${bossAt} WHERE "id" = ${characterId}`,
  );
}

export async function incrementForestWinsSql(db: SqlDb, characterId: string) {
  await db.$executeRaw(
    Prisma.sql`
      UPDATE "Character"
      SET "forestWinsSinceBoss" = COALESCE("forestWinsSinceBoss", 0) + 1
      WHERE "id" = ${characterId}
    `,
  );
}

export async function readForestDireWolfStreak(db: SqlDb, characterId: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ streak: number | bigint }>>(
    Prisma.sql`SELECT "forestConsecutiveDireWolfWins" AS streak FROM "Character" WHERE "id" = ${characterId} LIMIT 1`,
  );
  return Number(rows[0]?.streak ?? 0);
}

export async function resetForestDireWolfStreakSql(db: SqlDb, characterId: string) {
  await db.$executeRaw(
    Prisma.sql`UPDATE "Character" SET "forestConsecutiveDireWolfWins" = 0 WHERE "id" = ${characterId}`,
  );
}

export async function incrementForestDireWolfStreakSql(db: SqlDb, characterId: string) {
  await db.$executeRaw(
    Prisma.sql`
      UPDATE "Character"
      SET "forestConsecutiveDireWolfWins" = COALESCE("forestConsecutiveDireWolfWins", 0) + 1
      WHERE "id" = ${characterId}
    `,
  );
}
