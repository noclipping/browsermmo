"use client";

import { equipItemAction, unequipSlotAction } from "@/app/actions/game";
import { ItemHoverCard } from "@/components/item-hover-card";
import { EQUIPMENT_SLOTS } from "@/lib/game/constants";
import { itemDisplayName } from "@/lib/game/item-display";
import { characterMeetsItemStatRequirements, formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import type { Character, CharacterEquipment, InventoryItem, Item } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const SLOT_FILTERS = ["ALL", "WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"] as const;
const RARITY_FILTERS = ["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"] as const;
const CLASS_FILTERS = ["ALL", "WARRIOR", "MAGE", "ROGUE"] as const;

type EquipRow = CharacterEquipment & { item: Item | null };
type InvRow = InventoryItem & { item: Item };

function prettyLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function itemClassType(item: Item): "WARRIOR" | "MAGE" | "ROGUE" {
  const str = item.requiredStrength ?? 0;
  const intl = item.requiredIntelligence ?? 0;
  const dex = item.requiredDexterity ?? 0;
  if (intl >= dex && intl >= str && intl > 0) return "MAGE";
  if (dex >= intl && dex >= str && dex > 0) return "ROGUE";
  return "WARRIOR";
}

export function LoadoutGearPack({
  character,
  gearInv,
  bySlot,
  combatLocked,
}: {
  character: Character;
  gearInv: InvRow[];
  bySlot: Map<string, EquipRow>;
  combatLocked: boolean;
}) {
  const [openFilters, setOpenFilters] = useState(false);
  const [openManager, setOpenManager] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [equippableOnly, setEquippableOnly] = useState(false);
  const [slot, setSlot] = useState<(typeof SLOT_FILTERS)[number]>("ALL");
  const [rarity, setRarity] = useState<(typeof RARITY_FILTERS)[number]>("ALL");
  const [classType, setClassType] = useState<(typeof CLASS_FILTERS)[number]>("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(
    () =>
      gearInv.filter((entry) => {
        if (slot !== "ALL" && entry.item.slot !== slot) return false;
        if (rarity !== "ALL" && entry.item.rarity !== rarity) return false;
        if (classType !== "ALL" && itemClassType(entry.item) !== classType) return false;
        if (equippableOnly) {
          const canEquip =
            character.level >= entry.item.requiredLevel && characterMeetsItemStatRequirements(character, entry.item);
          if (!canEquip) return false;
        }
        return true;
      }),
    [gearInv, slot, rarity, classType, equippableOnly, character.level, character.strength, character.constitution, character.intelligence, character.dexterity],
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
          Pack (gear) ({filtered.length}/{gearInv.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenFilters((v) => !v)}
            className="rounded border border-white/20 bg-black/55 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
          >
            {openFilters ? "Hide gear filters" : "Gear filters"}
          </button>
          <button
            type="button"
            onClick={() => setOpenManager(true)}
            className="rounded border border-amber-700/50 bg-amber-950/25 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/35"
          >
            Open gear manager
          </button>
        </div>
      </div>

      {openFilters ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800/80 bg-black/25 p-2">
          <label className="text-[11px] text-zinc-500">
            Type
            <select
              value={slot}
              onChange={(e) => setSlot(e.currentTarget.value as (typeof SLOT_FILTERS)[number])}
              className="mt-1 block rounded border border-white/20 bg-black/55 px-2 py-1 text-xs text-zinc-100"
            >
              {SLOT_FILTERS.map((v) => (
                <option key={v} value={v}>
                  {v === "ALL" ? "All types" : prettyLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-zinc-500">
            Rarity
            <select
              value={rarity}
              onChange={(e) => setRarity(e.currentTarget.value as (typeof RARITY_FILTERS)[number])}
              className="mt-1 block rounded border border-white/20 bg-black/55 px-2 py-1 text-xs text-zinc-100"
            >
              {RARITY_FILTERS.map((v) => (
                <option key={v} value={v}>
                  {v === "ALL" ? "All rarities" : prettyLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-zinc-500">
            Class
            <select
              value={classType}
              onChange={(e) => setClassType(e.currentTarget.value as (typeof CLASS_FILTERS)[number])}
              className="mt-1 block rounded border border-white/20 bg-black/55 px-2 py-1 text-xs text-zinc-100"
            >
              {CLASS_FILTERS.map((v) => (
                <option key={v} value={v}>
                  {v === "ALL" ? "All classes" : prettyLabel(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
        {filtered.map((entry) => {
          const canEquip = character.level >= entry.item.requiredLevel && characterMeetsItemStatRequirements(character, entry.item);
          const equippedSameSlot = bySlot.get(entry.item.slot);
          const compareAgainst =
            equippedSameSlot?.item && equippedSameSlot.item.id !== entry.item.id
              ? {
                  item: equippedSameSlot.item,
                  forgeLevel: equippedSameSlot.forgeLevel,
                  affixPrefix: equippedSameSlot.affixPrefix,
                  bonusLifeSteal: equippedSameSlot.bonusLifeSteal,
                  bonusCritChance: equippedSameSlot.bonusCritChance,
                  bonusSkillPower: equippedSameSlot.bonusSkillPower,
                  bonusStrength: equippedSameSlot.bonusStrength,
                  bonusConstitution: equippedSameSlot.bonusConstitution,
                  bonusIntelligence: equippedSameSlot.bonusIntelligence,
                  bonusDexterity: equippedSameSlot.bonusDexterity,
                }
              : null;
          return (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 bg-black/50 px-2 py-2">
              <div className="min-w-0">
                <ItemHoverCard
                  item={entry.item}
                  forgeLevel={entry.forgeLevel}
                  affixPrefix={entry.affixPrefix}
                  bonusLifeSteal={entry.bonusLifeSteal}
                  bonusCritChance={entry.bonusCritChance}
                  bonusSkillPower={entry.bonusSkillPower}
                  bonusStrength={entry.bonusStrength}
                  bonusConstitution={entry.bonusConstitution}
                  bonusIntelligence={entry.bonusIntelligence}
                  bonusDexterity={entry.bonusDexterity}
                  compareAgainst={compareAgainst}
                >
                  <span className={`font-medium ${rarityNameClass(entry.item.rarity)}`}>
                    {entry.item.emoji} {itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)}
                  </span>
                </ItemHoverCard>
                <span className="text-zinc-300/90"> ×{entry.quantity}</span>
                {formatItemStatRequirements(entry.item) ? (
                  <span className="mt-0.5 block text-[10px] text-amber-700/90">Req: {formatItemStatRequirements(entry.item)}</span>
                ) : null}
              </div>
              <form action={equipItemAction}>
                <input type="hidden" name="inventoryEntryId" value={entry.id} />
                <button
                  type="submit"
                  disabled={!canEquip || combatLocked}
                  className="rounded border border-amber-800/60 px-2 py-1 text-[11px] font-semibold text-amber-200/90 enabled:hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Equip
                </button>
              </form>
            </li>
          );
        })}
        {filtered.length === 0 ? <li className="text-xs text-zinc-500">No gear matches these filters.</li> : null}
      </ul>

      {openManager && mounted
        ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-6xl rounded-2xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-100">Gear Manager</h4>
              <button
                type="button"
                onClick={() => setOpenManager(false)}
                className="rounded border border-white/20 bg-black/55 px-2 py-1 text-xs font-semibold text-zinc-200 hover:border-white/35"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800/80 bg-black/25 p-2">
              <label className="text-[11px] text-zinc-500">
                Type
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.currentTarget.value as (typeof SLOT_FILTERS)[number])}
                  className="mt-1 block rounded border border-white/20 bg-black/55 px-2 py-1 text-xs text-zinc-100"
                >
                  {SLOT_FILTERS.map((v) => (
                    <option key={v} value={v}>
                      {v === "ALL" ? "All types" : prettyLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-zinc-500">
                Rarity
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.currentTarget.value as (typeof RARITY_FILTERS)[number])}
                  className="mt-1 block rounded border border-white/20 bg-black/55 px-2 py-1 text-xs text-zinc-100"
                >
                  {RARITY_FILTERS.map((v) => (
                    <option key={v} value={v}>
                      {v === "ALL" ? "All rarities" : prettyLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-zinc-500">
                Class
                <select
                  value={classType}
                  onChange={(e) => setClassType(e.currentTarget.value as (typeof CLASS_FILTERS)[number])}
                  className="mt-1 block rounded border border-white/20 bg-black/55 px-2 py-1 text-xs text-zinc-100"
                >
                  {CLASS_FILTERS.map((v) => (
                    <option key={v} value={v}>
                      {v === "ALL" ? "All classes" : prettyLabel(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 rounded border border-white/20 bg-black/45 px-2 py-1 text-[11px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={equippableOnly}
                  onChange={(e) => setEquippableOnly(e.currentTarget.checked)}
                />
                Equippable only
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="rounded-lg border border-zinc-800 bg-black/30 p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Worn (quick unequip)</p>
                <ul className="mt-2 max-h-[70vh] space-y-1 overflow-y-auto text-sm">
                  {EQUIPMENT_SLOTS.map((slotName) => {
                    const row = bySlot.get(slotName);
                    return (
                      <li key={slotName} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-black/30 px-2 py-1.5">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase text-zinc-500">{slotName}</p>
                          {row?.item ? (
                            <ItemHoverCard
                              item={row.item}
                              forgeLevel={row.forgeLevel}
                              affixPrefix={row.affixPrefix}
                              bonusLifeSteal={row.bonusLifeSteal}
                              bonusCritChance={row.bonusCritChance}
                              bonusSkillPower={row.bonusSkillPower}
                              bonusStrength={row.bonusStrength}
                              bonusConstitution={row.bonusConstitution}
                              bonusIntelligence={row.bonusIntelligence}
                              bonusDexterity={row.bonusDexterity}
                            >
                              <span className={`text-xs font-medium ${rarityNameClass(row.item.rarity)}`}>
                                {row.item.emoji} {itemDisplayName(row.item, row.forgeLevel, row.affixPrefix)}
                              </span>
                            </ItemHoverCard>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </div>
                        {row?.item && !combatLocked ? (
                          <form action={unequipSlotAction}>
                            <input type="hidden" name="slot" value={slotName} />
                            <button
                              type="submit"
                              className="rounded border border-white/20 px-2 py-1 text-[11px] text-zinc-200 hover:border-white/35"
                            >
                              Unequip
                            </button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-black/30 p-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pack gear ({filtered.length}/{gearInv.length})</p>
                <ul className="mt-2 max-h-[70vh] space-y-2 overflow-y-auto text-sm">
                  {filtered.map((entry) => {
                    const canEquip =
                      character.level >= entry.item.requiredLevel && characterMeetsItemStatRequirements(character, entry.item);
                    const equippedSameSlot = bySlot.get(entry.item.slot);
                    const compareAgainst =
                      equippedSameSlot?.item && equippedSameSlot.item.id !== entry.item.id
                        ? {
                            item: equippedSameSlot.item,
                            forgeLevel: equippedSameSlot.forgeLevel,
                            affixPrefix: equippedSameSlot.affixPrefix,
                            bonusLifeSteal: equippedSameSlot.bonusLifeSteal,
                            bonusCritChance: equippedSameSlot.bonusCritChance,
                            bonusSkillPower: equippedSameSlot.bonusSkillPower,
                            bonusStrength: equippedSameSlot.bonusStrength,
                            bonusConstitution: equippedSameSlot.bonusConstitution,
                            bonusIntelligence: equippedSameSlot.bonusIntelligence,
                            bonusDexterity: equippedSameSlot.bonusDexterity,
                          }
                        : null;
                    return (
                      <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 bg-black/50 px-2 py-2">
                        <div className="min-w-0">
                          <ItemHoverCard
                            item={entry.item}
                            forgeLevel={entry.forgeLevel}
                            affixPrefix={entry.affixPrefix}
                            bonusLifeSteal={entry.bonusLifeSteal}
                            bonusCritChance={entry.bonusCritChance}
                            bonusSkillPower={entry.bonusSkillPower}
                            bonusStrength={entry.bonusStrength}
                            bonusConstitution={entry.bonusConstitution}
                            bonusIntelligence={entry.bonusIntelligence}
                            bonusDexterity={entry.bonusDexterity}
                            compareAgainst={compareAgainst}
                          >
                            <span className={`font-medium ${rarityNameClass(entry.item.rarity)}`}>
                              {entry.item.emoji} {itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)}
                            </span>
                          </ItemHoverCard>
                          <span className="text-zinc-300/90"> ×{entry.quantity}</span>
                          {formatItemStatRequirements(entry.item) ? (
                            <span className="mt-0.5 block text-[10px] text-amber-700/90">Req: {formatItemStatRequirements(entry.item)}</span>
                          ) : null}
                        </div>
                        <form action={equipItemAction}>
                          <input type="hidden" name="inventoryEntryId" value={entry.id} />
                          <button
                            type="submit"
                            disabled={!canEquip || combatLocked}
                            className="rounded border border-amber-800/60 px-2 py-1 text-[11px] font-semibold text-amber-200/90 enabled:hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            Equip
                          </button>
                        </form>
                      </li>
                    );
                  })}
                  {filtered.length === 0 ? <li className="text-xs text-zinc-500">No gear matches these filters.</li> : null}
                </ul>
              </div>
            </div>
          </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}

