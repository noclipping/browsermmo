"use client";

import { useEffect, useMemo, useState } from "react";

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DailyNextClaimTimer({ nextClaimAtIso }: { nextClaimAtIso: string }) {
  const target = useMemo(() => new Date(nextClaimAtIso).getTime(), [nextClaimAtIso]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = Math.max(0, target - now);
  return (
    <p className="text-xs text-zinc-400">
      Next claim in <span className="font-semibold text-amber-200">{fmt(remaining)}</span> (UTC reset)
    </p>
  );
}

