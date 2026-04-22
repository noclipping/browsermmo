import type { Enemy, Item, LootTableEntry } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  LEVEL_UP_ATTACK,
  LEVEL_UP_DEFENSE,
  LEVEL_UP_HP_BUMP,
  LEVEL_UP_MAX_HP,
  STAT_POINTS_PER_LEVEL,
} from "@/lib/game/constants";
import { applyXp } from "@/lib/game/progression";

export function rollGoldReward(enemy: Enemy): number {
  return enemy.goldMin + Math.floor(Math.random() * (enemy.goldMax - enemy.goldMin + 1));
}

export function rollDrops(lootEntries: (LootTableEntry & { item: Item })[]): string[] {
  return lootEntries.filter((e) => Math.random() <= e.chance).map((e) => e.itemId);
}

export function xpForOutcome(enemy: Enemy, victory: boolean, characterLevel: number): number {
  const base = victory ? enemy.xpReward : Math.floor(enemy.xpReward * 0.15);
  if (enemy.level <= characterLevel) return Math.max(2, Math.floor(base * 0.4));
  if (enemy.level >= characterLevel + 2) return Math.floor(base * 1.12);
  return base;
}

/** Keep end-of-fight HP (no full heal). On level-up, max HP grows and current HP gets a small bump. */
export function buildVictoryCharacterUpdate(
  character: { level: number; xp: number; maxHp: number },
  postFightHp: number,
  xpGained: number,
  goldGained: number,
): { data: Prisma.CharacterUpdateInput; leveled: boolean } {
  const progression = applyXp(character.level, character.xp, xpGained);
  const leveled = progression.level > character.level;
  const newMaxHp = leveled ? character.maxHp + LEVEL_UP_MAX_HP : character.maxHp;
  const hpAfter = leveled ? Math.min(postFightHp + LEVEL_UP_HP_BUMP, newMaxHp) : Math.min(postFightHp, newMaxHp);
  return {
    leveled,
    data: {
      xp: progression.xp,
      level: progression.level,
      gold: { increment: goldGained },
      hp: hpAfter,
      ...(leveled
        ? {
            maxHp: { increment: LEVEL_UP_MAX_HP },
            attack: { increment: LEVEL_UP_ATTACK },
            defense: { increment: LEVEL_UP_DEFENSE },
            statPoints: { increment: STAT_POINTS_PER_LEVEL },
          }
        : {}),
    },
  };
}
