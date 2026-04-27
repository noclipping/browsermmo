import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consumeTonicOutsideCombatAction,
  forgeUpgradeAction,
  restAtCampfireAction,
  returnToTownAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import {
  FORGE_MAX_BY_RARITY,
  FORGE_UPGRADE_GOLD_COST,
  SMITHING_STONE_ITEM_KEY,
  TOWN_REST_COOLDOWN_MS,
} from "@/lib/game/constants";
import { buildCharacterStats } from "@/lib/game/stats";
import { CampfireRestButton } from "@/components/campfire-rest-button";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { itemDisplayName, normalizeForgeLevel } from "@/lib/game/item-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TownPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, townRegion, currentRegion, combatActive] =
    await Promise.all([
      prisma.characterEquipment.findMany({
        where: { characterId: character.id },
        include: { item: true },
      }),
      prisma.region.findUnique({ where: { key: "town_outskirts" } }),
      prisma.region.findUnique({ where: { id: character.regionId } }),
      prisma.soloCombatEncounter.findFirst({
        where: { characterId: character.id, status: "ACTIVE" },
        select: { id: true },
      }),
    ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey])
    redirect("/character/new");

  const inventory = await prisma.inventoryItem.findMany({
    where: { characterId: character.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });
  const smithingStoneCount =
    inventory.find((entry) => entry.item.key === SMITHING_STONE_ITEM_KEY)
      ?.quantity ?? 0;
  const isTown = currentRegion?.key === "town_outskirts";
  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const effective = buildCharacterStats(character, equipment);
  const restCooldownEndsAtMs =
    character.lastFreeRestAt != null
      ? character.lastFreeRestAt.getTime() + TOWN_REST_COOLDOWN_MS
      : null;
  const districtPanelClass =
    "rounded-2xl border border-amber-900/40 bg-zinc-950/20 bg-linear-to-b from-black/45 via-black/65 to-black/88 p-4 backdrop-blur-[1px]";
  const districtTitleClass =
    "text-[10px] font-bold uppercase tracking-widest text-amber-500/90";
  const districtButtonClass =
    "mt-3 inline-block rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/35";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0"
      >
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art; md+ intrinsic sizing shows full frame */}
          <img
            src="/images/areabanners/townbanner.png"
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
          <GameTopBar
            characterName={character.name}
            characterClass={character.class}
          />
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
          <div className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-2xl border border-amber-900/40 bg-zinc-950/20 backdrop-blur-[1px]">
              <div className="bg-linear-to-b from-black/45 via-black/65 to-black/88 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90">
                  Town Outskirts
                </p>
                <h1 className="mt-1 font-serif text-2xl text-amber-100">
                  The camp is alive with trade and steelwork.
                </h1>
                <p className="mt-2 text-sm text-zinc-300">
                  Use the district tiles below to prepare before heading through
                  the gate.
                </p>
              </div>
            </section>

            {isTown ? (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <article className={districtPanelClass}>
                  <h2 className={districtTitleClass}>
                    🔥 Campfire
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Free full heal on a timer between uses. Wins do not top you
                    off.
                  </p>
                  <CampfireRestButton
                    restAction={restAtCampfireAction}
                    hp={character.hp}
                    maxHp={character.maxHp}
                    cooldownEndsAtMs={restCooldownEndsAtMs}
                  />
                </article>
                <article className={districtPanelClass}>
                  <h2 className={districtTitleClass}>🛒 Market</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Common gear, tonics, smithing stones, and buyback - prices
                    scale with danger tier and item power.
                  </p>
                  <Link href="/shop" className={districtButtonClass}>
                    Open market
                  </Link>
                </article>
                <article className={districtPanelClass}>
                  <h2 className={districtTitleClass}>⚒️ Forge</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Stones: {smithingStoneCount} · Cost:{" "}
                    {FORGE_UPGRADE_GOLD_COST}g + stones scale with each forge
                    tier (+N costs N stones). Common, Uncommon, Rare, and Epic
                    are capped; Legendary and Godly scale infinitely with
                    diminishing returns.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {equipment
                      .filter((entry) => entry.item)
                      .map((entry) =>
                        (() => {
                          const currentForge = normalizeForgeLevel(
                            entry.forgeLevel,
                          );
                          const maxForge = entry.item
                            ? FORGE_MAX_BY_RARITY[entry.item.rarity]
                            : 0;
                          const stonesRequired = currentForge + 1;
                          const forgeBlocked =
                            currentForge >= maxForge ||
                            smithingStoneCount < stonesRequired ||
                            character.gold < FORGE_UPGRADE_GOLD_COST;
                          return (
                            <form
                              action={forgeUpgradeAction}
                              key={`forge-${entry.id}`}
                            >
                              <input
                                type="hidden"
                                name="slot"
                                value={entry.slot}
                              />
                              <button
                                type="submit"
                                disabled={forgeBlocked}
                                className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 enabled:hover:bg-amber-900/35 disabled:cursor-not-allowed disabled:opacity-40"
                                title={
                                  entry.item
                                    ? currentForge >= maxForge
                                      ? `${itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)} is at max forge tier for ${entry.item.rarity.toLowerCase()}.`
                                      : `${itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)} → +${currentForge + 1} (${stonesRequired} stone${stonesRequired > 1 ? "s" : ""})`
                                    : undefined
                                }
                              >
                                Forge {entry.slot}{" "}
                                <span className="text-amber-200/80">
                                  (+{currentForge}→+
                                  {maxForge >= Number.MAX_SAFE_INTEGER
                                    ? currentForge + 1
                                    : Math.min(maxForge, currentForge + 1)}{" "}
                                  · {stonesRequired} stone
                                  {stonesRequired > 1 ? "s" : ""})
                                </span>
                              </button>
                            </form>
                          );
                        })(),
                      )}
                  </div>
                </article>
                <article className={districtPanelClass}>
                  <h2 className={districtTitleClass}>🧑‍🏫 Trainer</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Spend stat points and inspect your class skill from the
                    character sheet.
                  </p>
                  <a href="/character" className={districtButtonClass}>
                    Visit trainer
                  </a>
                </article>
                <article className={districtPanelClass}>
                  <h2 className={districtTitleClass}>🗺️ Adventure gate</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Step out into hostile regions. Flee may fail, and bosses
                    will not let you run.
                  </p>
                  <a href="/adventure" className={districtButtonClass}>
                    Go adventuring
                  </a>
                </article>
                <article className={districtPanelClass}>
                  <h2 className={districtTitleClass}>
                    {currentRegion.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Services only work in Town Outskirts. Use{" "}
                    <span className="text-amber-200/90">Town</span> in the
                    bar above to return when you are not in a fight.
                  </p>
                </article>
              </section>
            ) : null}

            {!isTown ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-500">
                You are away from town. Open{" "}
                <strong className="text-zinc-400">Adventure</strong> to fight,
                or travel back above to use services.
              </p>
            ) : null}
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
