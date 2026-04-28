import { isUserRecentlyActive } from "@/lib/auth/last-seen";

export function PresenceIndicator({
  lastSeenAt,
  compact = false,
}: {
  lastSeenAt: Date | null | undefined;
  compact?: boolean;
}) {
  const online = isUserRecentlyActive(lastSeenAt ?? null);
  const dot = online ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-zinc-600";

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-zinc-500"
        title="Best-effort from recent activity (not live presence)."
      >
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className={online ? "text-emerald-400/90" : "text-zinc-500"}>{online ? "Online" : "Offline"}</span>
      </span>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-2.5 py-0.5 text-[11px] font-semibold ${
          online ? "text-emerald-200" : "text-zinc-300"
        }`}
      >
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        {online ? "Online" : "Offline"}
      </span>
      <span className="text-[10px] text-zinc-600">From last activity · not live</span>
    </div>
  );
}
