/** Split log lines into the player's half vs enemy's half of the exchange (before `— Name acts …`). */
export function sliceLinesBeforeEnemyActs(lines: string[]): string[] {
  const idx = lines.findIndex((l) => /^— .+ acts/.test(l.trim()));
  return idx === -1 ? lines : lines.slice(0, idx);
}

/** Lines after the `— Name acts …` separator (enemy phase copy). */
export function sliceEnemyActsPhase(lines: string[]): string[] {
  const idx = lines.findIndex((l) => /^— .+ acts/.test(l.trim()));
  return idx === -1 ? [] : lines.slice(idx + 1);
}

/** Sum `You strike … for X damage.` lines (basic attacks + skills that reuse applyPlayerPhysicalHit). */
export function sumPlayerStrikeDamageFromLines(lines: string[]): number {
  let sum = 0;
  for (const L of lines) {
    const m = L.match(/You strike .+ for (\d+)/);
    if (m) sum += Number(m[1]);
  }
  return sum;
}

/**
 * Final damage taken by the player during the enemy phase (best-effort parse from server log lines).
 */
export function parseDamageDealtToPlayerFromEnemyPhase(lines: string[]): number | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const L = lines[i] ?? "";
    if (/Shadow Veil.*nullif|phases you through|phased you through/i.test(L)) return null;
    const deals = L.match(/deals (\d+)(?:\s*\(critical\))?\s*damage/i);
    if (deals) return Number(deals[1]);
    const becomes = L.match(/damage becomes (\d+)/i);
    if (becomes) return Number(becomes[1]);
    const reduced = L.match(/reduced to (\d+)/i);
    if (reduced) return Number(reduced[1]);
    const clips = L.match(/clips you for (\d+)/i);
    if (clips) return Number(clips[1]);
    const catches = L.match(/catches you for (\d+)/i);
    if (catches) return Number(catches[1]);
    const arrow = L.match(/(?:→|->)\s*(\d+)/);
    if (arrow && /trim|guard|nick|swipe|probing/i.test(L)) return Number(arrow[1]);
  }
  return null;
}

/** Sum incoming damage lines across one server response (handles AUTO multi-exchange logs). */
export function sumDamageDealtToPlayerFromExchangeLog(lines: string[]): number {
  let sum = 0;
  for (const L of lines) {
    if (/You strike/i.test(L)) continue;
    if (/You recover/i.test(L)) continue;
    if (/Shadow Veil|nullifies the incoming|phases you through/i.test(L)) continue;
    const deals = L.match(/deals (\d+)(?:\s*\(critical\))?\s*damage/i);
    if (deals) {
      sum += Number(deals[1]);
      continue;
    }
    const becomes = L.match(/damage becomes (\d+)/i);
    if (becomes) {
      sum += Number(becomes[1]);
      continue;
    }
    const reduced = L.match(/reduced to (\d+)/i);
    if (reduced) {
      sum += Number(reduced[1]);
      continue;
    }
    const clips = L.match(/clips you for (\d+)/i);
    if (clips) {
      sum += Number(clips[1]);
      continue;
    }
    const catches = L.match(/catches you for (\d+)/i);
    if (catches) {
      sum += Number(catches[1]);
      continue;
    }
    const arrow = L.match(/(?:→|->)\s*(\d+)/);
    if (arrow && /trim|guard|nick|swipe|probing|lazy/i.test(L)) {
      sum += Number(arrow[1]);
    }
  }
  return sum;
}

/** AUTO may chain rounds — if any slice used a class skill, prefer ability SFX over melee. */
export function inferAutoResolvedStrikeSfx(strikePhaseLines: string[]): "attack" | "skill" {
  const blob = strikePhaseLines.join("\n").toLowerCase();
  if (
    blob.includes("fireball") ||
    blob.includes("heavy strike") ||
    blob.includes("dagger storm") ||
    blob.includes("volley") ||
    blob.includes("shadow veil")
  ) {
    return "skill";
  }
  return "attack";
}

/** Sum HP restored by lifesteal (`applyPlayerPhysicalHit` log lines), including multi-hit turns. */
export function sumLifestealHealFromLines(lines: string[]): number {
  let sum = 0;
  for (const L of lines) {
    const m = L.match(/Lifesteal restores (\d+) HP/i);
    if (m) sum += Number(m[1]);
  }
  return sum;
}
