-- Add wearable percentage affix fields.
ALTER TABLE "GuildTreasuryItem"
ADD COLUMN "bonusDefensePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "bonusConstitutionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "InventoryItem"
ADD COLUMN "bonusDefensePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "bonusConstitutionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "MarketListing"
ADD COLUMN "bonusDefensePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "bonusConstitutionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "CharacterEquipment"
ADD COLUMN "bonusDefensePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "bonusConstitutionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Rebuild unique stack-shape indexes that include affix fields.
DROP INDEX IF EXISTS "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bonusLif_key";
CREATE UNIQUE INDEX "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bonusLif_key"
ON "GuildTreasuryItem"(
  "guildId", "itemId", "forgeLevel", "affixPrefix",
  "bonusLifeSteal", "bonusCritChance", "bonusSkillPower",
  "bonusDefensePercent", "bonusConstitutionPercent",
  "bonusStrength", "bonusConstitution", "bonusIntelligence", "bonusDexterity"
);

DROP INDEX IF EXISTS "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bonusLife_key";
CREATE UNIQUE INDEX "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bonusLife_key"
ON "InventoryItem"(
  "characterId", "itemId", "forgeLevel", "affixPrefix",
  "bonusLifeSteal", "bonusCritChance", "bonusSkillPower",
  "bonusDefensePercent", "bonusConstitutionPercent",
  "bonusStrength", "bonusConstitution", "bonusIntelligence", "bonusDexterity"
);
