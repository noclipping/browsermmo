import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type SqlDb = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

export async function readOutskirtsBossState(db: SqlDb, characterId: string): Promise<{ wins: number; bossAt: number }> {
  const rows = await db.$queryRaw<Array<{ wins: number | bigint; at: number | bigint }>>(
    Prisma.sql`SELECT "outskirtsWinsSinceBoss" AS wins, "outskirtsBossAt" AS at FROM "Character" WHERE "id" = ${characterId} LIMIT 1`,
  );
  const r = rows[0];
  return {
    wins: Number(r?.wins ?? 0),
    bossAt: Number(r?.at ?? 4),
  };
}

export async function setOutskirtsBossCountersSql(db: SqlDb, characterId: string, wins: number, bossAt: number) {
  await db.$executeRaw(
    Prisma.sql`UPDATE "Character" SET "outskirtsWinsSinceBoss" = ${wins}, "outskirtsBossAt" = ${bossAt} WHERE "id" = ${characterId}`,
  );
}

export async function incrementOutskirtsWinsSql(db: SqlDb, characterId: string) {
  await db.$executeRaw(
    Prisma.sql`
      UPDATE "Character"
      SET "outskirtsWinsSinceBoss" = COALESCE("outskirtsWinsSinceBoss", 0) + 1
      WHERE "id" = ${characterId}
    `,
  );
}
