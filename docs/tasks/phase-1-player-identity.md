# Phase 1 Task Plan: Player Identity + Public Profiles

## Goal

Ship the first social identity slice:

1. Public character profile pages.
2. Player lookup flow.
3. API endpoint for player search.

Keep this thin and compatible with future social features (friends, guilds, async PvP snapshots) without adding premature schema complexity.

## Scope in this slice

- Added `GET /api/player/search` for character-name lookup.
- Added public profile page at `/player/[name]`.
- Added lookup page at `/player` with search UI.
- Added direct link to own public profile in the top bar.

## Files touched

- `src/app/api/player/search/route.ts`
- `src/app/player/page.tsx`
- `src/app/player/[name]/page.tsx`
- `src/components/game-top-bar.tsx`

## Notes

- Public profile currently exposes: class, level, region, account created date, last active timestamp, effective stats, and equipped gear names.
- Identity key is currently `Character.name` (already globally unique in schema).
- Search is case-insensitive `contains` with capped result limit.

## Follow-up slices (remaining in Phase 1)

1. Add profile-card links in chat and future social surfaces.
2. Add optional profile tagline/bio (schema + edit action) with moderation-safe limits.
3. Add profile privacy toggles (online status visibility, profile discoverability).
4. Add canonical profile slug strategy if name-change support is introduced.

## Validation

- Targeted lint passed for all touched Phase 1 files.
- Workspace still has pre-existing lint issues in `src/components/turn-combat-arena.tsx` outside this slice.
