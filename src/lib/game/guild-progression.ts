/**
 * Guild level is derived from total guild XP (stored on `Guild.xp`).
 * Future: boss unlocks / difficulty can read level via `getGuildLevelFromXp` without schema churn.
 */

export function getGuildLevelFromXp(xp: number): number {
  if (xp < 500) return 1;
  if (xp < 1500) return 2;
  if (xp < 3500) return 3;
  if (xp < 7500) return 4;
  if (xp < 15000) return 5;
  return 5 + Math.floor((xp - 15000) / 10000);
}

/** Minimum total guild XP required to reach the *next* guild level (upper bound of current band). */
export function getGuildXpForNextLevel(xp: number): number {
  const level = getGuildLevelFromXp(xp);
  if (level === 1) return 500;
  if (level === 2) return 1500;
  if (level === 3) return 3500;
  if (level === 4) return 7500;
  return 15000 + (level - 5) * 10000;
}

export function getGuildXpBonusPercent(guildLevel: number): number {
  return Math.min(guildLevel, 20);
}

/** XP at which the current `level` starts (inclusive). */
export function getGuildXpLevelStart(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 500;
  if (level === 3) return 1500;
  if (level === 4) return 3500;
  if (level === 5) return 7500;
  return 15000 + (level - 5) * 10000;
}

export type GuildCombatXpBonusResult = {
  baseXp: number;
  bonusXp: number;
  totalXp: number;
  bonusPercent: number;
  guildLevel: number;
};

/**
 * Combat-only XP bonus: +1% per guild level, max +20%. Does not apply to gold, drops, or guild XP.
 */
export function applyGuildBonusToCombatXp(baseXp: number, guildXp: number | null): GuildCombatXpBonusResult {
  if (baseXp <= 0 || guildXp == null) {
    return { baseXp, bonusXp: 0, totalXp: baseXp, bonusPercent: 0, guildLevel: 0 };
  }
  const guildLevel = getGuildLevelFromXp(guildXp);
  const bonusPercent = getGuildXpBonusPercent(guildLevel);
  const bonusXp = Math.floor(baseXp * (bonusPercent / 100));
  return {
    baseXp,
    bonusXp,
    totalXp: baseXp + bonusXp,
    bonusPercent,
    guildLevel,
  };
}

export type GuildLevelProgress = {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNext: number;
  fraction: number;
};

export function getGuildLevelProgress(guildXp: number): GuildLevelProgress {
  const level = getGuildLevelFromXp(guildXp);
  const levelStartXp = getGuildXpLevelStart(level);
  const nextLevelXp = getGuildXpForNextLevel(guildXp);
  const span = Math.max(1, nextLevelXp - levelStartXp);
  const xpIntoLevel = Math.max(0, guildXp - levelStartXp);
  const xpToNext = Math.max(0, nextLevelXp - guildXp);
  const fraction = Math.min(1, xpIntoLevel / span);
  return {
    level,
    xp: guildXp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNext,
    fraction,
  };
}
