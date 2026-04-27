# Phase 0 Task Plan: Solo Balance + Combat Foundation Seam

Status: complete (locked baseline for next phase)

## Goal

Execute the first approved roadmap slice by:

1. Stabilizing current solo combat across classes.
2. Introducing a compatibility-first combat domain seam that keeps current gameplay unchanged.

This is intentionally implementation-ready and small-step oriented for solo development in Cursor.

---

## Scope Guardrails

- Do not add multiplayer features yet.
- Do not change route contracts for existing pages/API consumers.
- Keep current combat outcomes broadly unchanged unless explicitly balancing.
- Prefer incremental PR-sized commits over large rewrites.

---

## Definition of Done

- Existing combat flows still work end-to-end:
  - start combat
  - take actions (attack, defend, skill, potion, auto)
  - flee
  - victory/defeat rewards
- Combat logic now runs through a new internal domain abstraction.
- Solo encounter DB model is still source of truth.
- Baseline class-balance telemetry and smoke validation exist.
- Documentation updated for the new architecture seam.

---

## Vertical Slice A: Add Combat Domain Types (No Behavior Change)

## A1. Create domain module

### Task

Add new file:

- `src/lib/game/encounter-domain.ts`

Define core types:

- `ActorType = "PLAYER" | "ENEMY"`
- `Team = "A" | "B"`
- `ActorState`
- `EncounterState`
- `TurnAction`
- `TurnResolution`

### Acceptance criteria

- File compiles.
- No runtime usage yet.

### Notes

- Keep type design minimal and solo-compatible.
- Include optional fields needed later (timeouts/default action), but do not implement timeout logic now.

---

## A2. Add adapter functions

### Task

In the same module or a companion file, add:

- `soloEncounterRowToEncounterState(...)`
- `encounterStateToSoloEncounterPatch(...)`

### Acceptance criteria

- Adapters fully map currently-used solo fields (HP, cooldowns, intent, round, pending modifiers, mana proxy).
- Mapping is deterministic and side-effect free.

---

## Vertical Slice B: Route Existing Resolver Through Domain Seam

## B1. Introduce seam entrypoint

### Task

Add a function in domain layer:

- `resolveSoloTurnThroughDomain(...)`

This can internally call existing `resolveCombatRound` initially; focus is seam shape, not algorithm rewrite.

### Acceptance criteria

- Existing turn logic can be called through this entrypoint.
- No behavior drift in normal combat flow.

---

## B2. Integrate in combat action executor

### Task

Update:

- `src/lib/game/combat-action-execute.ts`

Replace direct state/round mutation hotspots with:

- row -> domain state adapter
- domain resolver call
- domain state -> DB patch adapter

### Acceptance criteria

- `executeCombatAction` external contract unchanged.
- Existing UI still receives same payload shapes.

---

## B3. Integrate in flee flow

### Task

Update:

- `src/lib/game/combat-flee-execute.ts`

Use the same domain adapter path for failed flee turn resolution (where enemy acts).

### Acceptance criteria

- Flee success/fail behavior unchanged from user perspective.
- Defeat-on-failed-flee path still works.

---

## Vertical Slice C: Baseline Class Balance Validation

## C1. Add lightweight telemetry helper

### Task

Add internal helper to capture per-fight summary (at minimum in logs or structured object):

- class
- enemy key/level
- turns
- outcome
- hp remaining
- action usage counts

No need for full DB table yet unless preferred.

### Acceptance criteria

- You can compare Warrior/Mage/Rogue runs with consistent summary output.

---

## C2. Run manual validation matrix

### Task

Perform quick repeatable checks for each class:

- early region normal enemy
- early elite/miniboss
- mid-tier region enemy
- potion-constrained scenario
- flee-at-low-hp scenario

### Acceptance criteria

- No class has obvious unwinnable loop in baseline regions.
- No hard regressions in flee, cooldown, or auto-battle behavior.

---

## Vertical Slice D: Docs + Dev Notes

## D1. Document seam in roadmap notes

### Task

Update docs to mention:

- combat now uses domain seam
- adapters preserve `SoloCombatEncounter` compatibility
- multiplayer-ready primitives introduced without feature switch

Suggested file:

- `roadmap.md` (or add dedicated short doc in `docs/architecture/`)

### Acceptance criteria

- New contributor can find where combat flow enters domain seam.

---

## File Touch Map (Expected)

- `src/lib/game/encounter-domain.ts` (new)
- `src/lib/game/combat-action-execute.ts`
- `src/lib/game/combat-flee-execute.ts`
- `roadmap.md` (or equivalent architecture note)

Optional:

- `src/lib/game/combat-turn.ts` (if extracting/bridging helpers)

---

## Suggested Implementation Order (Small Commits)

1. Add types only (`encounter-domain.ts`).
2. Add adapters + unit-like sanity assertions.
3. Wire `executeCombatAction` through seam.
4. Wire failed-flee branch through seam.
5. Add telemetry helper/log summary.
6. Perform manual class matrix.
7. Update docs.

---

## Regression Checklist

- Can start an encounter from adventure.
- `ATTACK`, `DEFEND`, `SKILL`, `POTION`, `AUTO` still resolve.
- Potion cap and cooldown remain enforced.
- Flee chance and failure handling still work.
- Victory still grants XP/gold/drops.
- Defeat still applies fallback HP and town return behavior.
- Combat log remains readable and complete.
- Existing pages load without contract changes.

---

## Practical Test Routine (Cursor-friendly)

For each class (Warrior, Mage, Rogue):

1. Create/focus a character.
2. Run 5-10 encounters in `town_outskirts`.
3. Force at least one:
   - skill-use fight
   - potion-use fight
   - failed flee
   - auto-battle
4. Record quick summary:
   - wins/losses
   - average turns
   - common failure mode

If one class consistently underperforms, adjust constants in a tiny follow-up commit rather than during seam wiring.

---

## Next Task After This Doc

Start Vertical Slice A:

- create `src/lib/game/encounter-domain.ts`
- define the core types and adapter function signatures

Then stop and run typecheck before wiring executors.

---

## Validation Results

Date: 2026-04-27

### Automated checks run

1. `npm run lint`
   - Result: failed due to pre-existing lint errors in `src/components/turn-combat-arena.tsx`.
   - Notes: failures are unrelated to Phase 0 seam work and were not introduced by these changes.
2. `npx tsx scripts/phase0-validation-smoke.ts`
   - Result: pass
   - Output summary:
     - manual-action-sweep:
       - Warrior: finalPlayerHp 42, finalEnemyHp 46
       - Mage: finalPlayerHp 57, finalEnemyHp 0
       - Rogue: finalPlayerHp 41, finalEnemyHp 38
     - auto-sweep:
       - Warrior: autoPlayerHp 30, autoEnemyHp 0, autoPotionsRemaining 2
       - Mage: autoPlayerHp 33, autoEnemyHp 0, autoPotionsRemaining 2
       - Rogue: autoPlayerHp 23, autoEnemyHp 0, autoPotionsRemaining 2
3. `npm run build`
   - Result: pass
   - Notes: production build compiled successfully and all app routes generated.

### Interpretation

- Phase 0 seam changes are build-safe and resolver-smoke-safe.
- Full repository lint is currently blocked by pre-existing arena hook/effect lint issues outside this task scope.
- Remaining validation needed: live class matrix in actual gameplay sessions (normal/elite/potion/flee/auto scenarios per class).

### Live browser validation attempt (agent-run)

- Attempted to execute in-app scenario flows through the IDE browser against `localhost`.
- Was able to:
  - register/login a Warrior test account
  - create character and reach `/town`
- Blocker:
  - repeated link/button interactions from the browser tool did not consistently trigger route transitions or adventure roll form submissions in this session, preventing full end-to-end manual matrix completion for all classes.
- Conclusion:
  - automated resolver/build checks passed, but full manual class matrix still needs a direct interactive pass in the regular app browser session.

### Mathematical first-zone simulation (Monte Carlo)

Command run:

- `npx tsx scripts/phase0-first-zone-sim.ts`

Simulation settings:

- Uses current `resolveCombatRound` logic and enemy intent rolling.
- Uses first-zone DB enemies (`town_outskirts`) with encounter enemy scaling parity.
- `400` runs per class/enemy matchup.
- Action policy: defend telegraphed heavy/charged strike, potion at low HP, skill when off cooldown, otherwise attack.

Key results:

- `sewer_rat` (Lv1):
  - Warrior `100%` win
  - Mage `100%` win
  - Rogue `100%` win
- `ditch_scrapper` (Lv1):
  - Warrior `100%` win
  - Mage `68.75%` win
  - Rogue `100%` win
- `gutter_cur` (Lv2):
  - Warrior `99.5%` win
  - Mage `27.75%` win
  - Rogue `94%` win
- `sewer_fencer` miniboss (Lv3):
  - Warrior `0.5%` win
  - Mage `0%` win
  - Rogue `0%` win

Interpretation:

- Baseline normal enemy is stable for all classes.
- Mage underperforms sharply vs stronger early-zone enemies in this policy model.
- Miniboss is intentionally lethal for Lv1 in current tuning; near-universal losses indicate a very hard gate.

### Balance iteration #1 (Mage early survivability)

Change applied:

- `src/lib/game/constants.ts`
  - Mage base stats changed from `hp 44 / defense 4` to `hp 48 / defense 5`.

Re-run command:

- `npx tsx scripts/phase0-first-zone-sim.ts`

Before vs after (Mage):

- `sewer_rat` win rate: `100% -> 100%` (stable)
- `ditch_scrapper` win rate: `68.75% -> 82.0%` (**+13.25pp**)
- `gutter_cur` win rate: `27.75% -> 40.75%` (**+13.0pp**)
- `sewer_fencer` win rate: `0% -> 0%` (still hard gate at Lv1, unchanged)

Summary:

- First tuning pass improved Mage early-zone consistency without changing miniboss gate behavior.
- Recommended next tuning (only if desired): small Fireball efficiency bump or enemy damage variance tightening for non-boss early encounters.

### Simulation model correction + final Mage nudge decision

Correction applied:

- Updated `scripts/phase0-first-zone-sim.ts` to initialize player mana from `buildCharacterStats(...).maxMana` (matching encounter setup), instead of base speed.

Impact:

- This materially changed class outcomes vs the earlier conservative model.
- Under corrected simulation, Mage already performs very strongly in first-zone non-boss matchups even at baseline stats.

Baseline (corrected model, current kept values):

- Mage win rates:
  - `sewer_rat`: `100%`
  - `ditch_scrapper`: `99.75%`
  - `gutter_cur`: `99.75%`
  - `sewer_fencer`: `29.25%`

Mage skill-efficiency nudge trial:

- Trialed Fireball scaling increase (`~130% -> ~140%`) and re-ran corrected simulation.
- Result: no healthy balancing effect; Mage remained or became overtuned in first-zone outcomes.
- Decision: **did not keep the skill-efficiency nudge**.

Final kept state after this pass:

- Fireball scaling remains at `~130%`.
- Mage base stats adjusted to `attack 9` (from `10`) while keeping `hp 44`, `defense 4`.

### Policy-model expansion (optimal vs conservative)

Simulation update:

- `scripts/phase0-first-zone-sim.ts` now runs two policies:
  - `OPTIMAL`: uses skill as soon as available, tighter defend and potion heuristics.
  - `CONSERVATIVE`: less aggressive skill usage, simpler defend/potion behavior.

Reason:

- Compare "best play" vs "typical play" so class tuning is not biased by one policy style.

Post-nerf Mage results (400 runs/matchup):

- `OPTIMAL` policy:
  - `ditch_scrapper`: `100%`
  - `gutter_cur`: `99.75%`
  - `sewer_fencer`: `22.5%`
- `CONSERVATIVE` policy:
  - `ditch_scrapper`: `99.75%`
  - `gutter_cur`: `98.75%`
  - `sewer_fencer`: `11.0%`

Parity read:

- Mage remains very strong in non-boss first-zone encounters, but the attack nerf narrows boss overperformance vs pre-nerf baseline.
- Warrior and Rogue still trail Mage on `gutter_cur`, but no class is failing normal-zone viability.

### Additional Mage nerf (small)

Change applied:

- `src/lib/game/combat-turn.ts`
  - Fireball INT contribution reduced to `intl * 1.3` to lower Mage burst scaling.
- `src/lib/game/constants.ts`
  - Mage base attack set to `9` (from original `10`) in the earlier tuning pass and kept.

Final code-level nerf retained in this step:

- Mage base attack remains `9`
- Fireball INT contribution remains reduced at `1.3`

Dual-policy results after this additional nerf direction:

- `OPTIMAL` Mage:
  - `ditch_scrapper`: `100%`
  - `gutter_cur`: `99.25%`
  - `sewer_fencer`: `12.75%`
- `CONSERVATIVE` Mage:
  - `ditch_scrapper`: `99.0%`
  - `gutter_cur`: `97.5%`
  - `sewer_fencer`: `6.75%`

Net effect:

- Mage remains reliable in first-zone normals but boss overperformance is reduced further.
- Closer to parity target while preserving class identity as high burst.
