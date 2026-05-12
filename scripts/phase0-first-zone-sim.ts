import type { Character, CharacterClass } from "@prisma/client";
import { MAX_POTIONS_PER_BATTLE, POTION_COOLDOWN_AFTER_USE_TURNS, CLASS_BASE_STATS, CLASS_SKILLS } from "@/lib/game/constants";
import { prisma } from "@/lib/prisma";
import { buildCharacterStats } from "@/lib/game/stats";
import { resolveCombatRound, rollEnemyIntent, type TurnEncounterState, type PlayerActionKind } from "@/lib/game/combat-turn";

const ENEMY_POWER_MULTIPLIER = 0.75;
const RUNS_PER_MATCHUP = 400;
const MAX_ROUNDS = 120;

type MatchupSummary = {
  policy: SimPolicy;
  className: CharacterClass;
  enemyKey: string;
  enemyLevel: number;
  runs: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRounds: number;
  avgHpRemainingOnWin: number;
  avgPotionsUsed: number;
  avgSkillsUsed: number;
};

type SimPolicy = "OPTIMAL" | "CONSERVATIVE";

function scaledEnemyStat(value: number) {
  return Math.max(1, Math.floor(value * ENEMY_POWER_MULTIPLIER));
}

function makeTemplateCharacter(characterClass: CharacterClass): Character {
  const base = CLASS_BASE_STATS[characterClass];
  return {
    id: `sim-${characterClass.toLowerCase()}`,
    name: `Sim ${characterClass}`,
    portraitKey: null,
    bio: "",
    equippedAchievementKey: null,
    userId: "sim-user",
    class: characterClass,
    rogueSkill: "VOLLEY",
    level: 1,
    xp: 0,
    hp: base.hp,
    maxHp: base.hp,
    attack: base.attack,
    defense: base.defense,
    speed: base.speed,
    critChance: base.critChance,
    strength: characterClass === "WARRIOR" ? 14 : characterClass === "MAGE" ? 5 : 7,
    constitution: characterClass === "WARRIOR" ? 12 : characterClass === "MAGE" ? 8 : 9,
    intelligence: characterClass === "WARRIOR" ? 5 : characterClass === "MAGE" ? 15 : 7,
    dexterity: characterClass === "WARRIOR" ? 7 : characterClass === "MAGE" ? 8 : 14,
    statPoints: 0,
    gold: 0,
    guildTreasuryItemsDeposited: 0,
    dailyChestsClaimedLifetime: 0,
    milestoneCounters: {},
    outskirtsWinsSinceBoss: 0,
    outskirtsBossAt: 4,
    forestWinsSinceBoss: 0,
    forestBossAt: 4,
    forestConsecutiveDireWolfWins: 0,
    lastFreeRestAt: null,
    regionId: "sim-region",
    dailyLoginNextStreakDay: 1,
    dailyLoginLastClaimDate: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function classAttackFor(characterClass: CharacterClass, character: Character) {
  const computed = buildCharacterStats(character, []);
  if (characterClass === "MAGE") return computed.magicAttack;
  if (characterClass === "ROGUE") return computed.rangedAttack;
  return computed.meleeAttack;
}

function chooseAction(params: {
  policy: SimPolicy;
  state: TurnEncounterState;
  className: CharacterClass;
  skillCd: number;
  potionCd: number;
  potionsRemaining: number;
}): PlayerActionKind {
  const { policy, state, skillCd, potionCd, potionsRemaining } = params;
  if (state.enemyIntent === "HEAVY_ATTACK") return "DEFEND";
  if (policy === "OPTIMAL" && state.enemyIntent === "STRIKE" && state.enemyPendingDamageMult >= 1.35) return "DEFEND";

  const potionThreshold = policy === "OPTIMAL" ? 0.32 : 0.25;
  if (potionsRemaining > 0 && potionCd <= 0 && state.playerHp < Math.floor(state.playerMaxHp * potionThreshold)) return "POTION";

  if (skillCd <= 0) {
    if (policy === "OPTIMAL") return "SKILL";
    // Conservative "typical" behavior: sometimes hold skill instead of using on cooldown.
    if (Math.random() < 0.55) return "SKILL";
  }
  return "ATTACK";
}

function runSingleFight(
  characterClass: CharacterClass,
  enemy: { key: string; level: number; hp: number; attack: number; defense: number },
  policy: SimPolicy,
) {
  const template = makeTemplateCharacter(characterClass);
  const computed = buildCharacterStats(template, []);
  const playerAttack = classAttackFor(characterClass, template);
  let state: TurnEncounterState = {
    playerHp: template.hp,
    playerMaxHp: template.maxHp,
    enemyHp: scaledEnemyStat(enemy.hp),
    enemyMaxHp: scaledEnemyStat(enemy.hp),
    playerAttack,
    playerDexterity: template.dexterity,
    playerDefense: computed.defense,
    playerMana: Math.max(0, computed.maxMana),
    playerMaxMana: Math.max(0, computed.maxMana),
    playerLifeSteal: 0,
    playerSkillPowerBonus: 0,
    playerCrit: template.critChance,
    enemyAttack: scaledEnemyStat(enemy.attack),
    enemyDefense: scaledEnemyStat(enemy.defense),
    enemyCrit: 0.045 * ENEMY_POWER_MULTIPLIER,
    enemyIntent: rollEnemyIntent(enemy.hp, enemy.hp),
    enemyStrikeStreak: 0,
    round: 1,
    playerInvulnerableTurns: 0,
    enemyPendingDamageMult: 1,
    enemyPendingArmorVsPlayer: 0,
  };

  let skillCd = 0;
  let potionCd = 0;
  let potionsRemaining = MAX_POTIONS_PER_BATTLE;
  let skillsUsed = 0;
  let potionsUsed = 0;
  const skillMaxCd = CLASS_SKILLS[characterClass].cooldown;

  for (let i = 0; i < MAX_ROUNDS && state.playerHp > 0 && state.enemyHp > 0; i++) {
    const action = chooseAction({ policy, state, className: characterClass, skillCd, potionCd, potionsRemaining });
    const potionHeal = action === "POTION" ? Math.max(18, Math.floor(state.playerMaxHp * 0.28)) : undefined;
    const res = resolveCombatRound({
      state,
      enemyIntent: state.enemyIntent,
      playerAction: action,
      potionHeal,
      enemyShortName: enemy.key,
      enemyLabel: enemy.key,
      playerClass: characterClass,
      rogueSkill: characterClass === "ROGUE" ? "VOLLEY" : undefined,
      playerIntelligence: template.intelligence,
    });
    state = { ...res.state, round: state.round + 1 };

    if (action === "SKILL") {
      skillCd = skillMaxCd;
      skillsUsed += 1;
    } else if (skillCd > 0) {
      skillCd -= 1;
    }
    if (action === "POTION") {
      potionCd = POTION_COOLDOWN_AFTER_USE_TURNS;
      potionsRemaining -= 1;
      potionsUsed += 1;
    } else if (potionCd > 0) {
      potionCd -= 1;
    }

    if (state.playerHp <= 0 || state.enemyHp <= 0) break;
    state = { ...state, enemyIntent: rollEnemyIntent(state.enemyHp, state.enemyMaxHp) };
  }

  const won = state.enemyHp <= 0 && state.playerHp > 0;
  return {
    won,
    rounds: state.round,
    hpRemaining: state.playerHp,
    skillsUsed,
    potionsUsed,
  };
}

function summarizeMatchup(
  characterClass: CharacterClass,
  enemy: { key: string; level: number; hp: number; attack: number; defense: number },
  policy: SimPolicy,
): MatchupSummary {
  const outcomes = Array.from({ length: RUNS_PER_MATCHUP }, () => runSingleFight(characterClass, enemy, policy));
  const wins = outcomes.filter((o) => o.won);
  const losses = RUNS_PER_MATCHUP - wins.length;
  const avgRounds = outcomes.reduce((s, o) => s + o.rounds, 0) / RUNS_PER_MATCHUP;
  const avgHpRemainingOnWin = wins.length ? wins.reduce((s, o) => s + o.hpRemaining, 0) / wins.length : 0;
  const avgPotionsUsed = outcomes.reduce((s, o) => s + o.potionsUsed, 0) / RUNS_PER_MATCHUP;
  const avgSkillsUsed = outcomes.reduce((s, o) => s + o.skillsUsed, 0) / RUNS_PER_MATCHUP;

  return {
    policy,
    className: characterClass,
    enemyKey: enemy.key,
    enemyLevel: enemy.level,
    runs: RUNS_PER_MATCHUP,
    wins: wins.length,
    losses,
    winRate: wins.length / RUNS_PER_MATCHUP,
    avgRounds,
    avgHpRemainingOnWin,
    avgPotionsUsed,
    avgSkillsUsed,
  };
}

async function main() {
  const enemies = await prisma.enemy.findMany({
    where: { region: { key: "town_outskirts" } },
    select: { key: true, level: true, hp: true, attack: true, defense: true, isAdventureMiniBoss: true, isElite: true },
    orderBy: [{ isAdventureMiniBoss: "asc" }, { isElite: "asc" }, { level: "asc" }],
  });

  const targetEnemies = enemies.filter((e) => !e.isElite).slice(0, 3);
  const miniboss = enemies.find((e) => e.isAdventureMiniBoss);
  if (miniboss) targetEnemies.push(miniboss);

  const classes: CharacterClass[] = ["WARRIOR", "MAGE", "ROGUE"];
  const results: MatchupSummary[] = [];

  const policies: SimPolicy[] = ["OPTIMAL", "CONSERVATIVE"];
  for (const policy of policies) {
    for (const enemy of targetEnemies) {
      for (const cls of classes) {
        results.push(summarizeMatchup(cls, enemy, policy));
      }
    }
  }

  console.log("[phase0-first-zone-sim] runs_per_matchup", RUNS_PER_MATCHUP);
  console.log(JSON.stringify(results, null, 2));
}

void main()
  .catch((err) => {
    console.error("[phase0-first-zone-sim] FAIL", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
