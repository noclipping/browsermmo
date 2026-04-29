import { logoutAction } from "@/app/actions/auth";
import { debugResetCharacterAction } from "@/app/actions/game";
import Link from "next/link";

const profileHref = (characterName: string) =>
  `/player/${encodeURIComponent(characterName)}`;

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function GameTopBar({
  characterName,
  characterLevel,
}: {
  characterName: string;
  characterLevel: number;
}) {
  const showDebugReset = process.env.NODE_ENV === "development";

  return (
    <div className="relative z-50 mb-8 mt-1">
      <header className="flex min-h-11 items-center justify-end gap-2 rounded-xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 py-2 pr-2 pl-41 shadow-md backdrop-blur-[1px] sm:pr-3 sm:pl-52 md:pl-56 md:pr-4">
        <div className="flex min-w-0 max-w-full flex-nowrap items-center justify-end gap-x-2 sm:gap-x-3 md:gap-4">
          <Link
            href={profileHref(characterName)}
            className="min-w-0 max-w-[min(9rem,32vw)] truncate text-sm font-medium text-white/95 underline decoration-white/35 underline-offset-4 hover:text-white hover:decoration-white/55 sm:max-w-[min(11rem,38vw)]"
          >
            {characterName}
          </Link>
          <span className="shrink-0 text-sm tabular-nums text-zinc-300">Lv. {characterLevel}</span>

          <div className="hidden shrink-0 items-center gap-2 md:flex md:gap-3">
            {showDebugReset ? (
              <form
                action={debugResetCharacterAction}
                title="Level 1, base stats, town, 25 gold, 4 tonics, no gear or loot"
              >
                <button
                  type="submit"
                  className="rounded-lg border border-white/20 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200/95 hover:border-amber-700/50 hover:bg-black/70 sm:px-3 sm:text-xs"
                >
                  Debug reset
                </button>
              </form>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs text-zinc-100 hover:border-white/30 hover:bg-black/70 sm:px-4 sm:text-sm"
              >
                Logout
              </button>
            </form>
          </div>

          <details className="relative z-50 shrink-0 md:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/20 bg-black/55 text-zinc-100 outline-offset-2 marker:hidden hover:border-white/35 hover:bg-black/70 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Account menu</span>
              <HamburgerIcon className="h-5 w-5 shrink-0 text-zinc-200" />
            </summary>
            <div className="absolute right-0 top-[calc(100%+0.375rem)] z-[70] min-w-46 rounded-xl border border-white/20 bg-linear-to-b from-zinc-950/98 to-black/98 p-2 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.85)] ring-1 ring-white/10 backdrop-blur-md">
              <div className="flex flex-col gap-2">
                {showDebugReset ? (
                  <form action={debugResetCharacterAction} title="Level 1, base stats, town, 25 gold, 4 tonics, no gear or loot">
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-amber-200/95 hover:border-amber-700/50 hover:bg-black/70 active:bg-black/75"
                    >
                      Debug reset
                    </button>
                  </form>
                ) : null}
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2.5 text-left text-sm text-zinc-100 hover:border-white/30 hover:bg-black/70 active:bg-black/75"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </header>

      <Link
        href="/town"
        className="absolute left-2 top-1/2 z-30 inline-flex -translate-y-1/2 items-center outline-offset-4 transition-opacity hover:opacity-95 max-sm:left-1 sm:left-3"
        aria-label="Duskforge — Town"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static branding from public assets */}
        <img
          src="/images/branding/duskforgelogo.png"
          alt=""
          width={1024}
          height={1024}
          className="h-20 w-auto max-w-[min(11rem,calc(100vw-10rem))] object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] select-none sm:h-24 sm:max-w-[min(16rem,46vw)] md:h-29 md:max-w-[20rem]"
          decoding="async"
        />
      </Link>
    </div>
  );
}
