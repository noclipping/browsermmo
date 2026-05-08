"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function GameNav({
  inTownRegion,
  combatLocked,
  returnToTownAction,
  returnToTownAndShopAction,
  returnToTownAndMarketAction,
}: {
  inTownRegion: boolean;
  combatLocked: boolean;
  returnToTownAction: () => Promise<void>;
  returnToTownAndShopAction: () => Promise<void>;
  returnToTownAndMarketAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pill =
    "inline-flex min-h-11 w-full min-w-[5.5rem] touch-manipulation items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 md:w-auto";
  const tap = "cursor-pointer";
  const inactive =
    "border-white/35 bg-zinc-950 text-zinc-400 hover:border-white/55 hover:bg-black hover:text-zinc-100";
  const activeCls =
    "border-white bg-zinc-800 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] ring-1 ring-white/25";

  const socialActive =
    pathname.startsWith("/social") || pathname.startsWith("/player/");
  const guildActive = pathname.startsWith("/guild");

  const townBlockedTitle =
    "Finish or flee your current fight before traveling.";
  const townTravelTitle = inTownRegion
    ? "Town hub"
    : "Return to Town Outskirts (one step)";

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const townPill = () =>
    pathname === "/town" ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        🏘️ Town
      </span>
    ) : combatLocked ? (
      <span className={`${pill} ${inactive} cursor-not-allowed`} title={townBlockedTitle}>
        🏘️ Town
      </span>
    ) : inTownRegion ? (
      <Link href="/town" className={`${pill} ${tap} ${inactive}`} title="Town hub" onClick={closeMenu}>
        🏘️ Town
      </Link>
    ) : (
      <form action={returnToTownAction}>
        <button type="submit" className={`${pill} ${tap} ${inactive}`} title={townTravelTitle}>
          🏘️ Town
        </button>
      </form>
    );

  const shopPill = () =>
    combatLocked ? (
      <span className={`${pill} ${inactive} cursor-not-allowed`} title={townBlockedTitle}>
        🛒 Shop
      </span>
    ) : pathname === "/shop" ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        🛒 Shop
      </span>
    ) : inTownRegion ? (
      <Link href="/shop" className={`${pill} ${tap} ${inactive}`} title="Town market (Town Outskirts only)" onClick={closeMenu}>
        🛒 Shop
      </Link>
    ) : (
      <form action={returnToTownAndShopAction}>
        <button
          type="submit"
          className={`${pill} ${tap} ${inactive}`}
          title="Return to Town Outskirts and open market"
        >
          🛒 Shop
        </button>
      </form>
    );

  const marketPill = () =>
    combatLocked ? (
      <span className={`${pill} ${inactive} cursor-not-allowed`} title={townBlockedTitle}>
        🏛️ Market
      </span>
    ) : pathname === "/market" ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        🏛️ Market
      </span>
    ) : inTownRegion ? (
      <Link
        href="/market"
        className={`${pill} ${tap} ${inactive}`}
        title="Global market (Town Outskirts only)"
        onClick={closeMenu}
      >
        🏛️ Market
      </Link>
    ) : (
      <form action={returnToTownAndMarketAction}>
        <button
          type="submit"
          className={`${pill} ${tap} ${inactive}`}
          title="Return to Town Outskirts and open global market"
        >
          🏛️ Market
        </button>
      </form>
    );

  const adventurePill = () =>
    pathname === "/adventure" ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        ⚔️ Adventure
      </span>
    ) : (
      <Link href="/adventure" className={`${pill} ${tap} ${inactive}`} onClick={closeMenu}>
        ⚔️ Adventure
      </Link>
    );

  const characterPill = () =>
    pathname === "/character" ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        🧙 Character
      </span>
    ) : (
      <Link href="/character" className={`${pill} ${tap} ${inactive}`} onClick={closeMenu}>
        🧙 Character
      </Link>
    );

  const socialPill = () =>
    socialActive ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        👥 Social
      </span>
    ) : (
      <Link href="/social/directory" className={`${pill} ${tap} ${inactive}`} onClick={closeMenu}>
        👥 Social
      </Link>
    );

  const guildPill = () =>
    guildActive ? (
      <span className={`${pill} ${activeCls} cursor-default`} aria-current="page">
        🛡️ Guild
      </span>
    ) : (
      <Link href="/guild" className={`${pill} ${tap} ${inactive}`} onClick={closeMenu}>
        🛡️ Guild
      </Link>
    );

  return (
    <div className="relative mb-6">
      {/* Desktop / tablet: wrapped row */}
      <nav
        className="hidden flex-wrap gap-2 border-b border-white/15 pb-4 md:flex"
        aria-label="Main"
      >
        {townPill()}
        {shopPill()}
        {marketPill()}
        {adventurePill()}
        {characterPill()}
        {socialPill()}
        {guildPill()}
      </nav>

      {/* Mobile: hamburger + dropdown */}
      <div className="md:hidden" ref={menuRef}>
        <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Menu</span>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/35 bg-zinc-950 px-3 py-2 text-zinc-200 hover:border-white/55 hover:bg-black"
            aria-expanded={menuOpen}
            aria-controls="game-nav-mobile-panel"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>
        {menuOpen ? (
          <div
            id="game-nav-mobile-panel"
            className="absolute left-0 right-0 z-50 mt-2 flex flex-col gap-2 rounded-xl border border-white/20 bg-zinc-950/98 p-3 shadow-xl backdrop-blur-md"
            role="menu"
          >
            <div className="flex flex-col gap-2">{townPill()}</div>
            <div className="flex flex-col gap-2">{shopPill()}</div>
            <div className="flex flex-col gap-2">{marketPill()}</div>
            <div className="flex flex-col gap-2">{adventurePill()}</div>
            <div className="flex flex-col gap-2">{characterPill()}</div>
            <div className="flex flex-col gap-2">{socialPill()}</div>
            <div className="flex flex-col gap-2">{guildPill()}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
