-- Per-slot reinforcement tier (displayed as "Item Name +N", bonuses layered in buildCharacterStats).
ALTER TABLE "CharacterEquipment" ADD COLUMN "forgeLevel" INTEGER NOT NULL DEFAULT 0;
