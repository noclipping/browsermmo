# Phase 3 Task Plan: Guild Foundation + Async Guild Chat

## Goal

Ship the first durable guild slice with async workflows:

1. Create/join/leave guild lifecycle.
2. Guild invite management (owner/officer controls).
3. Guild roster + kick flow with role checks.
4. Guild donations.
5. Async guild chat feed (no sockets yet).

## Scope in this slice

- Added guild schema models:
  - `Guild`
  - `GuildMember`
  - `GuildInvite`
  - `GuildDonation`
  - `GuildChatMessage`
  - enums `GuildRole`, `GuildInviteStatus`
- Added guild server actions:
  - create guild
  - invite / accept / decline / cancel invite
  - leave guild (owner blocked pending ownership transfer feature)
  - kick member with role guardrails
  - donate gold
  - post guild chat message
- Added `Guild` page in in-game shell at `/guild` with:
  - no-guild state (create + incoming invites)
  - in-guild state (roster, invites, donations, async chat)
- Added `Guild` tab to `GameNav`.

## Constraints / intentional limits

- Async only (no guild realtime socket events in this slice).
- Single guild membership per user (`GuildMember.userId` unique).
- Ownership transfer is deferred (owner cannot leave yet).

## Manual test checklist

1. Create a guild with valid name and description.
2. Attempt duplicate guild name.
3. Invite another character by name.
4. Accept and decline invite paths.
5. Cancel pending invite as inviter.
6. Verify roster shows joined members and roles.
7. Kick a member as owner/officer.
8. Verify officer cannot kick owner/officer.
9. Donate gold and confirm character gold decreases + donation log entry appears.
10. Post guild chat messages and verify ordering + persistence on refresh.
11. Verify owner cannot leave guild without transfer.

## Follow-up slices

1. Ownership transfer action.
2. Guild role promotion/demotion actions.
3. Realtime guild chat + member events via Phase 2 socket infrastructure.
