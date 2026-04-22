# Game design (browser-first PvE RPG)

Practical reference for **Dream World–style** Kongregate energy: short sessions, clear loops, readable UI. Placeholder art is fine; systems should feel fair and understandable.

---

## Core gameplay loop

1. **Town:** Heal (campfire on cooldown), buy tonics / stones, forge equipped gear, sell spares, allocate stats.
2. **Adventure:** Pick region → roll encounter (combat / quick gold / quick tonic) → resolve combat or return.
3. **Combat:** Read enemy intent → choose attack, defend, skill, or potion → repeat until victory, defeat, or flee.
4. **Outcome:** XP and gold on win; loot to inventory; HP persists (no full heal on win); defeat may send you back to town at reduced HP.
5. **Progress:** Level up → stat points → better gear and regions → harder encounters and chase drops.

Loop should work in **under a minute per outing** when desired, or stretch longer for players who chain fights.

---

## Stat system

- **Core attributes:** STR, CON, INT, DEX — spent from a pool on level-up (and a small starting pool).
- **Combat stats:** HP, max HP, attack, defense, speed, crit chance — derived from class base + gear + attributes (implementation in `buildCharacterStats` and related helpers).
- **CON** also bumps max and current HP per point (see constants).
- **Design goal:** Stats should matter in combat and gear requirements; avoid opaque formulas in UI — show **effective** combat stats where possible.

---

## Class identities

| Class   | Role (design intent)      | Notes |
|--------|-----------------------------|--------|
| **Warrior** | Sturdy melee               | Higher baseline defense / HP bias; skill supports brawling. |
| **Mage**    | Glass cannon caster        | INT-weighted; skill leans magical burst / utility. |
| **Rogue**   | Fast, crit-leaning (archer-style in copy) | DEX bias; mobility / precision fantasy. |

Skills are **cooldown-based** (no mana in current design). Class-specific skill definitions live in code constants.

---

## Combat rules (summary)

- **Turn order:** Player acts with full information about **this round’s** enemy intent, then enemy resolves.
- **Actions:** Attack, Defend (mitigates / interacts with intent), class Skill (cooldown), Potion (tonic), Auto (resolver runs a policy).
- **Enemy intent:** Telegraph reduces unfair deaths; heavy attacks reward defending.
- **Victory:** XP, gold, possible loot; encounter cleared; HP retained.
- **Defeat:** Consolation XP possible; return-to-town behavior per implementation; no gold loss in current design.

---

## Flee rules

- **Flee** ends the encounter without victory rewards; **current HP is preserved** as of flee resolution.
- Use when the player prefers to keep HP and exit rather than risk defeat.

---

## Potion rules (tonics)

- **Pack cap:** Maximum tonics in inventory (hard cap) so fights stay tense.
- **Shop:** Tonics purchased in town; cannot exceed pack cap (overflow may convert to gold or be blocked — per implementation).
- **In combat:** Using a tonic consumes one unit, heals by a **curved** amount (not a full reset of difficulty), and applies a **cooldown** (several player turns before another sip in manual mode; auto may follow same rules per implementation).
- **Design goal:** Tonics are **safety valves**, not infinite sustain.

---

## Region progression philosophy

- **Gated by level** so players don’t skip the curve; higher regions assume better gear and stats.
- **Elites** and optional **miniboss** pacing add spikes without replacing the normal pool.
- **Loot** ties to region and enemy tier; rare / legendary items are **chase** rewards, not guaranteed.
- Regions should teach systems in early zones and **demand** preparation in later ones (gear, stats, tonics).

---

## Town vs adventure philosophy

- **Town:** Safety, preparation, economy, recovery on timers — **no** open-ended grinding without leaving.
- **Adventure:** Risk, XP, gold, drops, HP loss — **identity** should feel different from town (layout, color, copy).
- **Navigation:** Returning to town should be obvious; services that only work in town should be clearly labeled.

---

## Mobile-first UI philosophy

- **Touch-first:** Large tap targets for combat actions and primary nav; avoid hover-only critical paths.
- **Readable:** Short lines, high contrast, monospace only where it aids numbers (HP, gold, stats).
- **Progressive disclosure:** Secondary info (full log, tooltips) available without crowding the main fight readout.
- **Performance:** Lightweight DOM; defer heavy animation; assume mid-tier phones and flaky tabs.
- **One-hand friendly:** Primary actions reachable; avoid forcing two-hand stretches for core loop.
