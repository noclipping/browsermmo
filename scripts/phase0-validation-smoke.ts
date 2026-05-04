import { resolveCombatRound, runAutoBattle, type TurnEncounterState, type PlayerActionKind } from "@/lib/game/combat-turn";

type ClassKey = "WARRIOR" | "MAGE" | "ROGUE";

const BASE_BY_CLASS: Record<ClassKey, Pick<TurnEncounterState, "playerAttack" | "playerDefense" | "playerCrit" | "playerMana" | "playerMaxMana">> =
  {
    WARRIOR: { playerAttack: 13, playerDefense: 9, playerCrit: 0.08, playerMana: 6, playerMaxMana: 6 },
    MAGE: { playerAttack: 14, playerDefense: 6, playerCrit: 0.1, playerMana: 12, playerMaxMana: 12 },
    ROGUE: { playerAttack: 12, playerDefense: 7, playerCrit: 0.12, playerMana: 10, playerMaxMana: 10 },
  };

function makeState(cls: ClassKey): TurnEncounterState {
  return {
    playerHp: 62,
    playerMaxHp: 62,
    enemyHp: 74,
    enemyMaxHp: 74,
    playerAttack: BASE_BY_CLASS[cls].playerAttack,
    playerDexterity: 10,
    playerDefense: BASE_BY_CLASS[cls].playerDefense,
    playerMana: BASE_BY_CLASS[cls].playerMana,
    playerMaxMana: BASE_BY_CLASS[cls].playerMaxMana,
    playerLifeSteal: 0.04,
    playerSkillPowerBonus: 0.12,
    playerCrit: BASE_BY_CLASS[cls].playerCrit,
    enemyAttack: 11,
    enemyDefense: 7,
    enemyCrit: 0.05,
    enemyIntent: "STRIKE",
    enemyStrikeStreak: 0,
    round: 1,
    playerInvulnerableTurns: 0,
    enemyPendingDamageMult: 1,
    enemyPendingArmorVsPlayer: 0,
  };
}

function assertValidState(state: TurnEncounterState, context: string) {
  const nums = [
    state.playerHp,
    state.playerMaxHp,
    state.enemyHp,
    state.enemyMaxHp,
    state.playerAttack,
    state.playerDefense,
    state.playerMana,
    state.playerMaxMana,
    state.enemyAttack,
    state.enemyDefense,
    state.enemyPendingDamageMult,
    state.enemyPendingArmorVsPlayer,
  ];
  if (nums.some((n) => Number.isNaN(n) || !Number.isFinite(n))) {
    throw new Error(`Invalid numeric state in ${context}`);
  }
  if (state.playerHp < 0 || state.enemyHp < 0) {
    throw new Error(`Negative HP in ${context}`);
  }
}

function runManualActionSweep(cls: ClassKey) {
  const actions: PlayerActionKind[] = ["ATTACK", "DEFEND", "POTION", "SKILL", "FLEE"];
  let state = makeState(cls);

  for (const action of actions) {
    const res = resolveCombatRound({
      state,
      enemyIntent: state.enemyIntent,
      playerAction: action,
      potionHeal: action === "POTION" ? 20 : undefined,
      enemyShortName: "Test Foe",
      enemyLabel: "🧪 Test Foe",
      playerClass: cls,
      playerIntelligence: cls === "MAGE" ? 15 : 7,
    });
    state = { ...res.state, round: state.round + 1 };
    assertValidState(state, `${cls} ${action}`);
  }

  return {
    class: cls,
    finalPlayerHp: state.playerHp,
    finalEnemyHp: state.enemyHp,
  };
}

function runAutoSweep(cls: ClassKey) {
  const res = runAutoBattle({
    state: makeState(cls),
    enemyShortName: "Test Foe",
    enemyLabel: "🧪 Test Foe",
    startRound: 1,
    initialPotionCount: 2,
    initialPotionCooldown: 0,
    potionCooldownAfterUse: 2,
    playerClass: cls,
    rogueSkill: "VOLLEY",
    playerIntelligence: cls === "MAGE" ? 15 : 7,
  });
  assertValidState(res.state, `${cls} AUTO`);
  return {
    class: cls,
    autoPlayerHp: res.state.playerHp,
    autoEnemyHp: res.state.enemyHp,
    autoPotionsRemaining: res.potionsRemaining,
  };
}

function main() {
  const classes: ClassKey[] = ["WARRIOR", "MAGE", "ROGUE"];
  const manual = classes.map(runManualActionSweep);
  const auto = classes.map(runAutoSweep);

  console.log("[phase0-smoke] manual-action-sweep", manual);
  console.log("[phase0-smoke] auto-sweep", auto);
  console.log("[phase0-smoke] PASS");
}

main();
