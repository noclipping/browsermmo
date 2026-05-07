import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consumeTonicOutsideCombatAction,
  restAtCampfireAction,
  returnToTownAction,
  returnToTownAndMarketAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import {
  debugDailyChestSetStateAction,
  getDailyLoginChestBannerState,
} from "@/app/actions/daily-login-chest";
import { AchievementToastPostActionDrain } from "@/components/achievement-toast-post-action-drain";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { DailyNextClaimTimer } from "@/components/daily-next-claim-timer";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { TOWN_REST_COOLDOWN_MS } from "@/lib/game/constants";
import { buildCharacterStats } from "@/lib/game/stats";
import { CampfireRestButton } from "@/components/campfire-rest-button";
import { DailyLoginChestClaimForm } from "@/components/daily-login-chest-claim-form";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { TownDistrictSlice } from "@/components/town-district-slice";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { asFormVoid } from "@/lib/as-form-void";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAILY_CHEST_PLAN = [
  { day: 1, tier: "Bronze", image: "/images/chests/bronzechest.png" },
  { day: 2, tier: "Silver", image: "/images/chests/silverchest.png" },
  { day: 3, tier: "Silver", image: "/images/chests/silverchest.png" },
  { day: 4, tier: "Gold", image: "/images/chests/goldchest.png" },
  { day: 5, tier: "Gold", image: "/images/chests/goldchest.png" },
  { day: 6, tier: "Diamond", image: "/images/chests/diamondchest.png" },
  { day: 7, tier: "Mythic", image: "/images/chests/mythicchest.png" },
] as const;

export default async function TownPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, townRegion, currentRegion, combatActive] = await Promise.all([
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
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const inventory = await prisma.inventoryItem.findMany({
    where: { characterId: character.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });
  const isTown = currentRegion?.key === "town_outskirts";
  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const effective = buildCharacterStats(character, equipment);
  const restCooldownEndsAtMs =
    character.lastFreeRestAt != null ? character.lastFreeRestAt.getTime() + TOWN_REST_COOLDOWN_MS : null;

  const dailyChest = await getDailyLoginChestBannerState(user.id, character.id);

  const sliceButtonClass =
    "inline-block rounded-lg border border-white/20 bg-black/55 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
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
          <AchievementToastPostActionDrain revision={character.updatedAt.toISOString()} />
          <GameTopBar characterName={character.name} characterLevel={character.level} />
          <GameNav
            inTownRegion={inTownRegion}
            combatLocked={combatLocked}
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
                combatLocked={combatLocked}
                consumeTonicAction={consumeTonicOutsideCombatAction}
              />
            </div>
          </div>
          <div className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-950/45 shadow-md backdrop-blur-[1px]">
              <div className="bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Town outskirts</p>
                <h1 className="mt-1 font-serif text-2xl text-zinc-100">Camp services</h1>
              </div>
            </section>

            {isTown ? (
              <section className="space-y-3">
                {dailyChest ? (
                  <TownDistrictSlice
                    layout="stacked"
                    emoji="📦"
                    label="Daily login chest"
                    hint={
                      dailyChest.claimedToday
                        ? "You already opened today's chest. Come back tomorrow to continue your streak."
                        : `Day ${dailyChest.pendingDay}/7 · Next reward: ${dailyChest.nextChestLabel}. Missing a day resets to Bronze.`
                    }
                  >
                    <div className="mx-auto w-full max-w-xl space-y-2">
                      <div className="rounded-lg border border-white/15 bg-black/40 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <p className="font-semibold text-zinc-200">
                            Streak progress · Day {dailyChest.pendingDay}/7
                          </p>
                          <p className="text-zinc-400">
                            {dailyChest.claimedToday ? "Claimed today ✓" : `Next chest: ${dailyChest.nextChestLabel}`}
                          </p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-zinc-800 bg-black/50">
                          <div
                            className="h-full bg-linear-to-r from-amber-700 via-yellow-500 to-fuchsia-500 transition-[width]"
                            style={{ width: `${Math.max(0, Math.min(100, (dailyChest.claimedThroughDay / 7) * 100))}%` }}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-7 gap-1">
                          {DAILY_CHEST_PLAN.map((step) => {
                            const completed = step.day <= dailyChest.claimedThroughDay;
                            const active = step.day === dailyChest.pendingDay && !dailyChest.claimedToday;
                            return (
                              <div
                                key={step.day}
                                className={`rounded border px-1 py-1 text-center ${
                                  completed
                                    ? "border-emerald-500/50 bg-emerald-900/20"
                                    : active
                                      ? "border-amber-500/60 bg-amber-900/25"
                                      : "border-zinc-800 bg-black/30"
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={step.image}
                                  alt={`Day ${step.day} ${step.tier} chest`}
                                  className="mx-auto h-8 w-8 object-contain"
                                />
                                <p className="mt-1 text-[10px] text-zinc-300">D{step.day}</p>
                                <p className="text-[9px] text-zinc-500">{step.tier}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {dailyChest.claimedToday ? (
                        <div className="space-y-1">
                          <p className="text-sm text-zinc-500">Claimed today ✓</p>
                          <DailyNextClaimTimer nextClaimAtIso={dailyChest.nextClaimAtIso} />
                        </div>
                      ) : (
                        <DailyLoginChestClaimForm buttonClassName={sliceButtonClass} />
                      )}

                      {process.env.NODE_ENV !== "production" ? (
                        <div className="rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/15 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">Debug tools (dev only)</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={asFormVoid(debugDailyChestSetStateAction)}>
                              <input type="hidden" name="mode" value="RESET" />
                              <button type="submit" className="rounded border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-zinc-300">
                                Reset streak
                              </button>
                            </form>
                            <form action={asFormVoid(debugDailyChestSetStateAction)} className="flex items-center gap-2">
                              <input type="hidden" name="mode" value="CLAIMABLE" />
                              <select name="day" defaultValue="1" className="rounded border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-zinc-200">
                                {DAILY_CHEST_PLAN.map((d) => (
                                  <option key={`claimable-${d.day}`} value={d.day}>
                                    Claimable day {d.day}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="rounded border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-zinc-300">
                                Set
                              </button>
                            </form>
                            <form action={asFormVoid(debugDailyChestSetStateAction)} className="flex items-center gap-2">
                              <input type="hidden" name="mode" value="CLAIMED_TODAY" />
                              <select name="day" defaultValue="1" className="rounded border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-zinc-200">
                                {DAILY_CHEST_PLAN.map((d) => (
                                  <option key={`claimed-${d.day}`} value={d.day}>
                                    Mark claimed day {d.day}
                                  </option>
                                ))}
                              </select>
                              <button type="submit" className="rounded border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-zinc-300">
                                Set
                              </button>
                            </form>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </TownDistrictSlice>
                ) : null}

                <TownDistrictSlice
                  emoji="🔥"
                  label="Campfire"
                  hint="Free full heal on a 2-minute cooldown between uses. Wins do not restore HP — only this fire or leveling."
                >
                  <CampfireRestButton
                    compact
                    restAction={restAtCampfireAction}
                    hp={character.hp}
                    maxHp={character.maxHp}
                    cooldownEndsAtMs={restCooldownEndsAtMs}
                  />
                </TownDistrictSlice>

                <TownDistrictSlice
                  emoji="🛒"
                  label="Market"
                  hint="Global market: list and buy player items. Town shop: NPC gear, crimson tonics, and smithing stones; sell spare pack gear. Prices scale with your recommended danger tier."
                >
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link href="/market" className={sliceButtonClass}>
                      Open market
                    </Link>
                    <Link href="/shop" className={sliceButtonClass}>
                      Town shop
                    </Link>
                  </div>
                </TownDistrictSlice>

                <TownDistrictSlice
                  emoji="⚒️"
                  label="Forge"
                  hint="Spend gold and smithing stones to reinforce equipped gear. Higher tiers cost more stones; rarity caps maximum forge except on Legendary and Godly pieces."
                >
                  <Link href="/forge" className={sliceButtonClass}>
                    Open forge
                  </Link>
                </TownDistrictSlice>

                <TownDistrictSlice
                  emoji="🧑‍🏫"
                  label="Trainer"
                  hint="Spend stat points and inspect your class skill from the character sheet."
                >
                  <a href="/character" className={sliceButtonClass}>
                    Visit trainer
                  </a>
                </TownDistrictSlice>

                <TownDistrictSlice
                  emoji="🗺️"
                  label="Adventure gate"
                  hint="Travel to hostile regions. Flee may fail, and bosses can block retreat."
                >
                  <a href="/adventure" className={sliceButtonClass}>
                    Go adventuring
                  </a>
                </TownDistrictSlice>
              </section>
            ) : null}

            {!isTown ? (
              <p className="rounded-lg border border-white/20 bg-black/55 px-4 py-3 text-sm text-zinc-400">
                You are away from town. Open <strong className="text-zinc-400">Adventure</strong> to fight, or travel
                back above to use services.
              </p>
            ) : null}
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
