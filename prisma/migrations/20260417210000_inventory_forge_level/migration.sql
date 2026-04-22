-- Smithing reinforcement carried on inventory stacks (same as equipped piece).
ALTER TABLE "InventoryItem" ADD COLUMN "forgeLevel" INTEGER NOT NULL DEFAULT 0;
