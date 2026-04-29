/** Static catalog for async guild bosses (unlock tier, shared HP scaling, combat template, defeat guild XP). */

export type GuildBossDefinition = {
  key: string;
  displayName: string;
  emoji: string;
  minGuildLevel: number;
  baseSharedHp: number;
  hpPerMember: number;
  /** Guild XP granted to the guild when this boss's season is cleared (`awardGuildXp` reason `guild_boss`). */
  defeatGuildXp: number;
  /** Enemy row key in DB (`prisma/seed`) for turn-based combat stats. */
  enemyKey: string;
  /** Combat template: base stats before seed difficulty multiplier. */
  combat: { level: number; hp: number; attack: number; defense: number; speed: number; xpReward: number; goldMin: number; goldMax: number };
};

export const GUILD_BOSS_DEFINITIONS: GuildBossDefinition[] = [
  {
    key: "sewer_rat_king",
    displayName: "Sewer Rat King",
    emoji: "👑",
    minGuildLevel: 1,
    baseSharedHp: 750,
    hpPerMember: 750,
    defeatGuildXp: 500,
    enemyKey: "guild_boss_sewer_rat_king",
    combat: { level: 4, hp: 120, attack: 18, defense: 12, speed: 10, xpReward: 0, goldMin: 0, goldMax: 0 },
  },
  {
    key: "gravebound_ogre",
    displayName: "Gravebound Ogre",
    emoji: "💀",
    minGuildLevel: 3,
    baseSharedHp: 2000,
    hpPerMember: 1000,
    defeatGuildXp: 1500,
    enemyKey: "guild_boss_gravebound_ogre",
    combat: { level: 7, hp: 220, attack: 28, defense: 18, speed: 8, xpReward: 0, goldMin: 0, goldMax: 0 },
  },
  {
    key: "ancient_warden",
    displayName: "Ancient Warden",
    emoji: "🗿",
    minGuildLevel: 5,
    baseSharedHp: 5000,
    hpPerMember: 1500,
    defeatGuildXp: 3500,
    enemyKey: "guild_boss_ancient_warden",
    combat: { level: 10, hp: 340, attack: 36, defense: 28, speed: 10, xpReward: 0, goldMin: 0, goldMax: 0 },
  },
  {
    key: "ashen_drake",
    displayName: "Ashen Drake",
    emoji: "🐉",
    minGuildLevel: 8,
    baseSharedHp: 12000,
    hpPerMember: 2500,
    defeatGuildXp: 7500,
    enemyKey: "guild_boss_ashen_drake",
    combat: { level: 14, hp: 480, attack: 44, defense: 32, speed: 14, xpReward: 0, goldMin: 0, goldMax: 0 },
  },
  {
    key: "duskforged_titan",
    displayName: "Duskforged Titan",
    emoji: "⚒️",
    minGuildLevel: 12,
    baseSharedHp: 30000,
    hpPerMember: 4000,
    defeatGuildXp: 15000,
    enemyKey: "guild_boss_duskforged_titan",
    combat: { level: 18, hp: 620, attack: 52, defense: 40, speed: 12, xpReward: 0, goldMin: 0, goldMax: 0 },
  },
];

export const GUILD_BOSS_ATTEMPTS_PER_24H = 3;

/** Flat minimum damage toward clear-reward eligibility (paired with 1% max HP rule). */
export const GUILD_BOSS_MIN_CLEAR_DAMAGE = 75;

export function getBossDefinitionByKey(key: string): GuildBossDefinition | undefined {
  return GUILD_BOSS_DEFINITIONS.find((b) => b.key === key);
}

export function getBossDefinitionByEnemyKey(enemyKey: string): GuildBossDefinition | undefined {
  return GUILD_BOSS_DEFINITIONS.find((b) => b.enemyKey === enemyKey);
}

export function highestUnlockedBoss(guildLevel: number): GuildBossDefinition | null {
  let best: GuildBossDefinition | null = null;
  for (const b of GUILD_BOSS_DEFINITIONS) {
    if (b.minGuildLevel <= guildLevel) {
      if (!best || b.minGuildLevel > best.minGuildLevel) best = b;
    }
  }
  return best;
}

export function bossTierIndex(bossKey: string): number {
  const i = GUILD_BOSS_DEFINITIONS.findIndex((b) => b.key === bossKey);
  return Math.max(0, i);
}

export function qualifiesForClearReward(damageTotal: number, seasonMaxHp: number): boolean {
  const pct = Math.floor(seasonMaxHp * 0.01);
  return damageTotal >= Math.max(GUILD_BOSS_MIN_CLEAR_DAMAGE, pct);
}

export function participationGoldReward(damageTotal: number, bossKey: string): number {
  const tier = bossTierIndex(bossKey);
  return 12 + tier * 12 + Math.floor(damageTotal / 30);
}

export function clearBonusGoldReward(damageTotal: number, bossKey: string): number {
  const tier = bossTierIndex(bossKey);
  return 35 + tier * 22 + Math.floor(damageTotal / 50);
}
