import type { CharacterClass } from "@prisma/client";

export type CombatTelemetryInput = {
  mode: "SOLO";
  outcome: "VICTORY" | "DEFEAT" | "FLEE_SUCCESS" | "FLEE_FAIL";
  characterClass: CharacterClass;
  characterLevel: number;
  enemyKey: string;
  enemyLevel: number;
  turns: number;
  playerHpRemaining: number;
  log: string[];
};

function countActionUsage(log: string[]) {
  const joined = log.join("\n").toLowerCase();
  return {
    attack: (joined.match(/you strike|quick shot/g) ?? []).length,
    defend: (joined.match(/guard up|you deflect|your guard/g) ?? []).length,
    skill: (joined.match(/heavy strike|fireball|volley/g) ?? []).length,
    potion: (joined.match(/crimson tonic|you recover \d+ hp/g) ?? []).length,
    flee: (joined.match(/attempt to flee|break away|escape/g) ?? []).length,
  };
}

export function logCombatTelemetry(input: CombatTelemetryInput) {
  if (process.env.NODE_ENV !== "development") return;

  const actions = countActionUsage(input.log);
  console.log("[combat-telemetry]", {
    mode: input.mode,
    outcome: input.outcome,
    class: input.characterClass,
    characterLevel: input.characterLevel,
    enemyKey: input.enemyKey,
    enemyLevel: input.enemyLevel,
    turns: input.turns,
    playerHpRemaining: input.playerHpRemaining,
    actions,
  });
}
