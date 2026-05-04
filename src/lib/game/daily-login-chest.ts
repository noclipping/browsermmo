import type { GuildBossChestTier } from "@/lib/game/guild-boss-chest";
import { getChestGoldReward, grantChestRollsToCharacter } from "@/lib/game/guild-boss-chest";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";
import { fetchMilestoneCountersJsonTx } from "@/lib/game/milestone-achievements";
import type { Prisma } from "@prisma/client";

/** Boss key only scales gold — daily chest uses a fixed mid-tier boss index. */
export const DAILY_LOGIN_CHEST_BOSS_KEY = "guild_boss_sewer_rat_king";

export function streakDayToChestTier(day: number): GuildBossChestTier {
  const d = Math.max(1, Math.min(7, Math.floor(day)));
  if (d <= 1) return "bronze";
  if (d <= 3) return "silver";
  if (d <= 5) return "gold";
  if (d === 6) return "diamond";
  return "mythic";
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(day: Date, delta: number): Date {
  const x = new Date(day.getTime());
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}

export type DailyClaimComputeOk = {
  ok: true;
  tierDay: number;
  tier: GuildBossChestTier;
  nextStreakAfterClaim: number;
};

export type DailyClaimComputeErr = { ok: false; code: "already_claimed" | "invalid_state" };

export function computeDailyLoginClaim(params: {
  now: Date;
  lastClaimDate: Date | null;
  nextStreakDay: number;
}): DailyClaimComputeOk | DailyClaimComputeErr {
  const today = startOfUtcDay(params.now);
  const last = params.lastClaimDate ? startOfUtcDay(params.lastClaimDate) : null;
  let next = Math.max(1, Math.min(7, Math.floor(params.nextStreakDay)));

  if (last && last.getTime() === today.getTime()) {
    return { ok: false, code: "already_claimed" };
  }

  const yesterday = addUtcDays(today, -1);

  let tierDay: number;
  if (!last) {
    tierDay = 1;
  } else if (last.getTime() === yesterday.getTime()) {
    tierDay = next;
  } else if (last.getTime() < yesterday.getTime()) {
    tierDay = 1;
  } else {
    return { ok: false, code: "invalid_state" };
  }

  const tier = streakDayToChestTier(tierDay);
  const nextStreakAfterClaim = tierDay === 7 ? 4 : tierDay + 1;

  return { ok: true, tierDay, tier, nextStreakAfterClaim };
}

export function getDailyLoginGoldForTier(tier: GuildBossChestTier): number {
  return getChestGoldReward(tier, DAILY_LOGIN_CHEST_BOSS_KEY);
}

/** Applies gold, item rolls, and streak fields in one transaction. */
export async function applyDailyLoginClaimTx(
  tx: Prisma.TransactionClient,
  params: {
    characterId: string;
    tier: GuildBossChestTier;
    /** Stored as UTC calendar date (`Character.dailyLoginLastClaimDate`). */
    claimDateUtc: Date;
    nextStreakDay: number;
  },
): Promise<{ gold: number; drops: { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }[] }> {
  const gold = getDailyLoginGoldForTier(params.tier);
  const mc = await fetchMilestoneCountersJsonTx(tx, params.characterId);
  if (params.tier === "mythic") {
    mc.mythicDailyEver = true;
  }
  if (params.tier === "gold") {
    mc.goldDailyEver = true;
  }
  if (params.tier === "diamond") {
    mc.diamondDailyEver = true;
  }
  const prevEarned =
    typeof mc.lifetimeGoldEarned === "number" && Number.isFinite(mc.lifetimeGoldEarned) ? Math.floor(mc.lifetimeGoldEarned) : 0;
  mc.lifetimeGoldEarned = prevEarned + gold;
  await tx.character.update({
    where: { id: params.characterId },
    data: {
      gold: { increment: gold },
      dailyLoginLastClaimDate: params.claimDateUtc,
      dailyLoginNextStreakDay: params.nextStreakDay,
    },
  });
  await tx.$executeRawUnsafe(
    `UPDATE "Character" SET "dailyChestsClaimedLifetime" = COALESCE("dailyChestsClaimedLifetime", 0) + 1, "milestoneCounters" = $1::jsonb WHERE "id" = $2`,
    JSON.stringify(mc),
    params.characterId,
  );
  const rawDrops = await grantChestRollsToCharacter(tx, { characterId: params.characterId, chestTier: params.tier });
  const aggregated = new Map<string, { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }>();
  for (const d of rawDrops) {
    const prev = aggregated.get(d.itemId);
    if (prev) prev.quantity += 1;
    else aggregated.set(d.itemId, { itemId: d.itemId, item: d.item, rarity: d.rarity, quantity: 1 });
  }
  return { gold, drops: Array.from(aggregated.values()) };
}
