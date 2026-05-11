import type { EnemyIntent } from "@prisma/client";

/** Compact UI emoji for telegraphed enemy intent (matches server `EnemyIntent`). */
export function enemyIntentEmoji(intent: EnemyIntent | string): string {
  switch (intent) {
    case "ATTACK":
      return "😡";
    case "GUARD":
      return "🛡️";
    case "RECOVER":
      return "💚";
    case "STRIKE":
      return "⚔️";
    case "HEAVY_ATTACK":
      return "⚔️⚔️";
    default:
      return "⚔️";
  }
}

/** Floating damage FX: one sword for a normal strike, two for telegraphed heavy. */
export function enemyStrikeDamageFxEmoji(intent: EnemyIntent | string): string {
  return intent === "HEAVY_ATTACK" ? "⚔️⚔️" : "⚔️";
}

export function enemyIntentTitle(intent: EnemyIntent | string): string {
  switch (intent) {
    case "ATTACK":
      return "Likely next: enrage (buffs their next hit)";
    case "GUARD":
      return "Likely next: harden (extra armor vs your damage)";
    case "RECOVER":
      return "Likely next: recover (heal)";
    case "STRIKE":
      return "Likely next: strike";
    case "HEAVY_ATTACK":
      return "Likely next: heavy strike";
    default:
      return "Enemy intent";
  }
}
