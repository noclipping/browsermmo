"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const idSchema = z.string().cuid();

function revalidateSocial() {
  revalidatePath("/friends");
  revalidatePath("/players");
  revalidatePath("/social/directory");
  revalidatePath("/social/friends");
  revalidatePath("/social/requests");
}

export async function sendFriendRequestAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const parsedId = idSchema.safeParse(targetUserId);
  if (!parsedId.success) return "Invalid player.";

  if (parsedId.data === user.id) return "You cannot add yourself.";

  const [forward, reverse] = await Promise.all([
    prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: { requesterId: user.id, addresseeId: parsedId.data },
      },
    }),
    prisma.friendship.findUnique({
      where: {
        requesterId_addresseeId: { requesterId: parsedId.data, addresseeId: user.id },
      },
    }),
  ]);

  if (forward?.status === "PENDING") return "Friend request already sent.";
  if (reverse?.status === "PENDING") {
    return "This player already sent you a request. Accept or decline it below.";
  }
  if (forward?.status === "ACCEPTED" || reverse?.status === "ACCEPTED") {
    return "You are already friends.";
  }

  if (forward && (forward.status === "DECLINED" || forward.status === "CANCELLED")) {
    await prisma.friendship.update({
      where: { id: forward.id },
      data: { status: "PENDING" },
    });
    revalidateSocial();
    const target = await prisma.character.findFirst({
      where: { userId: parsedId.data },
      select: { name: true },
    });
    if (target?.name) revalidatePath(`/player/${encodeURIComponent(target.name)}`);
    return null;
  }

  await prisma.friendship.create({
    data: {
      requesterId: user.id,
      addresseeId: parsedId.data,
      status: "PENDING",
    },
  });
  revalidateSocial();
  const target = await prisma.character.findFirst({
    where: { userId: parsedId.data },
    select: { name: true },
  });
  if (target?.name) revalidatePath(`/player/${encodeURIComponent(target.name)}`);
  return null;
}

export async function cancelOutgoingFriendRequestAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  const parsedId = idSchema.safeParse(friendshipId);
  if (!parsedId.success) return "Invalid request.";

  const row = await prisma.friendship.findUnique({ where: { id: parsedId.data } });
  if (!row || row.requesterId !== user.id || row.status !== "PENDING") {
    return "Could not cancel that request.";
  }

  await prisma.friendship.update({
    where: { id: row.id },
    data: { status: "CANCELLED" },
  });
  revalidateSocial();
  const otherId = row.addresseeId;
  const target = await prisma.character.findFirst({
    where: { userId: otherId },
    select: { name: true },
  });
  if (target?.name) revalidatePath(`/player/${encodeURIComponent(target.name)}`);
  return null;
}

export async function acceptFriendRequestAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  const parsedId = idSchema.safeParse(friendshipId);
  if (!parsedId.success) return "Invalid request.";

  const row = await prisma.friendship.findUnique({ where: { id: parsedId.data } });
  if (!row || row.addresseeId !== user.id || row.status !== "PENDING") {
    return "Could not accept that request.";
  }

  await prisma.friendship.update({
    where: { id: row.id },
    data: { status: "ACCEPTED" },
  });
  revalidateSocial();
  const target = await prisma.character.findFirst({
    where: { userId: row.requesterId },
    select: { name: true },
  });
  if (target?.name) revalidatePath(`/player/${encodeURIComponent(target.name)}`);
  return null;
}

export async function declineFriendRequestAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  const parsedId = idSchema.safeParse(friendshipId);
  if (!parsedId.success) return "Invalid request.";

  const row = await prisma.friendship.findUnique({ where: { id: parsedId.data } });
  if (!row || row.addresseeId !== user.id || row.status !== "PENDING") {
    return "Could not decline that request.";
  }

  await prisma.friendship.update({
    where: { id: row.id },
    data: { status: "DECLINED" },
  });
  revalidateSocial();
  const target = await prisma.character.findFirst({
    where: { userId: row.requesterId },
    select: { name: true },
  });
  if (target?.name) revalidatePath(`/player/${encodeURIComponent(target.name)}`);
  return null;
}

export async function removeFriendAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  const parsedId = idSchema.safeParse(friendshipId);
  if (!parsedId.success) return "Invalid request.";

  const row = await prisma.friendship.findUnique({ where: { id: parsedId.data } });
  if (!row || row.status !== "ACCEPTED") return "Could not remove that friendship.";
  if (row.requesterId !== user.id && row.addresseeId !== user.id) {
    return "Not allowed.";
  }

  const otherUserId = row.requesterId === user.id ? row.addresseeId : row.requesterId;
  await prisma.friendship.delete({ where: { id: row.id } });
  revalidateSocial();
  const target = await prisma.character.findFirst({
    where: { userId: otherUserId },
    select: { name: true },
  });
  if (target?.name) revalidatePath(`/player/${encodeURIComponent(target.name)}`);
  return null;
}
