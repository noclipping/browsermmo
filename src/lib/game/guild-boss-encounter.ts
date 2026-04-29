import type { Character } from "@prisma/client";
import { nextEnemyStrikeStreak, openingLine, rollEnemyIntent } from "@/lib/game/combat-turn";
import { forgedAffixScaledBonuses } from "@/lib/game/item-affixes";
import { buildCharacterStats } from "@/lib/game/stats";
import { getBossDefinitionByKey } from "@/lib/game/guild-boss-definitions";
import { assertGuildBossAttemptBudget } from "@/lib/game/guild-boss-attempts";
import { trySpawnNextGuildBossIfReady } from "@/lib/game/guild-boss-season";
import { prisma } from "@/lib/prisma";

const ENEMY_POWER_MULTIPLIER = 0.75;

function scaledEnemyStat(value: number): number {
  return Math.max(1, Math.floor(value * ENEMY_POWER_MULTIPLIER));
}

function fightSliceHp(seasonCurrentHp: number, seasonMaxHp: number): number {
  const pct = Math.max(120, Math.floor(seasonMaxHp * 0.14));
  return Math.max(100, Math.min(seasonCurrentHp, pct));
}

/**
 * Start a guild boss attempt: PENDING attempt + ACTIVE solo encounter linked for turn combat.
 */
export async function startGuildBossEncounter(params: { character: Character; userId: string }): Promise<{ encounterId: string }> {
  const membership = await prisma.guildMember.findUnique({ where: { userId: params.userId } });
  if (!membership) {
    throw new Error("Join a guild to challenge the guild boss.");
  }

  const fighting = await prisma.soloCombatEncounter.findFirst({
    where: { characterId: params.character.id, status: "ACTIVE" },
    select: { id: true, guildBossAttemptId: true },
  });
  if (fighting) {
    if (fighting.guildBossAttemptId) {
      return { encounterId: fighting.id };
    }
    throw new Error("You already have a fight in progress — finish or flee it first.");
  }

  return prisma.$transaction(async (tx) => {
    const clash = await tx.soloCombatEncounter.findFirst({
      where: { characterId: params.character.id, status: "ACTIVE" },
    });
    if (clash) {
      if (clash.guildBossAttemptId) return { encounterId: clash.id };
      throw new Error("You already have a fight in progress — finish or flee it first.");
    }

    await assertGuildBossAttemptBudget(tx, params.userId, membership.guildId);

    await trySpawnNextGuildBossIfReady(tx, membership.guildId);
    const season = await tx.guildBossSeason.findFirst({
      where: { guildId: membership.guildId, status: "ACTIVE" },
    });
    if (!season) {
      const last = await tx.guildBossSeason.findFirst({
        where: { guildId: membership.guildId, status: "DEFEATED" },
        orderBy: { defeatedAt: "desc" },
      });
      const now = Date.now();
      if (last?.nextSpawnAt && last.nextSpawnAt.getTime() > now) {
        const hrs = Math.max(1, Math.ceil((last.nextSpawnAt.getTime() - now) / (60 * 60 * 1000)));
        throw new Error(`Boss defeated. Next boss in ~${hrs}h — check back later or refresh the guild page.`);
      }
      throw new Error("No guild raid is active — refresh the guild page.");
    }
    if (season.currentHp <= 0) {
      throw new Error("Guild boss pool is empty — refresh the guild page.");
    }

    const def = getBossDefinitionByKey(season.bossKey);
    if (!def) {
      throw new Error("Unknown guild boss for this season.");
    }

    const enemy = await tx.enemy.findUnique({ where: { key: def.enemyKey } });
    if (!enemy) {
      throw new Error(`Missing enemy "${def.enemyKey}" — run prisma db seed.`);
    }

    const slice = fightSliceHp(season.currentHp, season.maxHp);
    const enemyMaxHp = slice;
    const enemyHp = slice;

    const attempt = await tx.guildBossAttempt.create({
      data: {
        userId: params.userId,
        guildId: membership.guildId,
        seasonId: season.id,
        bossKey: season.bossKey,
        status: "PENDING",
      },
    });

    const equipment = await tx.characterEquipment.findMany({
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

    const firstIntent = rollEnemyIntent(enemyHp, enemyMaxHp);
    const firstStrikeStreak = nextEnemyStrikeStreak(0, firstIntent);
    const defMeta = getBossDefinitionByKey(season.bossKey);
    const log: string[] = [
      "— Guild raid —",
      openingLine(),
      `${defMeta?.emoji ?? enemy.emoji} ${defMeta?.displayName ?? enemy.name} (shared HP pool ${season.currentHp}/${season.maxHp}) — you carve into this manifestation (${enemyHp} HP this sortie).`,
    ];
    if (gearAffixes.lifeSteal > 0) log.push(`🩸 Lifesteal ${Math.round(gearAffixes.lifeSteal * 100)}% active.`);
    if (gearAffixes.skillPower > 0) log.push(`✨ Skill power +${Math.round(gearAffixes.skillPower * 100)}% active.`);

    const encounter = await tx.soloCombatEncounter.create({
      data: {
        characterId: params.character.id,
        enemyId: enemy.id,
        guildBossAttemptId: attempt.id,
        status: "ACTIVE",
        playerHp: Math.min(params.character.hp, params.character.maxHp),
        playerMaxHp: params.character.maxHp,
        enemyHp,
        enemyMaxHp,
        playerAttack: classAttack,
        playerDefense: computed.defense,
        playerSpeed: computed.maxMana,
        playerCrit: computed.critChance,
        enemyAttack: scaledEnemyStat(enemy.attack),
        enemyDefense: scaledEnemyStat(enemy.defense),
        enemySpeed: scaledEnemyStat(enemy.speed),
        enemyCrit: 0.045 * ENEMY_POWER_MULTIPLIER,
        enemyIntent: firstIntent,
        enemyStrikeStreak: firstStrikeStreak,
        round: 1,
        skillCooldownRemaining: 0,
        playerInvulnerableTurns: 0,
        potionCooldownRemaining: 0,
        playerIntelligence: computed.intelligence,
        playerDexterity: computed.dexterity,
        playerLifeSteal: computed.lifeSteal,
        playerSkillPowerBonus: computed.skillPowerBonus,
        enemyPendingDamageMult: 1,
        enemyPendingArmorVsPlayer: 0,
        log,
      },
    });

    return { encounterId: encounter.id };
  });
}
