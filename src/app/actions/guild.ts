"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import {
  canDemoteOfficerToMember,
  canEditGuildBranding,
  canPromoteInitiateToMember,
  canPromoteMemberToOfficer,
} from "@/lib/game/guild-rank";
import { pickGuildSuccessorPlain } from "@/lib/game/guild-succession";
import { isGuildSymbol } from "@/lib/game/guild-symbols";
import { unlockGuildboundForUserTx } from "@/lib/game/achievements";
import {
  fetchMilestoneCountersJsonTx,
  reevaluateMilestoneAchievements,
  sqlSetMilestoneCountersTx,
} from "@/lib/game/milestone-achievements";
import { queueAchievementToasts } from "@/lib/achievement-toast-server";
import { mergeAchievementKeys } from "@/lib/merge-achievement-keys";
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

function canManageGuild(role: "OWNER" | "OFFICER" | "MEMBER" | "INITIATE") {
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
    const keys = await prisma.$transaction(async (tx) => {
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
      const g = await unlockGuildboundForUserTx(tx, user.id);
      const c = await tx.character.findFirst({ where: { userId: user.id }, select: { id: true } });
      const r = c ? await reevaluateMilestoneAchievements(tx, c.id) : [];
      return mergeAchievementKeys(g, r);
    });
    await queueAchievementToasts(keys);
  } catch {
    return "Guild name is already taken.";
  }

  revalidateGuildPaths();
  revalidatePath("/character");
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
  if (!canEditGuildBranding(me.role)) return "Only the guild leader or officers can set the guild symbol.";

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
    const keys = await prisma.$transaction(async (tx) => {
      await tx.guildInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED" },
      });
      await tx.guildMember.create({
        data: {
          guildId: invite.guildId,
          userId: user.id,
          role: "INITIATE",
        },
      });
      const g = await unlockGuildboundForUserTx(tx, user.id);
      const c = await tx.character.findFirst({ where: { userId: user.id }, select: { id: true } });
      const r = c ? await reevaluateMilestoneAchievements(tx, c.id) : [];
      return mergeAchievementKeys(g, r);
    });
    await queueAchievementToasts(keys);
  } catch {
    return "Could not join guild.";
  }

  revalidateGuildPaths();
  revalidatePath("/character");
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

  if (me.role !== "OWNER") {
    await prisma.guildMember.delete({ where: { userId: user.id } });
    revalidateGuildPaths();
    return null;
  }

  const members = await prisma.guildMember.findMany({
    where: { guildId: me.guildId },
    select: { userId: true, role: true, joinedAt: true },
  });
  const successor = pickGuildSuccessorPlain(members, user.id);
  if (!successor) {
    return "Invite another member (or promote someone) before leaving — the guild must have a successor.";
  }

  await prisma.$transaction(async (tx) => {
    await tx.guild.update({
      where: { id: me.guildId },
      data: { ownerId: successor.userId },
    });
    await tx.guildMember.update({
      where: { userId: successor.userId },
      data: { role: "OWNER" },
    });
    await tx.guildMember.delete({ where: { userId: user.id } });
  });

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

  const keys = await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: { gold: { decrement: amount } },
    });
    const mc = await fetchMilestoneCountersJsonTx(tx, character.id);
    const prev = typeof mc.goldDonatedGuild === "number" && Number.isFinite(mc.goldDonatedGuild) ? Math.floor(mc.goldDonatedGuild) : 0;
    mc.goldDonatedGuild = prev + amount;
    await sqlSetMilestoneCountersTx(tx, character.id, mc);
    await tx.guildDonation.create({
      data: {
        guildId: me.guildId,
        userId: user.id,
        amount,
      },
    });
    await awardGuildXp(tx, me.guildId, amount, "gold_donation");
    return reevaluateMilestoneAchievements(tx, character.id);
  });
  await queueAchievementToasts(keys);

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

export async function updateGuildDescriptionAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me) return "You must be in a guild.";
  if (!canEditGuildBranding(me.role)) return "Only the guild leader or officers can edit the guild bio.";

  const descriptionParsed = guildDescriptionSchema.safeParse(String(formData.get("description") ?? ""));
  if (!descriptionParsed.success) return "Guild description is too long.";

  await prisma.guild.update({
    where: { id: me.guildId },
    data: { description: descriptionParsed.data },
  });

  revalidateGuildPaths();
  return null;
}

export async function transferGuildOwnershipAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me || me.role !== "OWNER") return "Only the guild leader can transfer ownership.";

  const targetParsed = cuidSchema.safeParse(String(formData.get("targetUserId") ?? ""));
  if (!targetParsed.success) return "Invalid member.";
  if (targetParsed.data === user.id) return "Choose another member.";

  const target = await prisma.guildMember.findUnique({ where: { userId: targetParsed.data } });
  if (!target || target.guildId !== me.guildId) return "That player is not in your guild.";
  if (target.role === "OWNER") return "Invalid target.";

  const keys = await prisma.$transaction(async (tx) => {
    await tx.guild.update({
      where: { id: me.guildId },
      data: { ownerId: target.userId },
    });
    await tx.guildMember.update({
      where: { userId: user.id },
      data: { role: "MEMBER" },
    });
    await tx.guildMember.update({
      where: { userId: target.userId },
      data: { role: "OWNER" },
    });
    const oldLeaderChar = await tx.character.findFirst({ where: { userId: user.id }, select: { id: true } });
    const newLeaderChar = await tx.character.findFirst({ where: { userId: target.userId }, select: { id: true } });
    let acc: string[] = [];
    if (oldLeaderChar) acc = mergeAchievementKeys(acc, await reevaluateMilestoneAchievements(tx, oldLeaderChar.id));
    if (newLeaderChar) acc = mergeAchievementKeys(acc, await reevaluateMilestoneAchievements(tx, newLeaderChar.id));
    return acc;
  });
  await queueAchievementToasts(keys);

  revalidateGuildPaths();
  revalidatePath("/character");
  return null;
}

export async function promoteGuildMemberToMemberAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me || !canPromoteInitiateToMember(me.role)) return "You cannot promote members.";

  const targetParsed = cuidSchema.safeParse(String(formData.get("targetUserId") ?? ""));
  if (!targetParsed.success) return "Invalid member.";

  const target = await prisma.guildMember.findUnique({ where: { userId: targetParsed.data } });
  if (!target || target.guildId !== me.guildId) return "Member not found.";
  if (target.role !== "INITIATE") return "That player is not an Initiate.";

  await prisma.guildMember.update({
    where: { userId: target.userId },
    data: { role: "MEMBER" },
  });

  revalidateGuildPaths();
  return null;
}

export async function promoteGuildMemberToOfficerAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me || !canPromoteMemberToOfficer(me.role)) return "Only the guild leader can promote officers.";

  const targetParsed = cuidSchema.safeParse(String(formData.get("targetUserId") ?? ""));
  if (!targetParsed.success) return "Invalid member.";

  const target = await prisma.guildMember.findUnique({ where: { userId: targetParsed.data } });
  if (!target || target.guildId !== me.guildId) return "Member not found.";
  if (target.role !== "MEMBER") return "Only Members can be promoted to Officer.";

  const keys = await prisma.$transaction(async (tx) => {
    await tx.guildMember.update({
      where: { userId: target.userId },
      data: { role: "OFFICER" },
    });
    const promotedChar = await tx.character.findFirst({
      where: { userId: target.userId },
      select: { id: true },
    });
    if (!promotedChar) return [];
    return reevaluateMilestoneAchievements(tx, promotedChar.id);
  });
  await queueAchievementToasts(keys);

  revalidateGuildPaths();
  revalidatePath("/character");
  return null;
}

export async function demoteGuildOfficerToMemberAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const me = await getMyMembership(user.id);
  if (!me || !canDemoteOfficerToMember(me.role)) return "Only the guild leader can demote officers.";

  const targetParsed = cuidSchema.safeParse(String(formData.get("targetUserId") ?? ""));
  if (!targetParsed.success) return "Invalid member.";
  if (targetParsed.data === user.id) return "Use transfer ownership to step down.";

  const target = await prisma.guildMember.findUnique({ where: { userId: targetParsed.data } });
  if (!target || target.guildId !== me.guildId) return "Member not found.";
  if (target.role !== "OFFICER") return "That player is not an Officer.";

  await prisma.guildMember.update({
    where: { userId: target.userId },
    data: { role: "MEMBER" },
  });

  revalidateGuildPaths();
  return null;
}
