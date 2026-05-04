"use client";

import { ItemHoverCard } from "@/components/item-hover-card";
import { ShopTransactionForm } from "@/components/shop-gold-fx";
import { itemDisplayName } from "@/lib/game/item-display";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import type { ShopTransactionResult } from "@/lib/game/shop-transaction";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";
import { useMemo, useState } from "react";

const SLOT_FILTERS = ["ALL", "WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET", "CONSUMABLE"] as const;
const RARITY_FILTERS = ["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"] as const;
const CLASS_FILTERS = ["ALL", "WARRIOR", "MAGE", "ROGUE"] as const;

export type ShopSellRow = {
  id: string;
  quantity: number;
  forgeLevel: number;
  affixPrefix: string | null;
  bonusLifeSteal: number;
  bonusCritChance: number;
  bonusSkillPower: number;
  bonusStrength: number;
  bonusConstitution: number;
  bonusIntelligence: number;
  bonusDexterity: number;
  item: ItemTooltipFields;
  compareAgainst: {
    item: ItemTooltipFields;
    forgeLevel?: number;
    affixPrefix: string | null;
    bonusLifeSteal: number;
    bonusCritChance: number;
    bonusSkillPower: number;
    bonusStrength: number;
    bonusConstitution: number;
    bonusIntelligence: number;
    bonusDexterity: number;
  } | null;
};

function prettyLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function itemClassType(item: {
  requiredStrength: number;
  requiredIntelligence: number;
  requiredDexterity: number;
}): "WARRIOR" | "MAGE" | "ROGUE" {
  const str = item.requiredStrength ?? 0;
  const intl = item.requiredIntelligence ?? 0;
  const dex = item.requiredDexterity ?? 0;
  if (intl >= dex && intl >= str && intl > 0) return "MAGE";
  if (dex >= intl && dex >= str && dex > 0) return "ROGUE";
  return "WARRIOR";
}

export function ShopSellList({
  rows,
  buttonClassName,
  sellItemAction,
  sellSelectedItemsAction,
}: {
  rows: ShopSellRow[];
  buttonClassName: string;
  sellItemAction: (formData: FormData) => Promise<ShopTransactionResult>;
  sellSelectedItemsAction: (formData: FormData) => Promise<ShopTransactionResult>;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [slot, setSlot] = useState<(typeof SLOT_FILTERS)[number]>("ALL");
  const [rarity, setRarity] = useState<(typeof RARITY_FILTERS)[number]>("ALL");
  const [classType, setClassType] = useState<(typeof CLASS_FILTERS)[number]>("ALL");

  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (slot !== "ALL" && row.item.slot !== slot) return false;
        if (rarity !== "ALL" && row.item.rarity !== rarity) return false;
        if (classType !== "ALL" && itemClassType(row.item) !== classType) return false;
        return true;
      }),
    [rows, slot, rarity, classType],
  );
  const visibleIds = useMemo(() => visibleRows.map((r) => r.id), [visibleRows]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => checked.has(id));
  const checkedCount = useMemo(() => visibleIds.filter((id) => checked.has(id)).length, [visibleIds, checked]);

  const toggleAll = () => {
    if (allChecked) {
      setChecked((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
      return;
    }
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  };

  const toggleOne = (id: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/20 bg-black/35 px-3 py-2">
        <label className="text-[11px] text-zinc-300">
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
        <label className="text-[11px] text-zinc-300">
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
        <label className="text-[11px] text-zinc-300">
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
        <p className="text-xs text-zinc-400">Showing {visibleRows.length} / {rows.length}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/20 bg-black/35 px-3 py-2">
        <label className="inline-flex items-center gap-2 text-xs text-zinc-200">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          Check all visible
        </label>
        <ShopTransactionForm transactionAction={sellSelectedItemsAction}>
          {[...checked].map((id) => (
            <input key={id} type="hidden" name="inventoryEntryId" value={id} />
          ))}
          <button type="submit" disabled={checkedCount < 1} className={buttonClassName}>
            Sell checked ({checkedCount})
          </button>
        </ShopTransactionForm>
      </div>

      {visibleRows.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-sm"
        >
          <span className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={checked.has(entry.id)}
              onChange={(e) => toggleOne(entry.id, e.currentTarget.checked)}
            />
            <span>
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
                compareAgainst={entry.compareAgainst}
              >
                <span className={`font-medium ${rarityNameClass(entry.item.rarity)}`}>
                  {entry.item.emoji} {itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)}
                </span>
              </ItemHoverCard>
              <span className="text-zinc-300"> ×{entry.quantity}</span>
              <span className="ml-2 font-mono text-xs text-zinc-100/90">{entry.item.sellPrice}g each</span>
            </span>
          </span>

          <div className="flex items-center gap-2">
            <ShopTransactionForm transactionAction={sellItemAction}>
              <input type="hidden" name="inventoryEntryId" value={entry.id} />
              <input type="hidden" name="amount" value="ONE" />
              <button type="submit" className={buttonClassName}>
                Sell x1
              </button>
            </ShopTransactionForm>
            <ShopTransactionForm transactionAction={sellItemAction}>
              <input type="hidden" name="inventoryEntryId" value={entry.id} />
              <input type="hidden" name="amount" value="ALL" />
              <button type="submit" className={buttonClassName}>
                Sell all
              </button>
            </ShopTransactionForm>
          </div>
        </div>
      ))}
    </div>
  );
}

