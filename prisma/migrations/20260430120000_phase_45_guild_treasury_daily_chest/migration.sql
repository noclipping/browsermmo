-- Phase 4.5: INITIATE rank, daily login chest fields, guild treasury stacks.

ALTER TYPE "GuildRole" ADD VALUE IF NOT EXISTS 'INITIATE';

ALTER TABLE "GuildMember" ALTER COLUMN "role" SET DEFAULT 'INITIATE'::"GuildRole";

ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "dailyLoginNextStreakDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "dailyLoginLastClaimDate" DATE;

CREATE TABLE IF NOT EXISTS "GuildTreasuryItem" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "forgeLevel" INTEGER NOT NULL DEFAULT 0,
    "affixPrefix" TEXT,
    "bonusLifeSteal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusCritChance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusSkillPower" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusStrength" INTEGER NOT NULL DEFAULT 0,
    "bonusConstitution" INTEGER NOT NULL DEFAULT 0,
    "bonusIntelligence" INTEGER NOT NULL DEFAULT 0,
    "bonusDexterity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildTreasuryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bonusLifeSteal_bonu_key" ON "GuildTreasuryItem"("guildId", "itemId", "forgeLevel", "affixPrefix", "bonusLifeSteal", "bonusCritChance", "bonusSkillPower", "bonusStrength", "bonusConstitution", "bonusIntelligence", "bonusDexterity");

CREATE INDEX IF NOT EXISTS "GuildTreasuryItem_guildId_idx" ON "GuildTreasuryItem"("guildId");

DO $$ BEGIN
  ALTER TABLE "GuildTreasuryItem" ADD CONSTRAINT "GuildTreasuryItem_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GuildTreasuryItem" ADD CONSTRAINT "GuildTreasuryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
