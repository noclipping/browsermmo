"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { claimDailyLoginChestStateAction, type DailyLoginChestClaimResult } from "@/app/actions/daily-login-chest";
import { ItemHoverCard } from "@/components/item-hover-card";
import { rarityBadgeClass, rarityNameClass } from "@/lib/game/item-rarity-styles";

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

export function DailyLoginChestClaimForm({ buttonClassName }: { buttonClassName: string }) {
  const router = useRouter();
  const [result, setResult] = useState<DailyLoginChestClaimResult | null>(null);
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const open = !!result?.ok && !hidden;
  useEffect(() => setMounted(true), []);

  return (
    <>
      <form
        action={() => {
          startTransition(async () => {
            const next = await claimDailyLoginChestStateAction(null);
            setResult(next);
            setHidden(false);
          });
        }}
      >
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? "Opening..." : "Open daily chest"}
        </button>
      </form>

      {result && !result.ok ? <p className="mt-2 text-xs text-rose-300/90">{result.message}</p> : null}

      {open && mounted
        ? createPortal(
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-xl border border-amber-700/60 bg-zinc-950 p-4 shadow-[0_0_35px_rgba(180,83,9,0.35)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/95">Daily Chest Opened</p>
            <div className="mt-2 rounded-lg border border-zinc-700/60 bg-linear-to-br from-zinc-900 via-zinc-950 to-black p-3">
              <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chestImagePath(result?.tier)} alt={`${result?.tier ?? "daily"} chest`} className="h-full w-full object-cover" />
              </div>
              <p className="text-center text-sm font-semibold text-amber-200">
                Day {result?.day} · {(result?.tier ?? "bronze").toString().toUpperCase()} chest
              </p>
            </div>
            <p className="mt-2 text-sm text-zinc-300">
              Gold gained: <span className="font-semibold text-amber-200">{result?.gold ?? 0}g</span>
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-800 bg-black/35 p-2">
              <p className="text-[11px] font-semibold text-zinc-300">Drops</p>
              {result?.drops && result.drops.length > 0 ? (
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
            <div className="mt-3 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setHidden(true);
                  router.refresh();
                }}
                className="w-full rounded border border-white/20 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5"
              >
                Close
              </button>
            </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}

