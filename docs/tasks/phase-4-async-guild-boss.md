# Phase 4 Task Plan: Async Guild Boss (design + v1 implementation)

## Implementation status (v1 shipped in repo)

- Prisma: `GuildBossSeason`, `GuildBossAttempt`, `GuildBossContribution`, `GuildBossRewardClaim`, `SoloCombatEncounter.guildBossAttemptId`.
- Domain: `src/lib/game/guild-boss-definitions.ts`, `guild-boss-season.ts`, `guild-boss-attempts.ts`, `guild-boss-encounter.ts`, `guild-boss-resolve.ts`.
- Combat: `combat-action-execute.ts` / `combat-flee-execute.ts` branch for guild boss (no solo XP/gold/drops; shared HP + contributions).
- Actions: `src/app/actions/guild-boss.ts` (`startGuildBossFightAction`, claim rewards).
- UI: Guild page raid panel; fight continues on `/adventure` like any solo encounter.
- Seed: five `guild_boss_*` enemies in `prisma/seed.ts`.

**Apply DB:** `npx prisma migrate deploy` (or `migrate dev`) then `npx prisma generate` (stop dev servers on Windows if EPERM) then `npx prisma db seed` for enemies.

---

## Relationship to existing architecture

Phase 4 keeps the same **technical spine** already called out in the multiplayer roadmap:

- **`GuildBossSeason`** — time-bounded (or rolling) boss rotation; holds shared boss state (current HP, boss identity, boundaries).
- **`GuildBossAttempt`** — one row per **completed** valid combat submission (audit + idempotency anchor).
- **`GuildBossContribution`** — per-user aggregates for the season (damage totals, eligibility flags); used for rewards and leaderboards.
- **Reward-claim table** — personal claim state (pending / claimed) keyed by user + season (+ reward tier).

**Guild Level** (derived from `Guild.xp` via `getGuildLevelFromXp`) is an **unlock and tuning layer** on top of this spine: it gates which boss *definitions* can be active, scales reward quality expectations, and drives post-defeat **Guild XP** grants through the existing `awardGuildXp(..., "guild_boss")` helper.

Do **not** replace the season / attempt / contribution split; add boss catalog metadata, unlock rules, HP scaling, attempt limits, and reward rules around it.

---

## Boss catalog and unlock tiers (Guild Level)

Bosses are **not** all available at guild level 1. Unlock table (initial content):

| Boss key / name        | Min guild level | Defeat Guild XP (`awardGuildXp`) |
|------------------------|-----------------|------------------------------------|
| Sewer Rat King         | 1               | +500                               |
| Gravebound Ogre        | 3               | +1,500                             |
| Ancient Warden         | 5               | +3,500                             |
| Ashen Drake            | 8               | +7,500                             |
| Duskforged Titan       | 12              | +15,000                            |

- **Guild level** = `getGuildLevelFromXp(guild.xp)` (no extra DB column).
- A guild may only engage bosses whose **min guild level ≤** current guild level (config-driven).
- **v1 simplicity:** one **active** boss target per guild per season (or rotation slot); the guild fights the tier they’ve selected among **unlocked** tiers, or the system assigns the “next” tier—pick one rule in implementation and document it in code comments.

---

## Boss HP scaling (shared guild-wide HP)

Shared boss max HP (and current HP) for the season applies to the whole guild.

**Member count**

- Prefer **active member count** when available: e.g. `GuildMember` joined users where `User.lastSeenAt` is within a defined window (e.g. last 7 days). If that yields `0`, fall back to **total** `GuildMember` count for the guild.
- **v1** may ship with **total member count only**; document the hook for `lastSeenAt`-based active count so it can be swapped without schema churn.

**Formula**

```text
bossMaxHp = baseBossHp + (memberCount * hpPerMember)
```

Example constants (tune in one module, e.g. `guild-boss-definitions.ts`):

| Boss               | baseBossHp | hpPerMember |
|--------------------|-----------:|------------:|
| Sewer Rat King     |       750  |         750 |
| Gravebound Ogre    |     2,000  |       1,000 |
| Ancient Warden     |     5,000  |       1,500 |
| Ashen Drake        |    12,000  |       2,500 |
| Duskforged Titan   |    30,000  |       4,000 |

Current HP is stored on the **season** (or boss instance) row; damage from attempts subtracts atomically in a transaction.

---

## Async attempts (per member, per day)

- **Base limit:** **3 attempts per member per rolling 24 hours** (or calendar UTC day—choose one; rolling 24h from first attempt is acceptable for “simple implementation”).
- **One attempt** = one full turn-based combat resolution against the **current** guild boss for that guild/season.
- **Decrement attempts only** after a **valid, server-validated** submission (combat finished, damage computed, transaction committed). Do not consume attempts on validation errors, stale boss state, or double-submit.
- **Double-submit / races:** persist `GuildBossAttempt` as the idempotent record: e.g. unique constraint on `(userId, guildId, seasonId, nonce)` or a single **server-issued `attemptId`** that must be present to finalize damage. Recommended **v1**: server creates `GuildBossAttempt` row in `PENDING` with unique id, runs combat, then updates to `COMPLETED` with `damageDealt` in one transaction that also updates season HP and contribution aggregates—so duplicate finalization hits a unique constraint or invalid state.

**Future (do not implement now):** attempts/day may scale slightly with guild level (e.g. +1 per few levels), **capped at 5**. Leave a TODO and a single config placeholder so balance can be added without redesign.

### `GuildBossAttempt` (tracking)

Minimum fields (align with existing Phase 4 schema naming):

- `userId`, `guildId`, `bossId` (or `bossKey`) / linkage to `seasonId`
- `damageDealt` (int, ≥ 0)
- `createdAt` (and optionally `completedAt`)
- Status if needed: `PENDING` | `COMPLETED` | `VOID` for crash safety

Ensure **no duplicate completed attempts** for the same logical submission (unique key or state machine as above).

---

## Damage and contributions

- **Damage dealt** on a valid attempt is added to **`GuildBossContribution`** for `(userId, guildId, seasonId)` (upsert / increment).
- Boss **current HP** is reduced by the same amount in the **same transaction** (check `currentHp >= damage` or clamp to remaining HP so overkill is handled once).
- **Async:** no realtime co-presence; all via server actions + DB.

---

## Rewards

### Qualifying for rewards

- **Minimum contribution** to count for **clear** (guild defeated the boss) rewards:
  - **≥ 1% of boss max HP** damage **OR**
  - **≥ flat minimum damage** (small number, e.g. 50–100, tuned so low-level players can qualify in 1–3 honest attempts).
- Use **max HP at season start** (or current max) for the 1% threshold—document which in code to avoid drift if HP ever changes mid-season.

### Personal vs clear rewards

- **Participation / personal:** players who contributed can **claim** a baseline reward (scaled by **boss tier** and **damage contribution**).
- **Clear bonus:** if the guild reduces boss HP to 0, **all qualifying contributors** get an **upgraded** clear reward (better table or multiplier).
- Reward quality scales with: **boss tier**, **damage share**, **defeated vs not**.

### Anti-snowball (one carry invalidating others)

- Cap **per-attempt** damage contribution toward **reward tiers** if needed (optional v2).
- **v1:** rely on **% of max HP** gate + scaling rewards by **relative** contribution so minimal contributors still get something if they pass the threshold.

---

## Guild XP on boss defeat

On **defeat** (boss HP reaches 0), call **`awardGuildXp(tx, guildId, amount, "guild_boss")`** in the same transaction that finalizes the season outcome (or marks boss defeated).

Use the **defeat Guild XP** column in the boss table above. This is intentionally **much larger** than donation-driven XP (donations are 1 XP per gold).

---

## Exploit prevention (priority)

1. **Double submit:** unique keys, server-minted attempt id, or conditional updates (`UPDATE ... WHERE currentHp = expected`).
2. **Race on last hit:** single transaction: read season row with appropriate isolation or `UPDATE ... SET currentHp = currentHp - $d WHERE id = $id AND currentHp >= $d`.
3. **Attempt inflation:** enforce daily cap with a **count query** or **counter rows** updated atomically; reject if over cap.
4. **Guild level spoofing:** unlock checks read **`Guild.xp` from DB inside the transaction**, not from client input.

---

## Frontend (later implementation)

- Guild boss panel: current boss, HP bar, your attempts remaining, your damage, unlock ladder (which tiers are locked vs unlocked by guild level).
- Clear / claim UI when eligible.

---

## Test checklist (for implementation phase)

- Unlock matrix: guild level below threshold cannot start or submit to higher tier.
- HP formula matches definition + member count.
- Attempt cap: 4th attempt in window rejected; valid path decrements exactly once.
- Concurrent damage submissions: no negative HP; contributions sum correctly.
- Defeat grants Guild XP once; `awardGuildXp` reason `"guild_boss"`.
- Rewards: sub-threshold contributors get no clear reward; above threshold do; defeat upgrades payout.
- Idempotent retry of same attempt id does not double-apply damage.

---

## Files (expected, when implementing)

- `prisma/schema.prisma` — season, attempt, contribution, claims (as per roadmap).
- `src/lib/game/guild-boss-definitions.ts` (or similar) — boss table, base HP, per-member HP, min level, defeat XP.
- `src/lib/game/guild-progression.ts` — already provides `getGuildLevelFromXp`; reuse.
- `src/lib/game/guild-xp.ts` — `awardGuildXp` with `"guild_boss"`.
- Domain module for atomic attempt application + reward claims.
- `src/app/guild/page.tsx` — boss UI section.
