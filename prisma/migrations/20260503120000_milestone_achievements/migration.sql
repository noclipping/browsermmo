-- Milestone JSON + daily chest lifetime counter; expand achievement catalog.

-- Idempotent: daily chest column may already exist from an earlier migration applied out-of-order or manually.
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "dailyChestsClaimedLifetime" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "milestoneCounters" JSONB NOT NULL DEFAULT '{}';

UPDATE "Achievement" SET
  "name" = 'Ratbane',
  "description" = 'Defeat the Sewer Rat King with your guild.',
  "sortOrder" = 2
WHERE "key" = 'ratbane';

UPDATE "Achievement" SET
  "name" = 'Guildbound',
  "description" = 'Join or create a guild.',
  "sortOrder" = 22
WHERE "key" = 'guildbound';

UPDATE "Achievement" SET
  "name" = 'Treasurekeeper',
  "description" = 'Deposit 10 item stacks into a guild treasury.',
  "sortOrder" = 24
WHERE "key" = 'treasurekeeper';

UPDATE "Achievement" SET
  "sortOrder" = 29
WHERE "key" = 'mythic_blessed';

UPDATE "Achievement" SET
  "sortOrder" = 39
WHERE "key" = 'founder';

INSERT INTO "Achievement" ("id", "key", "name", "description", "icon", "titleReward", "sortOrder")
SELECT * FROM (VALUES
  ('ach_first_blood', 'first_blood', 'First Blood', 'Win your first solo fight.', '⚔️', 'Firstblood', 0),
  ('ach_survivor', 'survivor', 'Survivor', 'Win a solo fight at or below 20% HP.', '🛡️', 'Survivor', 1),
  ('ach_armed', 'armed', 'Armed', 'Equip a weapon.', '🗡️', NULL::text, 3),
  ('ach_prepared', 'prepared', 'Prepared', 'Drink a crimson tonic.', '🧪', NULL::text, 4),
  ('ach_novice_adventurer', 'novice_adventurer', 'Novice Adventurer', 'Reach level 5.', '⭐', 'Novice', 5),
  ('ach_seasoned_adventurer', 'seasoned_adventurer', 'Seasoned Adventurer', 'Reach level 10.', '✨', 'Seasoned', 6),
  ('ach_veteran', 'veteran', 'Veteran', 'Reach level 25.', '🎖️', 'Veteran', 7),
  ('ach_paragon', 'paragon', 'Paragon', 'Reach level 50.', '💎', 'Paragon', 8),
  ('ach_greenhorn', 'greenhorn', 'Greenhorn', 'Reach level 3.', '🌱', NULL::text, 9),
  ('ach_journeyman', 'journeyman', 'Journeyman', 'Reach level 15.', '🧭', NULL::text, 10),
  ('ach_keystone', 'keystone', 'Keystone', 'Reach level 30.', '🏔️', NULL::text, 11),
  ('ach_luminous', 'luminous', 'Luminous', 'Reach level 40.', '🔆', NULL::text, 12),
  ('ach_colossus', 'colossus', 'Colossus', 'Reach level 45.', '🗿', NULL::text, 13),
  ('ach_bladebound', 'bladebound', 'Bladebound', 'Deal 1,000 total melee damage (solo or guild raid).', '⚔️', 'Bladebound', 14),
  ('ach_spellscarred', 'spellscarred', 'Spellscarred', 'Deal 1,000 total magic damage.', '🔥', 'Spellscarred', 15),
  ('ach_deadeye', 'deadeye', 'Deadeye', 'Deal 1,000 total ranged damage.', '🏹', 'Deadeye', 16),
  ('ach_unbroken', 'unbroken', 'Unbroken', 'Brace 100 times (Defend).', '🛡️', 'Unbroken', 17),
  ('ach_executioner', 'executioner', 'Executioner', 'Land 100 killing blows.', '☠️', 'Executioner', 18),
  ('ach_relentless', 'relentless', 'Relentless', 'Win 10 solo fights.', '🔥', NULL::text, 19),
  ('ach_champion', 'champion', 'Champion', 'Win 50 solo fights.', '🏅', NULL::text, 20),
  ('ach_deathless', 'deathless', 'Deathless', 'Win 25 solo fights in a row without defeat.', '👻', 'Deathless', 21),
  ('ach_treasury_hand', 'treasury_hand', 'Treasury Hand', 'Deposit 5 item stacks into a guild treasury.', '📥', NULL::text, 23),
  ('ach_oathbearer', 'oathbearer', 'Oathbearer', 'Become a guild leader or officer.', '⚜️', 'Oathbearer', 25),
  ('ach_benefactor', 'benefactor', 'Benefactor', 'Donate 10,000 total gold to guilds.', '💰', 'Benefactor', 26),
  ('ach_returning_soul', 'returning_soul', 'Returning Soul', 'Claim 3 daily login chests.', '🌅', NULL::text, 27),
  ('ach_oathkeeper', 'oathkeeper', 'Oathkeeper', 'Claim 7 daily login chests.', '📜', 'Oathkeeper', 28),
  ('ach_forest_walker', 'forest_walker', 'Forest Walker', 'Travel to Forest Edge.', '🌲', NULL::text, 30),
  ('ach_ruin_seeker', 'ruin_seeker', 'Ruin Seeker', 'Travel to Ancient Ruins.', '🏛️', NULL::text, 31),
  ('ach_catacomb_delver', 'catacomb_delver', 'Catacomb Delver', 'Travel to Murk Catacombs.', '🦇', NULL::text, 32),
  ('ach_bossbreaker', 'bossbreaker', 'Bossbreaker', 'Deal 10,000 total damage to guild raid bosses.', '💥', 'Bossbreaker', 33),
  ('ach_duskforged', 'duskforged', 'Duskforged', 'Unlock 30 achievements.', '🌑', 'Duskforged', 34),
  ('ach_discerning_eye', 'discerning_eye', 'Discerning Eye', 'Equip a Rare or better item.', '💠', NULL::text, 35),
  ('ach_full_kit', 'full_kit', 'Full Kit', 'Wear a weapon, helm, chest, gloves, and boots.', '🎭', NULL::text, 36),
  ('ach_steady_aim', 'steady_aim', 'Steady Aim', 'Win 5 solo fights in a row.', '🎯', NULL::text, 37),
  ('ach_scout', 'scout', 'Scout', 'Visit three different wild regions (excluding town).', '🧭', NULL::text, 38)
) AS t("id", "key", "name", "description", "icon", "titleReward", "sortOrder")
WHERE NOT EXISTS (SELECT 1 FROM "Achievement" a WHERE a.key = t.key);
