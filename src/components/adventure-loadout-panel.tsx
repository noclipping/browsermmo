import { equipItemAction, unequipSlotAction } from "@/app/actions/game";
import Link from "next/link";
import { EQUIPMENT_SLOTS, HEALTH_POTION_ITEM_KEY } from "@/lib/game/constants";
import { requiredXpForLevel } from "@/lib/game/progression";
import { itemDisplayName } from "@/lib/game/item-display";
import { characterMeetsItemStatRequirements, formatItemStatRequirements } from "@/lib/game/item-requirements";
import { rarityNameClass } from "@/lib/game/item-rarity-styles";
import { displayTitleForEquippedKey } from "@/lib/game/achievements";
import { portraitForClass } from "@/lib/game/portraits";
import type { Character, CharacterEquipment, InventoryItem, Item } from "@prisma/client";
import { ConsumeTonicForm } from "@/components/consume-tonic-form";
import { ItemHoverCard } from "@/components/item-hover-card";
import { LoadoutGearPack } from "@/components/loadout-gear-pack";

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

export async function AdventureLoadoutPanel({
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
  const equippedTitleLabel = await displayTitleForEquippedKey(character.equippedAchievementKey);
  const bySlot = new Map(equipment.map((e) => [e.slot, e]));
  const gearInv = inventory.filter((r) => r.item.slot !== "CONSUMABLE");
  const xpNeeded = requiredXpForLevel(character.level);
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.round((character.xp / xpNeeded) * 100)) : 0;
  const hpPct = character.maxHp > 0 ? Math.min(100, Math.round((character.hp / character.maxHp) * 100)) : 0;
  const tonicCount = inventory
    .filter((r) => r.item.key === HEALTH_POTION_ITEM_KEY)
    .reduce((sum, row) => sum + row.quantity, 0);
  const canUseTonic = !combatLocked && tonicCount > 0 && character.hp < character.maxHp;
  const portrait = portraitForClass(character.class, character.portraitKey);

  return (
    <aside className="space-y-4 rounded-2xl border border-white/20 bg-zinc-950/45 bg-linear-to-b from-black/62 via-black/78 to-black/95 p-4 shadow-md backdrop-blur-[1px]">
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/70">Loadout</h2>
      </div>
      <div className="rounded-lg border border-white/20 bg-black/55 px-3 py-2 font-mono text-xs text-zinc-100">
        <div className="flex items-start gap-3">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element -- static portrait assets from public
            <img
              src={portrait.src}
              alt={`${character.name} portrait`}
              className="h-16 w-16 rounded-md border border-white/20 object-cover object-top"
              loading="lazy"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-white/20 bg-black/40 text-sm text-zinc-200">
              ?
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="min-w-0 truncate text-sm font-semibold text-white">{character.name}</p>
            {equippedTitleLabel ? (
              <p className="mt-0.5 min-w-0 truncate text-[10px] italic leading-tight text-zinc-500">{equippedTitleLabel}</p>
            ) : null}
            <p className="mt-0.5 text-zinc-100">Lv {character.level}</p>
            <div className="mt-1">
              <p className="text-[11px] text-zinc-200">XP {character.xp}/{xpNeeded}</p>
              <div className="mt-1 h-2 overflow-hidden rounded border border-violet-900/50 bg-zinc-900/80">
                <div className="h-full bg-linear-to-r from-violet-700 to-fuchsia-500" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <p className="text-[11px] text-zinc-200">
            ❤️ HP {character.hp}/{character.maxHp}
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded border border-red-900/50 bg-zinc-900/80">
            <div className="h-full bg-linear-to-r from-red-800 to-red-500" style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <p className="text-white">🪙 Gold {character.gold}</p>
        {character.statPoints > 0 ? (
          <div className="mt-1 rounded border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-100">
            <span className="font-semibold">Unspent points: {character.statPoints}</span>{" "}
            <Link href="/character" className="underline decoration-amber-500/80 hover:text-amber-200">
              Spend on Character page
            </Link>
          </div>
        ) : null}
        <p className="mt-1 text-[11px] text-zinc-200/95">
          💪 STR {effective.strength} · ❤️ CON {effective.constitution} · 🔮 INT {effective.intelligence} · 🏹 DEX {effective.dexterity}
        </p>
        <div className="mt-1 flex items-center justify-end">
          <span className="group relative inline-flex">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-500 text-[10px] text-zinc-100">
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
          <ConsumeTonicForm
            action={consumeTonicAction}
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
          </ConsumeTonicForm>
        ) : null}
      </div>

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Worn</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {EQUIPMENT_SLOTS.map((slot) => {
            const row = bySlot.get(slot);
            const it = row?.item;
            return (
              <li key={slot} className="rounded-lg border border-white/15 bg-black/50 px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-300">{slot}</span>
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
                    <span className="text-zinc-300/80">—</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!combatLocked && gearInv.length > 0 ? (
        <LoadoutGearPack character={character} gearInv={gearInv} bySlot={bySlot} combatLocked={combatLocked} />
      ) : null}
    </aside>
  );
}
