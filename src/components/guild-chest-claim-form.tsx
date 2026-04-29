"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  claimGuildBossChestRewardStateAction,
  type GuildBossChestClaimResult,
} from "@/app/actions/guild-boss";
import { ItemHoverCard } from "@/components/item-hover-card";
import { rarityBadgeClass, rarityNameClass } from "@/lib/game/item-rarity-styles";

function chestTierClass(tier?: string) {
  switch ((tier ?? "").toLowerCase()) {
    case "bronze":
      return {
        frame: "border-amber-700/70 shadow-[0_0_35px_rgba(180,83,9,0.35)]",
        header: "text-amber-300/95",
      };
    case "silver":
      return {
        frame: "border-slate-500/75 shadow-[0_0_35px_rgba(148,163,184,0.35)]",
        header: "text-slate-200",
      };
    case "gold":
      return {
        frame: "border-yellow-500/70 shadow-[0_0_40px_rgba(234,179,8,0.35)]",
        header: "text-yellow-200",
      };
    case "diamond":
      return {
        frame: "border-cyan-500/70 shadow-[0_0_45px_rgba(34,211,238,0.35)]",
        header: "text-cyan-200",
      };
    case "mythic":
      return {
        frame: "border-fuchsia-500/80 shadow-[0_0_55px_rgba(217,70,239,0.45)]",
        header: "text-fuchsia-200",
      };
    default:
      return {
        frame: "border-amber-500/60 shadow-[0_0_40px_rgba(251,191,36,0.25)]",
        header: "text-amber-300/95",
      };
  }
}

function chestImagePath(tier?: string): string {
  switch ((tier ?? "").toLowerCase()) {
    case "bronze":
      return "/images/chests/bronzechest.png";
    case "silver":
      return "/images/chests/silverchest.png";
    case "gold":
      return "/images/chests/goldchest.png";
    case "diamond":
      return "/images/chests/diamondchest.png";
    case "mythic":
      return "/images/chests/mythicchest.png";
    default:
      return "/images/chests/bronzechest.png";
  }
}

export function GuildChestClaimForm({
  seasonId,
  buttonClassName,
  buttonText = "Claim raid chest",
}: {
  seasonId: string;
  buttonClassName: string;
  buttonText?: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<GuildBossChestClaimResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasSuccess = !!result?.ok;
  const open = hasSuccess && !hidden;
  const tierTheme = chestTierClass(result?.chestTier);
  const chestSrc = chestImagePath(result?.chestTier);

  return (
    <>
      <form
        action={(formData) => {
          startTransition(async () => {
            const next = await claimGuildBossChestRewardStateAction(null, formData);
            setResult(next);
            setHidden(false);
            setImageError(false);
          });
        }}
        className="inline"
      >
        <input type="hidden" name="seasonId" value={seasonId} />
        <button type="submit" className={buttonClassName} disabled={pending || hasSuccess} onClick={() => setHidden(false)}>
          {pending ? "Claiming..." : hasSuccess ? "Claimed" : buttonText}
        </button>
      </form>

      {result && !result.ok ? <p className="mt-1 text-[11px] text-rose-300/90">{result.message}</p> : null}

      {open && result?.ok ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className={`w-full max-w-md rounded-xl border bg-zinc-950 p-4 ${tierTheme.frame}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${tierTheme.header}`}>Raid Chest Opened</p>
            <div className="mt-2 rounded-lg border border-zinc-700/60 bg-linear-to-br from-zinc-900 via-zinc-950 to-black p-3">
              <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {!imageError ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic art path fallback
                  <img src={chestSrc} alt={`${result.chestTier} chest`} className="h-full w-full object-cover" onError={() => setImageError(true)} />
                ) : (
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500">Chest</p>
                    <p className={`text-sm font-semibold ${tierTheme.header}`}>{result.chestTier}</p>
                  </div>
                )}
              </div>
              <p className={`text-center text-sm font-semibold ${tierTheme.header}`}>You cracked open a {result.chestTier} chest!</p>
            </div>
            <p className="mt-1 text-sm text-zinc-300">
              Tier: <span className="font-semibold text-amber-200">{result.chestTier}</span>
            </p>
            <p className="text-sm text-zinc-300">
              Gold gained: <span className="font-semibold text-amber-200">{result.gold ?? 0}g</span>
            </p>
            <div className="mt-3 rounded-lg border border-zinc-800 bg-black/35 p-2">
              <p className="text-[11px] font-semibold text-zinc-300">Drops</p>
              {result.drops && result.drops.length > 0 ? (
                <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                  {result.drops.map((d, i) => (
                    <li key={`${d.itemId}-${i}`} className="flex items-center justify-between gap-2 rounded border border-zinc-800/70 bg-zinc-900/50 px-2 py-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <ItemHoverCard item={d.item}>
                          <span className={`truncate font-semibold ${rarityNameClass(d.rarity)}`}>
                            {d.item.emoji} {d.item.name}
                          </span>
                        </ItemHoverCard>
                        <span className="text-zinc-500">x{d.quantity}</span>
                      </div>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${rarityBadgeClass(d.rarity)}`}>{d.rarity}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">No item drop this claim.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setHidden(true);
                router.refresh();
              }}
              className="mt-3 w-full rounded border border-white/20 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
