import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createMarketListingAction,
  buyMarketListingAction,
  cancelMarketListingAction,
} from "@/app/actions/market";
import {
  consumeTonicOutsideCombatAction,
  returnToTownAction,
  returnToTownAndMarketAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AchievementToastPostActionDrain } from "@/components/achievement-toast-post-action-drain";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { formatItemStatRequirements } from "@/lib/game/item-requirements";
import { gearStatSummary, itemDisplayName } from "@/lib/game/item-display";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { ItemHoverCard } from "@/components/item-hover-card";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { ShopGoldFxRoot, ShopTransactionForm } from "@/components/shop-gold-fx";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";
import type { ItemSlot, Prisma, Rarity } from "@prisma/client";

export const dynamic = "force-dynamic";

const SLOT_FILTERS = ["ALL", "WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET", "CONSUMABLE"] as const;
const RARITY_FILTERS = ["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"] as const;
const SORT_FILTERS = ["newest", "price_asc", "price_desc"] as const;

const MAX_PRICE_INPUT = 1_000_000_000;
const MAX_SEARCH_LEN = 80;

type MarketSearch = Record<string, string | string[] | undefined>;

function pickFilter<T extends readonly string[]>(value: string | undefined, choices: T, fallback: T[number]): T[number] {
  return choices.includes((value ?? fallback) as T[number]) ? ((value ?? fallback) as T[number]) : fallback;
}

function getSearchParam(sp: MarketSearch, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

function parseOptionalUint(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, MAX_PRICE_INPUT);
}

function clampSearchQuery(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  if (s.length <= MAX_SEARCH_LEN) return s;
  return s.slice(0, MAX_SEARCH_LEN);
}

function buildBrowseQuery(state: {
  page?: number;
  slot: string;
  rarity: string;
  sort: string;
  q: string;
  minPrice?: number;
  maxPrice?: number;
}): string {
  const p = new URLSearchParams();
  if (state.page != null && state.page > 1) p.set("page", String(state.page));
  if (state.slot !== "ALL") p.set("slot", state.slot);
  if (state.rarity !== "ALL") p.set("rarity", state.rarity);
  if (state.sort !== "newest") p.set("sort", state.sort);
  if (state.q.length > 0) p.set("q", state.q);
  if (state.minPrice !== undefined) p.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) p.set("maxPrice", String(state.maxPrice));
  const s = p.toString();
  return s ? `?${s}` : "";
}

function marketListingBrowseWhere(params: {
  slot: string;
  rarity: string;
  q: string;
  minPrice?: number;
  maxPrice?: number;
}): Prisma.MarketListingWhereInput {
  const itemWhere: Prisma.ItemWhereInput = {};
  if (params.slot !== "ALL") itemWhere.slot = params.slot as ItemSlot;
  if (params.rarity !== "ALL") itemWhere.rarity = params.rarity as Rarity;
  if (params.q.length > 0) {
    itemWhere.name = { contains: params.q, mode: "insensitive" };
  }

  const priceWhere: Prisma.IntFilter = {};
  let minP = params.minPrice;
  let maxP = params.maxPrice;
  if (minP !== undefined && maxP !== undefined && minP > maxP) {
    const t = minP;
    minP = maxP;
    maxP = t;
  }
  if (minP !== undefined) priceWhere.gte = minP;
  if (maxP !== undefined) priceWhere.lte = maxP;

  const where: Prisma.MarketListingWhereInput = {};
  if (Object.keys(itemWhere).length > 0) where.item = itemWhere;
  if (Object.keys(priceWhere).length > 0) where.priceGold = priceWhere;
  return where;
}

function marketListingOrderBy(sort: string): Prisma.MarketListingOrderByWithRelationInput {
  if (sort === "price_asc") return { priceGold: "asc" };
  if (sort === "price_desc") return { priceGold: "desc" };
  return { createdAt: "desc" };
}

function prettyFilterLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type MarketListingBrowseRow = Prisma.MarketListingGetPayload<{
  include: { item: true; sellerCharacter: { select: { id: true; name: true } } };
}>;

type MarketListingMineRow = Prisma.MarketListingGetPayload<{ include: { item: true } }>;

const LISTINGS_PAGE_SIZE = 12;

export default async function MarketPage({
  searchParams,
}: {
  searchParams?: Promise<MarketSearch> | MarketSearch;
}) {
  const sp: MarketSearch =
    searchParams === undefined ? {} : await Promise.resolve(searchParams as Promise<MarketSearch> | MarketSearch);

  const rawTab = typeof sp.tab === "string" ? sp.tab : Array.isArray(sp.tab) ? sp.tab[0] : undefined;
  const tab = rawTab === "my" || rawTab === "create" ? rawTab : "browse";

  const pageRaw = typeof sp.page === "string" ? sp.page : Array.isArray(sp.page) ? sp.page[0] : "1";
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);

  const filterSlot = pickFilter(getSearchParam(sp, "slot"), SLOT_FILTERS, "ALL");
  const filterRarity = pickFilter(getSearchParam(sp, "rarity"), RARITY_FILTERS, "ALL");
  const filterSort = pickFilter(getSearchParam(sp, "sort"), SORT_FILTERS, "newest");
  const filterQ = clampSearchQuery(getSearchParam(sp, "q"));
  const filterMin = parseOptionalUint(getSearchParam(sp, "minPrice"));
  const filterMax = parseOptionalUint(getSearchParam(sp, "maxPrice"));

  const browseWhere = marketListingBrowseWhere({
    slot: filterSlot,
    rarity: filterRarity,
    q: filterQ,
    minPrice: filterMin,
    maxPrice: filterMax,
  });
  const browseOrder = marketListingOrderBy(filterSort);

  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [townRegion, currentRegion, combatActive, equipment, inventory] = await Promise.all([
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
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
  if (!inTownRegion) redirect("/town");

  const effective = buildCharacterStats(character, equipment);

  const skip = (page - 1) * LISTINGS_PAGE_SIZE;

  let browseTotal = 0;
  let browseRows: MarketListingBrowseRow[] = [];
  let myRows: MarketListingMineRow[] = [];

  if (tab === "browse") {
    [browseTotal, browseRows] = await Promise.all([
      prisma.marketListing.count({ where: browseWhere }),
      prisma.marketListing.findMany({
        where: browseWhere,
        include: {
          item: true,
          sellerCharacter: { select: { id: true, name: true } },
        },
        orderBy: browseOrder,
        skip,
        take: LISTINGS_PAGE_SIZE,
      }),
    ]);
  } else if (tab === "my") {
    myRows = await prisma.marketListing.findMany({
      where: { sellerCharacterId: character.id },
      include: { item: true },
      orderBy: { createdAt: "desc" },
    });
  }

  const totalPages = Math.max(1, Math.ceil(browseTotal / LISTINGS_PAGE_SIZE));

  const browseFilterState = {
    slot: filterSlot,
    rarity: filterRarity,
    sort: filterSort,
    q: filterQ,
    minPrice: filterMin,
    maxPrice: filterMax,
  };

  const panelClass =
    "rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5 backdrop-blur-[1px]";
  const titleClass = "text-[10px] font-bold uppercase tracking-widest text-white/80";
  const subtleClass = "mt-1 text-sm text-zinc-200";
  const tabLink = (t: "browse" | "my" | "create", label: string) => {
    const href =
      t === "browse"
        ? `/market${buildBrowseQuery({ page: 1, ...browseFilterState })}`
        : t === "my"
          ? "/market?tab=my"
          : "/market?tab=create";
    const active = tab === t;
    return (
      <Link
        href={href}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
          active ? "border-amber-400/70 bg-amber-950/35 text-amber-50" : "border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10"
        }`}
      >
        {label}
      </Link>
    );
  };

  const browsePrevHref = `/market${buildBrowseQuery({ page: page - 1, ...browseFilterState })}`;
  const browseNextHref = `/market${buildBrowseQuery({ page: page + 1, ...browseFilterState })}`;

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
          <AchievementToastPostActionDrain revision={character.updatedAt.toISOString()} />
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
            <div className="min-w-0 space-y-4">
              <p className="text-sm text-zinc-300">
                <Link href="/town" className="font-semibold text-amber-200/90 underline-offset-2 hover:underline">
                  Back to town
                </Link>
                <span className="text-zinc-500"> · </span>
                <Link href="/shop" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                  NPC shop
                </Link>
              </p>

              <section className={panelClass}>
                <h2 className={titleClass}>Global market</h2>
                <p className={subtleClass}>Buy and sell items with other players. Listed stacks leave your pack until sold or cancelled.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tabLink("browse", "Browse")}
                  {tabLink("my", "My listings")}
                  {tabLink("create", "Create listing")}
                </div>
              </section>

              {tab === "browse" ? (
                <section className={panelClass}>
                  <h3 className={titleClass}>Active listings</h3>
                  <form method="get" action="/market" className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800/80 bg-black/25 p-3">
                    <label className="min-w-[min(100%,14rem)] flex-1 text-[11px] text-zinc-500">
                      Search name
                      <input
                        type="search"
                        name="q"
                        defaultValue={filterQ}
                        placeholder="Contains…"
                        maxLength={MAX_SEARCH_LEN}
                        className="mt-1 block w-full rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
                      />
                    </label>
                    <label className="text-[11px] text-zinc-500">
                      Type
                      <select
                        name="slot"
                        defaultValue={filterSlot}
                        className="mt-1 block rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
                      >
                        {SLOT_FILTERS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === "ALL" ? "All types" : prettyFilterLabel(opt)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] text-zinc-500">
                      Rarity
                      <select
                        name="rarity"
                        defaultValue={filterRarity}
                        className="mt-1 block rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
                      >
                        {RARITY_FILTERS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === "ALL" ? "All rarities" : prettyFilterLabel(opt)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] text-zinc-500">
                      Sort
                      <select
                        name="sort"
                        defaultValue={filterSort}
                        className="mt-1 block rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
                      >
                        <option value="newest">Newest</option>
                        <option value="price_asc">Price ↑</option>
                        <option value="price_desc">Price ↓</option>
                      </select>
                    </label>
                    <label className="text-[11px] text-zinc-500">
                      Min gold
                      <input
                        type="number"
                        name="minPrice"
                        min={0}
                        max={MAX_PRICE_INPUT}
                        defaultValue={filterMin ?? ""}
                        placeholder="Any"
                        className="mt-1 block w-24 rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
                      />
                    </label>
                    <label className="text-[11px] text-zinc-500">
                      Max gold
                      <input
                        type="number"
                        name="maxPrice"
                        min={0}
                        max={MAX_PRICE_INPUT}
                        defaultValue={filterMax ?? ""}
                        placeholder="Any"
                        className="mt-1 block w-24 rounded-lg border border-white/20 bg-black/55 px-2 py-1.5 text-xs text-zinc-100"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-400/45 bg-amber-950/35 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-950/55"
                    >
                      Apply
                    </button>
                    <Link
                      href="/market"
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10"
                    >
                      Clear
                    </Link>
                  </form>
                  <p className={subtleClass}>
                    Page {page} of {totalPages} ({browseTotal} listing{browseTotal === 1 ? "" : "s"}).
                  </p>
                  {browseRows.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-400">
                      {browseTotal === 0 ? "Nothing listed yet." : "No listings match these filters."}
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {browseRows.map((row) => {
                        const stats =
                          row.item.slot !== "CONSUMABLE"
                            ? gearStatSummary(row.item, row.item.slot, row.forgeLevel)
                            : row.item.name;
                        const reqLine = formatItemStatRequirements(row.item);
                        const own = row.sellerCharacter.id === character.id;
                        return (
                          <li
                            key={row.id}
                            className="flex flex-col gap-2 rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div>
                                <ItemHoverCard
                                  item={row.item}
                                  forgeLevel={row.forgeLevel}
                                  affixPrefix={row.affixPrefix}
                                  bonusLifeSteal={row.bonusLifeSteal}
                                  bonusCritChance={row.bonusCritChance}
                                  bonusSkillPower={row.bonusSkillPower}
                                  bonusStrength={row.bonusStrength}
                                  bonusConstitution={row.bonusConstitution}
                                  bonusIntelligence={row.bonusIntelligence}
                                  bonusDexterity={row.bonusDexterity}
                                >
                                  <span className={`font-medium ${rarityNameClass(row.item.rarity)}`}>
                                    {row.item.emoji} {itemDisplayName(row.item, row.forgeLevel, row.affixPrefix)}
                                  </span>
                                </ItemHoverCard>
                                <span className="text-zinc-500"> ×{row.quantity}</span>
                              </div>
                              <div className="truncate text-xs text-zinc-400">{stats}</div>
                              {reqLine ? <div className="text-[11px] text-zinc-500">Req: {reqLine}</div> : null}
                              <div className="text-xs text-zinc-500">
                                Seller:{" "}
                                <Link
                                  href={`/player/${encodeURIComponent(row.sellerCharacter.name)}`}
                                  className="font-medium text-amber-200/90 underline-offset-2 hover:text-amber-100 hover:underline"
                                >
                                  {own ? "You" : row.sellerCharacter.name}
                                </Link>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <span className="font-black tabular-nums text-amber-200">{row.priceGold.toLocaleString()} gold</span>
                              {own ? (
                                <span className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400">Your listing</span>
                              ) : (
                                <ShopTransactionForm transactionAction={buyMarketListingAction} className="inline">
                                  <input type="hidden" name="listingId" value={row.id} />
                                  <button
                                    type="submit"
                                    className="rounded-lg border border-amber-400/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-950/60"
                                  >
                                    Buy
                                  </button>
                                </ShopTransactionForm>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    {page > 1 ? (
                      <Link href={browsePrevHref} className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/10">
                        Previous
                      </Link>
                    ) : null}
                    {page < totalPages ? (
                      <Link href={browseNextHref} className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/10">
                        Next
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {tab === "my" ? (
                <section className={panelClass}>
                  <h3 className={titleClass}>My listings</h3>
                  <p className={subtleClass}>Cancel anytime — items return to your pack.</p>
                  {myRows.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-400">You have no active listings.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {myRows.map((row) => {
                        const stats =
                          row.item.slot !== "CONSUMABLE"
                            ? gearStatSummary(row.item, row.item.slot, row.forgeLevel)
                            : row.item.name;
                        const reqLine = formatItemStatRequirements(row.item);
                        return (
                          <li
                            key={row.id}
                            className="flex flex-col gap-2 rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div>
                                <ItemHoverCard
                                  item={row.item}
                                  forgeLevel={row.forgeLevel}
                                  affixPrefix={row.affixPrefix}
                                  bonusLifeSteal={row.bonusLifeSteal}
                                  bonusCritChance={row.bonusCritChance}
                                  bonusSkillPower={row.bonusSkillPower}
                                  bonusStrength={row.bonusStrength}
                                  bonusConstitution={row.bonusConstitution}
                                  bonusIntelligence={row.bonusIntelligence}
                                  bonusDexterity={row.bonusDexterity}
                                >
                                  <span className={`font-medium ${rarityNameClass(row.item.rarity)}`}>
                                    {row.item.emoji} {itemDisplayName(row.item, row.forgeLevel, row.affixPrefix)}
                                  </span>
                                </ItemHoverCard>
                                <span className="text-zinc-500"> ×{row.quantity}</span>
                              </div>
                              <div className="truncate text-xs text-zinc-400">{stats}</div>
                              {reqLine ? <div className="text-[11px] text-zinc-500">Req: {reqLine}</div> : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-black tabular-nums text-amber-200">{row.priceGold.toLocaleString()} gold</span>
                              <ShopTransactionForm transactionAction={cancelMarketListingAction} className="inline">
                                <input type="hidden" name="listingId" value={row.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-zinc-500 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                                >
                                  Cancel
                                </button>
                              </ShopTransactionForm>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ) : null}

              {tab === "create" ? (
                <section className={panelClass}>
                  <h3 className={titleClass}>Create listing</h3>
                  <p className={subtleClass}>Choose a pack stack, price in gold, and how many units to list (defaults to the full stack).</p>
                  {inventory.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-400">Your pack is empty.</p>
                  ) : (
                    <ShopTransactionForm transactionAction={createMarketListingAction} className="mt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Item stack</label>
                        <select
                          name="inventoryEntryId"
                          required
                          className="mt-1 w-full max-w-lg rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-zinc-100"
                        >
                          {inventory.map((inv) => {
                            const title = itemDisplayName(inv.item, inv.forgeLevel, inv.affixPrefix);
                            return (
                              <option key={inv.id} value={inv.id}>
                                {title} ×{inv.quantity}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Price (gold)</label>
                          <input
                            name="priceGold"
                            type="number"
                            min={1}
                            max={1_000_000_000}
                            required
                            className="mt-1 w-40 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Quantity</label>
                          <input
                            name="quantity"
                            type="number"
                            min={1}
                            placeholder="Full stack"
                            className="mt-1 w-40 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-zinc-100"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="rounded-lg border border-amber-400/50 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-950/60"
                      >
                        List for sale
                      </button>
                    </ShopTransactionForm>
                  )}
                </section>
              ) : null}
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
