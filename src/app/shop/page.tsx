import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buyPotionAction,
  consumeTonicOutsideCombatAction,
  buyShopEquipmentAction,
  buySmithingStoneAction,
  returnToTownAction,
  returnToTownAndShopAction,
  sellItemAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { HEALTH_POTION_ITEM_KEY, MAX_POTIONS_IN_PACK } from "@/lib/game/constants";
import { formatItemStatRequirements } from "@/lib/game/item-requirements";
import { gearStatSummary, itemDisplayName } from "@/lib/game/item-display";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import {
  filterShopEquipmentForTier,
  recommendedShopTier,
  shopBuyPriceForItem,
  shopPlaystyleFromKey,
  shopPotionBuyPrice,
  shopPurchaseBlockReason,
  shopStatTagsFromItem,
  shopStoneBuyPrice,
  sortShopEquipment,
  type ShopPlaystyle,
  type ShopGearClientRow,
} from "@/lib/game/shop";
import { ItemHoverCard } from "@/components/item-hover-card";
import { ShopGearList } from "@/components/shop-gear-list";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { ItemTooltipFields } from "@/lib/game/item-tooltip-text";
import { buildCharacterStats } from "@/lib/game/stats";
import { WorldChatPanel } from "@/components/world-chat-panel";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [townRegion, currentRegion, combatActive, regions, commonGear, equipment] = await Promise.all([
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.region.findMany({ orderBy: { minLevel: "asc" } }),
    prisma.item.findMany({
      where: { rarity: "COMMON", slot: { not: "CONSUMABLE" } },
    }),
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  if (combatActive) redirect("/adventure");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  if (!inTownRegion) redirect("/");

  const tier = recommendedShopTier(character.level, regions);
  const recommendedRegion = regions[tier] ?? regions[0];
  const tierItems = filterShopEquipmentForTier(commonGear, tier).sort(sortShopEquipment);

  const gearRows: ShopGearClientRow[] = tierItems.map((item) => {
    const price = shopBuyPriceForItem(item);
    const statLine =
      [gearStatSummary(item, item.slot, 0), item.speed ? `+${item.speed} SPD` : ""].filter(Boolean).join(" · ") || "—";
    return {
      item,
      price,
      purchaseBlock: shopPurchaseBlockReason(character, item, price),
      statLine,
      reqLine: formatItemStatRequirements(item),
      playstyle: shopPlaystyleFromKey(item.key),
      statTags: shopStatTagsFromItem(item),
    };
  });

  const tonicPrice = shopPotionBuyPrice(tier);
  const stonePrice = shopStoneBuyPrice(tier);

  const inventory = await prisma.inventoryItem.findMany({
    where: { characterId: character.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });
  const tonicCount = inventory.find((e) => e.item.key === HEALTH_POTION_ITEM_KEY)?.quantity ?? 0;
  const tonicFull = tonicCount >= MAX_POTIONS_IN_PACK;

  const equippedItemIds = new Set(equipment.map((e) => e.itemId).filter((id): id is string => !!id));
  const equippedBySlot: Partial<
    Record<
      string,
      {
        item: ItemTooltipFields;
        forgeLevel: number | null;
        affixPrefix: string | null;
        bonusLifeSteal: number;
        bonusCritChance: number;
        bonusSkillPower: number;
        bonusStrength: number;
        bonusConstitution: number;
        bonusIntelligence: number;
        bonusDexterity: number;
      }
    >
  > = {};
  for (const row of equipment) {
    if (!row.item) continue;
    equippedBySlot[row.slot] = {
      item: row.item,
      forgeLevel: row.forgeLevel,
      affixPrefix: row.affixPrefix,
      bonusLifeSteal: row.bonusLifeSteal,
      bonusCritChance: row.bonusCritChance,
      bonusSkillPower: row.bonusSkillPower,
      bonusStrength: row.bonusStrength,
      bonusConstitution: row.bonusConstitution,
      bonusIntelligence: row.bonusIntelligence,
      bonusDexterity: row.bonusDexterity,
    };
  }
  const sellableInventory = inventory.filter((inv) => inv.item.sellPrice >= 1 && !equippedItemIds.has(inv.itemId));
  const effective = buildCharacterStats(character, equipment);
  const classDefaultFilter: ShopPlaystyle =
    character.class === "WARRIOR" ? "WARRIOR" : character.class === "MAGE" ? "MAGE" : "ROGUE";
  const marketPanelClass =
    "rounded-2xl border border-amber-900/40 bg-zinc-950/20 bg-linear-to-b from-black/45 via-black/65 to-black/88 p-5 backdrop-blur-[1px]";
  const marketTitleClass = "text-[10px] font-bold uppercase tracking-widest text-amber-500/90";
  const marketSubtleTextClass = "mt-1 text-sm text-zinc-300";
  const marketButtonClass =
    "rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/35";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      {/* Shop only: banner fades into page bg; md+ shows full art; mobile uses min-height + cover for more vertical presence */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0"
      >
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art; md+ intrinsic sizing shows full frame */}
          <img
            src="/images/shopbanner.png"
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
          <GameTopBar username={user.username} characterName={character.name} characterClass={character.class} />
          <GameNav
            inTownRegion={inTownRegion}
            combatLocked={false}
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
                combatLocked={false}
                consumeTonicAction={consumeTonicOutsideCombatAction}
              />
            </div>
          </div>
          <div className="min-w-0 space-y-6">
            <header className={marketPanelClass}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/90">Town market</p>
          <h1 className="mt-1 font-serif text-2xl text-amber-100">Travelers&apos; stock by league and region</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Full <span className="text-amber-200/90">common</span> catalog for your recommended region by level (today:{" "}
            <strong className="text-zinc-200">{recommendedRegion.name}</strong>, Lv {recommendedRegion.minLevel}+). Every
            kit and slot is listed; buy stays locked until you meet level, stats, and gold. Apothecary prices tick up with
            tier.
          </p>
          <p className="mt-2 font-mono text-sm text-amber-200/90">Your gold: {character.gold}</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
          >
            ← Town hub
          </Link>
            </header>

            <section className={marketPanelClass}>
              <h2 className={marketTitleClass}>Front counter</h2>
              <p className={marketSubtleTextClass}>
                Quick consumables and crafting stock. Prices scale by your recommended tier.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-amber-900/40 bg-zinc-950/35 p-3">
                  <p className={marketTitleClass}>🧪 Crimson tonic</p>
                  <p className="mt-1 text-xs text-zinc-300">
                    Fast out-of-combat heal. Carry cap: {MAX_POTIONS_IN_PACK}.
                  </p>
                  <form action={buyPotionAction} className="mt-3">
                    <button
                      type="submit"
                      disabled={character.gold < tonicPrice || tonicFull}
                      title={tonicFull ? `Pack holds at most ${MAX_POTIONS_IN_PACK} tonics.` : undefined}
                      className="w-full rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2.5 text-sm font-semibold text-amber-100 enabled:hover:bg-amber-900/35 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Buy tonic — {tonicPrice}g ({tonicCount}/{MAX_POTIONS_IN_PACK})
                    </button>
                  </form>
                </div>
                <div className="rounded-lg border border-amber-900/40 bg-zinc-950/35 p-3">
                  <p className={marketTitleClass}>🪨 Smithing stone</p>
                  <p className="mt-1 text-xs text-zinc-300">Used at the forge to reinforce equipped gear tiers.</p>
                  <form action={buySmithingStoneAction} className="mt-3">
                    <button
                      type="submit"
                      disabled={character.gold < stonePrice}
                      className="w-full rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2.5 text-sm font-semibold text-amber-100 enabled:hover:bg-amber-900/35 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Buy smithing stone — {stonePrice}g
                    </button>
                  </form>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
              <article className={`${marketPanelClass} xl:h-176 xl:overflow-y-auto xl:pr-3`}>
                <h2 className={marketTitleClass}>Buy gear — {recommendedRegion.name}</h2>
                <p className={marketSubtleTextClass}>
                  Prices scale with stats and requirements. Hover names for full details.
                </p>
                {gearRows.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-300">No common stock is defined for this tier in the database.</p>
                ) : (
                  <div className="mt-4">
                    <ShopGearList
                      rows={gearRows}
                      buyAction={buyShopEquipmentAction}
                      equippedBySlot={equippedBySlot}
                      defaultPlaystyle={classDefaultFilter}
                    />
                  </div>
                )}
              </article>

              <article className={`flex flex-col ${marketPanelClass} xl:min-h-0 xl:h-176`}>
                <h2 className={marketTitleClass}>Sell gear</h2>
                <p className={marketSubtleTextClass}>
                  Sell spare pack items quickly. Equipped gear must be unequipped first.
                </p>
                <div className="mt-3 space-y-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                  {sellableInventory.length ? (
                    sellableInventory.map((entry) => {
                      const equippedSameSlot = equippedBySlot[entry.item.slot] ?? null;
                      const compareAgainst = equippedSameSlot
                        ? {
                            ...equippedSameSlot,
                            forgeLevel: equippedSameSlot.forgeLevel ?? undefined,
                          }
                        : null;
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-900/35 bg-zinc-950/35 px-3 py-2 text-sm"
                        >
                          <span>
                            <ItemHoverCard
                              item={entry.item}
                              forgeLevel={entry.forgeLevel}
                              affixPrefix={entry.affixPrefix}
                              bonusLifeSteal={entry.bonusLifeSteal}
                              bonusCritChance={entry.bonusCritChance}
                              bonusSkillPower={entry.bonusSkillPower}
                              bonusStrength={entry.bonusStrength}
                              bonusConstitution={entry.bonusConstitution}
                              bonusIntelligence={entry.bonusIntelligence}
                              bonusDexterity={entry.bonusDexterity}
                              compareAgainst={compareAgainst}
                            >
                              <span className={`font-medium ${rarityNameClass(entry.item.rarity)}`}>
                                {entry.item.emoji} {itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)}
                              </span>
                            </ItemHoverCard>
                            <span className="text-zinc-300"> ×{entry.quantity}</span>
                            <span className="ml-2 font-mono text-xs text-amber-200/80">{entry.item.sellPrice}g each</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <form action={sellItemAction}>
                              <input type="hidden" name="itemId" value={entry.item.id} />
                              <input type="hidden" name="amount" value="ONE" />
                              <button type="submit" className={marketButtonClass}>
                                Sell x1
                              </button>
                            </form>
                            <form action={sellItemAction}>
                              <input type="hidden" name="itemId" value={entry.item.id} />
                              <input type="hidden" name="amount" value="ALL" />
                              <button type="submit" className={marketButtonClass}>
                                Sell all
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-zinc-300">Nothing to sell right now (or everything is equipped).</p>
                  )}
                </div>
              </article>
            </section>
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
              combatLocked={false}
              consumeTonicAction={consumeTonicOutsideCombatAction}
            />
          }
          chatPanel={<WorldChatPanel compact />}
        />
      </main>
    </div>
  );
}
