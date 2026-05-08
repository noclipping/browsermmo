"use client";

import { useSfx } from "@/components/sfx-provider";
import { emitAchievementToasts } from "@/lib/achievement-toast-events";
import { levelUpToastItem } from "@/lib/level-up-toast";

/** Dev-only: fires level-up SFX + toast without touching the database. */
export function DebugLevelUpPreview({ previewLevel }: { previewLevel: number }) {
  const { playSfx } = useSfx();
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <button
      type="button"
      onClick={() => {
        playSfx("levelup");
        emitAchievementToasts([levelUpToastItem(previewLevel)]);
      }}
      title="Preview level-up toast + sound only — does not change your character."
      className="w-full rounded-lg border border-violet-500/40 bg-violet-950/40 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-200/95 hover:border-violet-400/55 hover:bg-violet-900/35 sm:w-auto sm:px-3 sm:text-xs"
    >
      LV↑ preview
    </button>
  );
}
