-- AlterTable (idempotent for re-deploy / drift)
ALTER TABLE "Achievement" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'legacy';
