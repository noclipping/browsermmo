-- AlterEnum
ALTER TYPE "ItemSlot" ADD VALUE 'CONSUMABLE';

-- AlterTable
ALTER TABLE "Enemy" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- CreateEnum
CREATE TYPE "SoloCombatStatus" AS ENUM ('ACTIVE', 'VICTORY', 'DEFEAT');

-- CreateTable
CREATE TABLE "SoloCombatEncounter" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "enemyId" TEXT NOT NULL,
    "status" "SoloCombatStatus" NOT NULL DEFAULT 'ACTIVE',
    "playerHp" INTEGER NOT NULL,
    "playerMaxHp" INTEGER NOT NULL,
    "enemyHp" INTEGER NOT NULL,
    "enemyMaxHp" INTEGER NOT NULL,
    "playerAttack" INTEGER NOT NULL,
    "playerDefense" INTEGER NOT NULL,
    "playerSpeed" INTEGER NOT NULL,
    "playerCrit" DOUBLE PRECISION NOT NULL,
    "enemyAttack" INTEGER NOT NULL,
    "enemyDefense" INTEGER NOT NULL,
    "enemySpeed" INTEGER NOT NULL,
    "enemyCrit" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
    "defendMitigation" INTEGER NOT NULL DEFAULT 0,
    "round" INTEGER NOT NULL DEFAULT 1,
    "log" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoloCombatEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoloCombatEncounter_characterId_status_idx" ON "SoloCombatEncounter"("characterId", "status");

-- AddForeignKey
ALTER TABLE "SoloCombatEncounter" ADD CONSTRAINT "SoloCombatEncounter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoloCombatEncounter" ADD CONSTRAINT "SoloCombatEncounter_enemyId_fkey" FOREIGN KEY ("enemyId") REFERENCES "Enemy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
