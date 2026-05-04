"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TreasuryFiltersProps = {
  prefix: "t" | "i" | "c";
  slot: string;
  rarity: string;
  classType: string;
  slotOptions: readonly string[];
  rarityOptions: readonly string[];
  classOptions: readonly string[];
  labels: {
    slot: string;
    rarity: string;
    classType: string;
  };
};

function prettyLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TreasuryFilters({
  prefix,
  slot,
  rarity,
  classType,
  slotOptions,
  rarityOptions,
  classOptions,
  labels,
}: TreasuryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800/80 bg-black/25 p-3">
      <label className="text-[11px] text-zinc-500">
        {labels.slot}
        <select
          value={slot}
          onChange={(e) => setFilter(`${prefix}Slot`, e.currentTarget.value)}
          className="mt-1 block rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
        >
          {slotOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "ALL" ? "All types" : prettyLabel(opt)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11px] text-zinc-500">
        {labels.rarity}
        <select
          value={rarity}
          onChange={(e) => setFilter(`${prefix}Rarity`, e.currentTarget.value)}
          className="mt-1 block rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
        >
          {rarityOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "ALL" ? "All rarities" : prettyLabel(opt)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11px] text-zinc-500">
        {labels.classType}
        <select
          value={classType}
          onChange={(e) => setFilter(`${prefix}Class`, e.currentTarget.value)}
          className="mt-1 block rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
        >
          {classOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "ALL" ? "All classes" : prettyLabel(opt)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

