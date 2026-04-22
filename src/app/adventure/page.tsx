import { redirect } from "next/navigation";
import { changeRegionAction, consumeTonicOutsideCombatAction, returnToTownAction } from "@/app/actions/game";
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

  return (
    <div className="min-h-screen bg-[#0c0a09] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(120,53,15,0.25),transparent)]">
      <main className="w-full space-y-6 px-4 py-8 pb-16 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <GameTopBar username={user.username} characterName={character.name} characterClass={character.class} />
          <GameNav inTownRegion={inTownRegion} combatLocked={combatLocked} returnToTownAction={returnToTownAction} />

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
            <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Region</h2>
              <p className="mt-1 text-sm text-zinc-500">
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
                              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
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
              <WorldChatPanel />
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
          chatPanel={<WorldChatPanel compact />}
        />
      </main>
    </div>
  );
}
