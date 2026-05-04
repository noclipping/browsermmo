import { redirect } from "next/navigation";
import {
  allocateStatAction,
  consumeTonicOutsideCombatAction,
  equipItemAction,
  returnToTownAction,
  returnToTownAndShopAction,
  unequipSlotAction,
  updateRogueSkillAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { activeSkillForCharacter, CLASS_DISPLAY_NAME, ROGUE_SKILLS } from "@/lib/game/constants";
import { requiredXpForLevel } from "@/lib/game/progression";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { CharacterPortraitPicker } from "@/components/character-portrait-picker";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { TreasuryFilters } from "@/components/treasury-filters";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { gearStatSummary, itemDisplayName } from "@/lib/game/item-display";
import { characterMeetsItemStatRequirements, formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { buildCharacterStats } from "@/lib/game/stats";
import { ItemHoverCard } from "@/components/item-hover-card";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { debugResetAllAchievementsAction } from "@/app/actions/achievements";
import { isAchievementDebugResetEnabled } from "@/lib/achievement-debug";
import { updateCharacterBioAction, updateCharacterPortraitAction } from "@/app/actions/character";
import { CharacterBioEditor } from "@/components/character-bio-editor";
import { AchievementToastPostActionDrain } from "@/components/achievement-toast-post-action-drain";
import { CharacterAchievementsModal } from "@/components/character-achievements-modal";
import { formatAchievementPlayerPercentLabel } from "@/lib/game/achievements";
import { reevaluateMilestoneAchievements } from "@/lib/game/milestone-achievements";

export const dynamic = "force-dynamic";

const SLOT_FILTERS = ["ALL", "WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET", "CONSUMABLE"] as const;
const RARITY_FILTERS = ["ALL", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "GODLY"] as const;
const CLASS_FILTERS = ["ALL", "WARRIOR", "MAGE", "ROGUE"] as const;

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

type CharacterPageProps = {
  searchParams?: Promise<{
    cSlot?: string;
    cRarity?: string;
    cClass?: string;
  }>;
};

export default async function CharacterPage({ searchParams }: CharacterPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const user = await requireUser();
  const character = await requireCharacter(user.id);
  const showAchievementDebugReset = isAchievementDebugResetEnabled();

  await prisma.$transaction(async (tx) => {
    await reevaluateMilestoneAchievements(tx, character.id);
  });

  const [
    inventory,
    equipment,
    dungeon,
    currentRegion,
    townRegion,
    combatActive,
    guildMembership,
    achievementsCatalog,
    characterAchievements,
    totalCharacters,
    achievementUnlockGroups,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
    prisma.dungeon.findFirst({ where: { key: "mossy_cellar" }, include: { bossEnemy: true } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.guildMember.findUnique({
      where: { userId: user.id },
      include: { guild: { select: { name: true, emoji: true } } },
    }),
    prisma.achievement.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.characterAchievement.findMany({
      where: { characterId: character.id },
      select: { achievementId: true },
    }),
    prisma.character.count(),
    prisma.characterAchievement.groupBy({
      by: ["achievementId"],
      _count: { _all: true },
    }),
  ]);

  const unlockCountByAchievementId = new Map(
    achievementUnlockGroups.map((g) => [g.achievementId, g._count._all]),
  );
  const unlockedAchievementIds = new Set(characterAchievements.map((a) => a.achievementId));
  const achievementUnlockedCount = unlockedAchievementIds.size;
  const achievementTotalCount = achievementsCatalog.length;
  const achievementModalRows = achievementsCatalog.map((a) => ({
    key: a.key,
    name: a.name,
    description: a.description,
    icon: a.icon,
    titleReward: a.titleReward,
    category: a.category,
    unlocked: unlockedAchievementIds.has(a.id),
    equipped: character.equippedAchievementKey === a.key,
    playerPercentLabel: formatAchievementPlayerPercentLabel(
      unlockCountByAchievementId.get(a.id) ?? 0,
      totalCharacters,
    ),
  }));
  const equippedAchievement = character.equippedAchievementKey
    ? achievementsCatalog.find((a) => a.key === character.equippedAchievementKey)
    : null;
  const equippedTitleValid =
    equippedAchievement &&
    unlockedAchievementIds.has(equippedAchievement.id) &&
    equippedAchievement.titleReward?.trim();
  const equippedTitleLabel = equippedTitleValid ? equippedAchievement.titleReward!.trim() : null;

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const effective = buildCharacterStats(character, equipment);
  const equippedBySlot = new Map(
    equipment
      .filter((entry) => entry.item)
      .map((entry) => [entry.slot, entry]),
  );
  const classSkill = activeSkillForCharacter(character.class, character.rogueSkill);
  const canAllocate = character.statPoints > 0;
  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;
  const packSlot = pickFilter(params?.cSlot, SLOT_FILTERS, "ALL");
  const packRarity = pickFilter(params?.cRarity, RARITY_FILTERS, "ALL");
  const packClass = pickFilter(params?.cClass, CLASS_FILTERS, "ALL");
  const filteredInventory = inventory.filter((entry) => {
    if (packSlot !== "ALL" && entry.item.slot !== packSlot) return false;
    if (packRarity !== "ALL" && entry.item.rarity !== packRarity) return false;
    if (packClass !== "ALL" && itemClassType(entry.item) !== packClass) return false;
    return true;
  });

  const glassPanel =
    "rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 shadow-md backdrop-blur-[1px]";
  const xpNeeded = requiredXpForLevel(character.level);
  const headerChipClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] text-zinc-200";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0c0a09]">
      {/* Character sheet banner: same styling system as town/shop pages */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0"
      >
        <div className="relative w-full max-md:min-h-[72vh] max-md:overflow-hidden leading-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed art; md+ intrinsic sizing shows full frame */}
          <img
            src="/images/areabanners/charactersheetbanner.png"
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
            <section className={`${glassPanel} p-4 md:p-5`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Character sheet</p>
              <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                <div className="flex shrink-0 justify-center md:justify-start">
                  <CharacterPortraitPicker
                    characterClass={character.class}
                    portraitKey={character.portraitKey}
                    updatePortraitAction={updateCharacterPortraitAction}
                    previewImgClassName="mx-auto h-36 w-36 rounded-lg border border-white/10 object-cover object-top bg-black/40 md:h-44 md:w-44"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-0">
                      <h1 className="font-serif text-3xl text-zinc-100 md:text-4xl">{character.name}</h1>
                      {equippedTitleLabel ? (
                        <p className="mt-0.5 text-[11px] italic leading-snug text-zinc-500 md:text-xs">{equippedTitleLabel}</p>
                      ) : (
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 md:text-xs">
                          No title equipped · Open Achievements to choose one
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
                      <CharacterAchievementsModal
                        rows={achievementModalRows}
                        equippedLabel={equippedTitleLabel}
                        unlockedCount={achievementUnlockedCount}
                        totalCount={achievementTotalCount}
                      />
                      {showAchievementDebugReset ? (
                        <form action={debugResetAllAchievementsAction} className="max-w-[11rem]">
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-red-500/35 bg-red-950/40 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-200/90 hover:border-red-400/50 hover:bg-red-950/55"
                          >
                            Debug: wipe achievements
                          </button>
                          <p className="mt-1 text-[9px] leading-tight text-red-400/70">
                            Unlocks + milestone/chest/treasury counters. Level, gear, and guild can still re-grant feats.
                          </p>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-300">
                      <span className="font-semibold text-zinc-200">{CLASS_DISPLAY_NAME[character.class]}</span>
                      <span className="text-zinc-500"> · </span>
                      <span>Level {character.level}</span>
                    </p>
                    <p className="text-sm text-zinc-400">
                      {guildMembership ? (
                        <>
                          <span className="text-zinc-500">Guild </span>
                          <span className="font-medium text-zinc-200">
                            {guildMembership.guild.emoji} {guildMembership.guild.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-500">No guild</span>
                      )}
                      <span className="text-zinc-600"> · </span>
                      <span>{currentRegion.name}</span>
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Public bio</p>
                    <CharacterBioEditor
                      initialBio={character.bio}
                      updateBioAction={updateCharacterBioAction}
                      variant="header"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <span className={headerChipClass} title="Current / max HP">
                      <span aria-hidden>❤️</span>
                      <span className="text-zinc-500">HP</span>
                      <span className="font-mono font-semibold tabular-nums text-zinc-100">
                        {character.hp}/{character.maxHp}
                      </span>
                    </span>
                    <span className={headerChipClass} title="Experience toward next level">
                      <span aria-hidden>✨</span>
                      <span className="text-zinc-500">XP</span>
                      <span className="font-mono font-semibold tabular-nums text-zinc-100">
                        {character.xp}/{xpNeeded}
                      </span>
                    </span>
                    <span className={headerChipClass}>
                      <span aria-hidden>🪙</span>
                      <span className="text-zinc-500">Gold</span>
                      <span className="font-mono font-semibold tabular-nums text-amber-200/95">{character.gold}</span>
                    </span>
                    <span className={headerChipClass}>
                      <span aria-hidden>📊</span>
                      <span className="text-zinc-500">Points</span>
                      <span className="font-mono font-semibold tabular-nums text-violet-200/90">{character.statPoints}</span>
                    </span>
                    <span className={headerChipClass} title="Achievements unlocked / catalog">
                      <span aria-hidden>🏆</span>
                      <span className="font-mono font-semibold tabular-nums text-amber-200/90">
                        {achievementUnlockedCount}/{achievementTotalCount}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${glassPanel} p-3 md:p-4`}>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Character stats</h2>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">Attributes and battle ratings.</p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    { label: "Strength", short: "STR", emoji: "💪", field: "STRENGTH" as const, value: character.strength },
                    { label: "Constitution", short: "CON", emoji: "❤️", field: "CONSTITUTION" as const, value: character.constitution },
                    { label: "Intelligence", short: "INT", emoji: "🔮", field: "INTELLIGENCE" as const, value: character.intelligence },
                    { label: "Dexterity", short: "DEX", emoji: "🏹", field: "DEXTERITY" as const, value: character.dexterity },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.field}
                    className="flex items-center gap-2 rounded-lg border border-amber-900/30 bg-zinc-900/40 px-2.5 py-2 backdrop-blur-[1px] sm:gap-2.5"
                  >
                    <div className="flex w-10 shrink-0 flex-col items-start gap-px text-left">
                      <span className="text-base leading-none" aria-hidden>
                        {row.emoji}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{row.short}</span>
                      <span className="sr-only">{row.label}</span>
                    </div>
                    <p className="min-w-0 flex-1 text-center font-mono text-xl font-bold tabular-nums leading-none text-zinc-50 sm:text-[1.35rem]">
                      {row.value}
                    </p>
                    {canAllocate ? (
                      <form action={allocateStatAction} className="shrink-0">
                        <input type="hidden" name="stat" value={row.field} />
                        <button
                          type="submit"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/22 bg-black/55 text-sm font-bold text-zinc-100 hover:border-amber-500/45 hover:bg-black/75"
                          title={`Add 1 to ${row.label}`}
                        >
                          +
                        </button>
                      </form>
                    ) : (
                      <span className="h-8 w-8 shrink-0" aria-hidden />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-200/75">Battle ratings</h3>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { label: "Melee attack", value: effective.meleeAttack },
                        { label: "Ranged attack", value: effective.rangedAttack },
                        { label: "Magic attack", value: effective.magicAttack },
                        { label: "Defense", value: effective.defense },
                      ] as const
                    ).map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-lg border border-white/8 bg-black/28 px-2 py-1.5"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{cell.label}</p>
                        <p className="mt-0.5 font-mono text-base font-semibold tabular-nums leading-none text-zinc-100">
                          {cell.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { label: "Mana", value: effective.maxMana },
                        { label: "Combat max HP", value: effective.maxHp },
                        {
                          label: "Crit chance",
                          value: `${(effective.critChance * 100).toFixed(1)}%`,
                        },
                        {
                          label: "Lifesteal",
                          value: `${(effective.lifeSteal * 100).toFixed(1)}%`,
                        },
                      ] as const
                    ).map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-lg border border-white/8 bg-black/28 px-2 py-1.5"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{cell.label}</p>
                        <p className="mt-0.5 font-mono text-base font-semibold tabular-nums leading-none text-zinc-100">
                          {cell.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          label: "Skill power",
                          value: `+${(effective.skillPowerBonus * 100).toFixed(1)}%`,
                        },
                        { label: "Sheet ATK", value: character.attack, muted: true },
                        { label: "Sheet DEF", value: character.defense, muted: true },
                      ] as const
                    ).map((cell) => (
                      <div
                        key={cell.label}
                        className="rounded-lg border border-white/8 bg-black/28 px-2 py-1.5"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{cell.label}</p>
                        <p
                          className={`mt-0.5 font-mono text-base font-semibold tabular-nums leading-none ${
                            "muted" in cell && cell.muted ? "text-zinc-400" : "text-zinc-100"
                          }`}
                        >
                          {cell.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

          <article
            className={`${glassPanel} relative overflow-hidden border-amber-900/35 p-4 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.07)]`}
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-amber-900/25 pb-2">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/85">Class skill</h2>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Combat ability</span>
            </div>
            <p className="text-lg font-semibold text-zinc-100">
              <span className="mr-2">{classSkill.emoji}</span>
              {classSkill.name}
              <span className="ml-2 text-sm font-normal text-zinc-500">({classSkill.cooldown}-turn cooldown, no mana)</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{classSkill.description}</p>
            <p className="mt-3 text-xs text-zinc-600">Use the Skill button in turn-based combat when your cooldown is clear.</p>
            {character.class === "ROGUE" ? (
              <form action={updateRogueSkillAction} className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Rogue skill loadout</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ROGUE_SKILLS).map(([key, skill]) => (
                    <button
                      key={key}
                      type="submit"
                      name="skill"
                      value={key}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        character.rogueSkill === key
                          ? "border-violet-300/60 bg-violet-400/20 text-violet-100"
                          : "border-white/20 bg-black/55 text-zinc-200 hover:border-white/35 hover:bg-black/70"
                      }`}
                      title={skill.description}
                    >
                      {skill.emoji} {skill.name}
                    </button>
                  ))}
                </div>
              </form>
            ) : null}
          </article>
          <article className={`${glassPanel} p-4`}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Equipment</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {equipment.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-2 border-b border-zinc-900/80 py-1.5 last:border-0">
                  <span className="text-zinc-500">{entry.slot}</span>
                  <span className="text-right">
                    {entry.item ? (
                      <>
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
                          <span className={`font-medium ${rarityNameClass(entry.item.rarity)}`}>
                            {entry.item.emoji} {itemDisplayName(entry.item, entry.forgeLevel, entry.affixPrefix)}
                          </span>
                        </ItemHoverCard>
                        <span className="ml-2 text-xs text-zinc-500">{gearStatSummary(entry.item, entry.slot, entry.forgeLevel)}</span>
                        {formatItemStatRequirements(entry.item) ? (
                          <span className="mt-0.5 block text-[11px] text-zinc-500">Req: {formatItemStatRequirements(entry.item)}</span>
                        ) : null}
                        {!combatLocked ? (
                          <form action={unequipSlotAction} className="mt-1 inline-block">
                            <input type="hidden" name="slot" value={entry.slot} />
                            <button
                              type="submit"
                              className="text-[11px] font-semibold text-zinc-500 underline decoration-zinc-600 hover:text-zinc-200"
                            >
                              Unequip
                            </button>
                          </form>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </article>

            <article className={`${glassPanel} p-4`}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Pack</h2>
          <div className="mt-3">
            <TreasuryFilters
              prefix="c"
              slot={packSlot}
              rarity={packRarity}
              classType={packClass}
              slotOptions={SLOT_FILTERS}
              rarityOptions={RARITY_FILTERS}
              classOptions={CLASS_FILTERS}
              labels={{
                slot: "Pack type",
                rarity: "Pack rarity",
                classType: "Pack class type",
              }}
            />
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {filteredInventory.length ? (
              filteredInventory.map((entry) => {
                const canEquip =
                  entry.item.slot !== "CONSUMABLE" &&
                  character.level >= entry.item.requiredLevel &&
                  characterMeetsItemStatRequirements(character, entry.item);
                const equippedSameSlot = entry.item.slot === "CONSUMABLE" ? null : equippedBySlot.get(entry.item.slot);
                const compareAgainst =
                  equippedSameSlot?.item && equippedSameSlot.item.id !== entry.item.id
                    ? {
                        item: equippedSameSlot.item,
                        forgeLevel: equippedSameSlot.forgeLevel,
                        affixPrefix: equippedSameSlot.affixPrefix,
                        bonusLifeSteal: equippedSameSlot.bonusLifeSteal,
                        bonusCritChance: equippedSameSlot.bonusCritChance,
                        bonusSkillPower: equippedSameSlot.bonusSkillPower,
                        bonusStrength: equippedSameSlot.bonusStrength,
                        bonusConstitution: equippedSameSlot.bonusConstitution,
                        bonusIntelligence: equippedSameSlot.bonusIntelligence,
                        bonusDexterity: equippedSameSlot.bonusDexterity,
                      }
                    : null;
                return (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm">
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
                    {entry.item.slot !== "CONSUMABLE" ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        {gearStatSummary(entry.item, entry.item.slot, entry.forgeLevel)}
                      </span>
                    ) : null}
                    {entry.item.slot !== "CONSUMABLE" && formatItemStatRequirements(entry.item) ? (
                      <span className="mt-0.5 block text-[11px] text-zinc-500">Req: {formatItemStatRequirements(entry.item)}</span>
                    ) : null}
                  </span>
                  {entry.item.slot !== "CONSUMABLE" ? (
                    <form action={equipItemAction}>
                      <input type="hidden" name="inventoryEntryId" value={entry.id} />
                      <button
                        type="submit"
                        disabled={!canEquip || combatLocked}
                        title={
                          combatLocked
                            ? "Cannot change gear during a fight."
                            : !canEquip
                              ? character.level < entry.item.requiredLevel
                                ? `Need level ${entry.item.requiredLevel}`
                                : "Stats too low for this piece"
                              : "Equip"
                        }
                        className="rounded-lg border border-white/20 bg-black/55 px-2 py-1 text-xs font-semibold text-zinc-100 hover:border-white/35 hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Equip
                      </button>
                    </form>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600">Use in combat</span>
                  )}
                </div>
              );
              })
            ) : inventory.length ? (
              <p className="text-sm text-zinc-500">No items match your pack filters.</p>
            ) : (
              <p className="text-sm text-zinc-500">Empty pack. Win battles for loot.</p>
            )}
          </div>
            </article>

            <article className={`${glassPanel} p-4`}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Solo dungeon</h2>
          {dungeon ? (
            <p className="mt-2 text-sm text-zinc-400">
              {dungeon.name} — {dungeon.description}{" "}
              <span className="text-zinc-500">
                Boss: {dungeon.bossEnemy.emoji} {dungeon.bossEnemy.name} (suggested Lv {dungeon.minLevel}+)
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">No dungeon data.</p>
          )}
            </article>
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
