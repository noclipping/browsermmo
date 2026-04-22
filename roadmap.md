# Roadmap

## Current project state

- **Stack:** Next.js, TypeScript, Prisma, PostgreSQL.
- **Solo PvE:** Turn-based combat with telegraphed enemy intent (attack / heavy / guard / recover), skills per class, manual potion use with cooldown, auto-battle, flee.
- **Screens:** Town (shop, campfire, forge, buyback), Adventure (region pick, encounter roll, combat UI), Character (stats, equipment, pack, solo dungeon hook).
- **Progression:** XP and leveling, stat points (STR / CON / INT / DEX), equipment slots, loot tables, rarity, stat-gated gear, region level gates, elite spawns, optional miniboss pacing (outskirts), smithing forge on equipped pieces, inventory `forgeLevel` on stacks.
- **Classes:** Warrior, Mage, Rogue (archer-style in UI copy).
- **Gaps:** Mobile layout polish; progression and “why keep playing” still thin vs target; social features not started.

## Immediate priorities

- **Mobile-first pass:** Touch targets, readable typography, adventure + combat panels that don’t require horizontal strain; safe areas for notched devices.
- **Prisma / dev hygiene:** Reliable `migrate` + `generate` on Windows (EPERM on query engine); document one-command flow for new contributors.
- **Doc + design alignment:** Keep `game-design.md` and this roadmap updated when systems change (no silent drift).
- **Stability:** Clear errors when seed/DB mismatch (enemies, regions); avoid opaque “mismatch” copy where possible.

## Near-term milestones (weeks)

- **Retention loop:** Stronger first-hour curve (pacing, loot clarity, chase items) without bloating scope.
- **Town vs adventure:** Stronger visual and copy separation (already directionally split; reinforce in nav and headers).
- **Combat clarity:** Optional combat log filters, elite/miniboss labeling consistency, victory/defeat summaries.
- **Content:** More region variety or dungeon-style runs if solo loop supports them without multiplayer.

## Later milestones (months)

- **Social layer (light):** Global chat, drop feed, level ladder — only after solo loop holds attention.
- **Deeper social:** Friends, guilds, parties, inspect — after core progression is trusted.
- **Live ops hooks:** Events, rotating modifiers, or admin tooling — TBD.

## Systems intentionally postponed

- **Real-time / synchronous multiplayer combat.**
- **PvP ladders** (async or live).
- **Party dungeons** as primary onboarding (treat as endgame-style retention later).
- **Heavy narrative / cutscenes** (placeholder text and tone first).
- **Premium economy** (define later; keep placeholders ethical and reversible).
