"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { getBossDefinitionByKey, participationGoldReward } from "@/lib/game/guild-boss-definitions";
import { getChestGoldReward, getGuildBossChestTier, grantChestRollsToCharacter } from "@/lib/game/guild-boss-chest";
import { startGuildBossEncounter } from "@/lib/game/guild-boss-encounter";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";
import { GUILD_BOSS_RESPAWN_COOLDOWN_MS, trySpawnNextGuildBossIfReady } from "@/lib/game/guild-boss-season";
import { awardGuildXp } from "@/lib/game/guild-xp";
import { prisma } from "@/lib/prisma";

function revalidateGuildBoss() {
  revalidatePath("/guild");
  revalidatePath("/adventure");
}

export async function startGuildBossFightAction(): Promise<void> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  await startGuildBossEncounter({ character, userId: user.id });
  revalidateGuildBoss();
  redirect("/adventure");
}



export async function debugRefreshGuildBossAttemptsAction(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development") return "Debug actions are disabled outside development.";
  const user = await requireUser();
  const membership = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!membership) return "Join a guild first.";

  await prisma.guildBossAttempt.updateMany({
    where: {
      userId: user.id,
      guildId: membership.guildId,
      status: "COMPLETED",
      completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    data: {
      completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  revalidateGuildBoss();
  return null;
}

export async function debugEndGuildBossCycleAction(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development") return "Debug actions are disabled outside development.";
  const user = await requireUser();
  const membership = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!membership) return "Join a guild first.";

  await prisma.$transaction(async (tx) => {
    const active = await tx.guildBossSeason.findFirst({
      where: { guildId: membership.guildId, status: "ACTIVE" },
    });
    if (!active) throw new Error("No active guild raid cycle.");

    await tx.guildBossSeason.update({
      where: { id: active.id },
      data: {
        status: "DEFEATED",
        defeatedAt: new Date(),
        currentHp: 0,
        nextSpawnAt: new Date(Date.now() + GUILD_BOSS_RESPAWN_COOLDOWN_MS),
      },
    });

    const def = getBossDefinitionByKey(active.bossKey);
    if (def) {
      await awardGuildXp(tx, membership.guildId, def.defeatGuildXp, "guild_boss");
    }
  });

  revalidateGuildBoss();
  return null;
}

/**
 * Dev-only: simulate a killing blow (remaining pool HP as damage), complete any pending raid attempt,
 * defeat the season, award guild XP, then start 24h respawn cooldown (same as live defeat).
 */
export async function debugKillGuildBossAction(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development") return "Debug actions are disabled outside development.";
  const user = await requireUser();
  const membership = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!membership) return "Join a guild first.";

  await prisma.$transaction(async (tx) => {
    const active = await tx.guildBossSeason.findFirst({
      where: { guildId: membership.guildId, status: "ACTIVE" },
    });
    if (!active) throw new Error("No active guild raid cycle.");
    if (active.currentHp <= 0) throw new Error("Boss pool already empty.");

    const killingDamage = active.currentHp;

    await tx.guildBossContribution.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId: active.id } },
      create: {
        userId: user.id,
        guildId: membership.guildId,
        seasonId: active.id,
        damageTotal: killingDamage,
      },
      update: { damageTotal: { increment: killingDamage } },
    });

    const pendingAttempt = await tx.guildBossAttempt.findFirst({
      where: { userId: user.id, seasonId: active.id, status: "PENDING" },
    });
    if (pendingAttempt) {
      await tx.soloCombatEncounter.deleteMany({
        where: { guildBossAttemptId: pendingAttempt.id },
      });
      await tx.guildBossAttempt.update({
        where: { id: pendingAttempt.id },
        data: {
          status: "COMPLETED",
          damageDealt: killingDamage,
          completedAt: new Date(),
        },
      });
    }

    await tx.guildBossSeason.update({
      where: { id: active.id },
      data: {
        status: "DEFEATED",
        defeatedAt: new Date(),
        currentHp: 0,
        nextSpawnAt: new Date(Date.now() + GUILD_BOSS_RESPAWN_COOLDOWN_MS),
      },
    });

    const def = getBossDefinitionByKey(active.bossKey);
    if (def) {
      await awardGuildXp(tx, membership.guildId, def.defeatGuildXp, "guild_boss");
    }
  });

  revalidateGuildBoss();
  return null;
}

export async function debugRespawnGuildBossNowAction(): Promise<string | null> {
  if (process.env.NODE_ENV !== "development") return "Debug actions are disabled outside development.";
  const user = await requireUser();
  const membership = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!membership) return "Join a guild first.";

  const active = await prisma.guildBossSeason.findFirst({
    where: { guildId: membership.guildId, status: "ACTIVE" },
    select: { id: true },
  });
  if (active) return "Boss is already active.";

  const latestDefeated = await prisma.guildBossSeason.findFirst({
    where: { guildId: membership.guildId, status: "DEFEATED" },
    orderBy: { defeatedAt: "desc" },
    select: { id: true },
  });
  if (!latestDefeated) return "No defeated season found to respawn from.";

  await prisma.guildBossSeason.update({
    where: { id: latestDefeated.id },
    data: { nextSpawnAt: new Date(Date.now() - 1000) },
  });
  await trySpawnNextGuildBossIfReady(prisma, membership.guildId);
  revalidateGuildBoss();
  return null;
}

export async function claimGuildBossParticipationRewardAction(formData: FormData): Promise<string | null> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const seasonId = String(formData.get("seasonId") ?? "");
  if (!seasonId) return "Invalid season.";

  const membership = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!membership) return "Not in a guild.";

  const season = await prisma.guildBossSeason.findFirst({
    where: { id: seasonId, guildId: membership.guildId },
  });
  if (!season) return "Season not found.";

  const contribution = await prisma.guildBossContribution.findUnique({
    where: { userId_seasonId: { userId: user.id, seasonId } },
  });
  if (!contribution || contribution.damageTotal <= 0) return "No contribution to claim for.";

  const claim = await prisma.guildBossRewardClaim.upsert({
    where: { userId_seasonId: { userId: user.id, seasonId } },
    create: {
      userId: user.id,
      guildId: membership.guildId,
      seasonId,
    },
    update: {},
  });
  if (claim.participationClaimedAt) return "Already claimed participation reward.";

  const gold = participationGoldReward(contribution.damageTotal, season.bossKey);

  await prisma.$transaction([
    prisma.character.update({
      where: { id: character.id },
      data: { gold: { increment: gold } },
    }),
    prisma.guildBossRewardClaim.update({
      where: { userId_seasonId: { userId: user.id, seasonId } },
      data: { participationClaimedAt: new Date() },
    }),
  ]);

  revalidateGuildBoss();
  return null;
}

export type GuildBossChestClaimResult = {
  ok: boolean;
  message: string;
  chestTier?: string;
  gold?: number;
  drops?: { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }[];
};

async function claimGuildBossChestInternal(
  formData: FormData,
  opts?: { revalidate?: boolean },
): Promise<GuildBossChestClaimResult> {
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  if (!seasonId) return { ok: false, message: "Invalid season." };

  const membership = await prisma.guildMember.findUnique({ where: { userId: user.id } });
  if (!membership) return { ok: false, message: "Not in a guild." };

  const season = await prisma.guildBossSeason.findFirst({
    where: { id: seasonId, guildId: membership.guildId },
  });
  if (!season) return { ok: false, message: "Season not found." };
  if (season.status !== "DEFEATED") return { ok: false, message: "Raid chest unlocks after this boss is defeated." };

  const contribution = await prisma.guildBossContribution.findUnique({
    where: { userId_seasonId: { userId: user.id, seasonId } },
  });
  if (!contribution || contribution.damageTotal <= 0) return { ok: false, message: "No contribution for this season." };

  const chestTier = getGuildBossChestTier(contribution.damageTotal, season.maxHp);
  if (!chestTier) {
    return { ok: false, message: "You need more damage (1% of boss HP or the flat minimum) to earn a raid chest." };
  }

  const gold = getChestGoldReward(chestTier, season.bossKey);
  const claimedAt = new Date();
  let drops: { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }[] = [];

  const earlyExit = await prisma.$transaction(async (tx) => {
    const row = await tx.guildBossRewardClaim.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId } },
    });
    if (row?.chestClaimedAt) return "Raid chest already claimed." as const;

    await tx.character.update({
      where: { id: character.id },
      data: { gold: { increment: gold } },
    });
    const rawDrops = await grantChestRollsToCharacter(tx, { characterId: character.id, chestTier });
    const aggregated = new Map<string, { itemId: string; item: ItemTooltipFields; rarity: string; quantity: number }>();
    for (const d of rawDrops) {
      const prev = aggregated.get(d.itemId);
      if (prev) {
        prev.quantity += 1;
      } else {
        aggregated.set(d.itemId, { itemId: d.itemId, item: d.item, rarity: d.rarity, quantity: 1 });
      }
    }
    drops = Array.from(aggregated.values());

    await tx.guildBossRewardClaim.upsert({
      where: { userId_seasonId: { userId: user.id, seasonId } },
      create: {
        userId: user.id,
        guildId: membership.guildId,
        seasonId,
        chestClaimedAt: claimedAt,
      },
      update: {
        chestClaimedAt: claimedAt,
      },
    });
    return null;
  });

  if (earlyExit) return { ok: false, message: earlyExit };

  if (opts?.revalidate ?? true) {
    revalidateGuildBoss();
  }
  return {
    ok: true,
    message: "Raid chest claimed.",
    chestTier,
    gold,
    drops,
  };
}

export async function claimGuildBossChestRewardAction(formData: FormData): Promise<string | null> {
  const result = await claimGuildBossChestInternal(formData, { revalidate: true });
  return result.ok ? null : result.message;
}

export async function claimGuildBossChestRewardStateAction(
  _state: GuildBossChestClaimResult | null,
  formData: FormData,
): Promise<GuildBossChestClaimResult | null> {
  void _state;
  return claimGuildBossChestInternal(formData, { revalidate: false });
}

/** @deprecated Clear bonus gold was merged into raid chest rewards. */
export async function claimGuildBossClearRewardAction(_formData?: FormData): Promise<string | null> {
  void _formData;
  return "Clear bonus was merged into raid chests — use Claim raid chest on the guild page.";
}
