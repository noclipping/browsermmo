-- Guarded because this migration can be replayed before guild boss phase tables
-- exist in a fresh shadow DB.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'GuildBossRewardClaim'
  ) THEN
    ALTER TABLE "GuildBossRewardClaim" ADD COLUMN IF NOT EXISTS "chestClaimedAt" TIMESTAMP(3);
    -- Legacy clear bonus claims map to chest claimed so players cannot double-claim the replacement chest.
    UPDATE "GuildBossRewardClaim"
    SET "chestClaimedAt" = "clearClaimedAt"
    WHERE "clearClaimedAt" IS NOT NULL AND "chestClaimedAt" IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'GuildBossSeason'
  ) THEN
    ALTER TABLE "GuildBossSeason" ADD COLUMN IF NOT EXISTS "nextSpawnAt" TIMESTAMP(3);
  END IF;
END $$;
