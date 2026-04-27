/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Character` will be added. If there are existing duplicate values, this will fail.

*/
-- Drop old composite unique constraint from initial schema.
ALTER TABLE "Character" DROP CONSTRAINT IF EXISTS "Character_userId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");
