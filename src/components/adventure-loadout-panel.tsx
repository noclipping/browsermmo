import { equipItemAction, unequipSlotAction } from "@/app/actions/game";
import { EQUIPMENT_SLOTS, HEALTH_POTION_ITEM_KEY } from "@/lib/game/constants";
import { requiredXpForLevel } from "@/lib/game/progression";
import { itemDisplayName } from "@/lib/game/item-display";
import { characterMeetsItemStatRequirements, formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import type { Character, CharacterEquipment, InventoryItem, Item } from "@prisma/client";
import { ItemHoverCard } from "@/components/item-hover-card";

type EquipRow = CharacterEquipment & { item: Item | null };
type InvRow = InventoryItem & { item: Item };

type Effective = {
  meleeAttack: number;
  rangedAttack: number;
  magicAttack: number;
  defense: number;
  maxHp: number;
  maxMana: number;
  critChance: number;
  lifeSteal: number;
  skillPowerBonus: number;
  strength: number;
  constitution: number;
  intelligence: number;
  dexterity: number;
};

export function AdventureLoadoutPanel({
  character,
  equipment,
  inventory,
  effective,
  combatLocked,
  consumeTonicAction,
}: {
  character: Character;
  equipment: EquipRow[];
  inventory: InvRow[];
  effective: Effective;
  combatLocked: boolean;
  consumeTonicAction?: () => Promise<void>;
}) {
  const bySlot = new Map(equipment.map((e) => [e.slot, e]));
  const gearInv = inventory.filter((r) => r.item.slot !== "CONSUMABLE");
  const xpNeeded = requiredXpForLevel(character.level);
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.round((character.xp / xpNeeded) * 100)) : 0;
  const hpPct = character.maxHp > 0 ? Math.min(100, Math.round((character.hp / character.maxHp) * 100)) : 0;
  const tonicCount = inventory.find((r) => r.item.key === HEALTH_POTION_ITEM_KEY)?.quantity ?? 0;
  const canUseTonic = !combatLocked && tonicCount > 0 && character.hp < character.maxHp;

  return (
    <aside className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-md">
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Adventure loadout</h2>
      </div>
      <div className="rounded-lg border border-amber-900/30 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-300">
        <p>Lv {character.level}</p>
        <div className="mt-1">
          <p className="text-[11px] text-zinc-400">XP {character.xp}/{xpNeeded}</p>
          <div className="mt-1 h-2 overflow-hidden rounded border border-violet-900/50 bg-zinc-900/80">
            <div className="h-full bg-linear-to-r from-violet-700 to-fuchsia-500" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-[11px] text-zinc-400">
            HP {character.hp}/{character.maxHp}
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded border border-red-900/50 bg-zinc-900/80">
            <div className="h-full bg-linear-to-r from-red-800 to-red-500" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <p className="text-amber-200/90">Gold {character.gold}</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          STR {effective.strength} · CON {effective.constitution} · INT {effective.intelligence} · DEX {effective.dexterity}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">
            {combatLocked ? "Gear + tonics locked in active battle." : "Swap gear and use tonics outside battle."}
          </span>
          <span className="group relative inline-flex">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 text-[10px] text-zinc-300">
              ?
            </span>
            <span className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1 w-56 rounded border border-zinc-700 bg-zinc-950/95 p-2 text-[10px] text-zinc-300 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
              Melee {effective.meleeAttack} · Ranged {effective.rangedAttack} · Magic {effective.magicAttack}
              <br />
              DEF {effective.defense} · Mana {effective.maxMana} · Crit {(effective.critChance * 100).toFixed(1)}%
              <br />
              Lifesteal {(effective.lifeSteal * 100).toFixed(1)}% · Skill power +{(effective.skillPowerBonus * 100).toFixed(1)}%
            </span>
          </span>
        </div>
        {consumeTonicAction ? (
          <form action={consumeTonicAction} className="mt-2">
            <button
              type="submit"
              disabled={!canUseTonic}
              className="w-full rounded border border-emerald-800/60 bg-emerald-950/40 px-2 py-1 text-[11px] font-semibold text-emerald-200 enabled:hover:bg-emerald-900/35 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                combatLocked
                  ? "Cannot use tonic during active battle."
                  : tonicCount < 1
                    ? "No tonics in pack."
                    : character.hp >= character.maxHp
                      ? "Already at full HP."
                      : "Consume one tonic to heal now."
              }
            >
              Drink tonic ({tonicCount})
            </button>
          </form>
        ) : null}
      </div>

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Worn</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {EQUIPMENT_SLOTS.map((slot) => {
            const row = bySlot.get(slot);
            const it = row?.item;
            return (
              <li key={slot} className="rounded-lg border border-zinc-900 bg-black/25 px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600">{slot}</span>
                  {it && row ? (
                    <div className="min-w-0 flex-1 text-right">
                      <ItemHoverCard
                        item={it}
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
                        <span className={`font-medium ${rarityNameClass(it.rarity)}`}>
                          {it.emoji} {itemDisplayName(it, row.forgeLevel, row.affixPrefix)}
                        </span>
                      </ItemHoverCard>
                      {!combatLocked ? (
                        <form action={unequipSlotAction} className="mt-1 inline-block">
                          <input type="hidden" name="slot" value={slot} />
                          <button
                            type="submit"
                            className="text-[11px] font-semibold text-zinc-500 underline decoration-zinc-700 hover:text-amber-200/90"
                          >
                            Unequip
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!combatLocked && gearInv.length > 0 ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Pack (gear)</h3>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
            {gearInv.map((entry) => {
              const canEquip =
                character.level >= entry.item.requiredLevel && characterMeetsItemStatRequirements(character, entry.item);
              const equippedSameSlot = bySlot.get(entry.item.slot);
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
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-900 bg-black/25 px-2 py-2">
                  <div className="min-w-0">
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
                    {formatItemStatRequirements(entry.item) ? (
                      <span className="mt-0.5 block text-[10px] text-amber-700/90">Req: {formatItemStatRequirements(entry.item)}</span>
                    ) : null}
                  </div>
                  <form action={equipItemAction}>
                    <input type="hidden" name="itemId" value={entry.item.id} />
                    <button
                      type="submit"
                      disabled={!canEquip}
                      className="rounded border border-amber-800/60 px-2 py-1 text-[11px] font-semibold text-amber-200/90 enabled:hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Equip
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
