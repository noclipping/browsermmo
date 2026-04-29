import Link from "next/link";
import { redirect } from "next/navigation";
import {
  consumeTonicOutsideCombatAction,
  restAtCampfireAction,
  returnToTownAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { TOWN_REST_COOLDOWN_MS } from "@/lib/game/constants";
import { buildCharacterStats } from "@/lib/game/stats";
import { CampfireRestButton } from "@/components/campfire-rest-button";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { TownDistrictSlice } from "@/components/town-district-slice";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
          <div className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-950/45 shadow-md backdrop-blur-[1px]">
              <div className="bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Town outskirts</p>
                <h1 className="mt-1 font-serif text-2xl text-zinc-100">Camp services</h1>
              </div>
            </section>

            {isTown ? (
              <section className="space-y-3">
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
                  hint="Buy common gear, crimson tonics, and smithing stones; sell spare pack gear. Prices scale with your recommended danger tier."
                >
                  <Link href="/shop" className={sliceButtonClass}>
                    Open market
                  </Link>
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
