import type { ReactNode } from "react";

export function DistrictHelpHint({ text }: { text: string }) {
  return (
    <abbr
      title={text}
      className="inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full border border-white/25 bg-black/50 text-[11px] font-bold leading-none text-zinc-400 no-underline hover:border-white/40 hover:text-zinc-200"
    >
      ?
    </abbr>
  );
}

const sliceClass =
  "flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 px-4 py-3 shadow-md backdrop-blur-[1px]";

export function TownDistrictSlice({
  emoji,
  label,
  hint,
  children,
}: {
  emoji: string;
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className={sliceClass}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-base" aria-hidden>
          {emoji}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{label}</span>
        <DistrictHelpHint text={hint} />
      </div>
      <div className="flex min-w-0 shrink-0 justify-end sm:min-w-48">{children}</div>
    </div>
  );
}
