-- Slay-the-Spire-style: STRIKE intent + pending buff fields on encounter

ALTER TYPE "EnemyIntent" ADD VALUE 'STRIKE';

ALTER TABLE "SoloCombatEncounter" ADD COLUMN "enemyPendingDamageMult" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "SoloCombatEncounter" ADD COLUMN "enemyPendingArmorVsPlayer" INTEGER NOT NULL DEFAULT 0;
