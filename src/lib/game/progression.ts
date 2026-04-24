export function requiredXpForLevel(level: number): number {
  const lv = Math.max(1, level);
  return 140 + (lv - 1) * 60 + Math.floor((lv - 1) * (lv - 1) * 8);
}

export const XP_GAIN_MULTIPLIER = 1.5;

export function scaleXpGain(baseXp: number): number {
  return Math.max(1, Math.floor(baseXp * XP_GAIN_MULTIPLIER));
}

export function applyXp(level: number, xp: number, gained: number) {
  let nextLevel = level;
  let nextXp = xp + gained;
  while (nextXp >= requiredXpForLevel(nextLevel)) {
    nextXp -= requiredXpForLevel(nextLevel);
    nextLevel += 1;
  }
  return { level: nextLevel, xp: nextXp };
}
