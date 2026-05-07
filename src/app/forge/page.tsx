import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buySmithingStoneAction,
  forgeUpgradeAction,
  consumeTonicOutsideCombatAction,
  returnToTownAction,
  returnToTownAndMarketAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { ShopGoldFxRoot, ShopTransactionForm } from "@/components/shop-gold-fx";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import {
  EQUIPMENT_SLOTS,
  FORGE_MAX_BY_RARITY,
  FORGE_UPGRADE_GOLD_COST,
  SMITHING_STONE_ITEM_KEY,
} from "@/lib/game/constants";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import {
  gearAffixBonusLine,
  gearStatSummary,
  itemDisplayName,
  normalizeForgeLevel,
} from "@/lib/game/item-display";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { recommendedShopTier, shopStoneBuyPrice } from "@/lib/game/shop";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";
import type { CharacterEquipment, Item } from "@prisma/client";

export const dynamic = "force-dynamic";

function gearForgeDisplayLine(item: Item, slot: string, forgeLevel: number): string {
  const parts = [gearStatSummary(item, slot, forgeLevel), item.speed ? `+${item.speed} SPD` : ""].filter(Boolean);
  return parts.join(" · ") || "—";
}

function storedAffix(entry: CharacterEquipment) {
  return {
    bonusLifeSteal: entry.bonusLifeSteal ?? 0,
    bonusCritChance: entry.bonusCritChance ?? 0,
    bonusSkillPower: entry.bonusSkillPower ?? 0,
    bonusStrength: entry.bonusStrength ?? 0,
    bonusConstitution: entry.bonusConstitution ?? 0,
    bonusIntelligence: entry.bonusIntelligence ?? 0,
    bonusDexterity: entry.bonusDexterity ?? 0,
  };
}

function slotTitle(slot: string): string {
  return slot.charAt(0) + slot.slice(1).toLowerCase().replace(/_/g, " ");
}

export default async function ForgePage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [townRegion, currentRegion, combatActive, regions, equipment, inventory] = await Promise.all([
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.region.findMany({ orderBy: { minLevel: "asc" } }),
    prisma.characterEquipment.findMany({
      where: { characterId: character.id },
      include: { item: true },
    }),
    prisma.inventoryItem.findMany({
      where: { characterId: character.id },
      include: { item: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  if (combatActive) redirect("/adventure");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  if (!inTownRegion || currentRegion?.key !== "town_outskirts") redirect("/town");

  const smithingStoneCount =
    inventory.find((entry) => entry.item.key === SMITHING_STONE_ITEM_KEY)?.quantity ?? 0;

  const tier = recommendedShopTier(character.level, regions);
  const stonePrice = shopStoneBuyPrice(tier);

  const bySlot = new Map(equipment.map((e) => [e.slot, e]));
  const effective = buildCharacterStats(character, equipment);

  const panelClass =
    "rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]";
  const titleClass = "text-[10px] font-bold uppercase tracking-widest text-white/80";
  const slotHeadingClass = "text-[10px] font-bold uppercase tracking-widest text-white/70";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art */}
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
          <GameTopBar characterName={character.name} characterLevel={character.level} />
          <GameNav
            inTownRegion={inTownRegion}
            combatLocked={false}
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
                combatLocked={false}
                consumeTonicAction={consumeTonicOutsideCombatAction}
              />
            </div>
          </div>
          <ShopGoldFxRoot>
            <div className="min-w-0 space-y-6">
            <section className={panelClass}>
              <p className={titleClass}>Forge</p>
              <h1 className="mt-1 font-serif text-2xl text-zinc-100">Reinforce equipped gear</h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                Each upgrade costs <span className="text-zinc-100">{FORGE_UPGRADE_GOLD_COST} gold</span> plus smithing
                stones. The stone cost equals the tier you are forging to (+1 costs 1 stone, +2 costs 2 stones, and so
                on). Common, Uncommon, Rare, and Epic pieces hit a forge cap; Legendary and Godly scale further with
                diminishing returns on their bonuses.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
                <p className="font-mono text-sm text-zinc-100">
                  🪙 {character.gold} gold · 🪨 {smithingStoneCount} smithing stone
                  {smithingStoneCount === 1 ? "" : "s"}
                </p>
                <Link
                  href="/town"
                  className="inline-block rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
                >
                  ← Town hub
                </Link>
              </div>
            </section>

            <section className={panelClass}>
              <p className={titleClass}>Smithing stones</p>
              <p className="mt-1 text-sm text-zinc-300">
                Same price as the market counter — scales with your recommended danger tier (tier {tier + 1}).
              </p>
              <ShopTransactionForm transactionAction={buySmithingStoneAction} className="mt-4">
                <button
                  type="submit"
                  disabled={character.gold < stonePrice}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  Buy smithing stone — {stonePrice}g
                </button>
              </ShopTransactionForm>
            </section>

            <section className="space-y-4">
              <h2 className={titleClass}>Pieces</h2>
              {EQUIPMENT_SLOTS.map((slot) => {
                const entry = bySlot.get(slot);
                const item = entry?.item ?? null;
                if (!entry || !item) {
                  return (
                    <article key={slot} className={`${panelClass} opacity-90`}>
                      <p className={slotHeadingClass}>{slotTitle(slot)}</p>
                      <p className="mt-2 text-sm text-zinc-500">Empty slot — equip an item here to forge it.</p>
                    </article>
                  );
                }

                const currentForge = normalizeForgeLevel(entry.forgeLevel);
                const maxForge = FORGE_MAX_BY_RARITY[item.rarity];
                const stonesRequired = currentForge + 1;
                const atMax = currentForge >= maxForge;
                const forgeBlocked =
                  atMax ||
                  smithingStoneCount < stonesRequired ||
                  character.gold < FORGE_UPGRADE_GOLD_COST;
                const canPreviewNext = !atMax;
                const nextForgeLevel = Math.min(currentForge + 1, maxForge);
                const affixStored = storedAffix(entry);
                const affixNowLine = gearAffixBonusLine(item.rarity, currentForge, affixStored);
                const affixAfterForgeLevel = canPreviewNext ? currentForge + 1 : currentForge;
                const affixAfterLine = gearAffixBonusLine(item.rarity, affixAfterForgeLevel, affixStored);

                let disabledReason: string | undefined;
                if (atMax) {
                  disabledReason = `${itemDisplayName(item, entry.forgeLevel, entry.affixPrefix)} is at max forge tier for ${item.rarity.toLowerCase()} gear.`;
                } else if (character.gold < FORGE_UPGRADE_GOLD_COST) {
                  disabledReason = `Need ${FORGE_UPGRADE_GOLD_COST} gold per forge.`;
                } else if (smithingStoneCount < stonesRequired) {
                  disabledReason = `Need ${stonesRequired} smithing stone${stonesRequired > 1 ? "s" : ""} for +${nextForgeLevel}.`;
                }

                return (
                  <article key={slot} className={panelClass}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={slotHeadingClass}>{slotTitle(slot)}</p>
                      <span className={`text-sm font-semibold ${rarityNameClass(item.rarity)}`}>
                        {itemDisplayName(item, entry.forgeLevel, entry.affixPrefix)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-white/15 bg-black/45 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Now</p>
                        <p className="mt-1 font-mono text-xs text-zinc-200">{gearForgeDisplayLine(item, slot, currentForge)}</p>
                        {affixNowLine ? (
                          <p className="mt-1 font-mono text-[11px] leading-snug wrap-break-word text-zinc-400">{affixNowLine}</p>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-white/15 bg-black/45 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          After +{nextForgeLevel}
                          {!canPreviewNext ? " (max)" : ""}
                        </p>
                        <p className="mt-1 font-mono text-xs text-zinc-200">
                          {canPreviewNext
                            ? gearForgeDisplayLine(item, slot, currentForge + 1)
                            : gearForgeDisplayLine(item, slot, currentForge)}
                        </p>
                        {affixAfterLine ? (
                          <p className="mt-1 font-mono text-[11px] leading-snug wrap-break-word text-zinc-400">{affixAfterLine}</p>
                        ) : null}
                      </div>
                    </div>
                    <form action={forgeUpgradeAction} className="mt-4">
                      <input type="hidden" name="slot" value={slot} />
                      <button
                        type="submit"
                        disabled={forgeBlocked}
                        title={disabledReason}
                        className="w-full rounded-lg border border-white/20 bg-black/55 px-4 py-2.5 text-sm font-semibold text-zinc-100 enabled:hover:border-white/35 enabled:hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                      >
                        {atMax
                          ? `Max forge (+${currentForge}) for ${item.rarity.toLowerCase()}`
                          : `Forge (+${currentForge} → +${currentForge + 1} · ${stonesRequired} stone${
                              stonesRequired > 1 ? "s" : ""
                            } · ${FORGE_UPGRADE_GOLD_COST}g)`}
                      </button>
                    </form>
                  </article>
                );
              })}
            </section>
            </div>
          </ShopGoldFxRoot>
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
              combatLocked={false}
              consumeTonicAction={consumeTonicOutsideCombatAction}
            />
          }
          chatPanel={<WorldChatPanel compact username={character.name} userId={user.id} />}
        />
      </main>
    </div>
  );
}
