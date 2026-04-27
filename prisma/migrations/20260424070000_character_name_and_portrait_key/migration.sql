-- Replace old per-user character-name uniqueness with global uniqueness.
ALTER TABLE "Character" DROP CONSTRAINT IF EXISTS "Character_userId_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Character_name_key" ON "Character"("name");

-- Persist selected portrait for use across screens.
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "portraitKey" TEXT;
