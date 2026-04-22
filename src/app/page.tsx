import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consumeTonicOutsideCombatAction,
  forgeUpgradeAction,
  restAtCampfireAction,
  returnToTownAction,
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
import { requiredXpForLevel } from "@/lib/game/progression";
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

  return (
    <div className="min-h-screen bg-[#0c0a09] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(120,53,15,0.25),transparent)]">
      <main className="w-full space-y-6 px-4 py-8 pb-16 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <GameTopBar
            username={user.username}
            characterName={character.name}
            characterClass={character.class}
          />
          <GameNav
            inTownRegion={inTownRegion}
            combatLocked={combatLocked}
            returnToTownAction={returnToTownAction}
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
            <section
          className="overflow-hidden rounded-2xl border border-amber-900/40 bg-cover bg-center"
          style={{
            backgroundImage: "url('/images/town/banner-placeholder.jpg')",
          }}
            >
              <div className="bg-linear-to-b from-black/40 via-black/60 to-black/85 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90">
                  Town Outskirts
                </p>
                <h1 className="mt-1 font-serif text-2xl text-amber-100">
                  The camp is alive with trade and steelwork.
                </h1>
                <p className="mt-2 text-sm text-zinc-300">
                  Use the district tiles below to prepare before heading through the
                  gate.
                </p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md md:col-span-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Vitals
            </h2>
            <div className="mt-3 space-y-1 font-mono text-sm text-zinc-300">
              <p>
                Lv {character.level} · XP {character.xp}/
                {requiredXpForLevel(character.level)}
              </p>
              <p>
                HP {character.hp}/{character.maxHp}
              </p>
              <p>
                ATK {character.attack} · DEF {character.defense}
              </p>
              <p className="text-amber-200/90">Gold {character.gold}</p>
            </div>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md md:col-span-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Where you are
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {currentRegion.name}. The market, campfire, and forge only work in
              Town Outskirts. Use{" "}
              <span className="text-amber-200/80">Town</span> in the bar above
              to return when you are not in a fight.
            </p>
          </article>
            </section>

            {isTown ? (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">
                Campfire
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Free full heal on a timer between uses. Wins do not top you off.
              </p>
              <CampfireRestButton
                restAction={restAtCampfireAction}
                hp={character.hp}
                maxHp={character.maxHp}
                cooldownEndsAtMs={restCooldownEndsAtMs}
              />
            </article>
            <article className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">
                Market
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Common gear, tonics, smithing stones, and buyback — prices scale
                with danger tier and item power.
              </p>
              <Link
                href="/shop"
                className="mt-3 inline-block rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/35"
              >
                Open market
              </Link>
            </article>
            <article className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/90">
                Forge
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Stones: {smithingStoneCount} · Cost: {FORGE_UPGRADE_GOLD_COST}g
                + stones scale with each forge tier (+N costs N stones). Common,
                Uncommon, Rare, and Epic are capped; Legendary and Godly scale
                infinitely with diminishing returns.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {equipment
                  .filter((entry) => entry.item)
                  .map((entry) =>
                    (() => {
                      const currentForge = normalizeForgeLevel(
                        entry.forgeLevel,
                      );
                      const maxForge =
                        entry.item ? FORGE_MAX_BY_RARITY[entry.item.rarity] : 0;
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
                          <input type="hidden" name="slot" value={entry.slot} />
                          <button
                            type="submit"
                            disabled={forgeBlocked}
                            className="rounded-lg border border-orange-900/60 bg-orange-950/30 px-3 py-2 text-xs font-semibold text-orange-100 enabled:hover:bg-orange-900/30 disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              entry.item
                                ? currentForge >= maxForge
                                  ? `${itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)} is at max forge tier for ${entry.item.rarity.toLowerCase()}.`
                                  : `${itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)} → +${currentForge + 1} (${stonesRequired} stone${stonesRequired > 1 ? "s" : ""})`
                                : undefined
                            }
                          >
                            Forge {entry.slot}{" "}
                            <span className="text-orange-200/80">
                              (+{currentForge}→+
                              {maxForge >= Number.MAX_SAFE_INTEGER
                                ? currentForge + 1
                                : Math.min(maxForge, currentForge + 1)}{" "}
                              ·{" "}
                              {stonesRequired} stone
                              {stonesRequired > 1 ? "s" : ""})
                            </span>
                          </button>
                        </form>
                      );
                    })(),
                  )}
              </div>
            </article>
            <article className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/90">
                Trainer
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Spend stat points and inspect your class skill from the
                character sheet.
              </p>
              <a
                href="/character"
                className="mt-3 inline-block rounded-lg border border-indigo-800/60 bg-indigo-950/40 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-900/35"
              >
                Visit trainer
              </a>
            </article>
            <article className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90">
                Adventure gate
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Step out into hostile regions. Flee may fail, and bosses will
                not let you run.
              </p>
              <a
                href="/adventure"
                className="mt-3 inline-block rounded-lg border border-amber-800/60 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/35"
              >
                Go adventuring
              </a>
            </article>
              </section>
            ) : null}

            {!isTown ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-500">
                You are away from town. Open{" "}
                <strong className="text-zinc-400">Adventure</strong> to fight, or
                travel back above to use services.
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
