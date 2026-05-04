import Link from "next/link";
import { redirect } from "next/navigation";
import { postGuildChatMessageAction } from "@/app/actions/guild";
import { depositGuildTreasuryAction, withdrawGuildTreasuryAction } from "@/app/actions/guild-treasury";
import { consumeTonicOutsideCombatAction, returnToTownAction, returnToTownAndShopAction } from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { ItemHoverCard } from "@/components/item-hover-card";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { TreasuryFilters } from "@/components/treasury-filters";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { asFormVoid } from "@/lib/as-form-void";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { itemDisplayName } from "@/lib/game/item-display";
import { canWithdrawFromTreasury } from "@/lib/game/guild-rank";
import { rarityBadgeClass } from "@/lib/game/item-rarity-styles";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SLOT_FILTERS = ["ALL", "WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET", "CONSUMABLE"] as const;
const RARITY_FILTERS = ["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"] as const;
const CLASS_FILTERS = ["ALL", "WARRIOR", "MAGE", "ROGUE"] as const;

type TreasuryPageProps = {
  searchParams?: Promise<{
    tSlot?: string;
    tRarity?: string;
    tClass?: string;
    iSlot?: string;
    iRarity?: string;
    iClass?: string;
  }>;
};

function pickFilter<T extends readonly string[]>(value: string | undefined, choices: T, fallback: T[number]): T[number] {
  return choices.includes((value ?? fallback) as T[number]) ? ((value ?? fallback) as T[number]) : fallback;
}

function itemClassType(item: {
  requiredStrength: number;
  requiredIntelligence: number;
  requiredDexterity: number;
}): "WARRIOR" | "MAGE" | "ROGUE" {
  const str = item.requiredStrength ?? 0;
  const intl = item.requiredIntelligence ?? 0;
  const dex = item.requiredDexterity ?? 0;
  if (intl >= dex && intl >= str && intl > 0) return "MAGE";
  if (dex >= intl && dex >= str && dex > 0) return "ROGUE";
  return "WARRIOR";
}

export default async function GuildTreasuryPage({ searchParams }: TreasuryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, inventory, currentRegion, townRegion, combatActive, membership] = await Promise.all([
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.guildMember.findUnique({
      where: { userId: user.id },
      include: { guild: { select: { id: true, emoji: true, name: true } } },
    }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  if (!membership) redirect("/guild");

  const treasuryItems = await prisma.guildTreasuryItem.findMany({
    where: { guildId: membership.guildId },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });
  const guildChatMessages = await prisma.guildChatMessage.findMany({
    where: { guildId: membership.guildId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const effective = buildCharacterStats(character, equipment);
  const canWithdraw = canWithdrawFromTreasury(membership.role);
  const treasurySlot = pickFilter(params?.tSlot, SLOT_FILTERS, "ALL");
  const treasuryRarity = pickFilter(params?.tRarity, RARITY_FILTERS, "ALL");
  const treasuryClass = pickFilter(params?.tClass, CLASS_FILTERS, "ALL");
  const inventorySlot = pickFilter(params?.iSlot, SLOT_FILTERS, "ALL");
  const inventoryRarity = pickFilter(params?.iRarity, RARITY_FILTERS, "ALL");
  const inventoryClass = pickFilter(params?.iClass, CLASS_FILTERS, "ALL");
  const filteredTreasury = treasuryItems.filter((row) => {
    if (treasurySlot !== "ALL" && row.item.slot !== treasurySlot) return false;
    if (treasuryRarity !== "ALL" && row.item.rarity !== treasuryRarity) return false;
    if (treasuryClass !== "ALL" && itemClassType(row.item) !== treasuryClass) return false;
    return true;
  });
  const filteredInventory = inventory.filter((row) => {
    if (inventorySlot !== "ALL" && row.item.slot !== inventorySlot) return false;
    if (inventoryRarity !== "ALL" && row.item.rarity !== inventoryRarity) return false;
    if (inventoryClass !== "ALL" && itemClassType(row.item) !== inventoryClass) return false;
    return true;
  });

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
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
            <section className="rounded-2xl border border-amber-900/45 bg-zinc-950/45 bg-linear-to-b from-amber-950/15 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">Guild treasury</p>
            <h1 className="mt-1 font-serif text-2xl text-zinc-100">
              <span className="mr-2">{membership.guild.emoji}</span>
              {membership.guild.name}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Deposit gear from your pack into shared storage. Withdrawals require <strong className="text-zinc-400">Member</strong> rank or
              higher — Initiates cannot take items out.
            </p>
            <Link
              href="/guild"
              className="mt-4 inline-flex rounded-lg border border-white/20 bg-black/55 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
            >
              ← Back to guild hall
            </Link>
              <div className="mt-4">
              <TreasuryFilters
                prefix="t"
                slot={treasurySlot}
                rarity={treasuryRarity}
                classType={treasuryClass}
                slotOptions={SLOT_FILTERS}
                rarityOptions={RARITY_FILTERS}
                classOptions={CLASS_FILTERS}
                labels={{
                  slot: "Treasury type",
                  rarity: "Treasury rarity",
                  classType: "Treasury class type",
                }}
              />
              <Link
                href="/guild/treasury"
                className="mt-2 inline-flex rounded-lg border border-zinc-700 bg-black/35 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-black/55"
              >
                Reset
              </Link>
            </div>
            </section>

            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 p-4 shadow-md backdrop-blur-[1px]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Treasury ({filteredTreasury.length} / {treasuryItems.length} stacks)
            </h2>
            {filteredTreasury.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">The treasury is empty.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {filteredTreasury.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2"
                  >
                    <div className="min-w-0">
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
                        <p className={`text-sm font-medium ${rarityBadgeClass(row.item.rarity)}`}>
                          <span className="mr-1">{row.item.emoji}</span>
                          {itemDisplayName(row.item, row.forgeLevel, row.affixPrefix)}
                          {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                        </p>
                      </ItemHoverCard>
                      {row.forgeLevel > 0 ? (
                        <p className="text-[11px] text-zinc-500">+{row.forgeLevel} forge</p>
                      ) : null}
                    </div>
                    {canWithdraw ? (
                      <form action={asFormVoid(withdrawGuildTreasuryAction)}>
                        <input type="hidden" name="treasuryItemId" value={row.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                        >
                          Withdraw to pack
                        </button>
                      </form>
                    ) : (
                      <span className="text-[11px] text-zinc-600">Withdraw locked (Initiate)</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            </section>

            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 p-4 shadow-md backdrop-blur-[1px]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Your pack (deposit) ({filteredInventory.length} / {inventory.length})
            </h2>
            <div className="mt-3 mb-3">
              <TreasuryFilters
                prefix="i"
                slot={inventorySlot}
                rarity={inventoryRarity}
                classType={inventoryClass}
                slotOptions={SLOT_FILTERS}
                rarityOptions={RARITY_FILTERS}
                classOptions={CLASS_FILTERS}
                labels={{
                  slot: "Deposit type",
                  rarity: "Deposit rarity",
                  classType: "Deposit class type",
                }}
              />
            </div>
            {inventory.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Nothing to deposit.</p>
            ) : filteredInventory.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No deposit items match your filters.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {filteredInventory.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2"
                  >
                    <div className="min-w-0">
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
                        <p className={`text-sm font-medium ${rarityBadgeClass(row.item.rarity)}`}>
                          <span className="mr-1">{row.item.emoji}</span>
                          {itemDisplayName(row.item, row.forgeLevel, row.affixPrefix)}
                          {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                        </p>
                      </ItemHoverCard>
                    </div>
                    <form action={asFormVoid(depositGuildTreasuryAction)}>
                      <input type="hidden" name="inventoryItemId" value={row.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                      >
                        Deposit
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            </section>

            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Guild chat (async)</h2>
              <form action={asFormVoid(postGuildChatMessageAction)} className="mt-3 flex gap-2">
                <input
                  name="text"
                  maxLength={300}
                  placeholder="Message your guild"
                  className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-white/20 bg-black/55 px-4 py-2 text-xs font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70"
                >
                  Send
                </button>
              </form>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-zinc-900 bg-black/30 p-3 text-sm">
                {guildChatMessages.length === 0 ? (
                  <p className="text-zinc-500">No guild messages yet.</p>
                ) : (
                  [...guildChatMessages].reverse().map((m) => (
                    <p key={m.id} className="text-zinc-300">
                      <span className="text-zinc-500">[{new Date(m.createdAt).toLocaleTimeString()}]</span>{" "}
                      <span className="font-medium text-zinc-100">{m.username}</span>: {m.text}
                    </p>
                  ))
                )}
              </div>
            </section>
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
