-- Achievements catalog, per-character unlocks, equipped title via achievement key, treasury deposit counter.

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏅',
    "titleReward" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

CREATE TABLE "CharacterAchievement" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterAchievement_characterId_achievementId_key" ON "CharacterAchievement"("characterId", "achievementId");
CREATE INDEX "CharacterAchievement_characterId_idx" ON "CharacterAchievement"("characterId");

ALTER TABLE "CharacterAchievement" ADD CONSTRAINT "CharacterAchievement_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterAchievement" ADD CONSTRAINT "CharacterAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Character" ADD COLUMN "equippedAchievementKey" TEXT;
ALTER TABLE "Character" ADD COLUMN "guildTreasuryItemsDeposited" INTEGER NOT NULL DEFAULT 0;

INSERT INTO "Achievement" ("id", "key", "name", "description", "icon", "titleReward", "sortOrder") VALUES
('ach_ratbane', 'ratbane', 'Ratbane', 'Defeat the Rat King.', '👑', 'Ratbane', 0),
('ach_guildbound', 'guildbound', 'Guildbound', 'Join a guild.', '🏰', 'Guildbound', 1),
('ach_treasurekeeper', 'treasurekeeper', 'Treasurekeeper', 'Deposit 10 items into a guild treasury.', '📦', 'Treasurekeeper', 2),
('ach_mythic_blessed', 'mythic_blessed', 'Mythic-Blessed', 'Claim a Mythic daily chest.', '✨', 'Mythic-Blessed', 3),
('ach_founder', 'founder', 'Founder', 'Early tester honorific.', '🌟', 'Founder', 4);

-- Map legacy free-text equipped titles to achievement keys (best-effort).
UPDATE "Character" SET "equippedAchievementKey" = 'ratbane'
WHERE "equippedTitle" IS NOT NULL AND lower(trim("equippedTitle")) = 'ratbane';
UPDATE "Character" SET "equippedAchievementKey" = 'guildbound'
WHERE "equippedTitle" IS NOT NULL AND lower(trim("equippedTitle")) = 'guildbound';
UPDATE "Character" SET "equippedAchievementKey" = 'treasurekeeper'
WHERE "equippedTitle" IS NOT NULL AND lower(trim("equippedTitle")) = 'treasurekeeper';
UPDATE "Character" SET "equippedAchievementKey" = 'mythic_blessed'
WHERE "equippedTitle" IS NOT NULL AND (
  lower(trim("equippedTitle")) = 'mythic-blessed'
  OR lower(trim("equippedTitle")) = 'mythic blessed'
);
UPDATE "Character" SET "equippedAchievementKey" = 'founder'
WHERE "equippedTitle" IS NOT NULL AND lower(trim("equippedTitle")) = 'founder';

UPDATE "Character" SET "equippedAchievementKey" = NULL
WHERE "equippedTitle" IS NOT NULL AND "equippedAchievementKey" IS NULL;

ALTER TABLE "Character" DROP COLUMN "equippedTitle";

-- Grant Founder to all existing characters (early-tester honorific).
INSERT INTO "CharacterAchievement" ("id", "characterId", "achievementId", "unlockedAt")
SELECT concat('cae_founder_', "id"), "id", 'ach_founder', CURRENT_TIMESTAMP
FROM "Character";
