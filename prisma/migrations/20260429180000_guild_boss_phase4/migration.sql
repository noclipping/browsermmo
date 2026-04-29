-- CreateEnum
CREATE TYPE "GuildBossSeasonStatus" AS ENUM ('ACTIVE', 'DEFEATED');

-- CreateEnum
CREATE TYPE "GuildBossAttemptStatus" AS ENUM ('PENDING', 'COMPLETED', 'VOIDED');

-- CreateTable
CREATE TABLE "GuildBossSeason" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "bossKey" TEXT NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "memberCountAtStart" INTEGER NOT NULL,
    "status" "GuildBossSeasonStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defeatedAt" TIMESTAMP(3),

    CONSTRAINT "GuildBossSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildBossAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "bossKey" TEXT NOT NULL,
    "status" "GuildBossAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GuildBossAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildBossContribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "damageTotal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildBossContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildBossRewardClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "participationClaimedAt" TIMESTAMP(3),
    "clearClaimedAt" TIMESTAMP(3),

    CONSTRAINT "GuildBossRewardClaim_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SoloCombatEncounter" ADD COLUMN "guildBossAttemptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SoloCombatEncounter_guildBossAttemptId_key" ON "SoloCombatEncounter"("guildBossAttemptId");

-- CreateIndex
CREATE INDEX "GuildBossSeason_guildId_status_idx" ON "GuildBossSeason"("guildId", "status");

-- At most one ACTIVE season per guild (async boss progression).
CREATE UNIQUE INDEX "GuildBossSeason_one_active_per_guild" ON "GuildBossSeason"("guildId") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "GuildBossAttempt_userId_guildId_status_completedAt_idx" ON "GuildBossAttempt"("userId", "guildId", "status", "completedAt");

-- CreateIndex
CREATE INDEX "GuildBossAttempt_seasonId_idx" ON "GuildBossAttempt"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildBossContribution_userId_seasonId_key" ON "GuildBossContribution"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildBossRewardClaim_userId_seasonId_key" ON "GuildBossRewardClaim"("userId", "seasonId");

-- AddForeignKey
ALTER TABLE "GuildBossSeason" ADD CONSTRAINT "GuildBossSeason_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossAttempt" ADD CONSTRAINT "GuildBossAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossAttempt" ADD CONSTRAINT "GuildBossAttempt_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossAttempt" ADD CONSTRAINT "GuildBossAttempt_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GuildBossSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossContribution" ADD CONSTRAINT "GuildBossContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossContribution" ADD CONSTRAINT "GuildBossContribution_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossContribution" ADD CONSTRAINT "GuildBossContribution_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GuildBossSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossRewardClaim" ADD CONSTRAINT "GuildBossRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossRewardClaim" ADD CONSTRAINT "GuildBossRewardClaim_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildBossRewardClaim" ADD CONSTRAINT "GuildBossRewardClaim_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GuildBossSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloCombatEncounter" ADD CONSTRAINT "SoloCombatEncounter_guildBossAttemptId_fkey" FOREIGN KEY ("guildBossAttemptId") REFERENCES "GuildBossAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
