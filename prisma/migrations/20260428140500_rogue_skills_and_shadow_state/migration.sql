-- Rogue skill loadout + per-encounter shadow invulnerability state.
CREATE TYPE "RogueSkill" AS ENUM ('VOLLEY', 'DAGGER_STORM', 'SHADOW');

ALTER TABLE "Character"
ADD COLUMN "rogueSkill" "RogueSkill" NOT NULL DEFAULT 'VOLLEY';

ALTER TABLE "SoloCombatEncounter"
ADD COLUMN "playerInvulnerableTurns" INTEGER NOT NULL DEFAULT 0;
