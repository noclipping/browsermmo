import type { Character, Enemy, PrismaClient } from "@prisma/client";

export type EnemyKind = "normal" | "elite" | "miniboss";

export function enemyKindFromRow(enemy: { isElite: boolean; isAdventureMiniBoss: boolean }): EnemyKind {
  if (enemy.isAdventureMiniBoss) return "miniboss";
  if (enemy.isElite) return "elite";
  return "normal";
}
import { activeSkillForCharacter, HEALTH_POTION_ITEM_KEY, MAX_POTIONS_PER_BATTLE, POTION_COOLDOWN_AFTER_USE_TURNS } from "@/lib/game/constants";
import { computeFleeChance } from "@/lib/game/combat-flee-execute";
import { nextEnemyStrikeStreak, openingLine, rollEnemyIntent } from "@/lib/game/combat-turn";
import { forgedAffixScaledBonuses } from "@/lib/game/item-affixes";
import { buildCharacterStats } from "@/lib/game/stats";

const ENEMY_POWER_MULTIPLIER = 0.75;

function scaledEnemyStat(value: number): number {
  return Math.max(1, Math.floor(value * ENEMY_POWER_MULTIPLIER));
}

export type SoloEncounterStartJson = {
  encounterId: string;
  round: number;
  enemyIntent: string;
  enemyKey: string;
  enemyKind: EnemyKind;
  enemy: { name: string; emoji: string; level: number; hp: number; maxHp: number };
  player: { name: string; hp: number; maxHp: number };
  log: string[];
  potionCount: number;
  potionCooldownRemaining: number;
  potionMaxCooldown: number;
  skillCooldownRemaining: number;
  skillMaxCooldown: number;
  skillName: string;
  skillEmoji: string;
  playerMana: number;
  playerMaxMana: number;
  fleeChance: number;
};

export async function createSoloEncounter(
  prisma: PrismaClient,
  params: {
    character: Character;
    enemy: Enemy;
    flavorPrefixLines: string[];
  },
): Promise<{
  encounter: {
    id: string;
    round: number;
    enemyIntent: string;
    enemyHp: number;
    enemyMaxHp: number;
    playerHp: number;
    playerMaxHp: number;
    playerSpeed: number;
    skillCooldownRemaining: number;
    potionCooldownRemaining: number;
    log: unknown;
  };
  enemy: Enemy;
  potionCount: number;
  character: Character;
}> {
  const equipment = await prisma.characterEquipment.findMany({
    where: { characterId: params.character.id },
    include: { item: true },
  });
  const computed = buildCharacterStats(params.character, equipment);
  const classAttack =
    params.character.class === "MAGE"
      ? computed.magicAttack
      : params.character.class === "ROGUE"
        ? computed.rangedAttack
        : computed.meleeAttack;
  const gearAffixes = equipment.reduce(
    (acc, entry) => {
      if (!entry.item) return acc;
      const affix = forgedAffixScaledBonuses(
        {
          bonusLifeSteal: entry.bonusLifeSteal ?? 0,
          bonusCritChance: entry.bonusCritChance ?? 0,
          bonusSkillPower: entry.bonusSkillPower ?? 0,
          bonusDefensePercent: entry.bonusDefensePercent ?? 0,
          bonusConstitutionPercent: entry.bonusConstitutionPercent ?? 0,
          bonusStrength: entry.bonusStrength ?? 0,
          bonusConstitution: entry.bonusConstitution ?? 0,
          bonusIntelligence: entry.bonusIntelligence ?? 0,
          bonusDexterity: entry.bonusDexterity ?? 0,
        },
        { forgeLevel: entry.forgeLevel ?? 0, rarity: entry.item.rarity },
      );
      acc.lifeSteal += affix.bonusLifeSteal;
      acc.crit += affix.bonusCritChance;
      acc.skillPower += affix.bonusSkillPower;
      acc.strength += affix.bonusStrength;
      acc.constitution += affix.bonusConstitution;
      acc.intelligence += affix.bonusIntelligence;
      acc.dexterity += affix.bonusDexterity;
      return acc;
    },
    {
      lifeSteal: 0,
      crit: 0,
      skillPower: 0,
      strength: 0,
      constitution: 0,
      intelligence: 0,
      dexterity: 0,
    },
  );

  await prisma.soloCombatEncounter.deleteMany({
    where: { characterId: params.character.id, status: "ACTIVE" },
  });

  const firstIntent = rollEnemyIntent(params.enemy.hp, params.enemy.hp);
  const firstStrikeStreak = nextEnemyStrikeStreak(0, firstIntent);
  const log: string[] = [
    ...params.flavorPrefixLines,
    openingLine(),
    `${params.enemy.emoji} ${params.enemy.name} (Lv ${params.enemy.level}) snarls and closes the distance.`,
  ];
  const affixLines: string[] = [];
  if (gearAffixes.lifeSteal > 0) affixLines.push(`🩸 Lifesteal ${Math.round(gearAffixes.lifeSteal * 100)}% active.`);
  if (gearAffixes.skillPower > 0) affixLines.push(`✨ Skill power +${Math.round(gearAffixes.skillPower * 100)}% active.`);
  if (gearAffixes.crit > 0) affixLines.push(`🎯 Bonus crit +${Math.round(gearAffixes.crit * 100)}% from affixes.`);
  if (gearAffixes.strength > 0) affixLines.push(`💪 Bonus STR +${gearAffixes.strength}.`);
  if (gearAffixes.constitution > 0) affixLines.push(`🛡️ Bonus CON +${gearAffixes.constitution}.`);
  if (gearAffixes.intelligence > 0) affixLines.push(`🔮 Bonus INT +${gearAffixes.intelligence}.`);
  if (gearAffixes.dexterity > 0) affixLines.push(`🏹 Bonus DEX +${gearAffixes.dexterity}.`);
  if (affixLines.length) {
    log.push("— Affix effects active —", ...affixLines);
  }

  const encounter = await prisma.soloCombatEncounter.create({
    // Enemy power tuning pass: all combat-facing enemy stats are reduced globally.
    data: {
      characterId: params.character.id,
      enemyId: params.enemy.id,
      status: "ACTIVE",
      playerHp: Math.min(params.character.hp, params.character.maxHp),
      playerMaxHp: params.character.maxHp,
      enemyHp: scaledEnemyStat(params.enemy.hp),
      enemyMaxHp: scaledEnemyStat(params.enemy.hp),
      // Class-specific basic attack scaling:
      // Warrior -> STR/melee, Rogue -> DEX/ranged, Mage -> INT/magic.
      playerAttack: classAttack,
      playerDefense: computed.defense,
      playerSpeed: computed.maxMana,
      playerCrit: computed.critChance,
      enemyAttack: scaledEnemyStat(params.enemy.attack),
      enemyDefense: scaledEnemyStat(params.enemy.defense),
      enemySpeed: scaledEnemyStat(params.enemy.speed),
      enemyCrit: 0.045 * ENEMY_POWER_MULTIPLIER,
      enemyIntent: firstIntent,
      enemyStrikeStreak: firstStrikeStreak,
      round: 1,
      skillCooldownRemaining: 0,
      playerInvulnerableTurns: 0,
      potionCooldownRemaining: 0,
      // Include gear bonuses so class skill scaling uses effective primary stats.
      playerIntelligence: computed.intelligence,
      playerDexterity: computed.dexterity,
      playerLifeSteal: computed.lifeSteal,
      playerSkillPowerBonus: computed.skillPowerBonus,
      enemyPendingDamageMult: 1,
      enemyPendingArmorVsPlayer: 0,
      log,
    },
    include: { enemy: true },
  });

  const potionItem = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
  let potionCount = 0;
  if (potionItem) {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        characterId: params.character.id,
        itemId: potionItem.id,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusDefensePercent: 0,
        bonusConstitutionPercent: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    });
    potionCount = inv?.quantity ?? 0;
  }

  return { encounter, enemy: encounter.enemy, potionCount, character: params.character };
}

function encounterLogAsStrings(log: unknown): string[] {
  if (!Array.isArray(log)) return [];
  return log.filter((x): x is string => typeof x === "string");
}

/** Rebuild the client combat payload for an in-progress encounter (e.g. after navigating away and back). */
export async function getResumeCombatPayload(
  prisma: PrismaClient,
  character: Character,
  encounter: {
    id: string;
    round: number;
    enemyIntent: string;
    enemyHp: number;
    enemyMaxHp: number;
    playerHp: number;
    playerMaxHp: number;
    playerSpeed: number;
    skillCooldownRemaining: number;
    potionCooldownRemaining: number;
    log: unknown;
    enemy: Enemy;
  },
): Promise<SoloEncounterStartJson> {
  const potionItem = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
  let potionCount = 0;
  if (potionItem) {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        characterId: character.id,
        itemId: potionItem.id,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusDefensePercent: 0,
        bonusConstitutionPercent: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    });
    potionCount = inv?.quantity ?? 0;
  }
  const log = encounterLogAsStrings(encounter.log);
  return toStartResponse(encounter, encounter.enemy, character, potionCount, log);
}

export function toStartResponse(
  encounter: {
    id: string;
    round: number;
    enemyIntent: string;
    enemyHp: number;
    enemyMaxHp: number;
    playerHp: number;
    playerMaxHp: number;
    playerSpeed: number;
    skillCooldownRemaining: number;
    potionCooldownRemaining: number;
    log: unknown;
  },
  enemy: Enemy,
  character: Character,
  potionCount: number,
  log: string[],
): SoloEncounterStartJson {
  const skill = activeSkillForCharacter(character.class, character.rogueSkill);
  const potionsUsed = log.reduce((sum, line) => (line.toLowerCase().includes("crimson tonic") ? sum + 1 : sum), 0);
  const potionBattleRemaining = Math.max(0, Math.min(potionCount, MAX_POTIONS_PER_BATTLE - potionsUsed));
  return {
    encounterId: encounter.id,
    round: encounter.round,
    enemyIntent: encounter.enemyIntent,
    enemyKey: enemy.key,
    enemyKind: enemyKindFromRow(enemy),
    enemy: {
      name: enemy.name,
      emoji: enemy.emoji,
      level: enemy.level,
      hp: encounter.enemyHp,
      maxHp: encounter.enemyMaxHp,
    },
    player: { name: character.name, hp: encounter.playerHp, maxHp: encounter.playerMaxHp },
    log,
    potionCount: potionBattleRemaining,
    potionCooldownRemaining: encounter.potionCooldownRemaining,
    potionMaxCooldown: POTION_COOLDOWN_AFTER_USE_TURNS,
    skillCooldownRemaining: encounter.skillCooldownRemaining,
    skillMaxCooldown: skill.cooldown,
    skillName: skill.name,
    skillEmoji: skill.emoji,
    playerMana: encounter.playerSpeed,
    playerMaxMana: encounter.playerSpeed,
    fleeChance: computeFleeChance({ character, enemy }),
  };
}
