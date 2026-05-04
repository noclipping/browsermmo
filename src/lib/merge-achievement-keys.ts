/** Dedupe and merge achievement key lists from nested game logic. */
export function mergeAchievementKeys(...groups: (string[] | undefined)[]): string[] {
  const s = new Set<string>();
  for (const g of groups) {
    for (const k of g ?? []) {
      if (typeof k === "string" && k.length > 0) s.add(k);
    }
  }
  return [...s];
}
