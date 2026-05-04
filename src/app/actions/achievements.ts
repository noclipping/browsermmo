"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { isAchievementDebugResetEnabled } from "@/lib/achievement-debug";
import { prisma } from "@/lib/prisma";

const keySchema = z.string().min(1).max(64);

/** Wipe all unlock rows and clear equipped title (testing). */
export async function debugResetAllAchievementsAction(): Promise<void> {
  if (!isAchievementDebugResetEnabled()) return;
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  await prisma.$transaction(async (tx) => {
    await tx.characterAchievement.deleteMany({ where: { characterId: character.id } });
    await tx.character.update({
      where: { id: character.id },
      data: {
        equippedAchievementKey: null,
        milestoneCounters: {},
        dailyChestsClaimedLifetime: 0,
        guildTreasuryItemsDeposited: 0,
      },
    });
  });

  revalidatePath("/character");
  revalidatePath("/players");
  revalidatePath(`/player/${encodeURIComponent(character.name)}`);
}

export type EquipAchievementTitleResult = { ok: true } | { ok: false; error: string };

export async function equipAchievementTitleAction(achievementKey: string | null): Promise<EquipAchievementTitleResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  if (achievementKey === null || achievementKey === "") {
    await prisma.character.update({
      where: { id: character.id },
      data: { equippedAchievementKey: null },
    });
    revalidatePath("/character");
    revalidatePath("/players");
    revalidatePath(`/player/${encodeURIComponent(character.name)}`);
    return { ok: true };
  }

  const parsed = keySchema.safeParse(achievementKey);
  if (!parsed.success) return { ok: false, error: "Invalid achievement." };

  const achievement = await prisma.achievement.findUnique({
    where: { key: parsed.data },
    select: { id: true, titleReward: true },
  });
  if (!achievement?.titleReward?.trim()) {
    return { ok: false, error: "This achievement does not grant a title." };
  }

  const unlocked = await prisma.characterAchievement.findUnique({
    where: {
      characterId_achievementId: { characterId: character.id, achievementId: achievement.id },
    },
    select: { id: true },
  });
  if (!unlocked) return { ok: false, error: "You have not unlocked this achievement yet." };

  await prisma.character.update({
    where: { id: character.id },
    data: { equippedAchievementKey: parsed.data },
  });

  revalidatePath("/character");
  revalidatePath("/players");
  revalidatePath(`/player/${encodeURIComponent(character.name)}`);
  return { ok: true };
}
