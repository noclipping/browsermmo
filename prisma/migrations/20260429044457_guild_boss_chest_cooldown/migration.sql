-- AlterTable
ALTER TABLE "GuildBossRewardClaim" ADD COLUMN     "chestClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GuildBossSeason" ADD COLUMN     "nextSpawnAt" TIMESTAMP(3);

-- Legacy clear bonus claims map to chest claimed so players cannot double-claim the replacement chest.
UPDATE "GuildBossRewardClaim" SET "chestClaimedAt" = "clearClaimedAt" WHERE "clearClaimedAt" IS NOT NULL AND "chestClaimedAt" IS NULL;
