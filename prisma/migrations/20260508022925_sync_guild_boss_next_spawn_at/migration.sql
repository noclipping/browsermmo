-- Idempotent: a prior run may have applied ADD COLUMN / RENAME before failing on a later step.

-- AlterTable
ALTER TABLE "GuildBossRewardClaim" ADD COLUMN IF NOT EXISTS "chestClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GuildBossSeason" ADD COLUMN IF NOT EXISTS "nextSpawnAt" TIMESTAMP(3);

-- RenameIndex (skip if already at target name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bon_key'
  ) AND EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bonusLi'
  ) THEN
    ALTER INDEX "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bonusLi" RENAME TO "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bon_key";
  END IF;
END $$;

-- RenameIndex
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bon_key'
  ) AND EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bonusLi'
  ) THEN
    ALTER INDEX "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bonusLi" RENAME TO "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bon_key";
  END IF;
END $$;
