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

Deliver cooperative guild progression without scheduling constraints.

### Data models

- `GuildBossSeason`
- `GuildBossAttempt`
- `GuildBossContribution`
- reward-claim table

### API/server actions

- Start/rollover season.
- Submit attempts and aggregate damage.
- Reward claim endpoints.

### Frontend

- Guild boss progress + personal contribution + rewards.

### Socket events

- `guildBoss:update`
- `guildBoss:seasonEnded`

### Risks

- Double-submit exploits; rollover race conditions.

### Likely files

- guild boss domain modules (new)
- `src/app/guild/page.tsx`
- `prisma/schema.prisma`

### Test checklist

- Atomic accounting.
- Idempotent rollovers.
- Correct reward distribution.

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
