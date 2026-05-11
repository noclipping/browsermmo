import type { CombatFxItem } from "@/components/combat/combat-fx-types";
import type { ReactNode } from "react";

type CombatStageProps = {
  bannerSrc: string | null | undefined;
  /** Shown only to screen readers (round badge removed from UI). */
  round: number;
  /** Floating combat text overlay (damage, heals, etc.) */
  combatFx: CombatFxItem[];
  left: ReactNode;
  right: ReactNode;
};

export function CombatStage({ bannerSrc, round, combatFx, left, right }: CombatStageProps) {
  return (
    <div className="relative rounded-2xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* No overflow on this box so combatants can lunge toward center without clipping. */}
      <div className="relative aspect-16/10 min-h-46 w-full max-h-[min(42vh,22rem)] rounded-2xl max-sm:overflow-hidden sm:min-h-52 sm:max-h-[min(44vh,24rem)] sm:overflow-visible">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {bannerSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- region banner art */}
              <img
                src={bannerSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
                decoding="async"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/88 via-black/35 to-black/20" />
            </>
          ) : (
            <div className="absolute inset-0 bg-linear-to-b from-zinc-800 via-zinc-950 to-black">
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,rgba(120,120,160,0.25),transparent_65%)]" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl">
          {combatFx.map((fx) => (
            <div
              key={fx.id}
              className={`combat-fx combat-fx-${fx.tone}`}
              style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
            >
              <span className="text-lg">{fx.emoji}</span>
              <span className="text-sm font-black tracking-wide">{fx.text}</span>
            </div>
          ))}
        </div>

        {/*
          --meet-shift-x: JRPG lunge distance; mobile-only smaller value, sm+ matches legacy desktop/tablet.
          Narrow viewports: align-items end + intrinsic actor height pins sprites/HP to the bottom row so
          headroom above the intent stays inside max-sm:overflow-hidden. Tighter pb-2 on mobile uses that space.
        */}
        <div className="relative z-5 flex min-h-0 h-full max-sm:items-end justify-between gap-1 px-1 pb-2 pt-16 [--meet-shift-x:min(24vw,4.25rem)] sm:items-end sm:gap-2 sm:px-3 sm:pb-4 sm:pt-11 sm:[--meet-shift-x:min(56vw,19rem)]">
          <span className="sr-only">Round {round}</span>
          {left}
          {right}
        </div>
      </div>
    </div>
  );
}
