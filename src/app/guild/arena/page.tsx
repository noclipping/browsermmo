import Link from "next/link";
import { redirect } from "next/navigation";
import {
  claimGuildBossChestRewardAction,
  debugRespawnGuildBossNowAction,
  claimGuildBossParticipationRewardAction,
  debugEndGuildBossCycleAction,
  debugKillGuildBossAction,
  debugRefreshGuildBossAttemptsAction,
  startGuildBossFightAction,
} from "@/app/actions/guild-boss";
import { consumeTonicOutsideCombatAction, returnToTownAction, returnToTownAndShopAction } from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { GuildChestClaimForm } from "@/components/guild-chest-claim-form";
import { GuildRaidChestCard, GuildRaidChestContributionStrip, GuildRaidChestPreviewGrid } from "@/components/guild-raid-chest-panel";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { getChestDropTable, getChestGoldReward, getGuildBossChestTier, getNextChestTierProgress, GUILD_BOSS_CHEST_LABEL } from "@/lib/game/guild-boss-chest";
import { GUILD_BOSS_ATTEMPTS_PER_24H, getBossDefinitionByKey, participationGoldReward } from "@/lib/game/guild-boss-definitions";
import { countGuildBossAttemptsLast24h } from "@/lib/game/guild-boss-attempts";
import { rarityBadgeClass } from "@/lib/game/item-rarity-styles";
import { trySpawnNextGuildBossIfReady } from "@/lib/game/guild-boss-season";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatRaidCooldownRemaining(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "momentarily";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 72) return `${Math.ceil(ms / 86400000)} days`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${Math.max(1, m)} min`;
}

function chestImagePath(tier: string): string {
  switch (tier.toLowerCase()) {
    case "bronze":
      return "/images/chests/bronzechest.png";
    case "silver":
      return "/images/chests/silverchest.png";
    case "gold":
      return "/images/chests/goldchest.png";
    case "diamond":
      return "/images/chests/diamondchest.png";
    case "mythic":
      return "/images/chests/mythicchest.png";
    default:
      return "/images/chests/bronzechest.png";
  }
}

export default async function GuildArenaPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, inventory, currentRegion, townRegion, combatActive, membership] = await Promise.all([
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true, guildBossAttemptId: true },
    }),
    prisma.guildMember.findUnique({
      where: { userId: user.id },
      include: {
        guild: {
          select: {
            id: true,
            emoji: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");
  if (!membership) redirect("/guild");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const guildRaidResume = !!combatActive?.guildBossAttemptId;
  const showRaidDebugTools = process.env.NODE_ENV === "development";
  const effective = buildCharacterStats(character, equipment);

  await trySpawnNextGuildBossIfReady(prisma, membership.guildId);

  const [activeBossSeason, defeatedBossSeasons, latestDefeatedSeason, bossAttemptsUsed] = await Promise.all([
    prisma.guildBossSeason.findFirst({ where: { guildId: membership.guildId, status: "ACTIVE" } }),
    prisma.guildBossSeason.findMany({
      where: { guildId: membership.guildId, status: "DEFEATED" },
      orderBy: { defeatedAt: "desc" },
      take: 8,
    }),
    prisma.guildBossSeason.findFirst({
      where: { guildId: membership.guildId, status: "DEFEATED" },
      orderBy: { defeatedAt: "desc" },
    }),
    countGuildBossAttemptsLast24h(prisma, user.id, membership.guildId),
  ]);

  const seasonIdsForClaims = [...(activeBossSeason ? [activeBossSeason.id] : []), ...defeatedBossSeasons.map((s) => s.id)];
  const bossClaims =
    seasonIdsForClaims.length > 0
      ? await prisma.guildBossRewardClaim.findMany({
          where: { userId: user.id, seasonId: { in: seasonIdsForClaims } },
        })
      : [];
  const claimBySeason = Object.fromEntries(bossClaims.map((c) => [c.seasonId, c]));

  const activeBossContribution =
    activeBossSeason &&
    (await prisma.guildBossContribution.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: activeBossSeason.id } },
    }));

  const defeatedContributions =
    defeatedBossSeasons.length > 0
      ? await prisma.guildBossContribution.findMany({
          where: { userId: user.id, seasonId: { in: defeatedBossSeasons.map((s) => s.id) } },
        })
      : [];
  const defeatedContribBySeason = Object.fromEntries(defeatedContributions.map((c) => [c.seasonId, c]));

  const activeBossDef = activeBossSeason ? getBossDefinitionByKey(activeBossSeason.bossKey) : null;
  const latestDefeatedBossDef = latestDefeatedSeason ? getBossDefinitionByKey(latestDefeatedSeason.bossKey) : null;
  const bossAttemptsLeft = Math.max(0, GUILD_BOSS_ATTEMPTS_PER_24H - bossAttemptsUsed);
  const canStartNewRaid = !!activeBossSeason && activeBossSeason.currentHp > 0 && bossAttemptsLeft > 0 && !combatLocked && !!activeBossDef;
  const bossCooldownUntil = !activeBossSeason ? (latestDefeatedSeason?.nextSpawnAt ?? null) : null;
  const activeChestProgress =
    activeBossSeason &&
    getNextChestTierProgress(activeBossContribution?.damageTotal ?? 0, activeBossSeason.maxHp);
  const activeChestTier =
    activeBossSeason && activeBossContribution
      ? getGuildBossChestTier(activeBossContribution.damageTotal, activeBossSeason.maxHp)
      : null;

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art; md+ intrinsic sizing shows full frame */}
          <img
            src="/images/areabanners/colloseumbanner.png"
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

        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-2xl text-zinc-100">
              {membership.guild.emoji} {membership.guild.name} · Boss Arena
            </h1>
            <Link href="/guild" className="rounded border border-white/20 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5">
              Back to Guild
            </Link>
          </div>

          <section className="rounded-2xl border border-rose-900/45 bg-zinc-950/45 bg-linear-to-b from-rose-950/20 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300/80">Guild raid arena</p>
        <p className="mt-1 text-xs text-zinc-500">
          Shared HP boss with {GUILD_BOSS_ATTEMPTS_PER_24H} attempts per rolling 24h. Contribution here determines your raid chest.
        </p>

        {activeBossSeason && activeBossDef ? (
          <div className="mt-4 space-y-2">
            <h3 className="font-serif text-lg text-rose-100">
              <span className="mr-2">{activeBossDef.emoji}</span>
              {activeBossDef.displayName}
            </h3>
            <div className="h-3 overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full rounded-full bg-rose-600/85"
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round((activeBossSeason.currentHp / Math.max(1, activeBossSeason.maxHp)) * 100)))}%`,
                }}
              />
            </div>
            <p className="text-sm text-zinc-400">
              Shared HP {activeBossSeason.currentHp.toLocaleString()} / {activeBossSeason.maxHp.toLocaleString()} · Your damage this season:{" "}
              {activeBossContribution?.damageTotal?.toLocaleString() ?? 0}
            </p>
            <p className="text-xs text-zinc-500">
              Attempts left (24h): <span className="font-semibold text-zinc-300">{bossAttemptsLeft}</span> / {GUILD_BOSS_ATTEMPTS_PER_24H}
            </p>
            {guildRaidResume ? (
              <Link
                href="/adventure"
                className="inline-flex rounded-lg border border-rose-700/50 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900/35"
              >
                Continue guild raid (Adventure)
              </Link>
            ) : canStartNewRaid ? (
              <form action={startGuildBossFightAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-rose-700/50 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900/35"
                >
                  Start guild raid sortie
                </button>
              </form>
            ) : (
              <p className="text-xs text-amber-200/80">
                {combatLocked
                  ? "Finish or flee your other fight before starting a raid."
                  : bossAttemptsLeft <= 0
                    ? "No raid attempts left — try again after the rolling 24h window."
                    : activeBossSeason.currentHp <= 0
                      ? "Boss pool empty — refresh shortly."
                      : "Cannot start raid right now."}
              </p>
            )}

            <div className="mt-4 space-y-4 rounded-xl border border-amber-900/25 bg-black/30 p-4">
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Deal damage to increase contribution. Final contribution determines chest tier. Chests unlock when this raid ends.
              </p>
              {activeChestProgress ? <GuildRaidChestContributionStrip bossMaxHp={activeBossSeason.maxHp} progress={activeChestProgress} /> : null}
              <GuildRaidChestCard
                tier={activeChestTier}
                locked
                modeLabel="Locked until end of raid — the boss must be defeated."
                seasonDefeated={false}
                canClaim={false}
                claimed={false}
                claimAction={claimGuildBossChestRewardAction}
                seasonId={activeBossSeason.id}
              />
              <GuildRaidChestPreviewGrid />
            </div>

            {activeBossContribution && activeBossContribution.damageTotal > 0 ? (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-black/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active season rewards</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                  <span>Participation (~{participationGoldReward(activeBossContribution.damageTotal, activeBossSeason.bossKey)}g):</span>
                  {claimBySeason[activeBossSeason.id]?.participationClaimedAt ? (
                    <span className="text-emerald-400">Claimed</span>
                  ) : (
                    <form action={claimGuildBossParticipationRewardAction} className="inline">
                      <input type="hidden" name="seasonId" value={activeBossSeason.id} />
                      <button type="submit" className="rounded border border-white/20 bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-zinc-200">
                        Claim
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : bossCooldownUntil ? (
          <div className="mt-4 rounded-xl border border-amber-800/45 bg-amber-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/85">Guild victory</p>
            <p className="mt-1 font-serif text-lg text-amber-100">
              💀 {latestDefeatedBossDef?.emoji ?? "👑"} {latestDefeatedBossDef?.displayName ?? "Guild Boss"} defeated
            </p>
            <p className="mt-2 text-sm text-amber-100/85">
              <span className="font-semibold text-emerald-300">VICTORY!</span> Next boss in{" "}
              <span className="font-semibold">{formatRaidCooldownRemaining(bossCooldownUntil)}</span> · unlocks around{" "}
              <span className="text-zinc-200">{bossCooldownUntil.toLocaleString()}</span>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No active raid — refresh the page or wait for next spawn.</p>
        )}

        {showRaidDebugTools ? (
          <div className="mt-3 rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/85">Debug tools (dev only)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <form action={debugRefreshGuildBossAttemptsAction}>
                <button
                  type="submit"
                  className="rounded border border-fuchsia-700/40 bg-black/40 px-2 py-1 text-[11px] font-semibold text-fuchsia-100 hover:bg-black/60"
                >
                  Refresh raid attempts
                </button>
              </form>
              <form action={debugEndGuildBossCycleAction}>
                <button
                  type="submit"
                  className="rounded border border-fuchsia-700/40 bg-black/40 px-2 py-1 text-[11px] font-semibold text-fuchsia-100 hover:bg-black/60"
                >
                  End raid cycle
                </button>
              </form>
              <form action={debugKillGuildBossAction}>
                <button
                  type="submit"
                  className="rounded border border-fuchsia-700/40 bg-black/40 px-2 py-1 text-[11px] font-semibold text-fuchsia-100 hover:bg-black/60"
                >
                  Kill boss (full)
                </button>
              </form>
              <form action={debugRespawnGuildBossNowAction}>
                <button
                  type="submit"
                  className="rounded border border-fuchsia-700/40 bg-black/40 px-2 py-1 text-[11px] font-semibold text-fuchsia-100 hover:bg-black/60"
                >
                  Respawn boss now
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {defeatedBossSeasons.length > 0 ? (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recent defeated seasons (claims)</p>
            <ul className="mt-2 space-y-3">
              {defeatedBossSeasons.map((s) => {
                const def = getBossDefinitionByKey(s.bossKey);
                const contrib = defeatedContribBySeason[s.id];
                const claim = claimBySeason[s.id];
                const chestTier = contrib ? getGuildBossChestTier(contrib.damageTotal, s.maxHp) : null;
                return (
                  <li key={s.id} className="rounded-lg border border-zinc-800 bg-black/25 px-3 py-2 text-sm text-zinc-400">
                    <span className="text-zinc-200">{def?.displayName ?? s.bossKey}</span>
                    <span className="ml-2 text-xs text-zinc-600">Defeated {s.defeatedAt ? new Date(s.defeatedAt).toLocaleString() : "—"}</span>
                    {contrib && contrib.damageTotal > 0 ? (
                      <div className="mt-2 space-y-1 text-xs">
                        <p>
                          Your damage: {contrib.damageTotal.toLocaleString()} ({getNextChestTierProgress(contrib.damageTotal, s.maxHp).contributionPercent.toFixed(1)}
                          % of pool)
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>Participation (~{participationGoldReward(contrib.damageTotal, s.bossKey)}g):</span>
                          {claim?.participationClaimedAt ? (
                            <span>Claimed</span>
                          ) : (
                            <form action={claimGuildBossParticipationRewardAction} className="inline">
                              <input type="hidden" name="seasonId" value={s.id} />
                              <button type="submit" className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-zinc-200">
                                Claim
                              </button>
                            </form>
                          )}
                        </div>
                        {chestTier ? (
                          <div className="mt-2 rounded-lg border border-amber-900/30 bg-black/35 px-2 py-2">
                            <div className="flex items-start gap-3">
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-white/10 bg-zinc-900">
                                {/* eslint-disable-next-line @next/next/no-img-element -- static public chest art */}
                                <img src={chestImagePath(chestTier)} alt={`${chestTier} chest`} className="h-full w-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-[11px] text-zinc-300">
                                  Raid chest: <span className="font-semibold text-amber-200/90">{GUILD_BOSS_CHEST_LABEL[chestTier]}</span>
                                  {!claim?.chestClaimedAt ? <> (~{getChestGoldReward(chestTier, s.bossKey)}g + item rolls)</> : null}
                                </p>
                                {!claim?.chestClaimedAt ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(() => {
                                      const table = getChestDropTable(chestTier);
                                      const rows = [
                                        ["COMMON", table.common],
                                        ["UNCOMMON", table.uncommon],
                                        ["RARE", table.rare],
                                        ["LEGENDARY", table.legendary],
                                        ["GODLY", table.godly],
                                      ] as const;
                                      return rows.map(([rarity, pct]) => (
                                        <span
                                          key={rarity}
                                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${rarityBadgeClass(rarity)}`}
                                        >
                                          {rarity} {pct}%
                                        </span>
                                      ));
                                    })()}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {claim?.chestClaimedAt ? (
                              <p className="mt-1 text-emerald-400/90">Raid chest claimed.</p>
                            ) : (
                              <div className="mt-2">
                                <GuildChestClaimForm
                                  seasonId={s.id}
                                  buttonClassName="rounded border border-amber-700/50 bg-amber-950/40 px-3 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/35 disabled:opacity-60"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-zinc-600">Raid chest: need more damage (1% of pool or flat minimum).</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-600">You did not hit this boss.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
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
