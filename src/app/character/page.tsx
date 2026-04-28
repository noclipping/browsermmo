import { redirect } from "next/navigation";
import {
  allocateStatAction,
  consumeTonicOutsideCombatAction,
  equipItemAction,
  returnToTownAction,
  returnToTownAndShopAction,
  unequipSlotAction,
} from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { CLASS_SKILLS } from "@/lib/game/constants";
import { requiredXpForLevel } from "@/lib/game/progression";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { CharacterPortraitPicker } from "@/components/character-portrait-picker";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { gearStatSummary, itemDisplayName } from "@/lib/game/item-display";
import { characterMeetsItemStatRequirements, formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { buildCharacterStats } from "@/lib/game/stats";
import { ItemHoverCard } from "@/components/item-hover-card";
import { WorldChatPanel } from "@/components/world-chat-panel";
import { updateCharacterBioAction, updateCharacterPortraitAction } from "@/app/actions/character";
import { CharacterBioEditor } from "@/components/character-bio-editor";

export const dynamic = "force-dynamic";

export default async function CharacterPage() {
  const user = await requireUser();
  const character = await requireCharacter(user.id);

  const [inventory, equipment, dungeon, currentRegion, townRegion, combatActive] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true }, orderBy: { createdAt: "desc" } }),
    prisma.characterEquipment.findMany({ where: { characterId: character.id }, include: { item: true } }),
    prisma.dungeon.findFirst({ where: { key: "mossy_cellar" }, include: { bossEnemy: true } }),
    prisma.region.findUnique({ where: { id: character.regionId } }),
    prisma.region.findUnique({ where: { key: "town_outskirts" } }),
    prisma.soloCombatEncounter.findFirst({
      where: { characterId: character.id, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  const regionKey = currentRegion?.key ?? "";
  if (!currentRegion || !ADVENTURE_REGIONS[regionKey]) redirect("/character/new");

  const effective = buildCharacterStats(character, equipment);
  const equippedBySlot = new Map(
    equipment
      .filter((entry) => entry.item)
      .map((entry) => [entry.slot, entry]),
  );
  const classSkill = CLASS_SKILLS[character.class];
  const canAllocate = character.statPoints > 0;
  const inTownRegion = !!townRegion && character.regionId === townRegion.id;
  const combatLocked = !!combatActive;

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
            <section className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Sheet</h2>
            <div className="mt-3">
              <CharacterPortraitPicker
                characterClass={character.class}
                portraitKey={character.portraitKey}
                updatePortraitAction={updateCharacterPortraitAction}
              />
            </div>
            <div className="mt-3 space-y-1 font-mono text-sm text-zinc-300">
              <p>
                Lv {character.level} · XP {character.xp}/{requiredXpForLevel(character.level)}
              </p>
              <p>
                HP {character.hp}/{character.maxHp}{" "}
                <span className="text-[11px] text-zinc-500">
                  (combat max {effective.maxHp})
                </span>
              </p>
              <p>
                ATK {character.attack} · DEF {character.defense}
              </p>
              <p className="text-xs text-zinc-500">
                Effective: Melee {effective.meleeAttack} · Ranged {effective.rangedAttack} · Magic {effective.magicAttack}
              </p>
              <p className="text-xs text-zinc-500">
                DEF {effective.defense} · Mana {effective.maxMana} · Crit {(effective.critChance * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-500">
                Lifesteal {(effective.lifeSteal * 100).toFixed(1)}% · Skill power +{(effective.skillPowerBonus * 100).toFixed(1)}%
              </p>
              <p className="text-zinc-100">Gold {character.gold}</p>
              <p className="pt-1 text-zinc-300">Unspent stat points: {character.statPoints}</p>
            </div>
            <div className="mt-4 space-y-2 border-t border-zinc-900 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Core attributes</p>
              {(
                [
                  { label: "STR", field: "STRENGTH" as const, value: character.strength },
                  { label: "CON", field: "CONSTITUTION" as const, value: character.constitution },
                  { label: "INT", field: "INTELLIGENCE" as const, value: character.intelligence },
                  { label: "DEX", field: "DEXTERITY" as const, value: character.dexterity },
                ] as const
              ).map((row) => (
                <div key={row.field} className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                  <span className="font-mono">
                    {row.label} {row.value}
                  </span>
                  <form action={allocateStatAction}>
                    <input type="hidden" name="stat" value={row.field} />
                    <button
                      type="submit"
                      disabled={!canAllocate}
                      className="h-7 w-7 rounded-lg border border-white/25 bg-black/55 text-sm font-bold text-zinc-100 hover:border-white/45 hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-35"
                      title={canAllocate ? `Add 1 ${row.label}` : "No stat points"}
                    >
                      +
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </article>
          <div className="space-y-4">
          <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Class skill</h2>
            <p className="mt-2 text-lg font-semibold text-zinc-100">
              <span className="mr-2">{classSkill.emoji}</span>
              {classSkill.name}
              <span className="ml-2 text-sm font-normal text-zinc-500">({classSkill.cooldown}-turn cooldown, no mana)</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{classSkill.description}</p>
            <p className="mt-3 text-xs text-zinc-600">Use the Skill button in turn-based combat when your cooldown is clear.</p>
          </article>
          <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Public profile bio</h2>
            <p className="mt-2 text-xs text-zinc-500">Always visible to everyone on your public profile.</p>
            <div className="mt-3">
              <CharacterBioEditor
                initialBio={character.bio}
                updateBioAction={updateCharacterBioAction}
              />
            </div>
          </article>
          <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
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
          </div>
            </section>

            <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Pack</h2>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {inventory.length ? (
              inventory.map((entry) => {
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
            ) : (
              <p className="text-sm text-zinc-500">Empty pack. Win battles for loot.</p>
            )}
          </div>
            </article>

            <article className="rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
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
              combatLocked={combatLocked}
              consumeTonicAction={consumeTonicOutsideCombatAction}
            />
          }
          chatPanel={<WorldChatPanel compact />}
        />
      </main>
    </div>
  );
}
