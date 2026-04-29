-- Phase 3 foundation: guilds, members, invites, donations, and async guild chat.

CREATE TYPE "GuildRole" AS ENUM ('OWNER', 'OFFICER', 'MEMBER');
CREATE TYPE "GuildInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GuildRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildInvite" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "GuildInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuildInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildDonation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildDonation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildChatMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");
CREATE UNIQUE INDEX "GuildMember_userId_key" ON "GuildMember"("userId");
CREATE UNIQUE INDEX "GuildMember_guildId_userId_key" ON "GuildMember"("guildId", "userId");
CREATE UNIQUE INDEX "GuildInvite_guildId_inviteeId_key" ON "GuildInvite"("guildId", "inviteeId");
CREATE INDEX "GuildMember_guildId_role_idx" ON "GuildMember"("guildId", "role");
CREATE INDEX "GuildInvite_inviteeId_status_idx" ON "GuildInvite"("inviteeId", "status");
CREATE INDEX "GuildInvite_guildId_status_idx" ON "GuildInvite"("guildId", "status");
CREATE INDEX "GuildDonation_guildId_createdAt_idx" ON "GuildDonation"("guildId", "createdAt");
CREATE INDEX "GuildDonation_userId_createdAt_idx" ON "GuildDonation"("userId", "createdAt");
CREATE INDEX "GuildChatMessage_guildId_createdAt_idx" ON "GuildChatMessage"("guildId", "createdAt");

ALTER TABLE "Guild" ADD CONSTRAINT "Guild_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildInvite" ADD CONSTRAINT "GuildInvite_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildInvite" ADD CONSTRAINT "GuildInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildInvite" ADD CONSTRAINT "GuildInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildDonation" ADD CONSTRAINT "GuildDonation_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildDonation" ADD CONSTRAINT "GuildDonation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildChatMessage" ADD CONSTRAINT "GuildChatMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildChatMessage" ADD CONSTRAINT "GuildChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
