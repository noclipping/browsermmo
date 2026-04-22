import { Character, CharacterEquipment, Item } from "@prisma/client";
import {
  CON_HP_PER_POINT,
  DEX_RANGED_ATK_FACTOR,
  DEX_CRIT_PER_POINT,
  INT_MAGIC_ATK_FACTOR,
  INT_MANA_PER_POINT,
  MAX_CRIT_FROM_STATS,
  STR_ATK_FACTOR,
} from "@/lib/game/constants";
import { forgedStatsForEntry } from "@/lib/game/item-affixes";

type Equipped = CharacterEquipment & { item: Item | null };

function weaponType(item: Item): "MAGIC" | "RANGED" | "DAGGER" | "MELEE" {
  const key = item.key.toLowerCase();
  const name = item.name.toLowerCase();
  if (
    key.includes("staff") ||
    key.includes("rod") ||
    key.includes("channel") ||
    key.includes("focus") ||
    name.includes("staff") ||
    name.includes("archstaff") ||
    name.includes("rod")
  ) {
    return "MAGIC";
  }
  if (
    key.includes("bow") ||
    key.includes("slingshot") ||
    key.includes("recurve") ||
    name.includes("bow") ||
    name.includes("slingshot")
  ) {
    return "RANGED";
  }
  if (
    key.includes("dagger") ||
    key.includes("knife") ||
    key.includes("dirk") ||
    name.includes("dagger")
  ) {
    return "DAGGER";
  }
  return "MELEE";
}

export function buildCharacterStats(character: Character, equipment: Equipped[]) {
  const gear = equipment.reduce(
    (acc, entry) => {
      if (!entry.item) return acc;
      const forged = forgedStatsForEntry({
        slot: entry.slot,
        rarity: entry.item.rarity,
        forgeLevel: entry.forgeLevel,
      });
      const totalAttackStat = entry.item.attack + forged.attack;
      if (entry.item.slot === "WEAPON") {
        const wt = weaponType(entry.item);
        if (wt === "MAGIC") {
          // Staves/rods convert weapon power into INT, not flat ATK.
          acc.intelligence += totalAttackStat;
        } else if (wt === "RANGED") {
          // Bows/slingshots convert weapon power into DEX.
          acc.dexterity += totalAttackStat;
        } else if (wt === "DAGGER") {
          // Daggers scale from both STR/DEX, with slight DEX preference.
          const dexPart = Math.ceil(totalAttackStat * 0.6);
          const strPart = totalAttackStat - dexPart;
          acc.dexterity += dexPart;
          acc.strength += strPart;
        } else {
          acc.attack += totalAttackStat;
        }
      } else {
        acc.attack += totalAttackStat;
      }
      acc.defense += entry.item.defense;
      acc.hp += entry.item.hp;
      acc.defense += forged.defense;
      acc.hp += forged.hp;
      acc.lifeSteal += entry.bonusLifeSteal ?? 0;
      acc.crit += entry.bonusCritChance ?? 0;
      acc.skillPower += entry.bonusSkillPower ?? 0;
      acc.strength += entry.bonusStrength ?? 0;
      acc.constitution += entry.bonusConstitution ?? 0;
      acc.intelligence += entry.bonusIntelligence ?? 0;
      acc.dexterity += entry.bonusDexterity ?? 0;
      return acc;
    },
    {
      attack: 0,
      defense: 0,
      hp: 0,
      lifeSteal: 0,
      crit: 0,
      skillPower: 0,
      strength: 0,
      constitution: 0,
      intelligence: 0,
      dexterity: 0,
    },
  );

  const con = character.constitution + gear.constitution;
  const str = character.strength + gear.strength;
  const intl = character.intelligence + gear.intelligence;
  const dex = character.dexterity + gear.dexterity;

  const fromConHp = con * CON_HP_PER_POINT;
  const fromStrAtk = Math.floor(str * STR_ATK_FACTOR);
  const fromDexRangedAtk = Math.floor(dex * DEX_RANGED_ATK_FACTOR);
  const fromIntMagicAtk = Math.floor(intl * INT_MAGIC_ATK_FACTOR);
  const critBonus = dex * DEX_CRIT_PER_POINT;

  return {
    maxHp: character.maxHp + gear.hp + fromConHp,
    meleeAttack: character.attack + gear.attack + fromStrAtk,
    rangedAttack: character.attack + gear.attack + fromDexRangedAtk,
    magicAttack: character.attack + gear.attack + fromIntMagicAtk,
    defense: character.defense + gear.defense,
    maxMana: Math.max(0, intl * INT_MANA_PER_POINT),
    critChance: Math.min(MAX_CRIT_FROM_STATS, character.critChance + critBonus + gear.crit),
    lifeSteal: Math.max(0, gear.lifeSteal),
    skillPowerBonus: Math.max(0, gear.skillPower),
    strength: str,
    constitution: con,
    intelligence: intl,
    dexterity: dex,
  };
}
