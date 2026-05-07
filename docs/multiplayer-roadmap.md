# Dusk Forge Multiplayer Roadmap

## Goal

Move Dusk Forge from solo-first into multiplayer/social in small vertical slices, while preserving a clean path to 2-4 player turn-based party dungeons without a painful rewrite.

## Current Architecture Snapshot

- Stack: Next.js App Router + TypeScript + Prisma + PostgreSQL.
- Auth/session: custom cookie-backed sessions (`src/lib/auth/session.ts`, `src/lib/auth/guards.ts`, `src/app/actions/auth.ts`).
- Core game model: single-character progression with `SoloCombatEncounter` in `prisma/schema.prisma`.
- Combat engine: server-resolved solo turn combat (`src/lib/game/combat-turn.ts`, `src/lib/game/combat-action-execute.ts`, `src/lib/game/combat-flee-execute.ts`, `src/lib/game/start-encounter.ts`).
- APIs: thin wrappers around services (`src/app/api/adventure/start/route.ts`, `src/app/api/combat/start/route.ts`, `src/app/api/combat/action/route.ts`, `src/app/api/combat/flee/route.ts`).
- UI surfaces: town, adventure, shop, character, solo arena (`src/app/town/page.tsx`, `src/app/adventure/page.tsx`, `src/app/shop/page.tsx`, `src/app/character/page.tsx`, `src/components/turn-combat-arena.tsx`).
- Social/realtime: no sockets yet; `WorldChatPanel` is placeholder text (`src/components/world-chat-panel.tsx`).

## Docs Accuracy Audit

### Accurate

- `roadmap.md`
- `game-design.md`

### Outdated or aspirational

- `README.md` (template-heavy)
- `blueprint.md` (vision-forward, not implementation truth)

### Missing

- Canonical architecture/flow doc
- API contracts doc
- Multiplayer schema evolution plan
- Socket event contract doc
- Multiplayer test strategy doc

## Solo Assumptions in Current Combat

- `SoloCombatEncounter` is hard-wired to one character vs one enemy.
- Combat resolvers accept one character context.
- UI state tracks one player and one enemy.
- Reward/progression apply directly to one character.
- No concept of `participants[]`, `turns[]`, `actions[]`, readiness, or timeout defaults.

## Minimal Refactors to Do Early

Keep behavior stable; add seams:

1. Introduce domain types (`EncounterState`, `ActorState`, `TurnAction`, `TurnResolution`).
2. Add adapters between `SoloCombatEncounter` rows and domain types.
3. Split enemy decision from resolution (`decideEnemyAction` vs `resolveTurn`).
4. Add actor abstraction (`actorType`, `team`) in domain.
5. Add explicit turn primitives (`turnNumber`, `actionsByActor`) even in solo mode.
6. Add timeout/default-action policy hook for future multiplayer turns.
7. Keep existing API signatures; delegate internally to new domain logic.

---

## Phase 0: Stabilize solo baseline and class balancing

Status: complete (baseline locked for Phase 1 handoff)

### Purpose

Balance and harden solo gameplay across Warrior/Mage/Rogue before social complexity.

### Data models

- Optional `CombatTelemetry` table, or extend `CombatLog` metadata.

### API/server actions

- Optional internal metrics endpoint/action for combat analytics.

### Frontend

- Optional dev-only combat balance panel.

### Socket events

- None.

### Risks

- Overfitting to seeds; regressions in potion/flee/cooldown.

### Likely files

- `src/lib/game/combat-turn.ts`
- `src/lib/game/combat-action-execute.ts`
- `src/lib/game/constants.ts`
- `prisma/seed.ts`

### Test checklist

- Bulk simulations per class and zone tier.
- Win-rate/time-to-kill sanity checks.
- Verify cooldown, potion cap, flee outcomes.

### Phase 0 completion notes

- Combat domain seam shipped (`encounter-domain`) with compatibility adapters and shared update helper.
- Combat telemetry logging shipped (`combat-telemetry`) for dev-mode outcome/action summaries.
- First-zone Monte Carlo simulation script shipped (`scripts/phase0-first-zone-sim.ts`) with both `OPTIMAL` and `CONSERVATIVE` policy modes.
- Current balance baseline locked:
  - Mage base attack set to `9` (from original `10`)
  - Fireball INT scaling contribution reduced to `intl * 1.3`
- Detailed validation history and deltas are documented in `docs/tasks/phase-0-combat-foundation.md`.

---

## Phase 1: Player identity / public profile pages

### Purpose

Create discoverable player identity and social presence.

### Data models

- Extend `Character` or add `CharacterProfile` (bio, title, visibility).

### API/server actions

- `GET /api/player/search`
- `GET /api/profile/[name]`
- Profile update action

### Frontend

- Public profile route (`/player/[name]`)
- Search/lookup UI entry point

### Socket events

- None required.

### Risks

- Name lookup consistency; visibility/privacy handling.

### Likely files

- `prisma/schema.prisma`
- `src/app/character/page.tsx`
- `src/app/player/[name]/page.tsx` (new)

### Test checklist

- Public/private profile access behavior.
- Character lookup by canonical name.

---

## Phase 1.5: Friends system (async)

### Purpose

Add player-to-player social ties before realtime guild/group systems.

### Data models

- `Friendship` with statuses `PENDING | ACCEPTED | DECLINED | CANCELLED`

### API/server actions

- Send friend request
- Accept / decline incoming requests
- Cancel outgoing request
- Remove friend

### Frontend

- Add-friend stateful CTA on public profiles and player directory
- Friends page with accepted/incoming/outgoing sections

### Socket events

- None required (async-only slice).

### Risks

- Duplicate pending requests
- Self-friending
- Button state drift across pages

### Likely files

- `prisma/schema.prisma`
- `src/app/actions/friends.ts`
- `src/app/friends/page.tsx`
- `src/app/player/[name]/page.tsx`
- `src/app/players/page.tsx`

### Test checklist

- Self-friend blocked
- Duplicate pending blocked
- Accept/decline/cancel/remove flows all re-render correctly

---

## Phase 2: Socket foundation + world chat

### Purpose

Make the world feel alive with real-time communication.

### Data models

- `ChatChannel`
- `ChatMessage`
- Optional moderation tables (mute/rate-limit flags).

### API/server actions

- Socket auth handshake endpoint.
- Chat history fetch endpoint.
- Fallback message post action.

### Frontend

- Replace placeholder `WorldChatPanel` with live feed and input.

### Socket events

- `presence:join`
- `presence:leave`
- `chat:world:send`
- `chat:world:new`
- `chat:world:history`

### Risks

- Spam, reconnect storms, ordering, moderation baseline.

### Likely files

- `src/components/world-chat-panel.tsx`
- `src/lib/auth/session.ts`
- realtime server files (new)
- `prisma/schema.prisma`

### Test checklist

- Multi-client send/receive.
- Reconnect and history sync.
- Rate-limit behavior.

---

## Phase 3: Guilds + guild chat

### Purpose

Add durable social grouping and retention loops.

### Data models

- `Guild`
- `GuildMember`
- `GuildInvite`
- `GuildDonation`
- `GuildChatMessage`

### API/server actions

- Create guild, invite/respond, leave/kick.
- Donation endpoints and roster/history fetch.

### Frontend

- Guild page with roster, invites, chat, donation panel.

### Socket events

- `guild:chat:new`
- `guild:member:joined`
- `guild:member:left`
- `guild:donation:new`

### Risks

- Role permissions, ownership transfer, invite spam.

### Likely files

- `prisma/schema.prisma`
- `src/app/guild/page.tsx` (new)
- `src/app/actions/guild.ts` (new)
- nav/topbar components

### Test checklist

- Guild lifecycle and permissions matrix.
- Guild chat isolation by guild ID.

---

## Phase 4: Async guild boss

### Purpose

Deliver cooperative guild progression without scheduling constraints. **Guild Level** (from existing `Guild.xp` / `getGuildLevelFromXp`) gates which boss tiers exist for that guild so boss content feels earned; shared boss HP, per-member daily attempts, and contribution-based rewards sit on the same async spine as before.

### Progression layer (Guild Level)

- Boss **availability** is **not** “all bosses day one”: each boss has a **minimum guild level** (initial ladder: L1 Rat King → L3 Ogre → L5 Warden → L8 Drake → L12 Titan).
- Higher guild level unlocks **stronger tiers** (harder HP, better rewards, larger **Guild XP** payout on defeat via `awardGuildXp(..., "guild_boss")`).
- Defeat XP per tier is **much larger** than donation XP (e.g. 500–15,000 guild XP by tier); donations remain a separate progression lever.

### Boss scaling (shared HP)

- **Shared guild-wide** current/max HP on the season (or boss instance) row.
- `bossMaxHp = baseBossHp + (memberCount * hpPerMember)` per boss definition.
- **Member count:** prefer **active** members (`User.lastSeenAt` window) when implemented; **fallback** to total `GuildMember` count for v1 simplicity.

### Data models (unchanged spine)

- `GuildBossSeason` — boss identity, shared HP, boundaries, link to guild + boss tier.
- `GuildBossAttempt` — `userId`, `guildId`, `bossId` / `seasonId`, `damageDealt`, `createdAt`; idempotency / status to block double-submit.
- `GuildBossContribution` — per-user damage aggregates for rewards.
- Reward-claim table — personal claim state (participation + clear upgrade).

### Attempts

- **3 attempts per member per 24h** (simple reset; calendar vs rolling documented in task plan).
- Decrement **only** on **valid** completed submission after server-side combat resolution.
- Leave **room** for future “attempts scale slightly with guild level, cap 5” without building it now.

### Rewards

- Contributors who meet **min threshold** (≥ **1% of boss max HP** **or** small flat min damage) qualify for **clear** rewards when the guild wins.
- Reward quality scales with **boss tier**, **damage contribution**, and **defeated vs not**; avoid one carry invalidating everyone (relative scaling + threshold).

### API/server actions

- Start/rollover season (boss choice must respect guild level unlocks).
- Submit attempt (turn-based combat reuse), atomic damage + contribution + HP update.
- Reward claim endpoints.

### Frontend

- Guild boss panel: HP, unlock ladder, attempts remaining, contribution, claims.

### Socket events (optional polish)

- `guildBoss:update`
- `guildBoss:seasonEnded`

### Risks

- Double-submit exploits; last-hit races; rollover race conditions; spoofed unlock tier (always re-read `Guild.xp` server-side).

### Likely files

- Detailed design: `docs/tasks/phase-4-async-guild-boss.md`
- guild boss domain modules (new), boss definition config (HP bases, unlock levels, defeat guild XP)
- `src/app/guild/page.tsx`
- `prisma/schema.prisma`
- `src/lib/game/guild-xp.ts` (`awardGuildXp` with `"guild_boss"`)

### Test checklist

- Unlock gating vs guild level; HP formula; attempt cap; atomic HP/contributions.
- Idempotent attempts / no duplicate damage.
- Defeat grants guild XP once; reward threshold and clear upgrade behavior.

---

## Phase 4.5: Guild treasury + daily login chest

### Purpose

Add shared guild item storage (treasury), **guild rank promotions** and **ownership rules** aligned with treasury access, officer-facing **guild branding** (bio + emoji), and a personal retention loop (consecutive daily login chests)—alongside Phase 4 guild boss work without requiring realtime.

### Guild ranks, promotions, ownership, and officer branding

- **Rank ladder:** **`INITIATE`** → **`MEMBER`** → **`OFFICER`**, with **`OWNER`** as guild leader (typically `Guild.ownerId` or equivalent). **Member** is the tier that gains **treasury withdraw** access (see Guild treasury below).
- **Promotions:** ship UI + server actions so authorized members can promote along that ladder—at minimum **Initiate → Member** (unlocks treasury take-out per policy) and **Member → Officer**. Define the **permission matrix** (e.g. Owner + Officers may promote to Member; **Officer** promotion might be Owner-only—pick and enforce server-side).
- **Ownership transfer:** if not already implemented from Phase 3, add an explicit **transfer ownership** action (current owner designates a successor who must be in the guild).
- **Owner departure → automatic succession:** when the **owner leaves** the guild (leave / kick flow), **transfer ownership** automatically to the **next highest-ranking** eligible member: prefer an **`OFFICER`** over Member/Initiate. Use a **deterministic tie-break** when multiple officers qualify (e.g. longest membership, then join date, then stable user id)—document it so behavior is predictable. If **no Officers** exist, fall back to **`MEMBER`** (same tie-break); if the roster cannot satisfy a successor rule, define behavior (e.g. dissolve guild, promote oldest Initiate, or freeze)—do not leave `ownerId` dangling.
- **Officer branding:** **`OFFICER`** (and **Owner**) may edit the guild’s **public bio** and **guild emoji** (emoji/icon field on `Guild`); validate on the server (length limits, allowed emoji range).

### Guild treasury

- **Placement:** a **tab or nav entry above the guild raid boss area** on the guild surface; clicking it navigates to a **dedicated treasury page** (not an inline-only panel).
- **Behavior:** members **deposit items** into the guild pool; **withdrawals are rank-gated**—only certain guild ranks may remove items (enforce **server-side** on every withdraw). Example policy: **`INITIATE`** (just joined) **cannot take** from the treasury; after promotion to **`MEMBER`** (or higher), they **can withdraw**. Deposits may stay open to more ranks than withdrawals (define explicitly).
- **Distinction from Phase 3:** Phase 3 `GuildDonation` may cover currency/XP-style donations; treasury is **shared inventory** with auditability (who put in/took out, when).

### Daily login chest (7-day consecutive streak)

Track **calendar-day** (or server-defined “login day”) **consecutive** logins.

| Streak day | Chest tier |
| ---------- | ---------- |
| 1          | Bronze     |
| 2          | Silver     |
| 3          | Silver     |
| 4          | Gold       |
| 5          | Gold       |
| 6          | Diamond    |
| 7          | Mythic     |

**Completed cycle (after day 7 / Mythic):** on the **next** consecutive login, advance the streak position to **day 4** (Gold), **not** day 1—so players reach Mythic again in **four** more consecutive days (4→5→6→7) instead of a full seven from Bronze.

**Broken streak:** **missing** a day resets progression to **day 1** (Bronze).

### Data models

- **Ranks & ownership:** confirm or extend `GuildMember.role` (`INITIATE` | `MEMBER` | `OFFICER`; Owner via `Guild.ownerId`), promotion audit optional; **`Guild.bio`**, **`Guild.emoji`** (or equivalent) for officer editing.
- **Treasury:** `GuildTreasuryItem` (or ledger + stack rows), deposit/withdraw audit rows; tie **withdraw** permission to `GuildMember.role` (e.g. minimum **`MEMBER`**, below that **`INITIATE`** cannot withdraw) so rank rules stay data-driven.
- **Daily chest:** per-character streak state (`lastLoginDate`, `currentStreakDay` 1–7, `lastClaimedAt`), chest tier enum aligned with the table above; after a **day-7** claim, next valid login sets streak to **4** (per “completed cycle” rule above).

### API/server actions

- **Guild governance:** promote/demote (role transitions **Initiate → Member → Officer** with permission checks), **transfer ownership**, **leave guild** path that runs **succession** when the leaver is owner; **update guild bio/emoji** (officer-gated).
- Treasury: list pool, deposit item (validate inventory + guild membership), withdraw item (validate **guild rank allows withdraw** + inventory space).
- Daily chest: claim endpoint idempotent per calendar day; server computes tier from streak rules.

### Frontend

- Guild roster / settings: **promotion** controls (Initiate→Member, Member→Officer), **transfer ownership** flow, **edit bio + guild emoji** for Owner/Officer.
- Guild page: **treasury tab/link above raid boss block** → `/guild/treasury` (or equivalent) with deposit/withdraw UX; **hide or disable withdraw** for ranks that cannot take (mirror server rules).
- Daily chest: claim UI on login hub or town (exact surface TBD), clear streak/progression display.

### Socket events

- Optional: `guild:treasury:update` for live refresh when another member changes the pool.

### Risks

- Treasury dupe/rollback races on concurrent withdraw; permission exploits (junior rank draining items).
- **Succession** races (owner leaves concurrently with transfer); ambiguous tie-break; guild left with invalid `ownerId`.
- Promotion/ownership UI spoofing—must mirror **server** authority checks.
- Login streak timezone edge cases; clock skew; multiple devices claiming same day.

### Likely files

- `prisma/schema.prisma` (`GuildMember.role`, `Guild` bio/emoji, `ownerId`)
- `src/app/guild/page.tsx`, guild roster/settings UI, new treasury route under guild
- server actions: guild promotions, ownership transfer, succession on owner leave, branding; treasury + daily claim

### Test checklist

- **Promote** Initiate→Member (treasury withdraw unlocks), Member→Officer; **demote** if supported; **transfer ownership**; **owner leaves** → next **Officer** (then Member fallback) with deterministic tie-break; no orphan owner row.
- **Officers** (and Owner) can edit **bio** and **guild emoji**; Initiate/Member cannot if policy says so.
- Deposit/withdraw atomicity; **rank matrix** (e.g. initiate cannot withdraw, member+ can); inventory constraints.
- Streak increments only on consecutive days; **gap resets to day 1**; **after mythic, next consecutive day is day 4**; claim once per day per tier rules.

---

## Phase 5: Global market

### Purpose

Introduce player economy and long-tail item goals.

### Data models

- `MarketListing`
- `MarketSale`
- `MarketEscrow` or equivalent lock model

### API/server actions

- Create/cancel listing.
- Browse/search listings.
- Buy/settle listing.

### Frontend

- `market` route with filters, listing flow, purchase flow.

### Socket events

- Optional `market:newListing`, `market:sale`.

### Risks

- Concurrency races and dupes.
- Price abuse and edge-case escrow failures.

### Likely files

- `prisma/schema.prisma`
- `src/app/market/page.tsx` (new)
- inventory transaction helpers

### Test checklist

- Concurrency-safe buys.
- Expired listing behavior.
- No item duplication/loss.

---

## Phase 6: Async PvP snapshots

### Purpose

Add competitive gameplay without live lockstep networking.

### Data models

- `PvpSnapshot`
- `PvpMatch`
- `PvpResult`
- optional ranking table

### API/server actions

- Publish snapshot.
- Queue challenge.
- Resolve match server-side.

### Frontend

- Arena page for defense setup, challenge flow, result history.

### Socket events

- Optional `pvp:result`.

### Risks

- Snapshot staleness and reward farming exploits.

### Likely files

- PvP resolver modules (new)
- `src/app/arena/page.tsx` (new)
- `prisma/schema.prisma`

### Test checklist

- Deterministic snapshot resolution.
- Anti-farm cooldowns/reward controls.

---

## Phase 7: 2-player party dungeon prototype

### Purpose

Ship first synchronous co-op turn loop with minimal scope.

### Data models

- `Party`
- `PartyMember`
- `DungeonRun`
- `RunParticipant`
- `RunTurn`
- `RunAction`

### API/server actions

- Party create/invite/join.
- Start run.
- Submit turn action.
- Resolve turn.

### Frontend

- Party lobby + 2-player dungeon room UI.

### Socket events

- `party:update`
- `run:turnStarted`
- `run:actionSubmitted`
- `run:turnResolved`

### Risks

- Disconnects, stalling, duplicate submissions, desync.

### Likely files

- party and run modules (new)
- multiplayer arena component(s) (new)
- `prisma/schema.prisma`

### Test checklist

- Two clients complete run.
- Timeout/default action fallback works.
- Reconnect mid-turn state recovery.

---

## Phase 8: 2-4 player party dungeons

### Purpose

Scale prototype to full party experience.

### Data models

- Extend Phase 7 models for scaling, reconnect, and readiness metadata.

### API/server actions

- Expanded lobby and scaling logic.
- Reconnect and state-sync endpoints.

### Frontend

- Full party roster UX, per-player action status, multi-actor turn display.

### Socket events

- Phase 7 events plus richer participant/state synchronization.

### Risks

- Turn complexity explosion.
- Mobile UX density.
- fairness of timeout defaults under unstable connections.

### Likely files

- multiplayer combat domain
- party/run UI surfaces
- socket handlers
- `prisma/schema.prisma`

### Test checklist

- 2, 3, and 4 player runs.
- timeout fairness under lag.
- reconnect and reward integrity.

---

## Recommended First Implementation Task (after roadmap approval)

Create a compatibility-first combat domain seam (no feature changes yet):

- Add `src/lib/game/encounter-domain.ts` with:
  - `ActorState`
  - `EncounterState`
  - `TurnAction`
  - `TurnResolution`
- Add adapters in/out of `SoloCombatEncounter`.
- Route current `executeCombatAction` through the domain layer.

This is the smallest high-leverage step that de-risks Phases 6-8.
