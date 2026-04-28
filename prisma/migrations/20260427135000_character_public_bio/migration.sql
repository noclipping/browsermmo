-- Add always-public character bio/tagline for Phase 1 identity.
ALTER TABLE "Character"
ADD COLUMN "bio" TEXT NOT NULL DEFAULT '';
