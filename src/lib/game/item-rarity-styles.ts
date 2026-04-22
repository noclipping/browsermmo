import type { Rarity } from "@prisma/client";

/** Tailwind classes for item names / badges by rarity. */
export function rarityNameClass(rarity: Rarity | string): string {
  switch (rarity) {
    case "COMMON":
      return "text-zinc-400";
    case "UNCOMMON":
      return "text-emerald-400";
    case "RARE":
      return "text-sky-400";
    case "EPIC":
      return "text-violet-400";
    case "LEGENDARY":
      return "text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]";
    case "GODLY":
      return "text-red-300 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]";
    default:
      return "text-zinc-300";
  }
}

export function rarityBadgeClass(rarity: Rarity | string): string {
  switch (rarity) {
    case "COMMON":
      return "border-zinc-600 bg-zinc-900/80 text-zinc-300";
    case "UNCOMMON":
      return "border-emerald-700/60 bg-emerald-950/50 text-emerald-200";
    case "RARE":
      return "border-sky-600/60 bg-sky-950/50 text-sky-200";
    case "EPIC":
      return "border-violet-600/60 bg-violet-950/50 text-violet-200";
    case "LEGENDARY":
      return "border-amber-500/70 bg-amber-950/60 text-amber-100";
    case "GODLY":
      return "border-red-500/75 bg-red-950/45 text-red-100";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}
