-- DropIndex
DROP INDEX "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bon_key";

-- AlterTable
ALTER TABLE "GuildBossRewardClaim" ADD COLUMN     "chestClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GuildBossSeason" ADD COLUMN     "nextSpawnAt" TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bonusLi" RENAME TO "GuildTreasuryItem_guildId_itemId_forgeLevel_affixPrefix_bon_key";

-- RenameIndex
ALTER INDEX "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bonusLi" RENAME TO "InventoryItem_characterId_itemId_forgeLevel_affixPrefix_bon_key";
