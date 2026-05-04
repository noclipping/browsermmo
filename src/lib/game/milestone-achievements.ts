import type { ItemSlot, Prisma, Rarity } from "@prisma/client";
import { unlockAchievementTx } from "@/lib/game/achievements";
import type { CombatRoundMilestoneAgg } from "@/lib/game/combat-turn";

export const DUSKFORGED_MIN_UNLOCKED = 45;

const TOWN_KEY = "town_outskirts";

const REGION_KILL_ABBR: Record<string, string> = {
  town_outskirts: "to",
  forest_edge: "fe",
  ancient_ruins: "ar",
  murk_catacombs: "mc",
};

const CORE_GEAR_SLOTS: ItemSlot[] = ["WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS"];

const RARITY_ORDER: Rarity[] = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"];

function rarityAtLeast(r: Rarity, min: Rarity): boolean {
  return RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf(min);
}

export type MilestoneCountersJson = {
  meleeDmg?: number;
  magicDmg?: number;
  rangedDmg?: number;
  defends?: number;
  killingBlows?: number;
  combatWins?: number;
  winStreakSolo?: number;
  guildBossDamage?: number;
  goldDonatedGuild?: number;
  regionsVisited?: string[];
  tonicSips?: number;
  mythicDailyEver?: boolean;
  goldDailyEver?: boolean;
  diamondDailyEver?: boolean;
  /** Per-region solo victories (one per win). */
  regionKills?: Record<string, number>;
  lifetimeGoldEarned?: number;
  lifetimeGoldSpent?: number;
  itemsSoldLifetime?: number;
};

export function parseMilestoneCounters(raw: unknown): MilestoneCountersJson {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as MilestoneCountersJson;
}

export function milestoneCountersToJson(mc: MilestoneCountersJson): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(mc)) as Prisma.InputJsonValue;
}

/** Milestone-related Character row (loaded via SQL so it works even if `prisma generate` is stale). */
export type MilestoneCharacterSlice = {
  level: number;
  guildTreasuryItemsDeposited: number;
  dailyChestsClaimedLifetime: number;
  milestoneCounters: unknown;
  userId: string;
};

export async function fetchMilestoneCharacterSliceTx(
  tx: Prisma.TransactionClient,
  characterId: string,
): Promise<MilestoneCharacterSlice | null> {
  try {
    const rows = await tx.$queryRawUnsafe<MilestoneCharacterSlice[]>(
      `SELECT "level", "guildTreasuryItemsDeposited", COALESCE("dailyChestsClaimedLifetime", 0) AS "dailyChestsClaimedLifetime", COALESCE("milestoneCounters", '{}'::jsonb) AS "milestoneCounters", "userId" FROM "Character" WHERE "id" = $1 LIMIT 1`,
      characterId,
    );
    const r = rows[0];
    if (!r) return null;
    return {
      ...r,
      dailyChestsClaimedLifetime: Number(r.dailyChestsClaimedLifetime) || 0,
    };
  } catch {
    const row = await tx.character.findUnique({
      where: { id: characterId },
      select: { level: true, guildTreasuryItemsDeposited: true, userId: true },
    });
    if (!row) return null;
    return {
      level: row.level,
      guildTreasuryItemsDeposited: row.guildTreasuryItemsDeposited,
      dailyChestsClaimedLifetime: 0,
      milestoneCounters: {},
      userId: row.userId,
    };
  }
}

export async function fetchMilestoneCountersJsonTx(
  tx: Prisma.TransactionClient,
  characterId: string,
): Promise<MilestoneCountersJson> {
  try {
    const rows = await tx.$queryRawUnsafe<Array<{ milestoneCounters: unknown }>>(
      `SELECT COALESCE("milestoneCounters", '{}'::jsonb) AS "milestoneCounters" FROM "Character" WHERE "id" = $1 LIMIT 1`,
      characterId,
    );
    return parseMilestoneCounters(rows[0]?.milestoneCounters);
  } catch {
    return {};
  }
}

export async function sqlSetMilestoneCountersTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  mc: MilestoneCountersJson,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `UPDATE "Character" SET "milestoneCounters" = $1::jsonb WHERE "id" = $2`,
    JSON.stringify(mc),
    characterId,
  );
}

export async function addLifetimeGoldEarnedTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  delta: number,
): Promise<void> {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const mc = await fetchMilestoneCountersJsonTx(tx, characterId);
  mc.lifetimeGoldEarned = num(mc.lifetimeGoldEarned) + Math.floor(delta);
  await sqlSetMilestoneCountersTx(tx, characterId, mc);
}

export async function addLifetimeGoldSpentTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  delta: number,
): Promise<void> {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const mc = await fetchMilestoneCountersJsonTx(tx, characterId);
  mc.lifetimeGoldSpent = num(mc.lifetimeGoldSpent) + Math.floor(delta);
  await sqlSetMilestoneCountersTx(tx, characterId, mc);
}

export async function addItemsSoldCountTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  count: number,
): Promise<void> {
  if (!Number.isFinite(count) || count <= 0) return;
  const mc = await fetchMilestoneCountersJsonTx(tx, characterId);
  mc.itemsSoldLifetime = num(mc.itemsSoldLifetime) + Math.floor(count);
  await sqlSetMilestoneCountersTx(tx, characterId, mc);
}

function num(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function wildRegionVariety(visited: string[] | undefined): number {
  const set = new Set(visited ?? []);
  set.delete(TOWN_KEY);
  return set.size;
}

function regionKillCount(mc: MilestoneCountersJson, regionKey: string): number {
  return num(mc.regionKills?.[regionKey]);
}

const RARE_PLUS: Rarity[] = ["RARE", "EPIC", "LEGENDARY", "GODLY"];

async function loadAchievementKeySet(
  tx: Prisma.TransactionClient,
  characterId: string,
): Promise<Set<string>> {
  const rows = await tx.characterAchievement.findMany({
    where: { characterId },
    select: { achievement: { select: { key: true } } },
  });
  return new Set(rows.map((r) => r.achievement.key));
}

/** After solo combat ends: merge fight totals, adjust win streak, optional survivor / first-blood unlocks. */
export async function mergeSoloCombatFightIntoCharacterTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  fight: CombatRoundMilestoneAgg & {
    outcome: "WIN" | "LOSS";
    endHp: number;
    endMaxHp: number;
    tonicsConsumed: number;
    /** Region key where the enemy lived (solo). */
    enemyRegionKey?: string | null;
    /** Victory gold rolled for this fight (lifetime earn tracking). */
    goldGainedOnWin?: number;
  },
): Promise<string[]> {
  const out: string[] = [];
  const mc = await fetchMilestoneCountersJsonTx(tx, characterId);
  mc.meleeDmg = num(mc.meleeDmg) + fight.meleeDmg;
  mc.magicDmg = num(mc.magicDmg) + fight.magicDmg;
  mc.rangedDmg = num(mc.rangedDmg) + fight.rangedDmg;
  mc.defends = num(mc.defends) + fight.defends;
  mc.killingBlows = num(mc.killingBlows) + fight.killingBlows;
  if (fight.tonicsConsumed > 0) {
    mc.tonicSips = num(mc.tonicSips) + fight.tonicsConsumed;
  }

  if (fight.outcome === "WIN") {
    mc.combatWins = num(mc.combatWins) + 1;
    mc.winStreakSolo = num(mc.winStreakSolo) + 1;
    const g = fight.goldGainedOnWin;
    if (typeof g === "number" && Number.isFinite(g) && g > 0) {
      mc.lifetimeGoldEarned = num(mc.lifetimeGoldEarned) + Math.floor(g);
    }
    const rkKey = fight.enemyRegionKey?.trim();
    if (rkKey) {
      const rk = { ...(mc.regionKills ?? {}) };
      rk[rkKey] = num(rk[rkKey]) + 1;
      mc.regionKills = rk;
    }
  } else {
    mc.winStreakSolo = 0;
  }

  await sqlSetMilestoneCountersTx(tx, characterId, mc);

  if (fight.outcome === "WIN") {
    const wins = num(mc.combatWins);
    if (wins === 1) {
      if (await unlockAchievementTx(tx, characterId, "first_blood")) out.push("first_blood");
    }
    if (fight.endMaxHp > 0 && fight.endHp / fight.endMaxHp <= 0.2) {
      if (await unlockAchievementTx(tx, characterId, "survivor")) out.push("survivor");
    }
    if (fight.endMaxHp > 0 && fight.endHp / fight.endMaxHp <= 0.1) {
      if (await unlockAchievementTx(tx, characterId, "thread_needle")) out.push("thread_needle");
    }
  }
  return out;
}

/** Guild raid combat: damage lanes + boss damage; does not change solo win counts or streaks. */
export async function mergeGuildBossFightMilestonesTx(
  tx: Prisma.TransactionClient,
  characterId: string,
  fight: CombatRoundMilestoneAgg & { guildBossDamage: number; tonicsConsumed: number },
): Promise<void> {
  const mc = await fetchMilestoneCountersJsonTx(tx, characterId);
  mc.meleeDmg = num(mc.meleeDmg) + fight.meleeDmg;
  mc.magicDmg = num(mc.magicDmg) + fight.magicDmg;
  mc.rangedDmg = num(mc.rangedDmg) + fight.rangedDmg;
  mc.defends = num(mc.defends) + fight.defends;
  mc.killingBlows = num(mc.killingBlows) + fight.killingBlows;
  mc.guildBossDamage = num(mc.guildBossDamage) + fight.guildBossDamage;
  if (fight.tonicsConsumed > 0) {
    mc.tonicSips = num(mc.tonicSips) + fight.tonicsConsumed;
  }
  await sqlSetMilestoneCountersTx(tx, characterId, mc);
}

function coreGearAllAtLeast(
  equipment: { slot: ItemSlot; item: { rarity: Rarity } | null }[],
  minRarity: Rarity,
): boolean {
  for (const slot of CORE_GEAR_SLOTS) {
    const row = equipment.find((e) => e.slot === slot);
    if (!row?.item) return false;
    if (!rarityAtLeast(row.item.rarity, minRarity)) return false;
  }
  return true;
}

/** Recompute unlockable catalog achievements from character + equipment + guild state. */
export async function reevaluateMilestoneAchievements(
  tx: Prisma.TransactionClient,
  characterId: string,
): Promise<string[]> {
  const newlyUnlocked: string[] = [];
  const character = await fetchMilestoneCharacterSliceTx(tx, characterId);
  if (!character) return newlyUnlocked;

  const mc = parseMilestoneCounters(character.milestoneCounters);
  const unlocked = await loadAchievementKeySet(tx, characterId);

  const maybeUnlock = async (key: string, condition: boolean) => {
    if (!condition || unlocked.has(key)) return;
    if (await unlockAchievementTx(tx, characterId, key)) newlyUnlocked.push(key);
    unlocked.add(key);
  };

  const level = character.level;
  await maybeUnlock("greenhorn", level >= 3);
  await maybeUnlock("novice_adventurer", level >= 5);
  await maybeUnlock("seasoned_adventurer", level >= 10);
  await maybeUnlock("level_twenty", level >= 20);
  await maybeUnlock("journeyman", level >= 15);
  await maybeUnlock("veteran", level >= 25);
  await maybeUnlock("keystone", level >= 30);
  await maybeUnlock("luminous", level >= 40);
  await maybeUnlock("colossus", level >= 45);
  await maybeUnlock("paragon", level >= 50);

  await maybeUnlock("bladebound", num(mc.meleeDmg) >= 1000);
  await maybeUnlock("spellscarred", num(mc.magicDmg) >= 1000);
  await maybeUnlock("deadeye", num(mc.rangedDmg) >= 1000);
  await maybeUnlock("bulwark_ten", num(mc.defends) >= 10);
  await maybeUnlock("unbroken", num(mc.defends) >= 100);
  await maybeUnlock("executioner", num(mc.killingBlows) >= 100);
  await maybeUnlock("relentless", num(mc.combatWins) >= 10);
  await maybeUnlock("champion", num(mc.combatWins) >= 50);
  await maybeUnlock("solo_century", num(mc.combatWins) >= 100);
  await maybeUnlock("solo_quarterk", num(mc.combatWins) >= 500);
  await maybeUnlock("solo_millennium", num(mc.combatWins) >= 1000);
  await maybeUnlock("solo_deca_k", num(mc.combatWins) >= 10000);
  await maybeUnlock("steady_aim", num(mc.winStreakSolo) >= 10);
  await maybeUnlock("deathless", num(mc.winStreakSolo) >= 25);
  await maybeUnlock("bossbreaker", num(mc.guildBossDamage) >= 10000);
  await maybeUnlock("boss_annihilator", num(mc.guildBossDamage) >= 100000);
  await maybeUnlock("prepared", num(mc.tonicSips) >= 1);
  await maybeUnlock("tonic_ten", num(mc.tonicSips) >= 10);
  await maybeUnlock("tonic_hundred", num(mc.tonicSips) >= 100);

  await maybeUnlock("treasury_hand", character.guildTreasuryItemsDeposited >= 5);
  await maybeUnlock("treasurekeeper", character.guildTreasuryItemsDeposited >= 10);
  await maybeUnlock("treasury_centurion", character.guildTreasuryItemsDeposited >= 100);

  const chests = character.dailyChestsClaimedLifetime;
  await maybeUnlock("returning_soul", chests >= 3);
  await maybeUnlock("oathkeeper", chests >= 7);
  await maybeUnlock("daily_thirty", chests >= 30);
  await maybeUnlock("daily_hundred", chests >= 100);
  if (mc.goldDailyEver) await maybeUnlock("daily_gold_tier", true);
  if (mc.diamondDailyEver) await maybeUnlock("daily_diamond_tier", true);
  if (mc.mythicDailyEver) await maybeUnlock("mythic_blessed", true);

  await maybeUnlock("guild_donor_1k", num(mc.goldDonatedGuild) >= 1000);
  await maybeUnlock("benefactor", num(mc.goldDonatedGuild) >= 10000);

  const earned = num(mc.lifetimeGoldEarned);
  await maybeUnlock("gold_earned_1k", earned >= 1000);
  await maybeUnlock("gold_earned_10k", earned >= 10000);
  await maybeUnlock("gold_earned_100k", earned >= 100000);
  await maybeUnlock("gold_earned_1m", earned >= 1_000_000);

  const spent = num(mc.lifetimeGoldSpent);
  await maybeUnlock("gold_spent_1k", spent >= 1000);
  await maybeUnlock("gold_spent_10k", spent >= 10000);

  const sold = num(mc.itemsSoldLifetime);
  await maybeUnlock("items_sold_10", sold >= 10);
  await maybeUnlock("items_sold_100", sold >= 100);

  for (const [regionKey, abbr] of Object.entries(REGION_KILL_ABBR)) {
    const n = regionKillCount(mc, regionKey);
    await maybeUnlock(`rk_${abbr}_10`, n >= 10);
    await maybeUnlock(`rk_${abbr}_100`, n >= 100);
    await maybeUnlock(`rk_${abbr}_1k`, n >= 1000);
    await maybeUnlock(`rk_${abbr}_10k`, n >= 10000);
  }

  const visited = mc.regionsVisited ?? [];
  await maybeUnlock("forest_walker", visited.includes("forest_edge"));
  await maybeUnlock("ruin_seeker", visited.includes("ancient_ruins"));
  await maybeUnlock("catacomb_delver", visited.includes("murk_catacombs"));
  await maybeUnlock("scout", wildRegionVariety(visited) >= 3);

  const member = await tx.guildMember.findUnique({
    where: { userId: character.userId },
    select: { role: true },
  });
  await maybeUnlock("guildbound", !!member);
  const ownsGuild = await tx.guild.findFirst({
    where: { ownerId: character.userId },
    select: { id: true },
  });
  await maybeUnlock("guild_founded", !!ownsGuild);
  await maybeUnlock("guild_officer", member?.role === "OFFICER");
  await maybeUnlock("oathbearer", member?.role === "OWNER" || member?.role === "OFFICER");

  const equipment = await tx.characterEquipment.findMany({
    where: { characterId },
    include: { item: true },
  });
  const weaponRow = equipment.find((e) => e.slot === "WEAPON");
  await maybeUnlock("armed", !!weaponRow?.itemId);
  const slots = new Set(equipment.filter((e) => e.itemId).map((e) => e.slot));
  await maybeUnlock(
    "full_kit",
    slots.has("WEAPON") && slots.has("HELMET") && slots.has("CHEST") && slots.has("GLOVES") && slots.has("BOOTS"),
  );
  const hasRarePlus = equipment.some((e) => e.item && RARE_PLUS.includes(e.item.rarity));
  await maybeUnlock("discerning_eye", hasRarePlus);
  const hasEpicPlus = equipment.some((e) => e.item && rarityAtLeast(e.item.rarity, "EPIC"));
  await maybeUnlock("epic_attuned", hasEpicPlus);
  const hasLegendPlus = equipment.some((e) => e.item && rarityAtLeast(e.item.rarity, "LEGENDARY"));
  await maybeUnlock("legend_wrapped", hasLegendPlus);
  const hasGodly = equipment.some((e) => e.item?.rarity === "GODLY");
  await maybeUnlock("godly_touch", hasGodly);
  await maybeUnlock("kit_rare_plus", coreGearAllAtLeast(equipment, "RARE"));
  await maybeUnlock("kit_epic_plus", coreGearAllAtLeast(equipment, "EPIC"));

  const unlockedTotal = await tx.characterAchievement.count({ where: { characterId } });
  if (unlockedTotal >= DUSKFORGED_MIN_UNLOCKED) {
    await maybeUnlock("duskforged", true);
  }
  return newlyUnlocked;
}
