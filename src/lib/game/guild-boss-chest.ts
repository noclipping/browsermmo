import type { Prisma } from "@prisma/client";
import type { Rarity } from "@prisma/client";
import { bossTierIndex, qualifiesForClearReward } from "@/lib/game/guild-boss-definitions";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";

/** Percent thresholds for raid chest tiers (of boss max HP). Mythic caps at 20%+ — no further tier scaling. */
export const CHEST_TIER_THRESHOLDS = {
  bronzeMin: 1,
  silverMin: 5,
  goldMin: 10,
  diamondMin: 15,
  mythicMin: 20,
} as const;

export type GuildBossChestTier = "bronze" | "silver" | "gold" | "diamond" | "mythic";

export const GUILD_BOSS_CHEST_ORDER: GuildBossChestTier[] = ["bronze", "silver", "gold", "diamond", "mythic"];

export const GUILD_BOSS_CHEST_LABEL: Record<GuildBossChestTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
  mythic: "Mythic",
};

export const GUILD_BOSS_CHEST_ABBR: Record<GuildBossChestTier, string> = {
  bronze: "B",
  silver: "S",
  gold: "G",
  diamond: "D",
  mythic: "M",
};

/** Progress bar markers (percent of max HP) — aligns with tier bands. */
export const CHEST_BAR_MARKERS: { pct: number; tier: GuildBossChestTier }[] = [
  { pct: 1, tier: "bronze" },
  { pct: 5, tier: "silver" },
  { pct: 10, tier: "gold" },
  { pct: 15, tier: "diamond" },
  { pct: 20, tier: "mythic" },
];

export type ChestDropWeights = {
  rolls: number;
  common: number;
  uncommon: number;
  rare: number;
  legendary: number;
  godly: number;
};

export function getContributionPercent(damageTotal: number, bossMaxHp: number): number {
  if (bossMaxHp <= 0 || damageTotal <= 0) return 0;
  return (damageTotal / bossMaxHp) * 100;
}

/**
 * Minimum contribution matches existing guild boss rule (1% max HP or 75 damage, whichever is greater).
 * Tier bands use percentage of max HP; eligible players below 1% still map to Bronze.
 */
export function getGuildBossChestTier(damageTotal: number, bossMaxHp: number): GuildBossChestTier | null {
  if (!qualifiesForClearReward(damageTotal, bossMaxHp)) return null;
  const pct = getContributionPercent(damageTotal, bossMaxHp);
  if (pct < CHEST_TIER_THRESHOLDS.silverMin) return "bronze";
  if (pct < CHEST_TIER_THRESHOLDS.goldMin) return "silver";
  if (pct < CHEST_TIER_THRESHOLDS.diamondMin) return "gold";
  if (pct < CHEST_TIER_THRESHOLDS.mythicMin) return "diamond";
  return "mythic";
}

export function getChestDropTable(tier: GuildBossChestTier): ChestDropWeights {
  switch (tier) {
    case "bronze":
      return { rolls: 1, common: 80, uncommon: 18, rare: 2, legendary: 0, godly: 0 };
    case "silver":
      return { rolls: 2, common: 60, uncommon: 30, rare: 9, legendary: 1, godly: 0 };
    case "gold":
      return { rolls: 3, common: 40, uncommon: 35, rare: 20, legendary: 5, godly: 0 };
    case "diamond":
      return { rolls: 4, common: 25, uncommon: 30, rare: 30, legendary: 14, godly: 1 };
    case "mythic":
      return { rolls: 5, common: 10, uncommon: 20, rare: 35, legendary: 30, godly: 5 };
    default:
      return { rolls: 1, common: 80, uncommon: 18, rare: 2, legendary: 0, godly: 0 };
  }
}

/** Tunable base gold before tier multipliers; scales slightly with boss catalog index. */
export function getChestBaseGoldForBoss(bossKey: string): number {
  const tier = bossTierIndex(bossKey);
  return 28 + tier * 18;
}

const GOLD_MULT: Record<GuildBossChestTier, number> = {
  bronze: 1,
  silver: 1.5,
  gold: 2.25,
  diamond: 3.5,
  mythic: 5,
};

export function getChestGoldReward(chestTier: GuildBossChestTier, bossKey: string): number {
  const base = getChestBaseGoldForBoss(bossKey);
  return Math.floor(base * GOLD_MULT[chestTier]);
}

export type NextChestTierProgress = {
  contributionPercent: number;
  /** Fill 0–100 for bar toward Mythic (20% contribution = full bar). */
  barFillPercent: number;
  currentTier: GuildBossChestTier | null;
  /** Next tier name for copy, or null if already Mythic (for eligible players). */
  nextTierLabel: string | null;
  /** Lower bound % of next tier, for “push to X%” hints. */
  nextTierMinPercent: number | null;
};

export function getNextChestTierProgress(damageTotal: number, bossMaxHp: number): NextChestTierProgress {
  const contributionPercent = getContributionPercent(damageTotal, bossMaxHp);
  const barFillPercent = Math.min(100, (contributionPercent / CHEST_TIER_THRESHOLDS.mythicMin) * 100);
  const currentTier = getGuildBossChestTier(damageTotal, bossMaxHp);

  if (!qualifiesForClearReward(damageTotal, bossMaxHp)) {
    return {
      contributionPercent,
      barFillPercent,
      currentTier: null,
      nextTierLabel: "Bronze",
      nextTierMinPercent: CHEST_TIER_THRESHOLDS.bronzeMin,
    };
  }

  if (currentTier === "mythic") {
    return {
      contributionPercent,
      barFillPercent: 100,
      currentTier: "mythic",
      nextTierLabel: null,
      nextTierMinPercent: null,
    };
  }

  const order = GUILD_BOSS_CHEST_ORDER;
  const idx = currentTier ? order.indexOf(currentTier) : -1;
  const nextTier = idx >= 0 && idx < order.length - 1 ? order[idx + 1]! : "mythic";
  const nextMinByTier: Record<GuildBossChestTier, number | null> = {
    bronze: CHEST_TIER_THRESHOLDS.silverMin,
    silver: CHEST_TIER_THRESHOLDS.goldMin,
    gold: CHEST_TIER_THRESHOLDS.diamondMin,
    diamond: CHEST_TIER_THRESHOLDS.mythicMin,
    mythic: null,
  };

  return {
    contributionPercent,
    barFillPercent,
    currentTier,
    nextTierLabel: GUILD_BOSS_CHEST_LABEL[nextTier],
    nextTierMinPercent: currentTier ? nextMinByTier[currentTier] : CHEST_TIER_THRESHOLDS.silverMin,
  };
}

/** Fix eligibility hint when below threshold — min damage required (not percent). */
export function minDamageForChestEligibility(bossMaxHp: number): number {
  const pct = Math.floor(bossMaxHp * 0.01);
  return Math.max(75, pct);
}

export function rollChestRarity(weights: ChestDropWeights): Rarity {
  const entries: { r: Rarity; w: number }[] = [
    { r: "COMMON", w: weights.common },
    { r: "UNCOMMON", w: weights.uncommon },
    { r: "RARE", w: weights.rare },
    { r: "LEGENDARY", w: weights.legendary },
    { r: "GODLY", w: weights.godly },
  ];
  const total = entries.reduce((s, e) => s + e.w, 0);
  let roll = Math.random() * (total > 0 ? total : 1);
  for (const e of entries) {
    if (e.w <= 0) continue;
    roll -= e.w;
    if (roll <= 0) return e.r;
  }
  return "COMMON";
}

/**
 * Grant one random item of the given rarity to inventory. Returns null if no items exist for that rarity.
 * TODO: curated per-slot chest pools, gear-only filters, and rolled affixes for raid drops when loot pipeline is ready.
 */
export async function grantRandomInventoryItemOfRarity(
  tx: Prisma.TransactionClient,
  params: { characterId: string; rarity: Rarity },
): Promise<{ itemId: string; item: ItemTooltipFields } | null> {
  const items = await tx.item.findMany({
    where: { rarity: params.rarity },
    select: {
      id: true,
      name: true,
      emoji: true,
      slot: true,
      rarity: true,
      attack: true,
      defense: true,
      hp: true,
      speed: true,
      description: true,
      sellPrice: true,
      requiredLevel: true,
      requiredStrength: true,
      requiredConstitution: true,
      requiredIntelligence: true,
      requiredDexterity: true,
    },
    take: 80,
  });
  if (items.length === 0) return null;
  const pick = items[Math.floor(Math.random() * items.length)]!;
  await tx.inventoryItem.create({
    data: { characterId: params.characterId, itemId: pick.id, quantity: 1 },
  });
  const { id: itemId, ...item } = pick;
  return { itemId, item };
}

export async function grantChestRollsToCharacter(
  tx: Prisma.TransactionClient,
  params: { characterId: string; chestTier: GuildBossChestTier },
): Promise<{ itemId: string; item: ItemTooltipFields; rarity: Rarity }[]> {
  const table = getChestDropTable(params.chestTier);
  const granted: { itemId: string; item: ItemTooltipFields; rarity: Rarity }[] = [];
  for (let i = 0; i < table.rolls; i++) {
    const rarity = rollChestRarity(table);
    const g = await grantRandomInventoryItemOfRarity(tx, { characterId: params.characterId, rarity });
    if (g) granted.push({ itemId: g.itemId, item: g.item, rarity });
  }
  return granted;
}

export const CHEST_REWARD_PREVIEW_LINES: Record<GuildBossChestTier, string> = {
  bronze: "1 roll · modest gold · Common/Uncommon focus",
  silver: "2 rolls · better gold · small Legendary chance",
  gold: "3 rolls · stronger gold · 5% Legendary",
  diamond: "4 rolls · 14% Legendary · 1% Godly",
  mythic: "5 rolls · 30% Legendary · 5% Godly · top gold",
};
