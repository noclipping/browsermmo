import Link from "next/link";
import { redirect } from "next/navigation";
import {
  acceptGuildInviteAction,
  cancelGuildInviteAction,
  createGuildAction,
  declineGuildInviteAction,
  demoteGuildOfficerToMemberAction,
  donateGuildGoldAction,
  inviteToGuildAction,
  kickGuildMemberAction,
  leaveGuildAction,
  postGuildChatMessageAction,
  promoteGuildMemberToMemberAction,
  promoteGuildMemberToOfficerAction,
  transferGuildOwnershipAction,
  updateGuildDescriptionAction,
  updateGuildEmojiAction,
} from "@/app/actions/guild";
import {
  consumeTonicOutsideCombatAction,
  returnToTownAction,
  returnToTownAndMarketAction,
  returnToTownAndShopAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import {
  GUILD_BOSS_ATTEMPTS_PER_24H,
  getBossDefinitionByKey,
} from "@/lib/game/guild-boss-definitions";
import { countGuildBossAttemptsLast24h } from "@/lib/game/guild-boss-attempts";
import { trySpawnNextGuildBossIfReady } from "@/lib/game/guild-boss-season";
import { getGuildLevelProgress, getGuildXpBonusPercent } from "@/lib/game/guild-progression";
import { asFormVoid } from "@/lib/as-form-void";
import { portraitForClass } from "@/lib/game/portraits";
import { canEditGuildBranding } from "@/lib/game/guild-rank";
import { GUILD_SYMBOLS } from "@/lib/game/guild-symbols";
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

const oneCharacterSelect = {
  take: 1 as const,
  orderBy: { createdAt: "asc" as const },
  select: {
    name: true,
    class: true,
    level: true,
    portraitKey: true,
  },
};

export default async function GuildPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [equipment, inventory, currentRegion, townRegion, combatActive, membership, incomingInvites] = await Promise.all([
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
            xp: true,
            name: true,
            description: true,
            ownerId: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.guildInvite.findMany({
      where: { inviteeId: user.id, status: "PENDING" },
      include: {
        guild: { select: { id: true, name: true } },
        inviter: { select: { characters: oneCharacterSelect } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const effective = buildCharacterStats(character, equipment);

  const [guildDetails, donationGoldSumRow] = membership
    ? await Promise.all([
        prisma.guild.findUnique({
          where: { id: membership.guildId },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    characters: oneCharacterSelect,
                  },
                },
              },
              orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
            },
            invites: {
              where: { status: "PENDING" },
              include: {
                invitee: { select: { id: true, characters: oneCharacterSelect } },
                inviter: { select: { id: true, characters: oneCharacterSelect } },
              },
              orderBy: { createdAt: "desc" },
            },
            donations: {
              take: 20,
              orderBy: { createdAt: "desc" },
              include: {
                user: { select: { characters: oneCharacterSelect } },
              },
            },
            chatMessages: {
              take: 50,
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        prisma.guildDonation.aggregate({
          where: { guildId: membership.guildId },
          _sum: { amount: true },
        }),
      ])
    : [null, null];

  const canManage = membership ? membership.role === "OWNER" || membership.role === "OFFICER" : false;
  const isOwner = membership?.role === "OWNER";
  const canBrand = membership ? canEditGuildBranding(membership.role) : false;
  const donationGoldLifetime = donationGoldSumRow?._sum.amount ?? 0;
  const guildProgress = guildDetails ? getGuildLevelProgress(guildDetails.xp) : null;
  const combatXpBonusPercent = guildProgress ? getGuildXpBonusPercent(guildProgress.level) : 0;

  let activeBossSeason: Awaited<ReturnType<typeof prisma.guildBossSeason.findFirst>> = null;
  let latestDefeatedSeason: Awaited<ReturnType<typeof prisma.guildBossSeason.findFirst>> = null;
  let bossAttemptsUsed = 0;
  if (membership) {
    await trySpawnNextGuildBossIfReady(prisma, membership.guildId);
    [activeBossSeason, latestDefeatedSeason, bossAttemptsUsed] = await Promise.all([
      prisma.guildBossSeason.findFirst({ where: { guildId: membership.guildId, status: "ACTIVE" } }),
      prisma.guildBossSeason.findFirst({
        where: { guildId: membership.guildId, status: "DEFEATED" },
        orderBy: { defeatedAt: "desc" },
      }),
      countGuildBossAttemptsLast24h(prisma, user.id, membership.guildId),
    ]);
  }
  const activeBossDef = activeBossSeason ? getBossDefinitionByKey(activeBossSeason.bossKey) : null;
  const latestDefeatedBossDef = latestDefeatedSeason ? getBossDefinitionByKey(latestDefeatedSeason.bossKey) : null;
  const bossAttemptsLeft = Math.max(0, GUILD_BOSS_ATTEMPTS_PER_24H - bossAttemptsUsed);

  const bossCooldownUntil = membership && !activeBossSeason ? (latestDefeatedSeason?.nextSpawnAt ?? null) : null;

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
        {/* Match standard hub banners (1717×916): guild art is taller (1659×948); crop with same aspect so it feels like Town/Shop */}
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none md:aspect-[1717/916] md:overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art */}
          <img
            src="/images/areabanners/guildhallbanner.png"
            alt=""
            width={1659}
            height={948}
            className="block h-auto w-full max-w-full select-none md:h-full md:w-full md:object-cover md:object-top max-md:absolute max-md:inset-0 max-md:h-full max-md:object-cover max-md:object-center max-md:scale-125"
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

          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Guild</p>
              {membership && guildDetails ? (
                <>
                  <h1 className="mt-1 font-serif text-2xl text-zinc-100">
                    <span className="mr-2">{guildDetails.emoji}</span>
                    {guildDetails.name}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">{guildDetails.description || "No guild description yet."}</p>
                  {guildProgress ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-100/90">
                        Guild Lv.{guildProgress.level} · {guildProgress.xp.toLocaleString()} Guild XP
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full rounded-full bg-emerald-600/80 transition-[width]"
                          style={{ width: `${Math.round(guildProgress.fraction * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-emerald-200/70">
                        {guildProgress.xpToNext > 0
                          ? `${guildProgress.xpToNext.toLocaleString()} XP to guild Lv.${guildProgress.level + 1} (${guildProgress.xpIntoLevel.toLocaleString()} / ${(guildProgress.nextLevelXp - guildProgress.levelStartXp).toLocaleString()} in this level)`
                          : "At next threshold."}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Guild Level grants +1% combat XP per level (max 20%). This guild:{" "}
                        <span className="font-semibold text-emerald-200/90">+{combatXpBonusPercent}%</span> combat XP.
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Donations grant Guild XP (not a shared bank). Stronger guild bosses will tie into level later.
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    Members {guildDetails.members.length} · Lifetime gold donated {donationGoldLifetime.toLocaleString()}g ·
                    Created {new Date(guildDetails.createdAt).toLocaleDateString()}
                  </p>
                  {canBrand ? (
                    <form action={asFormVoid(updateGuildEmojiAction)} className="mt-3 flex items-center gap-2">
                      <select
                        name="emoji"
                        defaultValue={guildDetails.emoji}
                        aria-label="Guild emoji"
                        className="w-24 rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-center text-lg text-zinc-100"
                      >
                        {GUILD_SYMBOLS.map((symbol) => (
                          <option key={symbol} value={symbol}>
                            {symbol}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                      >
                        Set symbol
                      </button>
                    </form>
                  ) : null}
                  {canBrand ? (
                    <form action={asFormVoid(updateGuildDescriptionAction)} className="mt-3 space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Guild bio</label>
                      <textarea
                        name="description"
                        defaultValue={guildDetails.description}
                        maxLength={180}
                        rows={3}
                        className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                      >
                        Save bio
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <>
                  <h1 className="mt-1 font-serif text-2xl text-zinc-100">No guild yet</h1>
                  <p className="mt-1 text-sm text-zinc-400">Create one or accept an invite. Async only for now.</p>
                </>
              )}
            </section>

            {membership && guildDetails && guildProgress ? (
              <section className="rounded-2xl border border-amber-900/40 bg-zinc-950/45 bg-linear-to-b from-amber-950/15 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/85">Guild treasury</p>
                <p className="mt-1 text-xs text-zinc-500">Shared item bank — deposit pack gear and withdraw if you are at least Member rank.</p>
                <Link
                  href="/guild/treasury"
                  className="mt-3 inline-flex rounded-lg border border-amber-800/50 bg-amber-950/25 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/30"
                >
                  Open treasury
                </Link>
              </section>
            ) : null}

            {membership && guildDetails && guildProgress ? (
              <section className="rounded-2xl border border-rose-900/45 bg-zinc-950/45 bg-linear-to-b from-rose-950/20 via-black/78 to-black/95 p-5 shadow-md backdrop-blur-[1px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300/80">Guild raid</p>
                <p className="mt-1 text-xs text-zinc-500">Raid details moved to a dedicated boss arena screen.</p>
                {activeBossSeason && activeBossDef ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-rose-900/35 bg-black/35 p-4">
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
                      Shared HP {activeBossSeason.currentHp.toLocaleString()} / {activeBossSeason.maxHp.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Attempts left (24h): <span className="font-semibold text-zinc-300">{bossAttemptsLeft}</span> / {GUILD_BOSS_ATTEMPTS_PER_24H}
                    </p>
                    <Link
                      href="/guild/arena"
                      className="inline-flex rounded-lg border border-rose-700/50 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-900/35"
                    >
                      Open guild boss arena
                    </Link>
                  </div>
                ) : bossCooldownUntil ? (
                  <div className="mt-4 rounded-xl border border-amber-800/45 bg-amber-950/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/85">Victory</p>
                    <p className="mt-1 font-serif text-lg text-amber-100">
                      💀 {latestDefeatedBossDef?.emoji ?? "👑"} {latestDefeatedBossDef?.displayName ?? "Guild Boss"} defeated
                    </p>
                    <p className="mt-2 text-sm text-amber-100/85">
                      <span className="font-semibold text-emerald-300">VICTORY!</span> Next boss in{" "}
                      <span className="font-semibold">{formatRaidCooldownRemaining(bossCooldownUntil)}</span>
                    </p>
                    <Link href="/guild/arena" className="mt-3 inline-flex rounded border border-amber-700/40 px-3 py-1.5 text-xs text-amber-100">
                      Open arena claims
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-zinc-500">No active raid right now.</p>
                    <Link href="/guild/arena" className="inline-flex rounded border border-white/20 px-3 py-1.5 text-xs text-zinc-200">
                      Open guild boss arena
                    </Link>
                  </div>
                )}
              </section>
            ) : null}

            {!membership ? (
              <>
                <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Create guild</h2>
                  <form action={asFormVoid(createGuildAction)} className="mt-3 space-y-2">
                    <input
                      name="name"
                      placeholder="Guild name (3-24)"
                      maxLength={24}
                      className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                    />
                    <textarea
                      name="description"
                      placeholder="Short guild description"
                      maxLength={180}
                      rows={3}
                      className="w-full rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                    >
                      Create guild
                    </button>
                  </form>
                </section>

                <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/90">Incoming invites</h2>
                  {incomingInvites.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No pending invites.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {incomingInvites.map((invite) => {
                        const inviterChar = invite.inviter.characters[0];
                        return (
                          <li key={invite.id} className="rounded-lg border border-zinc-900 bg-black/30 px-3 py-2">
                            <p className="text-sm text-zinc-200">
                              <span className="font-semibold">{invite.guild.name}</span>
                              {inviterChar ? ` · Invited by ${inviterChar.name}` : ""}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <form action={asFormVoid(acceptGuildInviteAction)}>
                                <input type="hidden" name="inviteId" value={invite.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                                >
                                  Accept
                                </button>
                              </form>
                              <form action={asFormVoid(declineGuildInviteAction)}>
                                <input type="hidden" name="inviteId" value={invite.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/50"
                                >
                                  Decline
                                </button>
                              </form>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            ) : guildDetails ? (
              <>
                <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Roster</h2>
                  <ul className="mt-3 space-y-2">
                    {guildDetails.members.map((member) => {
                      const c = member.user.characters[0];
                      const portrait = c ? portraitForClass(c.class, c.portraitKey) : null;
                      const canKick =
                        canManage &&
                        member.userId !== user.id &&
                        member.role !== "OWNER" &&
                        !(membership?.role === "OFFICER" && member.role === "OFFICER");
                      return (
                        <li key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={portrait?.src ?? ""}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded object-cover object-top bg-black/25"
                            />
                            <div className="min-w-0">
                              {c ? (
                                <Link
                                  href={`/player/${encodeURIComponent(c.name)}`}
                                  className="truncate text-sm font-medium text-zinc-200 underline decoration-zinc-600 hover:text-amber-100"
                                >
                                  {c.name}
                                </Link>
                              ) : (
                                <p className="text-sm text-zinc-400">Unknown</p>
                              )}
                              <p className="text-xs text-zinc-500">
                                {member.role} · Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
                            {canManage && member.role === "INITIATE" ? (
                              <form action={asFormVoid(promoteGuildMemberToMemberAction)}>
                                <input type="hidden" name="targetUserId" value={member.userId} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-emerald-900/50 bg-emerald-950/25 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/40"
                                >
                                  Promote to Member
                                </button>
                              </form>
                            ) : null}
                            {isOwner && member.role === "MEMBER" ? (
                              <form action={asFormVoid(promoteGuildMemberToOfficerAction)}>
                                <input type="hidden" name="targetUserId" value={member.userId} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-sky-900/50 bg-sky-950/25 px-2 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-950/40"
                                >
                                  Promote to Officer
                                </button>
                              </form>
                            ) : null}
                            {isOwner && member.role === "OFFICER" ? (
                              <form action={asFormVoid(demoteGuildOfficerToMemberAction)}>
                                <input type="hidden" name="targetUserId" value={member.userId} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-zinc-700 bg-black/40 px-2 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-black/60"
                                >
                                  Demote to Member
                                </button>
                              </form>
                            ) : null}
                            {canKick ? (
                              <form action={asFormVoid(kickGuildMemberAction)}>
                                <input type="hidden" name="memberUserId" value={member.userId} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/50"
                                >
                                  Kick
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {isOwner ? (
                    <form action={asFormVoid(transferGuildOwnershipAction)} className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-black/20 p-3">
                      <p className="text-[11px] font-semibold text-zinc-400">Transfer leadership</p>
                      <p className="text-[11px] text-zinc-600">Hand off owner before you leave, or use Leave — the next officer or member inherits automatically.</p>
                      <div className="flex flex-wrap gap-2">
                        <select
                          name="targetUserId"
                          required
                          className="min-w-48 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Choose member…
                          </option>
                          {guildDetails.members
                            .filter((m) => m.userId !== user.id && m.role !== "OWNER")
                            .map((m) => {
                              const cn = m.user.characters[0]?.name ?? "Unknown";
                              return (
                                <option key={m.userId} value={m.userId}>
                                  {cn} ({m.role})
                                </option>
                              );
                            })}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                        >
                          Transfer ownership
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <form action={asFormVoid(leaveGuildAction)} className="mt-3">
                    <button
                      type="submit"
                      className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                    >
                      {isOwner ? "Leave guild (succession)" : "Leave guild"}
                    </button>
                  </form>
                </section>

                {canManage ? (
                  <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Invites</h2>
                    <form action={asFormVoid(inviteToGuildAction)} className="mt-3 flex flex-wrap gap-2">
                      <input
                        name="characterName"
                        placeholder="Character name"
                        className="min-w-56 flex-1 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                      >
                        Send invite
                      </button>
                    </form>
                    {guildDetails.invites.length ? (
                      <ul className="mt-3 space-y-2">
                        {guildDetails.invites.map((invite) => {
                          const inviteeChar = invite.invitee.characters[0];
                          return (
                            <li key={invite.id} className="flex items-center justify-between rounded-lg border border-zinc-900 bg-black/30 px-3 py-2">
                              <p className="text-sm text-zinc-300">
                                Pending: {inviteeChar?.name ?? "Unknown"}
                              </p>
                              <form action={asFormVoid(cancelGuildInviteAction)}>
                                <input type="hidden" name="inviteId" value={invite.id} />
                                <button
                                  type="submit"
                                  className="rounded-lg border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-white/35 hover:bg-black/70"
                                >
                                  Cancel
                                </button>
                              </form>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </section>
                ) : null}

                <section className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Donations</h2>
                  <p className="mt-2 text-xs text-zinc-500">
                    Donations grant Guild XP (1 XP per gold). Guild Level increases combat XP and will unlock stronger guild
                    bosses later.
                  </p>
                  <form action={asFormVoid(donateGuildGoldAction)} className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      name="amount"
                      type="number"
                      min={1}
                      max={character.gold}
                      placeholder="Gold amount"
                      className="w-40 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                    >
                      Donate
                    </button>
                    <span className="text-xs text-zinc-500">You have {character.gold}g</span>
                  </form>
                  {guildDetails.donations.length ? (
                    <>
                      <p className="mt-3 text-[11px] text-zinc-600">Recent donations (latest 20).</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {guildDetails.donations.map((d) => {
                          const donor = d.user.characters[0];
                          return (
                            <li key={d.id} className="text-zinc-300">
                              {donor?.name ?? "Unknown"} donated {d.amount}g
                              <span className="ml-2 text-xs text-zinc-500">{new Date(d.createdAt).toLocaleString()}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No donations yet.</p>
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
                    {guildDetails.chatMessages.length === 0 ? (
                      <p className="text-zinc-500">No guild messages yet.</p>
                    ) : (
                      [...guildDetails.chatMessages].reverse().map((m) => (
                        <p key={m.id} className="text-zinc-300">
                          <span className="text-zinc-500">[{new Date(m.createdAt).toLocaleTimeString()}]</span>{" "}
                          <span className="font-medium text-zinc-100">{m.username}</span>: {m.text}
                        </p>
                      ))
                    )}
                  </div>
                </section>
              </>
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
