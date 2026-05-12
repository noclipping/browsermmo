-- Forest Edge: Tree Ent miniboss gate (mirrors outskirts pattern) + dire wolf streak for pity Alpha spawn.
ALTER TABLE "Character" ADD COLUMN "forestWinsSinceBoss" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Character" ADD COLUMN "forestBossAt" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Character" ADD COLUMN "forestConsecutiveDireWolfWins" INTEGER NOT NULL DEFAULT 0;
