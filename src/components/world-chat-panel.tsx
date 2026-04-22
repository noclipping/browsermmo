const CHAT_LINES = [
  "[World] Aster: anyone farming town outskirts?",
  "[World] Vex: miniboss just dropped a rare bow",
  "[System] Campfire cooldowns reset on schedule.",
  "[World] Mira: smithing stones in market are up",
];

export function WorldChatPanel({ compact = false }: { compact?: boolean }) {
  return (
    <aside className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">World chat</h2>
        <span className="rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300/90">
          Online
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Social panel placeholder for Phase 1 layout work.</p>

      <div className={`mt-3 space-y-2 overflow-y-auto rounded-lg border border-zinc-900 bg-black/25 p-3 text-xs text-zinc-300 ${compact ? "max-h-56" : "max-h-72"}`}>
        {CHAT_LINES.map((line) => (
          <p key={line} className="border-b border-zinc-900/70 pb-2 last:border-0 last:pb-0">
            {line}
          </p>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">Chat input and live feed wiring can land in a later pass.</p>
    </aside>
  );
}
