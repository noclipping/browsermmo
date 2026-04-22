import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buyPotionAction,
  consumeTonicOutsideCombatAction,
  buyShopEquipmentAction,
  buySmithingStoneAction,
  returnToTownAction,
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

  return (
    <div className="min-h-screen bg-[#0c0a09] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(20,83,45,0.2),transparent)]">
      <main className="w-full space-y-6 px-4 py-8 pb-16 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <GameTopBar username={user.username} characterName={character.name} characterClass={character.class} />
          <GameNav inTownRegion={inTownRegion} combatLocked={false} returnToTownAction={returnToTownAction} />
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
            <header className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/90">Town market</p>
          <h1 className="mt-1 font-serif text-2xl text-emerald-50">Travelers&apos; stock by league and region</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Full <span className="text-emerald-200/90">common</span> catalog for your recommended region by level (today:{" "}
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

            <section className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/95">Apothecary (front counter)</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tonics are your fast heal item. Price scales with your level tier (current tonic: {tonicPrice}g). Carry cap:{" "}
            {MAX_POTIONS_IN_PACK}.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <form action={buyPotionAction}>
              <button
                type="submit"
                disabled={character.gold < tonicPrice || tonicFull}
                title={tonicFull ? `Pack holds at most ${MAX_POTIONS_IN_PACK} tonics.` : undefined}
                className="w-full rounded-lg border border-emerald-700/70 bg-emerald-900/40 px-4 py-3 text-sm font-bold text-emerald-50 enabled:hover:bg-emerald-800/45 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Buy tonic now - {tonicPrice}g ({tonicCount}/{MAX_POTIONS_IN_PACK})
              </button>
            </form>
            <p className="text-right font-mono text-xs text-emerald-200/85">Tier {tier + 1} pricing active</p>
          </div>
          <div className="mt-3 border-t border-emerald-900/30 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/85">Smithing</p>
            <p className="mt-1 text-xs text-zinc-500">Smithing stones also scale by level tier (current: {stonePrice}g).</p>
            <form action={buySmithingStoneAction}>
              <button
                type="submit"
                disabled={character.gold < stonePrice}
                className="mt-2 rounded-lg border border-violet-800/60 bg-violet-950/30 px-4 py-2 text-sm font-semibold text-violet-100 enabled:hover:bg-violet-900/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Buy smithing stone — {stonePrice}g
              </button>
            </form>
          </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Common gear — {recommendedRegion.name}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Buy price scales with stats and requirements. Use filters to focus a kit or stat gate; hover a name for full
            stats.
          </p>
          {gearRows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No common stock is defined for this tier in the database.</p>
          ) : (
            <div className="mt-4">
              <ShopGearList rows={gearRows} buyAction={buyShopEquipmentAction} equippedBySlot={equippedBySlot} />
            </div>
          )}
            </section>

            <section className="rounded-xl border border-amber-900/35 bg-amber-950/10 px-5 py-4 shadow-md">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-600/90">Buyback</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Sell spare gear from your pack (hover for stats and price). Worn items must be unequipped first.
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {sellableInventory.length ? (
              sellableInventory.map((entry) => (
                (() => {
                  const equippedSameSlot = equippedBySlot[entry.item.slot] ?? null;
                  const compareAgainst =
                    equippedSameSlot && equippedSameSlot.item.id !== entry.item.id
                      ? equippedSameSlot
                      : null;
                  return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-sm"
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
                    <span className="text-zinc-500"> ×{entry.quantity}</span>
                    <span className="ml-2 font-mono text-xs text-amber-200/80">{entry.item.sellPrice}g each</span>
                  </span>
                  <form action={sellItemAction}>
                    <input type="hidden" name="itemId" value={entry.item.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                    >
                      Sell one
                    </button>
                  </form>
                </div>
                  );
                })()
              ))
            ) : (
              <p className="text-sm text-zinc-500">Nothing to sell right now (or everything is equipped).</p>
            )}
          </div>
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
