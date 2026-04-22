"use client";

import { useMemo, useState } from "react";
import type { ShopGearClientRow, ShopPlaystyle, ShopStatTag } from "@/lib/game/shop";
import { ItemHoverCard } from "@/components/item-hover-card";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";

const CLASS_OPTIONS: { id: ShopPlaystyle; label: string }[] = [
  { id: "WARRIOR", label: "Warrior" },
  { id: "ROGUE", label: "Ranger" },
  { id: "MAGE", label: "Mage" },
  { id: "NEUTRAL", label: "Neutral / shared" },
];

const STAT_OPTIONS: { id: ShopStatTag; label: string }[] = [
  { id: "STR", label: "STR" },
  { id: "DEX", label: "DEX" },
  { id: "INT", label: "INT" },
  { id: "CON", label: "CON" },
];

function subsetToggle<T extends string>(set: Set<T>, id: T, checked: boolean): Set<T> {
  const n = new Set(set);
  if (checked) n.add(id);
  else n.delete(id);
  return n;
}

export function ShopGearList({
  rows,
  buyAction,
  equippedBySlot,
}: {
  rows: ShopGearClientRow[];
  buyAction: (formData: FormData) => Promise<void>;
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
  const [classOn, setClassOn] = useState(() => new Set<ShopPlaystyle>(["WARRIOR", "ROGUE", "MAGE", "NEUTRAL"]));
  const [statOn, setStatOn] = useState(() => new Set<ShopStatTag>(["STR", "DEX", "INT", "CON"]));

  const visible = useMemo(() => {
    const classAll = classOn.size === 0 || classOn.size === CLASS_OPTIONS.length;
    const statAll = statOn.size === 0 || statOn.size === STAT_OPTIONS.length;
    return rows.filter((row) => {
      if (!classAll && !classOn.has(row.playstyle)) return false;
      if (statAll) return true;
      if (row.statTags.length === 0) return true;
      return row.statTags.some((t) => statOn.has(t));
    });
  }, [rows, classOn, statOn]);

  return (
    <div>
      <div className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-black/20 p-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Filter by kit</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {CLASS_OPTIONS.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="size-4 rounded border-zinc-600 bg-zinc-900"
                  checked={classOn.has(o.id)}
                  onChange={(e) => setClassOn(subsetToggle(classOn, o.id, e.target.checked))}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Filter by stat requirement</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {STAT_OPTIONS.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="size-4 rounded border-zinc-600 bg-zinc-900"
                  checked={statOn.has(o.id)}
                  onChange={(e) => setStatOn(subsetToggle(statOn, o.id, e.target.checked))}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-600">
          Showing {visible.length} of {rows.length} listings. Uncheck a kit or stat to narrow the list.
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
            const compareAgainst =
              equippedSameSlot && equippedSameSlot.item.id !== item.id
                ? equippedSameSlot
                : null;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/25 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <ItemHoverCard item={item} forgeLevel={0} compareAgainst={compareAgainst}>
                    <span className={`font-medium ${rarityNameClass(item.rarity)}`}>
                      {item.emoji} {item.name}
                    </span>
                  </ItemHoverCard>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {row.statLine} · Lv {item.requiredLevel}+
                    {row.reqLine ? ` · ${row.reqLine}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    Slot {item.slot.replace(/_/g, " ")} ·{" "}
                    {row.playstyle === "ROGUE" ? "Ranger kit" : row.playstyle === "NEUTRAL" ? "Shared" : `${row.playstyle} kit`}
                  </p>
                  {blocked ? <p className="mt-1 text-xs text-amber-600/90">{row.purchaseBlock}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm text-amber-200/90">{row.price}g</span>
                  <form action={buyAction}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      disabled={blocked}
                      title={row.purchaseBlock ?? undefined}
                      className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-100 enabled:hover:bg-amber-900/35 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Buy
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
