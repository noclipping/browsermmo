"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { equipAchievementTitleAction } from "@/app/actions/achievements";

export type AchievementModalRow = {
  key: string;
  name: string;
  description: string;
  icon: string;
  titleReward: string | null;
  category: string;
  unlocked: boolean;
  equipped: boolean;
  /** e.g. "12% of players" or "<1% of players" */
  playerPercentLabel: string;
};

type AchievementFilter = "all" | "unlocked" | "locked" | "titles";

const glassPanel =
  "rounded-2xl border border-white/20 bg-zinc-950/90 bg-linear-to-b from-black/75 via-black/88 to-black/95 shadow-xl backdrop-blur-md";

const chipBase =
  "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors";
const chipOff = "border-white/12 bg-black/35 text-zinc-500 hover:border-white/20 hover:text-zinc-300";
const chipOn = "border-amber-500/45 bg-amber-950/40 text-amber-100/95";

export function CharacterAchievementsModal({
  rows,
  equippedLabel,
  unlockedCount,
  totalCount,
}: {
  rows: AchievementModalRow[];
  equippedLabel: string | null;
  unlockedCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const visibleRows = useMemo(() => {
    switch (filter) {
      case "unlocked":
        return rows.filter((r) => r.unlocked);
      case "locked":
        return rows.filter((r) => !r.unlocked);
      case "titles":
        return rows.filter((r) => !!r.titleReward?.trim());
      default:
        return rows;
    }
  }, [rows, filter]);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const onEquip = useCallback(
    (achievementKey: string | null) => {
      setError(null);
      startTransition(async () => {
        const r = await equipAchievementTitleAction(achievementKey);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        close();
        router.refresh();
      });
    },
    [close, router],
  );

  const onCardActivate = useCallback(
    (row: AchievementModalRow) => {
      if (!row.unlocked || !row.titleReward?.trim()) return;
      if (row.equipped) return;
      onEquip(row.key);
    },
    [onEquip],
  );

  const overlay =
    open ? (
      <div
        className="fixed inset-0 z-[10050] flex max-h-[100dvh] flex-col justify-end p-0 md:items-center md:justify-center md:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievements-modal-title"
      >
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-black/72 backdrop-blur-[2px]"
          onClick={close}
        />
        <div
          className={`relative z-[10051] flex h-[96dvh] w-full max-w-2xl flex-col md:h-auto md:max-h-[min(85vh,44rem)] ${glassPanel}`}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5 md:py-4">
            <div className="min-w-0">
              <h2 id="achievements-modal-title" className="font-serif text-lg text-zinc-100 md:text-xl">
                Achievements &amp; Titles
              </h2>
              <p className="mt-1 text-[11px] font-medium tabular-nums text-zinc-400">
                {unlockedCount} / {totalCount} achievements unlocked
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Unlock feats and wear their titles on your profile.</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-sm font-semibold text-zinc-300 hover:border-amber-500/40 hover:text-amber-100"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          <div className="shrink-0 border-b border-white/5 px-4 py-3 md:px-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Equipped title</p>
            {equippedLabel ? (
              <p className="mt-1 text-xs italic text-zinc-500">{equippedLabel}</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">None — equip a title from an unlocked achievement below.</p>
            )}
            {rows.some((r) => r.equipped) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onEquip(null)}
                className="mt-2 text-[11px] font-semibold text-zinc-500 underline decoration-zinc-600 hover:text-zinc-300 disabled:opacity-40"
              >
                Clear equipped title
              </button>
            ) : null}
            {error ? <p className="mt-2 text-xs font-medium text-red-400/95">{error}</p> : null}
          </div>

          <div className="shrink-0 border-b border-white/5 px-3 py-2 md:px-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Filter</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["unlocked", "Unlocked"],
                  ["locked", "Locked"],
                  ["titles", "Titles"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={`${chipBase} ${filter === id ? chipOn : chipOff}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
            {visibleRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No achievements match this filter.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                {visibleRows.map((row) => {
                  const canEquipTitle = row.unlocked && !!row.titleReward?.trim();
                  const locked = !row.unlocked;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        disabled={pending || locked || row.equipped}
                        onClick={() => onCardActivate(row)}
                        className={`flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors md:px-3 md:py-2.5 ${
                          row.equipped
                            ? "border-amber-500/45 bg-amber-950/35 ring-1 ring-amber-500/20"
                            : row.unlocked
                              ? "border-white/14 bg-black/35 hover:border-amber-500/30 hover:bg-black/45"
                              : "cursor-default border-white/8 bg-black/25 opacity-60"
                        } ${
                          canEquipTitle && !row.equipped && !pending
                            ? "cursor-pointer"
                            : row.unlocked && !row.equipped
                              ? "cursor-default"
                              : ""
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className="text-lg leading-none md:text-xl" aria-hidden>
                            {row.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-tight text-zinc-100 md:text-sm">{row.name}</p>
                            <p
                              className={`mt-0.5 text-[10px] leading-snug md:text-[11px] ${
                                row.unlocked && !row.titleReward?.trim() ? "text-zinc-400" : "text-zinc-500"
                              }`}
                            >
                              {row.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-1.5">
                          <span className="text-[9px] tabular-nums text-zinc-500 md:text-[10px]">{row.playerPercentLabel}</span>
                          {locked ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 md:text-[10px]">
                              Locked
                            </span>
                          ) : row.titleReward ? (
                            <span className="text-[9px] text-zinc-400 md:text-[10px]">
                              Title: <span className="font-medium text-amber-200/85">{row.titleReward}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] text-zinc-400 md:text-[10px]">No title reward</span>
                          )}
                          {row.equipped ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/90 md:text-[10px]">
                              Equipped
                            </span>
                          ) : canEquipTitle ? (
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 md:text-[10px]">
                              Click to equip
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFilter("all");
          setOpen(true);
        }}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 self-center rounded-lg border border-white/14 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-sm backdrop-blur-[1px] hover:border-amber-500/35 hover:bg-black/55 hover:text-amber-100/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/50 sm:self-start"
      >
        <span aria-hidden>🏆</span>
        Achievements
      </button>
      {overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
