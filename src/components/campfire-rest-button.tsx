"use client";

import { useEffect, useState } from "react";

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CampfireRestButton({
  restAction,
  hp,
  maxHp,
  cooldownEndsAtMs,
  compact,
}: {
  restAction: () => Promise<void>;
  hp: number;
  maxHp: number;
  /** When free rest becomes available again (ms since epoch); null if off cooldown. */
  cooldownEndsAtMs: number | null;
  /** Omit footnote copy (e.g. town hub horizontal slices). */
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const atFullHp = hp >= maxHp;
  const onCooldown = cooldownEndsAtMs !== null && now < cooldownEndsAtMs;
  const waitSec = onCooldown ? Math.max(0, Math.ceil((cooldownEndsAtMs - now) / 1000)) : 0;
  const disabled = atFullHp || onCooldown;

  return (
    <div className={compact ? "" : "mt-3 space-y-2"}>
      <form action={restAction}>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg border border-white/20 bg-black/55 px-4 py-2 text-sm font-semibold text-zinc-100 enabled:hover:border-white/35 enabled:hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {atFullHp ? "Already at full HP" : onCooldown ? `Rest ready in ${formatMmSs(waitSec)}` : "Rest at campfire (free)"}
        </button>
      </form>
      {!compact ? (
        <p className="text-[11px] text-zinc-500">
          Free full heal on a 2-minute cooldown. Wins do not auto-heal — only this fire (or leveling) helps.
        </p>
      ) : null}
    </div>
  );
}
