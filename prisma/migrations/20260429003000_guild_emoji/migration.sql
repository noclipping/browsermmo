-- Phase 3 follow-up: configurable guild emoji.
ALTER TABLE "Guild"
ADD COLUMN "emoji" TEXT NOT NULL DEFAULT '🛡️';
