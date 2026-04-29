import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GuildXpAwardReason = "gold_donation" | "item_donation" | "enemy_kill" | "guild_boss";

export async function awardGuildXp(
  tx: Prisma.TransactionClient,
  guildId: string,
  amount: number,
  reason: GuildXpAwardReason,
): Promise<void> {
  void reason;
  if (amount <= 0) return;
  await tx.guild.update({
    where: { id: guildId },
    data: { xp: { increment: amount } },
  });
}

export async function getGuildXpForUser(userId: string): Promise<number | null> {
  const row = await prisma.guildMember.findUnique({
    where: { userId },
    select: { guild: { select: { xp: true } } },
  });
  return row?.guild.xp ?? null;
}
