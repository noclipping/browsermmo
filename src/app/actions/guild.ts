"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { isGuildSymbol } from "@/lib/game/guild-symbols";
import { awardGuildXp } from "@/lib/game/guild-xp";
import { prisma } from "@/lib/prisma";

const guildNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9 _-]+$/);

const guildDescriptionSchema = z.string().trim().max(180);
const guildEmojiSchema = z.string().trim().min(1).max(8);
const characterNameSchema = z.string().trim().min(2).max(24);
const cuidSchema = z.string().cuid();
const donationAmountSchema = z.coerce.number().int().min(1).max(1000000);
const guildChatSchema = z.string().trim().min(1).max(300);

function revalidateGuildPaths() {
  revalidatePath("/guild");
  revalidatePath("/friends");
  revalidatePath("/players");
}

async function getMyMembership(userId: string) {
  return prisma.guildMember.findUnique({
    where: { userId },
    include: { guild: true },
  });
}

function canManageGuild(role: "OWNER" | "OFFICER" | "MEMBER") {
  return role === "OWNER" || role === "OFFICER";
}

export async function createGuildAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const existing = await getMyMembership(user.id);
  if (existing) return "You are already in a guild.";

  const nameParsed = guildNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!nameParsed.success) return "Guild name must be 3-24 chars (letters, numbers, spaces, _ or -).";
  const descriptionParsed = guildDescriptionSchema.safeParse(String(formData.get("description") ?? ""));
  if (!descriptionParsed.success) return "Guild description is too long.";

  try {
    await prisma.$transaction(async (tx) => {
      const guild = await tx.guild.create({
        data: {
          name: nameParsed.data,
          description: descriptionParsed.data,
          ownerId: user.id,
        },
      });
      await tx.guildMember.create({
        data: {
          guildId: guild.id,
          userId: user.id,
          role: "OWNER",
        },
      });
    });
  } catch {
    return "Guild name is already taken.";
  }

  revalidateGuildPaths();
  return null;
}

export async function inviteToGuildAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me) return "You must be in a guild.";
  if (!canManageGuild(me.role)) return "Only owner or officers can invite.";

  const inviteeNameParsed = characterNameSchema.safeParse(String(formData.get("characterName") ?? ""));
  if (!inviteeNameParsed.success) return "Enter a valid character name.";

  const inviteeCharacter = await prisma.character.findFirst({
    where: { name: { equals: inviteeNameParsed.data, mode: "insensitive" } },
    select: { userId: true, name: true },
  });
  if (!inviteeCharacter) return "Character not found.";
  if (inviteeCharacter.userId === user.id) return "You cannot invite yourself.";

  const inviteeMembership = await getMyMembership(inviteeCharacter.userId);
  if (inviteeMembership) return "That player is already in a guild.";

  const existing = await prisma.guildInvite.findUnique({
    where: {
      guildId_inviteeId: { guildId: me.guildId, inviteeId: inviteeCharacter.userId },
    },
  });
  if (existing?.status === "PENDING") return "Invite already pending.";

  if (existing) {
    await prisma.guildInvite.update({
      where: { id: existing.id },
      data: { inviterId: user.id, status: "PENDING" },
    });
  } else {
    await prisma.guildInvite.create({
      data: {
        guildId: me.guildId,
        inviterId: user.id,
        inviteeId: inviteeCharacter.userId,
        status: "PENDING",
      },
    });
  }

  revalidateGuildPaths();
  return null;
}

export async function updateGuildEmojiAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me) return "You must be in a guild.";
  if (me.role !== "OWNER") return "Only guild leader can set guild emoji.";

  const emojiParsed = guildEmojiSchema.safeParse(String(formData.get("emoji") ?? ""));
  if (!emojiParsed.success) return "Enter a valid emoji.";
  if (!isGuildSymbol(emojiParsed.data)) return "Choose a symbol from the preset list.";

  await prisma.guild.update({
    where: { id: me.guildId },
    data: { emoji: emojiParsed.data },
  });

  revalidatePath("/guild");
  revalidatePath("/players");
  return null;
}

export async function acceptGuildInviteAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const already = await getMyMembership(user.id);
  if (already) return "Leave your current guild first.";

  const inviteIdParsed = cuidSchema.safeParse(String(formData.get("inviteId") ?? ""));
  if (!inviteIdParsed.success) return "Invalid invite.";

  const invite = await prisma.guildInvite.findUnique({ where: { id: inviteIdParsed.data } });
  if (!invite || invite.inviteeId !== user.id || invite.status !== "PENDING") {
    return "Invite is no longer valid.";
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.guildInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED" },
      });
      await tx.guildMember.create({
        data: {
          guildId: invite.guildId,
          userId: user.id,
          role: "MEMBER",
        },
      });
    });
  } catch {
    return "Could not join guild.";
  }

  revalidateGuildPaths();
  return null;
}

export async function declineGuildInviteAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const inviteIdParsed = cuidSchema.safeParse(String(formData.get("inviteId") ?? ""));
  if (!inviteIdParsed.success) return "Invalid invite.";

  const invite = await prisma.guildInvite.findUnique({ where: { id: inviteIdParsed.data } });
  if (!invite || invite.inviteeId !== user.id || invite.status !== "PENDING") {
    return "Invite is no longer valid.";
  }

  await prisma.guildInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED" },
  });
  revalidateGuildPaths();
  return null;
}

export async function cancelGuildInviteAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me || !canManageGuild(me.role)) return "Not allowed.";

  const inviteIdParsed = cuidSchema.safeParse(String(formData.get("inviteId") ?? ""));
  if (!inviteIdParsed.success) return "Invalid invite.";

  const invite = await prisma.guildInvite.findUnique({ where: { id: inviteIdParsed.data } });
  if (!invite || invite.guildId !== me.guildId || invite.status !== "PENDING") {
    return "Invite is no longer valid.";
  }

  await prisma.guildInvite.update({
    where: { id: invite.id },
    data: { status: "CANCELLED" },
  });
  revalidateGuildPaths();
  return null;
}

export async function leaveGuildAction(): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me) return "You are not in a guild.";
  if (me.role === "OWNER") return "Owner must transfer ownership before leaving (not added yet).";

  await prisma.guildMember.delete({ where: { userId: user.id } });
  revalidateGuildPaths();
  return null;
}

export async function kickGuildMemberAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me || !canManageGuild(me.role)) return "Not allowed.";

  const memberIdParsed = cuidSchema.safeParse(String(formData.get("memberUserId") ?? ""));
  if (!memberIdParsed.success) return "Invalid member.";
  if (memberIdParsed.data === user.id) return "Use leave instead.";

  const target = await prisma.guildMember.findUnique({ where: { userId: memberIdParsed.data } });
  if (!target || target.guildId !== me.guildId) return "Member not found.";
  if (target.role === "OWNER") return "Cannot kick owner.";
  if (me.role === "OFFICER" && target.role === "OFFICER") return "Officers cannot kick officers.";

  await prisma.guildMember.delete({ where: { userId: target.userId } });
  revalidateGuildPaths();
  return null;
}

export async function donateGuildGoldAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me) return "Join a guild first.";

  const amountParsed = donationAmountSchema.safeParse(formData.get("amount"));
  if (!amountParsed.success) return "Invalid amount.";
  const amount = amountParsed.data;

  const character = await requireCharacter(user.id);
  if (character.gold < amount) return "Not enough gold.";

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { decrement: amount } },
    });
    await tx.guildDonation.create({
      data: {
        guildId: me.guildId,
        userId: user.id,
        amount,
      },
    });
    await awardGuildXp(tx, me.guildId, amount, "gold_donation");
  });

  revalidateGuildPaths();
  return null;
}

export async function postGuildChatMessageAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me) return "Join a guild first.";

  const textParsed = guildChatSchema.safeParse(String(formData.get("text") ?? ""));
  if (!textParsed.success) return "Message must be 1-300 characters.";
  const character = await requireCharacter(user.id);

  await prisma.guildChatMessage.create({
    data: {
      guildId: me.guildId,
      userId: user.id,
      username: character.name,
      text: textParsed.data,
    },
  });

  revalidatePath("/guild");
  return null;
}
