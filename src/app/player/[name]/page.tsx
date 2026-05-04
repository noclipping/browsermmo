import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cancelGuildInviteAction, inviteToGuildAction } from "@/app/actions/guild";
import { consumeTonicOutsideCombatAction, returnToTownAction, returnToTownAndShopAction } from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { ItemHoverCard } from "@/components/item-hover-card";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { CLASS_DISPLAY_NAME } from "@/lib/game/constants";
import { itemDisplayName } from "@/lib/game/item-display";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { portraitForClass } from "@/lib/game/portraits";
import { buildCharacterStats } from "@/lib/game/stats";
import { prisma } from "@/lib/prisma";
import { FriendProfileActions } from "@/components/friend-profile-actions";
import { PresenceIndicator } from "@/components/presence-indicator";
import { asFormVoid } from "@/lib/as-form-void";
import { displayTitleForEquippedKey } from "@/lib/game/achievements";
import { reevaluateMilestoneAchievements } from "@/lib/game/milestone-achievements";
import { getFriendProfileButtonState } from "@/lib/social/friendship";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ name: string }> | { name: string };
};

export default async function PublicProfilePage({ params }: PageProps) {
  const user = await requireUser();
  const myCharacter = await requireCharacter(user.id);
  const p = await Promise.resolve(params);
  const decodedName = decodeURIComponent(p.name ?? "").trim();
  if (!decodedName) notFound();

  const [equipment, inventory, currentRegion, townRegion, combatActive, myMembership, character] = await Promise.all([
    prisma.characterEquipment.findMany({ where: { characterId: myCharacter.id }, include: { item: true } }),
    prisma.inventoryItem.findMany({ where: { characterId: myCharacter.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
    prisma.region.findUnique({ where: { id: myCharacter.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: myCharacter.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.guildMember.findUnique({
      where: { userId: user.id },
      select: { guildId: true, role: true },
    }),
    prisma.character.findFirst({
      where: {
        name: {
          equals: decodedName,
          mode: "insensitive",
        },
      },
      include: {
        equipment: {
          include: { item: true },
        },
        region: true,
        user: {
          select: {
            id: true,
            createdAt: true,
            lastSeenAt: true,
            guildMembership: {
              select: {
                role: true,
                guild: {
                  select: {
                    name: true,
                    emoji: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!character) notFound();
  if (character.userId === user.id) {
    await prisma.$transaction(async (tx) => {
      await reevaluateMilestoneAchievements(tx, character.id);
    });
  }
  const [viewedAchievementCount, achievementCatalogTotal] = await Promise.all([
    prisma.characterAchievement.count({ where: { characterId: character.id } }),
    prisma.achievement.count(),
  ]);
  const viewedEquippedTitle = await displayTitleForEquippedKey(character.equippedAchievementKey);
  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const inTownRegion = !!townRegion && myCharacter.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const myEffective = buildCharacterStats(myCharacter, equipment);
  const viewedEffective = buildCharacterStats(character, character.equipment);
  const shownLastSeen = character.user.lastSeenAt ?? character.updatedAt;
  const portrait = portraitForClass(character.class, character.portraitKey);
  const friendState = await getFriendProfileButtonState(prisma, user.id, character.user.id);
  const viewedGuildMembership = character.user.guildMembership[0] ?? null;
  const canManageGuildInvites = !!myMembership && (myMembership.role === "OWNER" || myMembership.role === "OFFICER");
  const canInviteToGuild =
    !!myMembership &&
    canManageGuildInvites &&
    !viewedGuildMembership &&
    character.user.id !== user.id;
  const existingGuildInvite =
    canManageGuildInvites && myMembership
      ? await prisma.guildInvite.findUnique({
          where: {
            guildId_inviteeId: {
              guildId: myMembership.guildId,
              inviteeId: character.user.id,
            },
          },
          select: { id: true, status: true },
        })
      : null;
  const hasPendingGuildInvite = existingGuildInvite?.status === "PENDING";

  const panelClass =
    "rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 shadow-md backdrop-blur-[1px]";
  const sectionTitleClass = "text-[10px] font-bold uppercase tracking-widest text-white/70";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0">
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art */}
          <img
            src="/images/areabanners/playerbanner.png"
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
          <GameTopBar characterName={myCharacter.name} characterLevel={myCharacter.level} />
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
                character={myCharacter}
                equipment={equipment}
                inventory={inventory}
                effective={myEffective}
                combatLocked={combatLocked}
                consumeTonicAction={consumeTonicOutsideCombatAction}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div className={`${panelClass} p-5`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Public profile</p>
              <div className="mt-2 flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- static portrait asset */}
                <img
                  src={portrait?.src ?? ""}
                  alt={portrait?.label ?? `${character.name} portrait`}
                  width={128}
                  height={128}
                  className="h-24 w-24 rounded-lg border border-white/15 object-cover object-top bg-black/40 md:h-28 md:w-28"
                  decoding="async"
                />
                <div className="min-w-0">
                  <h1 className="font-serif text-3xl text-zinc-100">{character.name}</h1>
                  {viewedEquippedTitle ? (
                    <p className="mt-0.5 text-[11px] italic leading-snug text-zinc-500 md:text-xs">{viewedEquippedTitle}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
                    <span aria-hidden>🏆</span> {viewedAchievementCount}/{achievementCatalogTotal} achievements
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {CLASS_DISPLAY_NAME[character.class]} · Level {character.level} · {character.region.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Account created {new Date(character.user.createdAt).toLocaleDateString()} · Last active{" "}
                    {new Date(shownLastSeen).toLocaleString()}
                  </p>
                  {viewedGuildMembership ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      Guild {viewedGuildMembership.guild.emoji} {viewedGuildMembership.guild.name} ·{" "}
                      {viewedGuildMembership.role}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">Guild None</p>
                  )}
                  <PresenceIndicator lastSeenAt={character.user.lastSeenAt} />
                  {character.bio ? (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">{character.bio}</p>
                  ) : null}
                  <div className="mt-2">
                    <FriendProfileActions state={friendState} targetUserId={character.user.id} />
                  </div>
                  {canInviteToGuild ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {hasPendingGuildInvite ? (
                        <>
                          <p className="text-xs font-medium text-amber-200/85">Guild invite sent</p>
                          <form action={asFormVoid(cancelGuildInviteAction)}>
                            <input type="hidden" name="inviteId" value={existingGuildInvite.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-zinc-700 bg-black/45 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-black/65"
                            >
                              Cancel invite
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={asFormVoid(inviteToGuildAction)}>
                          <input type="hidden" name="characterName" value={character.name} />
                          <button
                            type="submit"
                            className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/35"
                          >
                            Invite to guild
                          </button>
                        </form>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className={`${panelClass} p-4`}>
                <h2 className={sectionTitleClass}>Core stats</h2>
                <div className="mt-3 space-y-1 text-sm text-zinc-300">
                  <p>HP {viewedEffective.maxHp}</p>
                  <p>Melee {viewedEffective.meleeAttack} · Ranged {viewedEffective.rangedAttack} · Magic {viewedEffective.magicAttack}</p>
                  <p>Defense {viewedEffective.defense} · Mana {viewedEffective.maxMana}</p>
                  <p>
                    Crit {(viewedEffective.critChance * 100).toFixed(1)}% · Lifesteal {(viewedEffective.lifeSteal * 100).toFixed(1)}% · Skill +{(viewedEffective.skillPowerBonus * 100).toFixed(1)}%
                  </p>
                </div>
              </article>

              <article className={`${panelClass} p-4`}>
                <h2 className={sectionTitleClass}>Attributes</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-300">
                  <p>STR {viewedEffective.strength}</p>
                  <p>CON {viewedEffective.constitution}</p>
                  <p>INT {viewedEffective.intelligence}</p>
                  <p>DEX {viewedEffective.dexterity}</p>
                </div>
              </article>
            </div>

            <article className={`${panelClass} p-4`}>
              <h2 className={sectionTitleClass}>Equipped gear</h2>
              <ul className="mt-3 space-y-2">
                {character.equipment.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between border-b border-white/10 py-1.5 text-sm last:border-0"
                  >
                    <span className="text-zinc-500">{entry.slot.replace(/_/g, " ")}</span>
                    <span className="min-w-0 text-right">
                      {entry.item ? (
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
                        >
                          <span className={rarityNameClass(entry.item.rarity)}>
                            {entry.item.emoji} {itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)}
                          </span>
                        </ItemHoverCard>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </article>

            <div className="flex gap-2">
              <Link
                href="/players"
                className="inline-block rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
              >
                Player directory
              </Link>
            </div>
          </div>

          <div className="hidden min-w-0 lg:block">
            <div className="lg:sticky lg:top-4 lg:mr-auto lg:w-[min(22rem,100%)]">
              <WorldChatPanel username={myCharacter.name} userId={user.id} />
            </div>
          </div>
        </div>

        <MobileAdventureOverlays
          inventoryPanel={
            <AdventureLoadoutPanel
              character={myCharacter}
              equipment={equipment}
              inventory={inventory}
              effective={myEffective}
              combatLocked={combatLocked}
              consumeTonicAction={consumeTonicOutsideCombatAction}
            />
          }
          chatPanel={<WorldChatPanel compact username={myCharacter.name} userId={user.id} />}
        />
      </main>
    </div>
  );
}
