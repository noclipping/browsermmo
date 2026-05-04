"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import {
  applyDailyLoginClaimTx,
  computeDailyLoginClaim,
  startOfUtcDay,
  streakDayToChestTier,
} from "@/lib/game/daily-login-chest";
import { GUILD_BOSS_CHEST_LABEL } from "@/lib/game/guild-boss-chest";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";
import { reevaluateMilestoneAchievements } from "@/lib/game/milestone-achievements";
import { queueAchievementToasts } from "@/lib/achievement-toast-server";
import { prisma } from "@/lib/prisma";

function revalidateAfterClaim() {
  revalidatePath("/town");
  revalidatePath("/guild");
  revalidatePath("/character");
}

function isDevMode() {
  return process.env.NODE_ENV !== "production";
}

export async function claimDailyLoginChestAction(): Promise<string | null> {
  const result = await claimDailyLoginChestInternal({ revalidate: true });
  return result.ok ? null : result.message;
}

export type DailyLoginChestClaimResult = {
  ok: boolean;
  message: string;
  day?: number;
  tier?: string;
  gold?: number;
  drops?: { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }[];
};

async function claimDailyLoginChestInternal(opts?: { revalidate?: boolean }): Promise<DailyLoginChestClaimResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const today = startOfUtcDay(new Date());
  let payload:
    | {
        day: number;
        tier: string;
        gold: number;
        drops: { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }[];
        achievementKeys: string[];
      }
    | null
    | undefined = undefined;

  try {
    payload = await prisma.$transaction(async (tx) => {
      const c = await tx.character.findUnique({
        where: { id: character.id },
        select: {
          dailyLoginLastClaimDate: true,
          dailyLoginNextStreakDay: true,
        },
      });
      if (!c) throw new Error("no_character");

      const computed = computeDailyLoginClaim({
        now: new Date(),
        lastClaimDate: c.dailyLoginLastClaimDate,
        nextStreakDay: c.dailyLoginNextStreakDay,
      });

      if (!computed.ok) {
        if (computed.code === "already_claimed") throw new Error("already_claimed");
        throw new Error("invalid_state");
      }

      const claim = await applyDailyLoginClaimTx(tx, {
        characterId: character.id,
        tier: computed.tier,
        claimDateUtc: today,
        nextStreakDay: computed.nextStreakAfterClaim,
      });
      const achievementKeys = await reevaluateMilestoneAchievements(tx, character.id);
      return {
        day: computed.tierDay,
        tier: computed.tier,
        gold: claim.gold,
        drops: claim.drops,
        achievementKeys,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "already_claimed") return { ok: false, message: "You already claimed today's chest." };
    if (msg === "invalid_state") return { ok: false, message: "Daily chest state is inconsistent." };
    if (msg === "no_character") return { ok: false, message: "Character not found." };
    throw e;
  }

  if (!payload) return { ok: false, message: "Daily chest reward did not resolve." };
  await queueAchievementToasts(payload.achievementKeys);
  if (opts?.revalidate ?? true) revalidateAfterClaim();
  return {
    ok: true,
    message: "Daily chest claimed.",
    day: payload.day,
    tier: payload.tier,
    gold: payload.gold,
    drops: payload.drops,
  };
}

export async function claimDailyLoginChestStateAction(
  _state: DailyLoginChestClaimResult | null,
): Promise<DailyLoginChestClaimResult | null> {
  void _state;
  return claimDailyLoginChestInternal({ revalidate: false });
}

export type DailyLoginChestBannerState = {
  claimedToday: boolean;
  nextStreakDay: number;
  nextChestLabel: string;
  pendingDay: number;
  claimedThroughDay: number;
  nextClaimAtIso: string;
};

export async function getDailyLoginChestBannerState(userId: string, characterId: string): Promise<DailyLoginChestBannerState | null> {
  const c = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select: {
      dailyLoginLastClaimDate: true,
      dailyLoginNextStreakDay: true,
    },
  });
  if (!c) return null;

  const today = startOfUtcDay(new Date());
  const last = c.dailyLoginLastClaimDate ? startOfUtcDay(c.dailyLoginLastClaimDate) : null;
  const claimedToday = last !== null && last.getTime() === today.getTime();

  const nextStreak = Math.max(1, Math.min(7, c.dailyLoginNextStreakDay));
  const comp = computeDailyLoginClaim({
    now: new Date(),
    lastClaimDate: c.dailyLoginLastClaimDate,
    nextStreakDay: c.dailyLoginNextStreakDay,
  });

  let nextChestLabel = GUILD_BOSS_CHEST_LABEL[streakDayToChestTier(1)];
  let pendingDay = 1;
  let claimedThroughDay = 0;
  const nextClaimAt = new Date(today.getTime());
  nextClaimAt.setUTCDate(nextClaimAt.getUTCDate() + 1);
  if (claimedToday) {
    nextChestLabel = "—";
    const claimedDay = nextStreak === 4 ? 7 : Math.max(1, nextStreak - 1);
    pendingDay = claimedDay;
    claimedThroughDay = claimedDay;
  } else if (comp.ok) {
    nextChestLabel = GUILD_BOSS_CHEST_LABEL[comp.tier];
    pendingDay = comp.tierDay;
    claimedThroughDay = Math.max(0, comp.tierDay - 1);
  }

  return {
    claimedToday,
    nextStreakDay: nextStreak,
    nextChestLabel,
    pendingDay,
    claimedThroughDay,
    nextClaimAtIso: nextClaimAt.toISOString(),
  };
}

const debugSchema = z.object({
  mode: z.enum(["RESET", "CLAIMABLE", "CLAIMED_TODAY"]),
  day: z.coerce.number().int().min(1).max(7).optional(),
});

export async function debugDailyChestSetStateAction(formData: FormData): Promise<string | null> {
  if (!isDevMode()) return "Debug tools are disabled outside development.";
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const parsed = debugSchema.safeParse({
    mode: formData.get("mode"),
    day: formData.get("day"),
  });
  if (!parsed.success) return "Invalid debug params.";

  const mode = parsed.data.mode;
  const day = parsed.data.day ?? 1;
  const today = startOfUtcDay(new Date());
  const yesterday = new Date(today.getTime());
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  if (mode === "RESET") {
    await prisma.character.update({
      where: { id: character.id },
      data: {
        dailyLoginNextStreakDay: 1,
        dailyLoginLastClaimDate: null,
      },
    });
    revalidateAfterClaim();
    return null;
  }

  if (mode === "CLAIMABLE") {
    await prisma.character.update({
      where: { id: character.id },
      data: {
        dailyLoginNextStreakDay: day,
        dailyLoginLastClaimDate: yesterday,
      },
    });
    revalidateAfterClaim();
    return null;
  }

  const nextAfterClaim = day === 7 ? 4 : day + 1;
  await prisma.character.update({
    where: { id: character.id },
    data: {
      dailyLoginNextStreakDay: nextAfterClaim,
      dailyLoginLastClaimDate: today,
    },
  });
  revalidateAfterClaim();
  return null;
}
