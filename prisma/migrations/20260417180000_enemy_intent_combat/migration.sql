-- CreateEnum
CREATE TYPE "EnemyIntent" AS ENUM ('ATTACK', 'HEAVY_ATTACK', 'GUARD', 'RECOVER');

-- AlterTable
ALTER TABLE "SoloCombatEncounter" DROP COLUMN "defendMitigation";
ALTER TABLE "SoloCombatEncounter" ADD COLUMN "enemyIntent" "EnemyIntent" NOT NULL DEFAULT 'ATTACK';
