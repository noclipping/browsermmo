"use client";

import confetti from "canvas-confetti";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ACHIEVEMENT_UNLOCK_EVENT,
  drainAchievementToastCookie,
  type AchievementUnlockDetail,
} from "@/lib/achievement-toast-events";
import type { AchievementToastItem } from "@/lib/achievement-toast-types";

/** Shorter than before (~5.2s); progress bar + auto-dismiss stay in sync via this constant. */
const AUTO_DISMISS_MS = 4200;

/**
 * CSS transitions often fail to restart for queued toasts. Web Animations API gives each display a fresh timeline.
 */
function AchievementToastProgressBar({ displayId, durationMs }: { displayId: number; durationMs: number }) {
  const fillRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const anim = el.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration: durationMs,
      easing: "linear",
      fill: "forwards",
    });
    return () => anim.cancel();
  }, [displayId, durationMs]);

  return (
    <div className="h-1 w-full shrink-0 bg-black/45" aria-hidden>
      <div className="h-full w-full overflow-hidden bg-zinc-800/80">
        <div
          ref={fillRef}
          className="h-full w-full origin-left rounded-full bg-linear-to-r from-amber-400 via-amber-300 to-amber-500"
          style={{ transform: "scaleX(1)" }}
        />
      </div>
    </div>
  );
}

function burstConfetti() {
  const count = 140;
  const defaults = { origin: { y: 0.92 }, zIndex: 10080 };

  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.35),
    spread: 62,
    startVelocity: 35,
    scalar: 0.9,
    colors: ["#fbbf24", "#fcd34d", "#fde68a", "#ffffff", "#a78bfa", "#34d399"],
  });
  confetti({
    ...defaults,
    particleCount: Math.floor(count * 0.25),
    spread: 90,
    startVelocity: 28,
    scalar: 0.85,
    colors: ["#f59e0b", "#fbbf24", "#fef3c7"],
  });
}

export function AchievementToastProvider() {
  const pathname = usePathname();
  /** Increments on every `showItem` so the progress bar animation restarts for queued toasts (not only achievement key). */
  const [toastDisplayId, setToastDisplayId] = useState(0);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<AchievementToastItem | null>(null);
  const queueRef = useRef<AchievementToastItem[]>([]);
  const showingRef = useRef(false);
  const dismissedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { enqueue, advanceQueue } = useMemo(() => {
    const clearTimer = () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };

    function showItem(item: AchievementToastItem) {
      setToastDisplayId((n) => n + 1);
      dismissedRef.current = false;
      showingRef.current = true;
      setCurrent(item);
      setOpen(true);
      requestAnimationFrame(() => {
        burstConfetti();
        setVisible(true);
      });
      clearTimer();
      autoTimerRef.current = setTimeout(() => {
        if (!dismissedRef.current) advanceQueue();
      }, AUTO_DISMISS_MS);
    }

    function advanceQueue() {
      dismissedRef.current = true;
      clearTimer();
      setVisible(false);
      window.setTimeout(() => {
        const next = queueRef.current.shift() ?? null;
        if (!next) {
          showingRef.current = false;
          setOpen(false);
          setCurrent(null);
          dismissedRef.current = false;
          return;
        }
        showItem(next);
      }, 220);
    }

    function enqueueItems(items: AchievementToastItem[]) {
      if (!items.length) return;
      for (const it of items) queueRef.current.push(it);
      if (!showingRef.current) {
        const first = queueRef.current.shift();
        if (first) showItem(first);
      }
    }

    return { enqueue: enqueueItems, advanceQueue };
  }, [setToastDisplayId]);

  useEffect(() => {
    const onUnlock = (e: Event) => {
      const ce = e as CustomEvent<AchievementUnlockDetail>;
      const items = ce.detail?.items;
      if (items?.length) enqueue(items);
    };
    window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock as EventListener);
    drainAchievementToastCookie();
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock as EventListener);
  }, [enqueue]);

  useEffect(() => {
    const drain = () => drainAchievementToastCookie();
    window.addEventListener("focus", drain);
    const onVis = () => {
      if (document.visibilityState === "visible") drain();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", drain);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    drainAchievementToastCookie();
  }, [pathname]);

  const onDismissClick = () => advanceQueue();

  const panel =
    open && current ? (
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-[10070] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6`}
      >
        <div
          className={`pointer-events-auto w-full max-w-md transition-all duration-300 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0"
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-linear-to-b from-zinc-900/98 via-zinc-950/98 to-black/95 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/50 to-transparent" />
            <button
              type="button"
              aria-label="Dismiss"
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-sm font-bold text-zinc-400 transition hover:border-amber-500/40 hover:text-amber-100"
              onClick={onDismissClick}
            >
              ✕
            </button>
            <div className="flex gap-3 px-4 py-4 pr-12">
              <span className="text-3xl leading-none drop-shadow-sm" aria-hidden>
                {current.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">
                  {current.variant === "levelup" ? "Progress" : "Achievement unlocked"}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-zinc-50">{current.name}</p>
                <p className="mt-1 text-xs leading-snug text-zinc-400">{current.description}</p>
              </div>
            </div>
            <AchievementToastProgressBar displayId={toastDisplayId} durationMs={AUTO_DISMISS_MS} />
          </div>
        </div>
      </div>
    ) : null;

  if (!panel || typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
