const CHAT_LINES = [
  "[World] Aster: anyone farming town outskirts?",
  "[World] Vex: miniboss just dropped a rare bow",
  "[System] Campfire cooldowns reset on schedule.",
  "[World] Mira: smithing stones in market are up",
];

export function WorldChatPanel({ compact = false }: { compact?: boolean }) {
  return (
    <aside className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/85">World chat</h2>
        <span className="rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300/90">
          Online
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-200/90">Social panel placeholder for Phase 1 layout work.</p>

      <div className={`mt-3 space-y-2 overflow-y-auto rounded-lg border border-white/15 bg-black/50 p-3 text-xs text-zinc-100 ${compact ? "max-h-56" : "max-h-72"}`}>
        {CHAT_LINES.map((line) => (
          <p key={line} className="border-b border-zinc-700/60 pb-2 last:border-0 last:pb-0">
            {line}
          </p>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-zinc-300/90">Chat input and live feed wiring can land in a later pass.</p>
    </aside>
  );
}
