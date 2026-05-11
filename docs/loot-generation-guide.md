# Loot Generation Guide

## Overview

The loot seed now uses a **regional definition model** instead of scattered per-enemy baseline drops.

Primary goals:

- Preserve class-themed identity (Warrior, Ranger, Mage).
- Ensure complete progression coverage in every region.
- Standardize drop behavior by enemy type (`COMMON`, `ELITE`, `BOSS`).
- Prevent accidental boss stacking from duplicated regional + boss rows.

---

## Regional Loot Pools

Regional loot config lives in `prisma/loot-generation.ts` under `REGIONAL_LOOT_DEFINITIONS`.

Each region definition declares:

- region key/name/tier
- theme prefix for naming
- enemy lists split by enemy type (`COMMON`, `ELITE`, `BOSS`)
- optional special/manual exception drops (consumables/material flavor drops)

Generated baseline loot is region/tier scoped by item key prefix:

- `loot_reg{tier}_...`

---

## Class-Themed Gear Rules

Every region generates class-themed gear for:

- Warrior
- Ranger
- Mage

For each class, generated slots are:

- `WEAPON`
- `HELMET`
- `CHEST`
- `GLOVES`
- `BOOTS`
- `RING`
- `AMULET`

This preserves non-generic identity via:

- class-specific item names
- class-biased stat distributions
- class-specific attribute requirements

---

## Required Rarity Coverage

Every region includes every rarity:

- `COMMON`
- `UNCOMMON`
- `RARE`
- `EPIC`
- `LEGENDARY`
- `GODLY`

This applies to all required class slots, not just weapons.

---

## Accessory Requirements

Rings and amulets are first-class progression items.

For each region, each rarity, and each class:

- Warrior ring + amulet
- Ranger ring + amulet
- Mage ring + amulet

No region should rely on sparse manual accessory drops for baseline progression.

---

## Dagger Line Requirements

Dagger remains a separate weapon line and is generated for every region and rarity:

- `COMMON`
- `UNCOMMON`
- `RARE`
- `EPIC`
- `LEGENDARY`
- `GODLY`

---

## Enemy-Type Drop Chances

Drop tables are standardized by enemy type with rarity-bucket targets:

### COMMON enemies

- COMMON: 35.0%
- UNCOMMON: 2.5%
- RARE: 0.9%
- EPIC: 0.25%
- LEGENDARY: 0.05%
- GODLY: 0.005%

### ELITE enemies

- COMMON: 35.0%
- UNCOMMON: 4.0%
- RARE: 1.8%
- EPIC: 0.65%
- LEGENDARY: 0.15%
- GODLY: 0.015%

### BOSS enemies

- COMMON: 35.0%
- UNCOMMON: 8.0%
- RARE: 4.0%
- EPIC: 1.75%
- LEGENDARY: 0.60%
- GODLY: 0.075%

---

## Drop Model and Rate Safety

Current persistence uses independent `LootTableEntry` rows (`enemyId`, `itemId`, `chance`).

To avoid drop inflation when pool size grows, per-item row chance is derived from the bucket target:

`perItemChance = 1 - (1 - bucketChance)^(1 / poolSize)`

That keeps the effective per-rarity bucket probability aligned with target odds even as item counts increase.

---

## Boss Stacking Avoidance

The old pattern could stack:

- regional generated rows for bosses
- additional boss rows for the same items

The current approach uses one standardized generation pass per enemy-type bucket and does **not** add duplicate boss-only rows for those same pool items.

Use special exceptions only for intentional flavor drops.

---

## Validation

Validation script: `scripts/validate-loot-seed.ts`

It checks:

- every region has every required rarity
- every region has full class+slot coverage (weapon/helmet/chest/gloves/boots/ring/amulet)
- every region has dagger coverage at every rarity
- EPIC exists per region
- no globally missing rarity
- enemies are not assigned multiple enemy types
- standardized bucket reconstruction matches configured enemy-type chance tables

Run:

`npm run loot:validate`

---

## Adding a New Region

1. Add a new entry in `REGIONAL_LOOT_DEFINITIONS` with:
   - `key`, `name`, `tier`, `itemThemePrefix`
   - `enemyKeysByType` for `COMMON`, `ELITE`, `BOSS`
   - optional `specialDropExceptions`
2. Ensure seed creates/upserts those enemies and region.
3. Run validation:
   - `npm run loot:validate`
4. Reseed:
   - `npm run prisma:seed`

The generation system will automatically produce full class/slot/rarity coverage for that tier.

---

## Naming Conventions

Generated item keys:

- Class gear: `loot_reg{tier}_{class}_{slot}_{rarity}`
- Dagger: `loot_reg{tier}_dagger_{rarity}`

Generated names include:

- region theme prefix
- rarity label
- class identity
- slot/weapon identity

---

## Operational Notes

- Use manual/special drop rows only for flavor items (consumables, crafting mats, unique quest-style drops).
- Do not use manual rows to fill baseline progression gaps.
- If you later migrate to true bucket-roll runtime logic, keep the same regional pool definitions and enemy-type tables; only the roll executor changes.
