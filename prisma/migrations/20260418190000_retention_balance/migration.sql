-- Stat gates for equipment (0 = no requirement).
ALTER TABLE "Item" ADD COLUMN "requiredStrength" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "requiredConstitution" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "requiredIntelligence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Item" ADD COLUMN "requiredDexterity" INTEGER NOT NULL DEFAULT 0;

-- Elite flag for tougher rare spawns.
ALTER TABLE "Enemy" ADD COLUMN "isElite" BOOLEAN NOT NULL DEFAULT false;

-- Turns remaining before another potion sip in the same fight (manual combat).
ALTER TABLE "SoloCombatEncounter" ADD COLUMN "potionCooldownRemaining" INTEGER NOT NULL DEFAULT 0;
