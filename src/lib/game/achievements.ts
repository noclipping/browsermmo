import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Display string for an equipped achievement title (public UI). */
export async function displayTitleForEquippedKey(equippedAchievementKey: string | null | undefined): Promise<string | null> {
  if (!equippedAchievementKey) return null;
  const row = await prisma.achievement.findUnique({
    where: { key: equippedAchievementKey },
    select: { titleReward: true },
  });
  return row?.titleReward?.trim() || null;
}

/** Share of characters with this achievement unlocked (for UI). */
export function formatAchievementPlayerPercentLabel(unlockedCount: number, totalCharacters: number): string {
  if (totalCharacters <= 0) return "0% of players";
  const pct = (unlockedCount / totalCharacters) * 100;
  const rounded = Math.round(pct);
  if (unlockedCount > 0 && rounded === 0) return "<1% of players";
  return `${rounded}% of players`;
}

/** Guild boss season key for Sewer Rat King (see `guild-boss-definitions`). */
export const SEWER_RAT_KING_BOSS_KEY = "sewer_rat_king";

export const ACHIEVEMENT_KEYS = {
  RATBANE: "ratbane",
  GUILDBOUND: "guildbound",
  TREASUREKEEPER: "treasurekeeper",
  MYTHIC_BLESSED: "mythic_blessed",
  FOUNDER: "founder",
} as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[keyof typeof ACHIEVEMENT_KEYS];

export async function unlockAchievementTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  achievementKey: string,
): Promise<boolean> {
  const ach = await tx.achievement.findUnique({
    where: { key: achievementKey },
    select: { id: true },
  });
  if (!ach) return false;
  const existing = await tx.characterAchievement.findUnique({
    where: {
      characterId_achievementId: { characterId, achievementId: ach.id },
    },
  });
  if (existing) return false;
  await tx.characterAchievement.create({
    data: { characterId, achievementId: ach.id },
  });
  return true;
}

export async function unlockGuildboundForUserTx(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
  const c = await tx.character.findFirst({ where: { userId }, select: { id: true } });
  if (!c) return [];
  const created = await unlockAchievementTx(tx, c.id, ACHIEVEMENT_KEYS.GUILDBOUND);
  return created ? [ACHIEVEMENT_KEYS.GUILDBOUND] : [];
}

export async function tryUnlockRatbaneGuildBossTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  guildDefeated: boolean,
  bossKey: string,
): Promise<boolean> {
  if (!guildDefeated || bossKey !== SEWER_RAT_KING_BOSS_KEY) return false;
  return unlockAchievementTx(tx, characterId, ACHIEVEMENT_KEYS.RATBANE);
}
