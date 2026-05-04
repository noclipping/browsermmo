-- Nullable equipped title for character sheet / profile display.

ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "equippedTitle" TEXT;
