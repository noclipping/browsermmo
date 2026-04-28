"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function GameNav({
  inTownRegion,
  combatLocked,
  returnToTownAction,
  returnToTownAndShopAction,
}: {
  inTownRegion: boolean;
  combatLocked: boolean;
  returnToTownAction: () => Promise<void>;
  returnToTownAndShopAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [stripOverflows, setStripOverflows] = useState(false);

  const pill =
    "inline-flex min-h-11 shrink-0 min-w-[5.5rem] touch-manipulation items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const tap = "cursor-pointer";
  const inactive =
    "border-white/35 bg-zinc-950 text-zinc-400 hover:border-white/55 hover:bg-black hover:text-zinc-100";
  const activeCls =
    "border-white bg-zinc-800 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] ring-1 ring-white/25";

  const playersActive =
    pathname === "/players" || pathname.startsWith("/player/");
  const friendsActive = pathname === "/friends";

  const townBlockedTitle =
    "Finish or flee your current fight before traveling.";
  const townTravelTitle = inTownRegion
    ? "Town hub"
    : "Return to Town Outskirts (one step)";

  const updateScrollState = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    setStripOverflows(overflow);
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      ro.disconnect();
    };
  }, [pathname, updateScrollState]);

  const scrollStrip = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    const delta = Math.min(Math.round(el.clientWidth * 0.65), 220);
    el.scrollBy({ left: dir * delta, behavior: "smooth" });
  };

  const arrowBtn =
    "pointer-events-auto absolute top-1/2 z-10 flex h-10 w-9 -translate-y-1/2 touch-manipulation items-center justify-center rounded-lg border border-white/25 bg-black/80 text-white shadow-md backdrop-blur-sm transition-[opacity,transform] hover:border-white/45 hover:bg-black active:scale-[0.97] max-md:flex md:hidden";

  return (
    <div className="relative mb-6">
      {stripOverflows ? (
        <>
          <button
            type="button"
            className={`${arrowBtn} left-0 pl-0.5 ${canScrollLeft ? "opacity-100" : "pointer-events-none opacity-25"}`}
            aria-label="Scroll navigation left"
            disabled={!canScrollLeft}
            onClick={() => scrollStrip(-1)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            className={`${arrowBtn} right-0 pr-0.5 ${canScrollRight ? "opacity-100" : "pointer-events-none opacity-25"}`}
            aria-label="Scroll navigation right"
            disabled={!canScrollRight}
            onClick={() => scrollStrip(1)}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}

      <nav
        ref={stripRef}
        className={`flex gap-2 border-b border-white/15 pb-4 max-md:touch-pan-x max-md:flex-nowrap max-md:overflow-x-auto max-md:overflow-y-hidden max-md:scroll-smooth max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden md:flex-wrap ${stripOverflows ? "max-md:px-10" : ""}`}
        aria-label="Main"
      >
        {pathname === "/town" ? (
          <span
            className={`${pill} ${activeCls} cursor-default`}
            aria-current="page"
          >
            Town
          </span>
        ) : combatLocked ? (
          <span
            className={`${pill} ${inactive} cursor-not-allowed`}
            title={townBlockedTitle}
          >
            Town
          </span>
        ) : inTownRegion ? (
          <Link
            href="/town"
            className={`${pill} ${tap} ${inactive}`}
            title="Town hub"
          >
            Town
          </Link>
        ) : (
          <form action={returnToTownAction}>
            <button
              type="submit"
              className={`${pill} ${tap} ${inactive}`}
              title={townTravelTitle}
            >
              Town
            </button>
          </form>
        )}

        {combatLocked ? (
          <span
            className={`${pill} ${inactive} cursor-not-allowed`}
            title={townBlockedTitle}
          >
            Shop
          </span>
        ) : pathname === "/shop" ? (
          <span
            className={`${pill} ${activeCls} cursor-default`}
            aria-current="page"
          >
            Shop
          </span>
        ) : inTownRegion ? (
          <Link
            href="/shop"
            className={`${pill} ${tap} ${inactive}`}
            title="Town market (Town Outskirts only)"
          >
            Shop
          </Link>
        ) : (
          <form action={returnToTownAndShopAction}>
            <button
              type="submit"
              className={`${pill} ${tap} ${inactive}`}
              title="Return to Town Outskirts and open market"
            >
              Shop
            </button>
          </form>
        )}

        {pathname === "/adventure" ? (
          <span
            className={`${pill} ${activeCls} cursor-default`}
            aria-current="page"
          >
            Adventure
          </span>
        ) : (
          <Link href="/adventure" className={`${pill} ${tap} ${inactive}`}>
            Adventure
          </Link>
        )}

        {pathname === "/character" ? (
          <span
            className={`${pill} ${activeCls} cursor-default`}
            aria-current="page"
          >
            Character
          </span>
        ) : (
          <Link href="/character" className={`${pill} ${tap} ${inactive}`}>
            Character
          </Link>
        )}

        {playersActive ? (
          <span
            className={`${pill} ${activeCls} cursor-default`}
            aria-current="page"
          >
            Players
          </span>
        ) : (
          <Link href="/players" className={`${pill} ${tap} ${inactive}`}>
            Players
          </Link>
        )}

        {friendsActive ? (
          <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
            Friends
          </span>
        ) : (
          <Link href="/friends" className={`${pill} ${tap} ${inactive}`}>
            Friends
          </Link>
        )}
      </nav>
    </div>
  );
}
