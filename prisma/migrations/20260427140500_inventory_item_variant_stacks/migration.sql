-- Allow multiple stacks per base item when forge/affix rolls differ.
ALTER TABLE "InventoryItem"
DROP CONSTRAINT IF EXISTS "InventoryItem_characterId_itemId_key";

ALTER TABLE "InventoryItem"
ADD CONSTRAINT "InventoryItem_characterId_itemId_forge_affix_bonus_key" UNIQUE (
  "characterId",
  "itemId",
  "forgeLevel",
  "affixPrefix",
  "bonusLifeSteal",
  "bonusCritChance",
  "bonusSkillPower",
  "bonusStrength",
  "bonusConstitution",
  "bonusIntelligence",
  "bonusDexterity"
);

CREATE INDEX IF NOT EXISTS "InventoryItem_characterId_itemId_idx"
ON "InventoryItem" ("characterId", "itemId");
