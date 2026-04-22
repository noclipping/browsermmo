-- CreateEnum
CREATE TYPE "CharacterClass" AS ENUM ('WARRIOR', 'MAGE', 'ROGUE');
CREATE TYPE "ItemSlot" AS ENUM ('WEAPON', 'HELMET', 'CHEST', 'GLOVES', 'BOOTS', 'RING', 'AMULET');
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3)
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Region" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "minLevel" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "Character" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "class" "CharacterClass" NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "hp" INTEGER NOT NULL,
  "maxHp" INTEGER NOT NULL,
  "attack" INTEGER NOT NULL,
  "defense" INTEGER NOT NULL,
  "speed" INTEGER NOT NULL,
  "critChance" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  "gold" INTEGER NOT NULL DEFAULT 0,
  "regionId" TEXT NOT NULL REFERENCES "Region"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "name")
);

CREATE TABLE "Enemy" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "hp" INTEGER NOT NULL,
  "attack" INTEGER NOT NULL,
  "defense" INTEGER NOT NULL,
  "speed" INTEGER NOT NULL,
  "xpReward" INTEGER NOT NULL,
  "goldMin" INTEGER NOT NULL,
  "goldMax" INTEGER NOT NULL,
  "regionId" TEXT NOT NULL REFERENCES "Region"("id"),
  "isDungeonBoss" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "Dungeon" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "minLevel" INTEGER NOT NULL,
  "regionId" TEXT NOT NULL REFERENCES "Region"("id"),
  "bossEnemyId" TEXT NOT NULL REFERENCES "Enemy"("id")
);

CREATE TABLE "Item" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "slot" "ItemSlot" NOT NULL,
  "rarity" "Rarity" NOT NULL,
  "requiredLevel" INTEGER NOT NULL DEFAULT 1,
  "attack" INTEGER NOT NULL DEFAULT 0,
  "defense" INTEGER NOT NULL DEFAULT 0,
  "hp" INTEGER NOT NULL DEFAULT 0,
  "speed" INTEGER NOT NULL DEFAULT 0,
  "value" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "InventoryItem" (
  "id" TEXT PRIMARY KEY,
  "characterId" TEXT NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "itemId" TEXT NOT NULL REFERENCES "Item"("id"),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("characterId", "itemId")
);

CREATE TABLE "CharacterEquipment" (
  "id" TEXT PRIMARY KEY,
  "characterId" TEXT NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "slot" "ItemSlot" NOT NULL,
  "itemId" TEXT REFERENCES "Item"("id"),
  UNIQUE ("characterId", "slot")
);

CREATE TABLE "LootTableEntry" (
  "id" TEXT PRIMARY KEY,
  "enemyId" TEXT NOT NULL REFERENCES "Enemy"("id") ON DELETE CASCADE,
  "itemId" TEXT NOT NULL REFERENCES "Item"("id"),
  "chance" DOUBLE PRECISION NOT NULL
);

CREATE TABLE "CombatLog" (
  "id" TEXT PRIMARY KEY,
  "characterId" TEXT NOT NULL REFERENCES "Character"("id") ON DELETE CASCADE,
  "enemyId" TEXT NOT NULL REFERENCES "Enemy"("id"),
  "outcome" TEXT NOT NULL,
  "turns" INTEGER NOT NULL,
  "log" JSONB NOT NULL,
  "xpGained" INTEGER NOT NULL,
  "goldGained" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
