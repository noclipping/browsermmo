"use client";

import { ShopTransactionForm } from "@/components/shop-gold-fx";
import { useMemo, useState } from "react";
import type { ShopGearClientRow } from "@/lib/game/shop";
import type { ShopTransactionResult } from "@/lib/game/shop-transaction";
import { ItemHoverCard } from "@/components/item-hover-card";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";

const SLOT_FILTERS = ["ALL", "WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET", "CONSUMABLE"] as const;
const RARITY_FILTERS = ["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"] as const;
const CLASS_FILTERS = ["ALL", "WARRIOR", "MAGE", "ROGUE"] as const;

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

export function ShopGearList({
  rows,
  buyAction,
  equippedBySlot,
}: {
  rows: ShopGearClientRow[];
  buyAction: (formData: FormData) => Promise<ShopTransactionResult>;
  equippedBySlot: Partial<
    Record<
      string,
      {
        item: ItemTooltipFields;
        forgeLevel: number | null;
        affixPrefix: string | null;
        bonusLifeSteal: number;
        bonusCritChance: number;
        bonusSkillPower: number;
        bonusStrength: number;
        bonusConstitution: number;
        bonusIntelligence: number;
        bonusDexterity: number;
      }
    >
  >;
}) {
  const [slot, setSlot] = useState<(typeof SLOT_FILTERS)[number]>("ALL");
  const [rarity, setRarity] = useState<(typeof RARITY_FILTERS)[number]>("ALL");
  const [classType, setClassType] = useState<(typeof CLASS_FILTERS)[number]>("ALL");

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        const { item } = row;
        if (slot !== "ALL" && item.slot !== slot) return false;
        if (rarity !== "ALL" && item.rarity !== rarity) return false;
        if (classType !== "ALL" && itemClassType(item) !== classType) return false;
        return true;
      }),
    [rows, slot, rarity, classType],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-white/20 bg-black/35 px-3 py-2">
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
        <p className="text-xs text-zinc-400">
          Showing {visible.length} / {rows.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">No rows match these filters.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => {
            const { item } = row;
            const blocked = row.purchaseBlock !== null;
            const equippedSameSlot = equippedBySlot[item.slot] ?? null;
            const compareAgainst = equippedSameSlot
              ? {
                  ...equippedSameSlot,
                  forgeLevel: equippedSameSlot.forgeLevel ?? undefined,
                }
              : null;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/20 bg-black/50 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <ItemHoverCard item={item} forgeLevel={0} compareAgainst={compareAgainst}>
                    <span className={`font-medium ${rarityNameClass(item.rarity)}`}>
                      {item.emoji} {item.name}
                    </span>
                  </ItemHoverCard>
                  <p className="mt-1 font-mono text-xs text-zinc-300">
                    {row.statLine} · Lv {item.requiredLevel}+
                    {row.reqLine ? ` · ${row.reqLine}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-300/90">
                    Slot {item.slot.replace(/_/g, " ")} ·{" "}
                    {row.playstyle === "ROGUE" ? "Ranger kit" : row.playstyle === "NEUTRAL" ? "Shared" : `${row.playstyle} kit`}
                  </p>
                  {blocked ? <p className="mt-1 text-xs text-red-300/90">{row.purchaseBlock}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm text-zinc-100">{row.price}g</span>
                  <ShopTransactionForm transactionAction={buyAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      disabled={blocked}
                      title={row.purchaseBlock ?? undefined}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Buy
                    </button>
                  </ShopTransactionForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
