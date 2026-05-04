import Link from "next/link";
import { redirect } from "next/navigation";
import {
  acceptFriendRequestAction,
  cancelOutgoingFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
} from "@/app/actions/friends";
import { consumeTonicOutsideCombatAction, returnToTownAction, returnToTownAndShopAction } from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { asFormVoid } from "@/lib/as-form-void";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { CLASS_DISPLAY_NAME } from "@/lib/game/constants";
import { portraitForClass } from "@/lib/game/portraits";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const characterSelect = {
  take: 1 as const,
  orderBy: { createdAt: "asc" as const },
  select: {
    name: true,
    class: true,
    level: true,
    portraitKey: true,
  },
};

export default async function FriendsPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, inventory, currentRegion, townRegion, combatActive, incoming, outgoing, accepted] =
    await Promise.all([
      prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
      prisma.inventoryItem.findMany({
        where: { characterId: character.id },
        include: { item: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.region.findUnique({ where: { id: character.regionId } }),
      prisma.region.findUnique({ where: { key: "town_outskirts" } }),
      prisma.soloCombatEncounter.findFirst({
        where: { characterId: character.id, status: "ACTIVE" },
        select: { id: true },
      }),
      prisma.friendship.findMany({
        where: { addresseeId: user.id, status: "PENDING" },
        include: {
          requester: { select: { id: true, characters: characterSelect } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.friendship.findMany({
        where: { requesterId: user.id, status: "PENDING" },
        include: {
          addressee: { select: { id: true, characters: characterSelect } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: user.id }, { addresseeId: user.id }],
        },
        include: {
          requester: { select: { id: true, characters: characterSelect } },
          addressee: { select: { id: true, characters: characterSelect } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const effective = buildCharacterStats(character, equipment);

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
            <div className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Friends</p>
              <h1 className="mt-1 font-serif text-2xl text-zinc-100">Requests & friends</h1>
              <p className="mt-1 text-sm text-zinc-400">Async only — no live presence or chat yet.</p>
            </div>

            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90">
                Incoming requests
              </h2>
              {incoming.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">None.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {incoming.map((row) => {
                    const c = row.requester.characters[0];
                    const portrait = c ? portraitForClass(c.class, c.portraitKey) : null;
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element -- portrait asset */}
                          <img
                            src={portrait?.src ?? ""}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover object-top bg-black/25"
                          />
                          <div className="min-w-0">
                            {c ? (
                              <Link
                                href={`/player/${encodeURIComponent(c.name)}`}
                                className="truncate font-medium text-zinc-200 underline decoration-zinc-600 hover:text-amber-100"
                              >
                                {c.name}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">Unknown</span>
                            )}
                            <p className="text-xs text-zinc-500">
                              {c ? `${CLASS_DISPLAY_NAME[c.class]} · Lv ${c.level}` : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <form action={asFormVoid(acceptFriendRequestAction)}>
                            <input type="hidden" name="friendshipId" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                            >
                              Accept
                            </button>
                          </form>
                          <form action={asFormVoid(declineFriendRequestAction)}>
                            <input type="hidden" name="friendshipId" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/50"
                            >
                              Decline
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Outgoing requests</h2>
              {outgoing.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">None.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {outgoing.map((row) => {
                    const c = row.addressee.characters[0];
                    const portrait = c ? portraitForClass(c.class, c.portraitKey) : null;
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={portrait?.src ?? ""}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover object-top bg-black/25"
                          />
                          <div className="min-w-0">
                            {c ? (
                              <Link
                                href={`/player/${encodeURIComponent(c.name)}`}
                                className="truncate font-medium text-zinc-200 underline decoration-zinc-600 hover:text-amber-100"
                              >
                                {c.name}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">Unknown</span>
                            )}
                            <p className="text-xs text-zinc-500">Pending</p>
                          </div>
                        </div>
                        <form action={asFormVoid(cancelOutgoingFriendRequestAction)}>
                          <input type="hidden" name="friendshipId" value={row.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                          >
                            Cancel
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">Friends</h2>
              {accepted.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No friends yet. Add people from their public profile.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {accepted.map((row) => {
                    const other =
                      row.requesterId === user.id
                        ? row.addressee
                        : row.requester;
                    const c = other.characters[0];
                    const portrait = c ? portraitForClass(c.class, c.portraitKey) : null;
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={portrait?.src ?? ""}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover object-top bg-black/25"
                          />
                          <div className="min-w-0">
                            {c ? (
                              <Link
                                href={`/player/${encodeURIComponent(c.name)}`}
                                className="truncate font-medium text-zinc-200 underline decoration-zinc-600 hover:text-amber-100"
                              >
                                {c.name}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">Unknown</span>
                            )}
                            <p className="text-xs text-zinc-500">
                              {c ? `${CLASS_DISPLAY_NAME[c.class]} · Lv ${c.level}` : null}
                            </p>
                          </div>
                        </div>
                        <form action={asFormVoid(removeFriendAction)}>
                          <input type="hidden" name="friendshipId" value={row.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                          >
                            Remove
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="text-center text-sm text-zinc-500">
              <Link href="/players" className="text-amber-200/90 underline decoration-amber-900/50 hover:text-amber-100">
                Player directory
              </Link>
            </p>
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
