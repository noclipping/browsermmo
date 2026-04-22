import { redirect } from "next/navigation";
import { allocateStatAction, consumeTonicOutsideCombatAction, equipItemAction, returnToTownAction, unequipSlotAction } from "@/app/actions/game";
import { AdventureLoadoutPanel } from "@/components/adventure-loadout-panel";
import { ADVENTURE_REGIONS } from "@/lib/game/adventure";
import { CLASS_SKILLS } from "@/lib/game/constants";
import { requiredXpForLevel } from "@/lib/game/progression";
import { GameNav } from "@/components/game-nav";
import { GameTopBar } from "@/components/game-top-bar";
import { MobileAdventureOverlays } from "@/components/mobile-adventure-overlays";
import { requireCharacter, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { gearStatSummary, itemDisplayName } from "@/lib/game/item-display";
import { characterMeetsItemStatRequirements, formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { buildCharacterStats } from "@/lib/game/stats";
import { ItemHoverCard } from "@/components/item-hover-card";
import { WorldChatPanel } from "@/components/world-chat-panel";

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
    <div className="min-h-screen bg-[#0c0a09] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(120,53,15,0.25),transparent)]">
      <main className="w-full space-y-6 px-4 py-8 pb-16 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <GameTopBar username={user.username} characterName={character.name} characterClass={character.class} />
          <GameNav inTownRegion={inTownRegion} combatLocked={combatLocked} returnToTownAction={returnToTownAction} />
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
          <article className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sheet</h2>
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
              <p className="text-amber-200/90">Gold {character.gold}</p>
              <p className="pt-1 text-violet-200/90">Unspent stat points: {character.statPoints}</p>
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
                      className="h-7 w-7 rounded border border-amber-800/70 bg-amber-950/50 text-sm font-bold text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-35"
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
          <article className="rounded-xl border border-amber-900/35 bg-amber-950/10 p-4 shadow-md">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-600/80">Class skill</h2>
            <p className="mt-2 text-lg font-semibold text-amber-100">
              <span className="mr-2">{classSkill.emoji}</span>
              {classSkill.name}
              <span className="ml-2 text-sm font-normal text-zinc-500">({classSkill.cooldown}-turn cooldown, no mana)</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{classSkill.description}</p>
            <p className="mt-3 text-xs text-zinc-600">Use the Skill button in turn-based combat when your cooldown is clear.</p>
          </article>
          <article className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Equipment</h2>
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
                          <span className="mt-0.5 block text-[11px] text-amber-600/90">Req: {formatItemStatRequirements(entry.item)}</span>
                        ) : null}
                        {!combatLocked ? (
                          <form action={unequipSlotAction} className="mt-1 inline-block">
                            <input type="hidden" name="slot" value={entry.slot} />
                            <button
                              type="submit"
                              className="text-[11px] font-semibold text-zinc-500 underline decoration-zinc-700 hover:text-amber-200/90"
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

            <article className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pack</h2>
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
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/30 px-3 py-2 text-sm">
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
                      <span className="mt-0.5 block text-[11px] text-amber-600/90">Req: {formatItemStatRequirements(entry.item)}</span>
                    ) : null}
                  </span>
                  {entry.item.slot !== "CONSUMABLE" ? (
                    <form action={equipItemAction}>
                      <input type="hidden" name="itemId" value={entry.item.id} />
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
                        className="rounded border border-emerald-900/60 bg-emerald-950/40 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-40"
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

            <article className="rounded-xl border border-violet-900/30 bg-violet-950/10 p-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-violet-400/80">Solo dungeon</h2>
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
