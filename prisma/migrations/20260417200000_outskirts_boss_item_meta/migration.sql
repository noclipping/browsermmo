-- Town outskirts miniboss pacing (wins since last fencer vs threshold).
ALTER TABLE "Character" ADD COLUMN "outskirtsWinsSinceBoss" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Character" ADD COLUMN "outskirtsBossAt" INTEGER NOT NULL DEFAULT 4;

-- Adventure-only miniboss (e.g. Sewer Fencer) — not a dungeon boss.
ALTER TABLE "Enemy" ADD COLUMN "isAdventureMiniBoss" BOOLEAN NOT NULL DEFAULT false;

-- Item flavor + vendor sell price.
ALTER TABLE "Item" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Item" ADD COLUMN "sellPrice" INTEGER NOT NULL DEFAULT 0;
