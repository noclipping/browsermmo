import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consumeTonicOutsideCombatAction,
  returnToTownAction,
  returnToTownAndMarketAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { SocialHubNav } from "@/components/social-hub-nav";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { CLASS_DISPLAY_NAME } from "@/lib/game/constants";
import { portraitForClass } from "@/lib/game/portraits";
import { buildCharacterStats } from "@/lib/game/stats";
import { FriendProfileActions } from "@/components/friend-profile-actions";
import { PresenceIndicator } from "@/components/presence-indicator";
import { getFriendProfileButtonStatesForUsers } from "@/lib/social/friendship";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;

function buildDirectoryHref(q: string, page: number): string {
  const sp = new URLSearchParams();
  if (q.length >= 2) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/social/directory?${s}` : "/social/directory";
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function SocialDirectoryPage({ searchParams }: PageProps) {
  const sp = searchParams ? await Promise.resolve(searchParams) : {};
  const rawQ = sp.q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "").trim();
  const hasLookup = q.length >= 2;

  const rawPage = sp.page;
  const parsedPage = Number.parseInt(String(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? "1"), 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, inventory, currentRegion, townRegion, combatActive] = await Promise.all([
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const effective = buildCharacterStats(character, equipment);

  const where: Prisma.CharacterWhereInput | undefined = hasLookup
    ? {
        name: {
          contains: q,
          mode: "insensitive",
        },
      }
    : undefined;

  const orderBy: Prisma.CharacterOrderByWithRelationInput[] = [
    { level: "desc" },
    { updatedAt: "desc" },
    { name: "asc" },
  ];

  const totalCount = await prisma.character.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PER_PAGE;

  const [players, achievementCatalogTotal] = await Promise.all([
    prisma.character.findMany({
      where,
      select: {
        name: true,
        class: true,
        level: true,
        bio: true,
        portraitKey: true,
        userId: true,
        updatedAt: true,
        region: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            lastSeenAt: true,
          },
        },
        _count: {
          select: { achievements: true },
        },
      },
      orderBy,
      skip,
      take: PER_PAGE,
    }),
    prisma.achievement.count(),
  ]);

  const friendStates = await getFriendProfileButtonStatesForUsers(
    prisma,
    user.id,
    players.map((p) => p.userId),
  );

  const rankStart = skip + 1;
  const rankEnd = skip + players.length;

  const paginationLinkClass =
    "inline-flex min-w-9 items-center justify-center rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70 disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art */}
          <img
            src="/images/areabanners/playerbanner.png"
            alt=""
            width={1717}
            height={916}
            className="block h-auto w-full max-w-full select-none max-md:absolute max-md:inset-0 max-md:h-full max-md:object-cover max-md:object-center max-md:scale-125"
            decoding="async"
          />
          <div className="absolute inset-0 bg-linear-to-b from-transparent from-10% via-[#0c0a09]/50 via-52% to-[#0c0a09] md:from-5% md:via-[#0c0a09]/55 md:via-42%" />
        </div>
      </div>
      <main className="relative z-10 w-full space-y-6 px-4 py-8 pb-16 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <GameTopBar characterName={character.name} characterLevel={character.level} />
          <GameNav
            inTownRegion={inTownRegion}
            combatLocked={combatLocked}
            returnToTownAction={returnToTownAction}
            returnToTownAndShopAction={returnToTownAndShopAction}
            returnToTownAndMarketAction={returnToTownAndMarketAction}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,56rem)_minmax(16rem,1fr)] lg:items-start">
          <div className="hidden min-w-0 lg:block">
            <div className="lg:sticky lg:top-4 lg:ml-auto lg:w-[min(22rem,100%)]">
              <AdventureLoadoutPanel
                character={character}
                equipment={equipment}
                inventory={inventory}
                effective={effective}
                combatLocked={combatLocked}
                consumeTonicAction={consumeTonicOutsideCombatAction}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <SocialHubNav />

            <div className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Social · Directory</p>
              <h1 className="mt-1 font-serif text-2xl text-zinc-100">Player directory</h1>
              <p className="mt-1 text-sm text-zinc-400">
                {hasLookup ? (
                  <>
                    {totalCount === 0
                      ? `No matches for “${q}”.`
                      : `Matches for “${q}” — ranks by level · showing ${rankStart}–${rankEnd} of ${totalCount}.`}
                  </>
                ) : totalCount === 0 ? (
                  "No players yet."
                ) : (
                  <>
                    Ranked by level (highest first) · showing {rankStart}–{rankEnd} of {totalCount}
                    {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}.
                  </>
                )}
              </p>
            </div>

            <form
              method="get"
              action="/social/directory"
              className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]"
            >
              <label htmlFor="q" className="text-xs font-bold uppercase tracking-widest text-white/70">
                Lookup player
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="q"
                  name="q"
                  defaultValue={q}
                  minLength={2}
                  placeholder="Type at least 2 characters"
                  className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-white/20 bg-black/55 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70"
                >
                  Search
                </button>
              </div>
            </form>

            <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
              {players.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {hasLookup ? `No players found for "${q}".` : "No players found yet."}
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {players.map((p, i) => {
                      const portrait = portraitForClass(p.class, p.portraitKey);
                      const rank = skip + i + 1;
                      const rowClass =
                        rank === 1
                          ? "rounded-lg border-2 border-amber-400/70 bg-linear-to-r from-amber-950/40 via-amber-950/15 to-black/40 shadow-[0_0_20px_rgba(251,191,36,0.12)]"
                          : rank === 2
                            ? "rounded-lg border-2 border-zinc-300/65 bg-linear-to-r from-zinc-600/25 via-zinc-800/15 to-black/40 shadow-[0_0_16px_rgba(212,212,216,0.1)]"
                            : rank === 3
                              ? "rounded-lg border-2 border-orange-600/55 bg-linear-to-r from-orange-950/35 via-amber-950/10 to-black/40 shadow-[0_0_14px_rgba(234,88,12,0.1)]"
                              : "rounded-lg border border-zinc-800/90 bg-black/30";

                      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

                      return (
                        <li
                          key={p.name}
                          className={`flex items-center justify-between gap-3 px-3 py-2 ${rowClass}`}
                          aria-label={`Rank ${rank}: ${p.name}`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-white/10 pr-2">
                              {medal ? (
                                <span className="text-xl leading-none" aria-hidden>
                                  {medal}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">#</span>
                              )}
                              <span className="font-mono text-sm font-bold tabular-nums text-zinc-200">{rank}</span>
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element -- static portrait asset */}
                            <img
                              src={portrait?.src ?? ""}
                              alt={portrait?.label ?? `${p.name} portrait`}
                              width={48}
                              height={48}
                              className="h-12 w-12 shrink-0 rounded object-cover object-top bg-black/25"
                              decoding="async"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-200">{p.name}</p>
                              <p className="text-xs text-zinc-500">
                                {CLASS_DISPLAY_NAME[p.class]} · Lv {p.level} · {p.region.name} ·{" "}
                                <span className="tabular-nums" title="Achievements unlocked / catalog total">
                                  <span aria-hidden>🏆</span> {p._count.achievements}/{achievementCatalogTotal}
                                </span>
                              </p>
                              <div className="mt-0.5">
                                <PresenceIndicator compact lastSeenAt={p.user.lastSeenAt} />
                              </div>
                              {p.bio ? <p className="truncate text-xs text-zinc-400">{p.bio}</p> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                            <Link
                              href={`/player/${encodeURIComponent(p.name)}`}
                              className="rounded-lg border border-white/20 bg-black/55 px-3 py-1 text-xs text-zinc-200 hover:border-white/35 hover:bg-black/70"
                            >
                              View profile
                            </Link>
                            <FriendProfileActions
                              compact
                              state={friendStates.get(p.userId) ?? { kind: "add_friend" }}
                              targetUserId={p.userId}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {totalPages > 1 ? (
                    <nav
                      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"
                      aria-label="Player list pages"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {page > 1 ? (
                          <Link href={buildDirectoryHref(q, page - 1)} className={paginationLinkClass}>
                            Previous
                          </Link>
                        ) : (
                          <span className={`${paginationLinkClass} cursor-not-allowed`} aria-disabled>
                            Previous
                          </span>
                        )}
                        {page < totalPages ? (
                          <Link href={buildDirectoryHref(q, page + 1)} className={paginationLinkClass}>
                            Next
                          </Link>
                        ) : (
                          <span className={`${paginationLinkClass} cursor-not-allowed`} aria-disabled>
                            Next
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        Page <span className="font-mono text-zinc-300">{page}</span> of{" "}
                        <span className="font-mono text-zinc-300">{totalPages}</span>
                      </p>
                    </nav>
                  ) : null}
                </>
              )}
            </article>
          </div>

          <div className="hidden min-w-0 lg:block">
            <div className="lg:sticky lg:top-4 lg:mr-auto lg:w-[min(22rem,100%)]">
              <WorldChatPanel username={character.name} userId={user.id} />
            </div>
          </div>
        </div>

        <MobileAdventureOverlays
          inventoryPanel={
            <AdventureLoadoutPanel
              character={character}
              equipment={equipment}
              inventory={inventory}
              effective={effective}
              combatLocked={combatLocked}
              consumeTonicAction={consumeTonicOutsideCombatAction}
            />
          }
          chatPanel={<WorldChatPanel compact username={character.name} userId={user.id} />}
        />
      </main>
    </div>
  );
}
