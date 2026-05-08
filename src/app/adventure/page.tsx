import { redirect } from "next/navigation";
import {
  changeRegionAction,
  consumeTonicOutsideCombatAction,
  returnToTownAction,
  returnToTownAndMarketAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AchievementToastPostActionDrain } from "@/components/achievement-toast-post-action-drain";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { TurnCombatArena } from "@/components/turn-combat-arena";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { getResumeCombatPayload } from "@/lib/game/start-encounter";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AdventureSearch = Record<string, string | string[] | undefined>;

function regionEmoji(regionKey: string): string {
  const emojiByKey: Record<string, string> = {
    town_outskirts: "🏘️",
    forest_edge: "🌲",
    ancient_ruins: "🏛️",
    murk_catacombs: "🕳️",
  };
  return emojiByKey[regionKey] ?? "🧭";
}

export default async function AdventurePage({
  searchParams,
}: {
  /** Next may pass a Promise or a plain object depending on version / config. */
  searchParams?: Promise<AdventureSearch> | AdventureSearch;
}) {
  const sp: AdventureSearch =
    searchParams === undefined ? {} : await Promise.resolve(searchParams as Promise<AdventureSearch> | AdventureSearch);
  const raw = sp.debugAdventure;
  const debugAdventureFromServer =
    raw === "1" || (Array.isArray(raw) && raw.includes("1"));

  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [regions, currentRegion, townRegion, activeEncounter, equipment, inventory] = await Promise.all([
    prisma.region.findMany({ orderBy: { minLevel: "asc" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      include: { enemy: true },
    }),
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!activeEncounter;
  const resumeCombat = activeEncounter ? await getResumeCombatPayload(prisma, character, activeEncounter) : null;
  const effective = buildCharacterStats(character, equipment);
  const unlockedCount = character.level >= 8 ? 4 : character.level >= 4 ? 3 : 2;
  const bannerByRegionKey: Partial<Record<string, string>> = {
    town_outskirts: "/images/areabanners/townoutskirtsbanner.png",
    forest_edge: "/images/areabanners/forestbanner.png",
    ancient_ruins: "/images/areabanners/ancientruinsbanner.png",
    murk_catacombs: "/images/areabanners/murkcatacombs.png",
  };
  const regionBannerSrc = bannerByRegionKey[regionKey] ?? null;

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      {regionBannerSrc ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-0"
        >
          <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art; md+ intrinsic sizing shows full frame */}
            <img
              src={regionBannerSrc}
              alt=""
              width={1717}
              height={916}
              className="block h-auto w-full max-w-full select-none max-md:absolute max-md:inset-0 max-md:h-full max-md:object-cover max-md:object-center max-md:scale-125"
              decoding="async"
            />
            <div className="absolute inset-0 bg-linear-to-b from-transparent from-10% via-[#0c0a09]/50 via-52% to-[#0c0a09] md:from-5% md:via-[#0c0a09]/55 md:via-42%" />
          </div>
        </div>
      ) : null}
      <main className="relative z-10 w-full space-y-6 px-4 py-8 pb-16 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <AchievementToastPostActionDrain revision={character.updatedAt.toISOString()} />
          <GameTopBar characterName={character.name} characterLevel={character.level} />
          <GameNav
            inTownRegion={inTownRegion}
            combatLocked={combatLocked}
            returnToTownAction={returnToTownAction}
            returnToTownAndShopAction={returnToTownAndShopAction}
            returnToTownAndMarketAction={returnToTownAndMarketAction}
          />

          {debugAdventureFromServer ? (
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-950/80 px-3 py-2 text-center text-sm font-medium text-emerald-50 shadow-lg shadow-emerald-900/30">
              Debug mode ON (server saw <code className="font-mono">?debugAdventure=1</code>). Scroll to the arena for
              trace lines + the big Adventure button (hub only).
            </div>
          ) : null}

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
            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Region</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Pick where you adventure - higher areas are deadlier. You cannot relocate during an active fight.
              </p>
              <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                {regions.map((region) => (
                  <form action={changeRegionAction} key={region.id}>
                    <input type="hidden" name="regionId" value={region.id} />
                    {(() => {
                      const targetIndex = regions.findIndex((r) => r.id === region.id);
                      const canByLevel = character.level >= region.minLevel;
                      const canByWindow = targetIndex >= 0 && targetIndex < unlockedCount;
                      const canTravel = canByLevel || canByWindow;
                      const lockReason = !canTravel
                        ? `Reach level ${region.minLevel} (or unlock more regions by leveling: Lv 4, Lv 8).`
                        : undefined;
                      return (
                        <button
                          type="submit"
                          disabled={combatLocked || !canTravel}
                          title={
                            combatLocked
                              ? "Finish or flee this encounter before changing region."
                              : !canTravel
                                ? lockReason
                                : undefined
                          }
                          className={`min-w-max snap-start rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            character.regionId === region.id
                              ? "border-amber-600 bg-amber-950/50 text-amber-100"
                              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                          }`}
                        >
                          <span className="mr-1.5" aria-hidden="true">
                            {regionEmoji(region.key)}
                          </span>
                          {region.name}
                          <span className="text-zinc-500"> · rec. Lv {region.minLevel}+</span>
                        </button>
                      );
                    })()}
                  </form>
                ))}
              </div>
            </section>

            <TurnCombatArena
              characterName={character.name}
              regionName={currentRegion.name}
              resumeCombat={resumeCombat}
              debugAdventureFromServer={debugAdventureFromServer}
            />
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
