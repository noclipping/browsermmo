"use client";

import { useSfx } from "@/components/sfx-provider";
import { useEffect, useRef, useState } from "react";

function SpeakerOnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.03v7.94A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A6.96 6.96 0 0 1 18.5 12 6.96 6.96 0 0 1 14 18.71v2.06A9.01 9.01 0 0 0 22 12a9.01 9.01 0 0 0-8-8.77z" />
    </svg>
  );
}

function SpeakerOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M16.5 12A4.5 4.5 0 0 0 14 8.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.86 8.86 0 0 0 22 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

export function SfxTopBarControl() {
  const { muted, setMuted, volume, setVolume } = useSfx();
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    function onPointerDown(ev: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (ev.target instanceof Node && !el.contains(ev.target)) setPanelOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [panelOpen]);

  return (
    <div ref={rootRef} className="group relative shrink-0">
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/55 bg-black/55 text-white outline-offset-2 transition-colors hover:bg-black/70"
        aria-expanded={panelOpen}
        aria-label={panelOpen ? "Hide sound controls" : "Show sound controls"}
        title="Sound"
      >
        {muted ? (
          <SpeakerOffIcon className="h-5 w-5" />
        ) : (
          <SpeakerOnIcon className="h-5 w-5" />
        )}
      </button>

      <div
        className={[
          "absolute top-0 right-[calc(100%+0.4rem)] z-70 flex w-[3.1rem] flex-col items-center gap-2 rounded-lg border border-white/55 bg-black/68 px-2 py-2.5 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.85)] ring-1 ring-white/25 backdrop-blur-md transition-opacity duration-150",
          panelOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        role="group"
        aria-label="Sound volume"
      >
        <label className="sr-only">Volume</label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          disabled={muted}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          onClick={() => setPanelOpen(true)}
          className="h-24 w-3 cursor-pointer accent-white [writing-mode:vertical-lr] [direction:rtl] disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Adjust sound volume"
        />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/50 bg-black/35 text-white transition-colors hover:bg-black/55"
          aria-label={muted ? "Unmute game sounds" : "Mute game sounds"}
          aria-pressed={muted}
        >
          {muted ? (
            <SpeakerOffIcon className="h-4.5 w-4.5" />
          ) : (
            <SpeakerOnIcon className="h-4.5 w-4.5" />
          )}
        </button>
      </div>
    </div>
  );
}
