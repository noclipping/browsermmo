import type { EnemyIntent } from "@prisma/client";

export type ActorType = "PLAYER" | "ENEMY";
export type Team = "A" | "B";

export type ActorState = {
  actorId: string;
  actorType: ActorType;
  team: Team;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  critChance: number;
  speed: number;
};

export type EncounterState = {
  encounterId: string;
  round: number;
  enemyIntent: EnemyIntent;
  player: ActorState;
  enemy: ActorState;
  playerMana: number;
  playerMaxMana: number;
  playerLifeSteal: number;
  playerSkillPowerBonus: number;
  enemyPendingDamageMult: number;
  enemyPendingArmorVsPlayer: number;
  // Multiplayer-ready placeholders; currently used as solo defaults.
  turnDeadlineAtMs?: number | null;
  defaultActionOnTimeout?: TurnActionKind | null;
};

export type TurnActionKind = "ATTACK" | "DEFEND" | "POTION" | "SKILL" | "AUTO" | "FLEE";

export type TurnAction = {
  actorId: string;
  action: TurnActionKind;
  submittedAtMs: number;
};

export type TurnResolution = {
  next: EncounterState;
  lines: string[];
  ended: boolean;
};

export type ResolveSoloTurnThroughDomainInput = {
  row: SoloEncounterRowLike;
  next: {
    round: number;
    enemyIntent: EnemyIntent;
    playerHp: number;
    enemyHp: number;
    playerMana: number;
    playerLifeSteal: number;
    playerSkillPowerBonus: number;
    enemyPendingDamageMult: number;
    enemyPendingArmorVsPlayer: number;
  };
};

export type BuildSoloEncounterUpdateDataInput = ResolveSoloTurnThroughDomainInput & {
  skillCooldownRemaining: number;
  potionCooldownRemaining: number;
  log: string[];
};

export type SoloEncounterRowLike = {
  id: string;
  characterId: string;
  enemyId: string;
  round: number;
  enemyIntent: EnemyIntent;
  playerHp: number;
  playerMaxHp: number;
  playerAttack: number;
  playerDefense: number;
  playerSpeed: number;
  playerCrit: number;
  playerLifeSteal?: number | null;
  playerSkillPowerBonus?: number | null;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAttack: number;
  enemyDefense: number;
  enemySpeed: number;
  enemyCrit: number;
  enemyPendingDamageMult?: number | null;
  enemyPendingArmorVsPlayer?: number | null;
};

export type SoloEncounterUpdatePatch = {
  playerHp: number;
  playerSpeed: number;
  enemyHp: number;
  round: number;
  enemyIntent: EnemyIntent;
  enemyPendingDamageMult: number;
  enemyPendingArmorVsPlayer: number;
  playerLifeSteal: number;
  playerSkillPowerBonus: number;
};

export type SoloEncounterPersistUpdateData = SoloEncounterUpdatePatch & {
  skillCooldownRemaining: number;
  potionCooldownRemaining: number;
  log: string[];
};

export function soloEncounterRowToEncounterState(row: SoloEncounterRowLike): EncounterState {
  return {
    encounterId: row.id,
    round: row.round,
    enemyIntent: row.enemyIntent,
    player: {
      actorId: row.characterId,
      actorType: "PLAYER",
      team: "A",
      hp: row.playerHp,
      maxHp: row.playerMaxHp,
      attack: row.playerAttack,
      defense: row.playerDefense,
      critChance: row.playerCrit,
      speed: row.playerSpeed,
    },
    enemy: {
      actorId: row.enemyId,
      actorType: "ENEMY",
      team: "B",
      hp: row.enemyHp,
      maxHp: row.enemyMaxHp,
      attack: row.enemyAttack,
      defense: row.enemyDefense,
      critChance: row.enemyCrit,
      speed: row.enemySpeed,
    },
    playerMana: Math.max(0, row.playerSpeed),
    playerMaxMana: Math.max(0, row.playerSpeed),
    playerLifeSteal: Math.max(0, row.playerLifeSteal ?? 0),
    playerSkillPowerBonus: Math.max(0, row.playerSkillPowerBonus ?? 0),
    enemyPendingDamageMult:
      row.enemyPendingDamageMult != null && Number.isFinite(Number(row.enemyPendingDamageMult))
        ? Math.max(1, Number(row.enemyPendingDamageMult))
        : 1,
    enemyPendingArmorVsPlayer:
      row.enemyPendingArmorVsPlayer != null && Number.isFinite(Number(row.enemyPendingArmorVsPlayer))
        ? Math.max(0, Math.floor(Number(row.enemyPendingArmorVsPlayer)))
        : 0,
    turnDeadlineAtMs: null,
    defaultActionOnTimeout: null,
  };
}

export function encounterStateToSoloEncounterPatch(state: EncounterState): SoloEncounterUpdatePatch {
  return {
    playerHp: state.player.hp,
    playerSpeed: state.playerMana,
    enemyHp: state.enemy.hp,
    round: state.round,
    enemyIntent: state.enemyIntent,
    enemyPendingDamageMult: state.enemyPendingDamageMult,
    enemyPendingArmorVsPlayer: state.enemyPendingArmorVsPlayer,
    playerLifeSteal: state.playerLifeSteal,
    playerSkillPowerBonus: state.playerSkillPowerBonus,
  };
}

/**
 * Compatibility seam for solo combat persistence.
 * Keeps existing SoloCombatEncounter writes funneled through domain state + adapter patching.
 */
export function resolveSoloTurnThroughDomain(input: ResolveSoloTurnThroughDomainInput): SoloEncounterUpdatePatch {
  const baseEncounterState = soloEncounterRowToEncounterState(input.row);
  const nextEncounterState: EncounterState = {
    ...baseEncounterState,
    round: input.next.round,
    enemyIntent: input.next.enemyIntent,
    player: { ...baseEncounterState.player, hp: input.next.playerHp },
    enemy: { ...baseEncounterState.enemy, hp: input.next.enemyHp },
    playerMana: input.next.playerMana,
    playerMaxMana: baseEncounterState.playerMaxMana,
    playerLifeSteal: input.next.playerLifeSteal,
    playerSkillPowerBonus: input.next.playerSkillPowerBonus,
    enemyPendingDamageMult: input.next.enemyPendingDamageMult,
    enemyPendingArmorVsPlayer: input.next.enemyPendingArmorVsPlayer,
  };
  return encounterStateToSoloEncounterPatch(nextEncounterState);
}

export function buildSoloEncounterUpdateData(input: BuildSoloEncounterUpdateDataInput): SoloEncounterPersistUpdateData {
  return {
    ...resolveSoloTurnThroughDomain(input),
    skillCooldownRemaining: input.skillCooldownRemaining,
    potionCooldownRemaining: input.potionCooldownRemaining,
    log: input.log,
  };
}
