import type { ReactNode } from "react";

/** Matches loadout panel “?” hovers: custom dark panel instead of the native browser tooltip. */
export function DistrictHelpHint({ text }: { text: string }) {
  return (
    <span className="group district-help relative inline-flex shrink-0">
      <span
        className="inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-zinc-500 text-[10px] font-bold leading-none text-zinc-100"
        aria-label={text}
      >
        ?
      </span>
      <span className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-[min(14rem,calc(100vw-1.5rem))] rounded border border-zinc-700 bg-zinc-950/95 p-2 text-left text-[10px] leading-snug text-zinc-300 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

const sliceStack =
  "relative z-0 has-[.district-help:hover]:z-50";

const sliceBaseClass =
  "gap-3 rounded-xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 px-4 py-3 shadow-md backdrop-blur-[1px]";

export function TownDistrictSlice({
  emoji,
  label,
  hint,
  layout = "row",
  children,
}: {
  emoji: string;
  label: string;
  hint: string;
  /** Stacked: title row on top, full-width content below (avoids a wide empty gap for large panels). */
  layout?: "row" | "stacked";
  children: ReactNode;
}) {
  if (layout === "stacked") {
    return (
      <div className={`${sliceStack} flex flex-col items-stretch ${sliceBaseClass}`}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-base" aria-hidden>
            {emoji}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{label}</span>
          <DistrictHelpHint text={hint} />
        </div>
        <div className="w-full min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={`${sliceStack} flex flex-wrap items-center ${sliceBaseClass}`}>
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
