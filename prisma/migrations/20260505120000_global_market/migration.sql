-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerCharacterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceGold" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "forgeLevel" INTEGER NOT NULL DEFAULT 0,
    "affixPrefix" TEXT,
    "bonusLifeSteal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusCritChance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusSkillPower" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusStrength" INTEGER NOT NULL DEFAULT 0,
    "bonusConstitution" INTEGER NOT NULL DEFAULT 0,
    "bonusIntelligence" INTEGER NOT NULL DEFAULT 0,
    "bonusDexterity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketListing_createdAt_idx" ON "MarketListing"("createdAt");

-- CreateIndex
CREATE INDEX "MarketListing_sellerCharacterId_idx" ON "MarketListing"("sellerCharacterId");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerCharacterId_fkey" FOREIGN KEY ("sellerCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
