# Phase 0 Validation Runbook

## Purpose

Run a repeatable manual validation pass across Warrior, Mage, and Rogue using the new combat seam and telemetry logging to confirm stability and identify balance outliers.

---

## Pre-check

1. Start dev server.
2. Use one test account per class, or recreate class as needed.
3. Open terminal logs and confirm `[combat-telemetry]` lines appear after combat outcomes in development mode.

---

## Scenario Matrix (per class)

Run each scenario at least once:

1. **Normal fight**
   - Region: `town_outskirts`
   - Goal: baseline win flow and telemetry output
2. **Skill-driven fight**
   - Use class skill at least once in encounter
   - Goal: cooldown/skill action usage sanity
3. **Potion-constrained fight**
   - Use at least one potion and verify cooldown/potion cap behavior
4. **Failed flee**
   - Attempt flee at low HP until a failure occurs
   - Goal: failed flee update path + state persistence
5. **Auto battle**
   - Use auto mode once
   - Goal: auto branch still stable through seam
6. **Elite or miniboss**
   - Trigger tougher enemy in `town_outskirts` or nearby unlocked region
   - Goal: check survival curve and turn pacing under pressure

---

## What to Capture

For each scenario, record:

- class
- enemy key/level
- outcome
- turns
- HP remaining
- action distribution from telemetry
- notes on failure mode (if any)

Use this template:

```txt
Class:
Scenario:
Enemy:
Outcome:
Turns:
HP remaining:
Telemetry actions:
Notes:
```

---

## Pass Criteria

- No hard regressions in:
  - start combat
  - action handling (`ATTACK`, `DEFEND`, `SKILL`, `POTION`, `AUTO`)
  - flee success/failure flows
  - victory/defeat cleanup
- All classes can complete baseline normal fights without obvious unwinnable loops.
- No class shows severe underperformance in baseline content (use qualitative + telemetry trend).

---

## Tuning Rules (if needed)

- Make small constants-only changes first.
- Avoid changing multiple systems at once (for example, do not change flee and potion and skill scaling in one pass).
- Re-run only affected scenarios after each tweak.

---

## Suggested Follow-up Log

After validation, append results to:

- `docs/tasks/phase-0-combat-foundation.md` under a new "Validation Results" section.

This keeps implementation and evidence in one place.
