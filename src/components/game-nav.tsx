"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  const pill =
    "inline-flex min-h-11 min-w-[5.5rem] touch-manipulation items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const tap = "cursor-pointer";
  const inactive =
    "border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200";
  const activeCls = "border-amber-600 bg-amber-950/50 text-amber-100";

  const townBlockedTitle =
    "Finish or flee your current fight before traveling.";
  const townTravelTitle = inTownRegion
    ? "Town hub"
    : "Return to Town Outskirts (one step)";

  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 border-b border-amber-900/25 pb-4"
      aria-label="Main"
    >
      {pathname === "/" ? (
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
          href="/"
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
    </nav>
  );
}
