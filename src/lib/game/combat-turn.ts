/** Turn-based solo combat with telegraphed enemy intents (Slay-the-Spire-style delayed buffs). */

import type { CharacterClass, EnemyIntent, RogueSkill } from "@prisma/client";
import {
  ENRAGE_PENDING_MULT,
  HARDEN_ARMOR_BASE,
  HARDEN_ARMOR_PER_ENEMY_DEF,
  MAX_ENEMY_PENDING_DAMAGE_MULT,
} from "@/lib/game/constants";

export type { EnemyIntent };

export type TurnEncounterState = {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerAttack: number;
  playerDexterity: number;
  playerDefense: number;
  playerMana: number;
  playerMaxMana: number;
  playerLifeSteal: number;
  playerSkillPowerBonus: number;
  playerCrit: number;
  enemyAttack: number;
  enemyDefense: number;
  enemyCrit: number;
  enemyIntent: EnemyIntent;
  enemyStrikeStreak: number;
  round: number;
  playerInvulnerableTurns: number;
  /** Applied on enemy's next STRIKE / HEAVY_ATTACK, then reset to 1. */
  enemyPendingDamageMult: number;
  /** Extra defense when you deal damage; cleared after your action. */
  enemyPendingArmorVsPlayer: number;
};

const OPENING_FLAVOR = [
  "Dust kicks up. Steel hums. The fight begins.",
  "Neither side blinks first — then violence.",
  "A tense breath… then violence.",
];

const PLAYER_HIT_FLAVOR = [
  "You land a solid hit!",
  "Steel finds flesh — a clean strike!",
  "Your blow connects with a satisfying crunch.",
  "You press the attack and draw blood!",
];

const PLAYER_CRIT_FLAVOR = ["Critical! A devastating strike!", "You exploit an opening — massive damage!"];

const DEFEND_FLAVOR = [
  "You set your feet and read the telegraph — bracing for what's coming.",
  "Guard up. You force the next blow to meet steel and stance, not ribs.",
];

const POTION_FLAVOR = [
  "You slam a crimson tonic. Heat floods your veins.",
  "The brew sears going down — strength returns in a rush.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function openingLine(): string {
  return pick(OPENING_FLAVOR);
}

/** Weighted intent for the *upcoming* round (visible to player before they act). */
function isStrikeIntent(intent: EnemyIntent): boolean {
  return intent === "STRIKE" || intent === "HEAVY_ATTACK";
}

export function nextEnemyStrikeStreak(currentStreak: number, nextIntent: EnemyIntent): number {
  return isStrikeIntent(nextIntent) ? Math.max(0, currentStreak) + 1 : 0;
}

export function rollEnemyIntent(enemyHp: number, enemyMaxHp: number, currentStrikeStreak = 0): EnemyIntent {
  const pct = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 1;
  const r = Math.random();

  // Guardrail: enemy cannot chain STRIKE/HEAVY_ATTACK more than 2 turns in a row.
  if (currentStrikeStreak >= 2) {
    return r < 0.5 ? "GUARD" : "RECOVER";
  }

  if (pct < 0.38 && r < 0.4) return "RECOVER";
  if (r < 0.22) return "ATTACK";
  if (r < 0.4) return "GUARD";
  if (r < 0.78) return "STRIKE";
  // Guardrail: no HEAVY_ATTACK twice in a row.
  if (currentStrikeStreak >= 1) return "STRIKE";
  return "HEAVY_ATTACK";
}

export function intentDisplayName(intent: EnemyIntent): string {
  switch (intent) {
    case "ATTACK":
      return "Enrage";
    case "STRIKE":
      return "Strike";
    case "HEAVY_ATTACK":
      return "Heavy Strike";
    case "GUARD":
      return "Harden";
    case "RECOVER":
      return "Recover";
    default:
      return intent;
  }
}

export function intentTelegraphLine(intent: EnemyIntent, enemyShortName: string): string {
  switch (intent) {
    case "ATTACK":
      return `🔥 ${enemyShortName} works into a fury — damage will spike on their next hit, not this one.`;
    case "STRIKE":
      return `⚔ ${enemyShortName} lines up a clean strike after you act.`;
    case "HEAVY_ATTACK":
      return `💥 ${enemyShortName} winds up a heavy strike — brace now.`;
    case "GUARD":
      return `🛡 ${enemyShortName} braces and steels themselves — your next blows will scrape armor they did not have this round.`;
    case "RECOVER":
      return `✚ ${enemyShortName} buys space, looking to catch their breath.`;
    default:
      return `${enemyShortName} moves.`;
  }
}

function rollDamage(attack: number, defense: number, critChance: number): { damage: number; crit: boolean } {
  const variance = 0.88 + Math.random() * 0.24;
  const mitigated = attack * variance - defense * 0.42;
  const crit = Math.random() < critChance;
  let damage = Math.floor(crit ? mitigated * 1.72 : mitigated);
  damage = Math.max(1, damage);
  return { damage, crit };
}

export function encounterToTurnState(row: {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerAttack: number;
  playerDexterity?: number;
  playerDefense: number;
  playerSpeed: number;
  playerCrit: number;
  playerLifeSteal?: number;
  playerSkillPowerBonus?: number;
  enemyAttack: number;
  enemyDefense: number;
  enemySpeed: number;
  enemyCrit: number;
  enemyIntent: EnemyIntent;
  enemyStrikeStreak?: number;
  round: number;
  enemyPendingDamageMult?: number | null;
  enemyPendingArmorVsPlayer?: number | null;
  playerInvulnerableTurns?: number | null;
}): TurnEncounterState {
  const mult = row.enemyPendingDamageMult;
  const armor = row.enemyPendingArmorVsPlayer;
  return {
    playerHp: row.playerHp,
    playerMaxHp: row.playerMaxHp,
    enemyHp: row.enemyHp,
    enemyMaxHp: row.enemyMaxHp,
    playerAttack: row.playerAttack,
    playerDexterity: Math.max(0, row.playerDexterity ?? 0),
    playerDefense: row.playerDefense,
    playerMana: Math.max(0, row.playerSpeed),
    playerMaxMana: Math.max(0, row.playerSpeed),
    playerLifeSteal: Math.max(0, row.playerLifeSteal ?? 0),
    playerSkillPowerBonus: Math.max(0, row.playerSkillPowerBonus ?? 0),
    playerCrit: row.playerCrit,
    enemyAttack: row.enemyAttack,
    enemyDefense: row.enemyDefense,
    enemyCrit: row.enemyCrit,
    enemyIntent: row.enemyIntent,
    enemyStrikeStreak: Math.max(0, row.enemyStrikeStreak ?? 0),
    round: row.round,
    playerInvulnerableTurns:
      row.playerInvulnerableTurns != null && Number.isFinite(Number(row.playerInvulnerableTurns))
        ? Math.max(0, Math.floor(Number(row.playerInvulnerableTurns)))
        : 0,
    enemyPendingDamageMult:
      mult != null && Number.isFinite(Number(mult)) ? Math.max(1, Math.min(MAX_ENEMY_PENDING_DAMAGE_MULT, Number(mult))) : 1,
    enemyPendingArmorVsPlayer:
      armor != null && Number.isFinite(Number(armor)) ? Math.max(0, Math.floor(Number(armor))) : 0,
  };
}

export function potionHealAmount(maxHp: number): number {
  return Math.max(18, Math.floor(maxHp * 0.28));
}

export const MAX_AUTO_EXCHANGES = 72;

export type PlayerActionKind = "ATTACK" | "DEFEND" | "POTION" | "SKILL" | "FLEE";

function applyPlayerPhysicalHit(
  state: TurnEncounterState,
  rawAttack: number,
  enemyLabel: string,
  critChance: number,
  lines: string[],
  armorLog: { logged: boolean },
): { state: TurnEncounterState; damageDealt: number } {
  const extraArmor = state.enemyPendingArmorVsPlayer;
  const effectiveDef = state.enemyDefense + extraArmor;
  const { damage, crit } = rollDamage(rawAttack, effectiveDef, critChance);
  if (extraArmor > 0 && !armorLog.logged) {
    lines.push(`🛡 Their Hardened shell shaves your hit — extra armor is in play this round.`);
    armorLog.logged = true;
  }
  lines.push(crit ? pick(PLAYER_CRIT_FLAVOR) : pick(PLAYER_HIT_FLAVOR));
  lines.push(`You strike ${enemyLabel} for ${damage}${crit ? " (critical)" : ""} damage.`);
  const nextEnemyHp = Math.max(0, state.enemyHp - damage);
  let nextPlayerHp = state.playerHp;
  if (damage > 0 && state.playerLifeSteal > 0 && state.playerHp < state.playerMaxHp) {
    const rawLifeStealHeal = damage * state.playerLifeSteal;
    const healed = Math.min(state.playerMaxHp - state.playerHp, Math.max(1, Math.round(rawLifeStealHeal)));
    if (healed > 0) {
      nextPlayerHp += healed;
      lines.push(
        `🩸 Lifesteal restores ${healed} HP (${damage} damage × ${(state.playerLifeSteal * 100).toFixed(1)}%).`,
      );
    }
  }
  return { state: { ...state, enemyHp: nextEnemyHp, playerHp: nextPlayerHp }, damageDealt: damage };
}

/** Per-round combat stats for achievement milestones (aggregated across AUTO / multi-round fights). */
export type CombatRoundMilestoneAgg = {
  meleeDmg: number;
  magicDmg: number;
  rangedDmg: number;
  defends: number;
  killingBlows: number;
};

export function emptyCombatRoundMilestoneAgg(): CombatRoundMilestoneAgg {
  return { meleeDmg: 0, magicDmg: 0, rangedDmg: 0, defends: 0, killingBlows: 0 };
}

export function addCombatRoundMilestoneAgg(a: CombatRoundMilestoneAgg, b: CombatRoundMilestoneAgg): CombatRoundMilestoneAgg {
  return {
    meleeDmg: a.meleeDmg + b.meleeDmg,
    magicDmg: a.magicDmg + b.magicDmg,
    rangedDmg: a.rangedDmg + b.rangedDmg,
    defends: a.defends + b.defends,
    killingBlows: a.killingBlows + b.killingBlows,
  };
}

function addLaneDamage(mile: CombatRoundMilestoneAgg, lane: "melee" | "magic" | "ranged", amount: number) {
  if (amount <= 0) return;
  if (lane === "melee") mile.meleeDmg += amount;
  else if (lane === "magic") mile.magicDmg += amount;
  else mile.rangedDmg += amount;
}

function hardenArmorAmount(state: TurnEncounterState): number {
  return HARDEN_ARMOR_BASE + Math.floor(state.enemyDefense * HARDEN_ARMOR_PER_ENEMY_DEF);
}

function enemyChipAfterUtility(
  state: TurnEncounterState,
  playerDefending: boolean,
  lines: string[],
  shadowActive: boolean,
): TurnEncounterState {
  const chip = Math.random() < 0.28;
  if (!chip) {
    lines.push("They keep pressure tight but do not commit a full swing.");
    return state;
  }
  if (shadowActive) {
    lines.push("🌑 Shadow Veil phases you through the probing hit.");
    return state;
  }
  let { damage } = rollDamage(Math.floor(state.enemyAttack * 0.32), state.playerDefense, 0);
  if (playerDefending) {
    const raw = damage;
    damage = Math.max(1, Math.floor(damage * 0.45));
    lines.push(`A probing nick still finds you — your guard trims ${raw} → ${damage}.`);
  } else {
    lines.push(`A quick nick clips you for ${damage}.`);
  }
  return { ...state, playerHp: Math.max(0, state.playerHp - damage) };
}

/**
 * One full round: telegraphed `enemyIntent` is what the enemy will do after the player acts.
 * Buff intents (Enrage / Harden) apply to *future* strikes / your next damage, not the same exchange.
 */
export function resolveCombatRound(params: {
  state: TurnEncounterState;
  enemyIntent: EnemyIntent;
  playerAction: PlayerActionKind;
  potionHeal?: number;
  enemyShortName: string;
  enemyLabel: string;
  playerClass?: CharacterClass;
  rogueSkill?: RogueSkill | null;
  /** Snapshot INT from encounter (spell scaling). */
  playerIntelligence?: number;
}): { state: TurnEncounterState; lines: string[]; milestone: CombatRoundMilestoneAgg } {
  const lines: string[] = [];
  let state = { ...params.state };
  const intent = params.enemyIntent;
  const playerDefending = params.playerAction === "DEFEND";
  const armorLog = { logged: false };
  const mile = emptyCombatRoundMilestoneAgg();

  const finish = (final: TurnEncounterState): { state: TurnEncounterState; lines: string[]; milestone: CombatRoundMilestoneAgg } => ({
    state: final,
    lines,
    milestone: mile,
  });

  lines.push(intentTelegraphLine(intent, params.enemyShortName));

  if (params.playerAction === "ATTACK") {
    const pc = params.playerClass;
    if (pc === "ROGUE") {
      lines.push("🏹 Quick Shot — a fast ranged strike!");
    }
    const lane: "melee" | "magic" | "ranged" = pc === "ROGUE" ? "ranged" : pc === "MAGE" ? "magic" : "melee";
    const basicAttack = pc === "ROGUE" ? state.playerAttack * 1.3 : state.playerAttack;
    const hit = applyPlayerPhysicalHit(state, basicAttack, params.enemyLabel, state.playerCrit, lines, armorLog);
    state = hit.state;
    addLaneDamage(mile, lane, hit.damageDealt);
  } else if (params.playerAction === "SKILL") {
    const pc = params.playerClass;
    const intl = params.playerIntelligence ?? 0;
    const dex = state.playerDexterity ?? 0;
    if (pc === "WARRIOR") {
      lines.push("⚔️ Heavy Strike — you put your weight behind a crushing blow!");
      const boosted = 1 + Math.max(0, state.playerSkillPowerBonus);
      const hit = applyPlayerPhysicalHit(state, state.playerAttack * 1.5 * boosted, params.enemyLabel, state.playerCrit, lines, armorLog);
      state = hit.state;
      addLaneDamage(mile, "melee", hit.damageDealt);
    } else if (pc === "MAGE") {
      const manaCost = 8;
      if (state.playerMana < manaCost) {
        lines.push("✨ Your mana is too low for Fireball.");
      } else {
        lines.push("🔥 Fireball — flame roars toward your foe!");
        const spellPower = Math.floor(state.playerAttack * 0.4 + intl * 1.3);
        const spellAtk = Math.floor(spellPower * 1.3 * (1 + Math.max(0, state.playerSkillPowerBonus)));
        const hit = applyPlayerPhysicalHit(state, spellAtk, params.enemyLabel, state.playerCrit, lines, armorLog);
        state = hit.state;
        addLaneDamage(mile, "magic", hit.damageDealt);
        state = { ...state, playerMana: Math.max(0, state.playerMana - manaCost) };
      }
    } else if (pc === "ROGUE") {
      const rogueSkill = params.rogueSkill ?? "VOLLEY";
      const boosted = 1 + Math.max(0, state.playerSkillPowerBonus);
      if (rogueSkill === "DAGGER_STORM") {
        lines.push("🗡️ Dagger Storm — steel flashes in a blurring arc!");
        const roguePower = Math.floor(state.playerAttack * 0.4 + dex * 1.3);
        const perHit = Math.floor(roguePower * 0.45 * boosted);
        for (let i = 0; i < 3 && state.enemyHp > 0; i++) {
          lines.push(i === 0 ? "First dagger bites." : i === 1 ? "Second cut follows." : "Third strike drives home.");
          const hit = applyPlayerPhysicalHit(state, perHit, params.enemyLabel, state.playerCrit, lines, armorLog);
          state = hit.state;
          addLaneDamage(mile, "ranged", hit.damageDealt);
        }
      } else if (rogueSkill === "SHADOW") {
        lines.push("🌑 Shadow Veil — you slip through the next hostile action untouched.");
        state = { ...state, playerInvulnerableTurns: 1 };
      } else {
        lines.push("🏹 Volley — two shots in quick succession!");
        const roguePower = Math.floor(state.playerAttack * 0.4 + dex * 1.3);
        const perShot = Math.floor(roguePower * 0.65 * boosted);
        for (let i = 0; i < 2 && state.enemyHp > 0; i++) {
          lines.push(i === 0 ? "First shaft flies." : "Second shaft follows.");
          const hit = applyPlayerPhysicalHit(state, perShot, params.enemyLabel, state.playerCrit, lines, armorLog);
          state = hit.state;
          addLaneDamage(mile, "ranged", hit.damageDealt);
        }
      }
    } else {
      lines.push("You have no class skill — the moment is wasted.");
    }
  } else if (params.playerAction === "DEFEND") {
    lines.push(pick(DEFEND_FLAVOR));
    mile.defends = 1;
  } else if (params.playerAction === "FLEE") {
    lines.push("🏃 You turn to break away from the fight!");
  } else {
    const heal = params.potionHeal ?? 0;
    const before = state.playerHp;
    const next = Math.min(state.playerMaxHp, state.playerHp + heal);
    const healed = next - before;
    lines.push(pick(POTION_FLAVOR));
    lines.push(healed > 0 ? `You recover ${healed} HP.` : "You're topped off — no healing wasted.");
    state = { ...state, playerHp: next };
  }

  // Harden armor applies on your next action only.
  state = { ...state, enemyPendingArmorVsPlayer: 0 };

  if (state.enemyHp <= 0) {
    mile.killingBlows = 1;
    return finish(state);
  }

  lines.push(`— ${params.enemyShortName} acts (${intentDisplayName(intent)}) —`);
  const shadowActive = state.playerInvulnerableTurns > 0;
  if (shadowActive) {
    state = { ...state, playerInvulnerableTurns: 0 };
  }

  if (intent === "RECOVER") {
    const heal = Math.max(8, Math.floor(state.enemyMaxHp * 0.11 + Math.random() * 6));
    const nh = Math.min(state.enemyMaxHp, state.enemyHp + heal);
    const got = nh - state.enemyHp;
    state = { ...state, enemyHp: nh };
    lines.push(`${params.enemyLabel} steadies and recovers ${got} HP.`);
    const chip = Math.random() < 0.35;
    if (chip) {
      let { damage } = rollDamage(Math.floor(state.enemyAttack * 0.35), state.playerDefense, 0);
      if (shadowActive) {
        lines.push("🌑 Shadow Veil turns the follow-up strike into mist.");
        return finish(state);
      }
      if (playerDefending) {
        const raw = damage;
        damage = Math.max(1, Math.floor(damage * 0.45));
        lines.push(`A lazy swipe still clips you — your guard shaves it from ${raw} to ${damage}.`);
      } else {
        lines.push(`A parting nick catches you for ${damage}.`);
      }
      state = { ...state, playerHp: Math.max(0, state.playerHp - damage) };
    } else {
      lines.push("They give you no free opening this beat.");
    }
    return finish(state);
  }

  if (intent === "ATTACK") {
    const nextMult = Math.min(
      MAX_ENEMY_PENDING_DAMAGE_MULT,
      state.enemyPendingDamageMult * ENRAGE_PENDING_MULT,
    );
    lines.push(
      `${params.enemyLabel} roars — Enrage stacks. Next hit damage ×${nextMult.toFixed(2)} (was ×${state.enemyPendingDamageMult.toFixed(2)}).`,
    );
    state = { ...state, enemyPendingDamageMult: nextMult };
    return finish(enemyChipAfterUtility(state, playerDefending, lines, shadowActive));
  }

  if (intent === "GUARD") {
    const add = hardenArmorAmount(state);
    const nextArmor = Math.max(state.enemyPendingArmorVsPlayer, add);
    lines.push(
      `${params.enemyLabel} Hardens — your next damaging action faces +${nextArmor} effective armor against these blows.`,
    );
    state = { ...state, enemyPendingArmorVsPlayer: nextArmor };
    return finish(enemyChipAfterUtility(state, playerDefending, lines, shadowActive));
  }

  // STRIKE or HEAVY_ATTACK — damage turn; consume pending enrage mult.
  const baseMult = intent === "HEAVY_ATTACK" ? 1.72 : 1;
  const chargedMult = state.enemyPendingDamageMult;
  const mult = baseMult * chargedMult;

  const rolled = rollDamage(state.enemyAttack, state.playerDefense, state.enemyCrit);
  let damage = rolled.damage;
  const crit = rolled.crit;
  damage = Math.max(1, Math.floor(damage * mult));
  state = { ...state, enemyPendingDamageMult: 1 };

  if (shadowActive) {
    lines.push("🌑 Shadow Veil nullifies the incoming blow.");
    return finish(state);
  }

  if (chargedMult > 1.01) {
    lines.push(`Their charged blow releases stored fury (×${chargedMult.toFixed(2)} on top of this swing).`);
  }

  if (intent === "HEAVY_ATTACK") {
    lines.push("A massive swing hurtles toward you — this is the telegraphed crush!");
  }

  if (playerDefending) {
    const raw = damage;
    const reduction = intent === "HEAVY_ATTACK" ? 0.62 : 0.48;
    damage = Math.max(1, Math.floor(damage * (1 - reduction)));
    if (intent === "HEAVY_ATTACK") {
      lines.push(`Your guard meets the brunt — ${raw} damage becomes ${damage}. The heavy blow would have wrecked you otherwise.`);
    } else {
      lines.push(`You deflect part of the strike — ${raw} damage reduced to ${damage}.`);
    }
  } else {
    lines.push(crit ? "A brutal hit — you're rocked!" : pick(["The enemy lashes out!", "Pain blooms as the attack lands!"]));
    lines.push(`${params.enemyLabel} deals ${damage}${crit ? " (critical)" : ""} damage.`);
  }

  state = { ...state, playerHp: Math.max(0, state.playerHp - damage) };
  return finish(state);
}

/** Auto: brace for telegraphed Heavy Attack, sip when low, otherwise strike. */
export function runAutoBattle(params: {
  state: TurnEncounterState;
  enemyShortName: string;
  enemyLabel: string;
  startRound: number;
  initialEnemyStrikeStreak?: number;
  initialPotionCount: number;
  /** Turns before auto-battle may sip again (mirrors manual potion cooldown). */
  initialPotionCooldown?: number;
  potionCooldownAfterUse?: number;
  playerClass: CharacterClass;
  rogueSkill: RogueSkill;
  playerIntelligence: number;
}): { state: TurnEncounterState; lines: string[]; potionsRemaining: number; milestone: CombatRoundMilestoneAgg } {
  let s = { ...params.state };
  let strikeStreak = Math.max(0, params.initialEnemyStrikeStreak ?? s.enemyStrikeStreak ?? 0);
  let potions = params.initialPotionCount;
  let potionCd = Math.max(0, params.initialPotionCooldown ?? 0);
  const potionCdAfter = Math.max(1, params.potionCooldownAfterUse ?? 2);
  const lines: string[] = ["—— Auto-battle —— You fight tactically off the telegraph."];
  let roundCounter = params.startRound;
  let exchanges = 0;
  let milestone = emptyCombatRoundMilestoneAgg();

  while (s.playerHp > 0 && s.enemyHp > 0 && exchanges < MAX_AUTO_EXCHANGES) {
    lines.push(`— Round ${roundCounter} —`);

    if (potionCd > 0) potionCd -= 1;

    let action: PlayerActionKind = "ATTACK";
    if (s.enemyIntent === "HEAVY_ATTACK") action = "DEFEND";
    else if (s.enemyIntent === "STRIKE" && s.enemyPendingDamageMult >= 1.35) action = "DEFEND";
    else if (potions > 0 && potionCd <= 0 && s.playerHp < Math.floor(s.playerMaxHp * 0.32)) action = "POTION";

    const heal = action === "POTION" ? potionHealAmount(s.playerMaxHp) : undefined;
    if (action === "POTION") {
      if (potions > 0 && potionCd <= 0) {
        potions -= 1;
        potionCd = potionCdAfter;
      } else action = "ATTACK";
    }

    const res = resolveCombatRound({
      state: s,
      enemyIntent: s.enemyIntent,
      playerAction: action,
      potionHeal: heal,
      enemyShortName: params.enemyShortName,
      enemyLabel: params.enemyLabel,
      playerClass: params.playerClass,
      rogueSkill: params.rogueSkill,
      playerIntelligence: params.playerIntelligence,
    });
    s = res.state;
    milestone = addCombatRoundMilestoneAgg(milestone, res.milestone);
    strikeStreak = s.enemyStrikeStreak;
    lines.push(...res.lines);
    exchanges++;

    if (s.enemyHp <= 0 || s.playerHp <= 0) {
      s = { ...s, round: roundCounter + 1 };
      break;
    }

    const nextIntent = rollEnemyIntent(s.enemyHp, s.enemyMaxHp, strikeStreak);
    strikeStreak = nextEnemyStrikeStreak(strikeStreak, nextIntent);
    s = { ...s, enemyIntent: nextIntent, enemyStrikeStreak: strikeStreak };
    roundCounter += 1;
  }

  if (s.playerHp > 0 && s.enemyHp > 0) {
    lines.push("You break away — neither side can find a clean finish.");
    s = { ...s, playerHp: 0, round: roundCounter + 1 };
  }

  return { state: s, lines, potionsRemaining: potions, milestone };
}
