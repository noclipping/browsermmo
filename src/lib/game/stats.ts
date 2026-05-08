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
import { forgedAffixScaledBonuses, forgedStatsForEntry } from "@/lib/game/item-affixes";
import { weaponType } from "@/lib/game/weapon-classification";

type Equipped = CharacterEquipment & { item: Item | null };

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
        // Non-weapon class gear uses attack pips as primary-stat bonuses:
        // INT line -> intelligence, DEX line -> dexterity. Tank gear stays HP/DEF focused.
        if (entry.item.requiredIntelligence > 0 && entry.item.requiredIntelligence >= entry.item.requiredDexterity) {
          acc.intelligence += totalAttackStat;
        } else if (entry.item.requiredDexterity > 0) {
          acc.dexterity += totalAttackStat;
        } else {
          acc.attack += totalAttackStat;
        }
      }
      acc.defense += entry.item.defense;
      acc.hp += entry.item.hp;
      acc.defense += forged.defense;
      acc.hp += forged.hp;
      const affix = forgedAffixScaledBonuses(
        {
          bonusLifeSteal: entry.bonusLifeSteal ?? 0,
          bonusCritChance: entry.bonusCritChance ?? 0,
          bonusSkillPower: entry.bonusSkillPower ?? 0,
          bonusDefensePercent: entry.bonusDefensePercent ?? 0,
          bonusConstitutionPercent: entry.bonusConstitutionPercent ?? 0,
          bonusStrength: entry.bonusStrength ?? 0,
          bonusConstitution: entry.bonusConstitution ?? 0,
          bonusIntelligence: entry.bonusIntelligence ?? 0,
          bonusDexterity: entry.bonusDexterity ?? 0,
        },
        { forgeLevel: entry.forgeLevel ?? 0, rarity: entry.item.rarity },
      );
      acc.lifeSteal += affix.bonusLifeSteal;
      acc.crit += affix.bonusCritChance;
      acc.skillPower += affix.bonusSkillPower;
      acc.defensePercent += affix.bonusDefensePercent;
      acc.constitutionPercent += affix.bonusConstitutionPercent;
      acc.strength += affix.bonusStrength;
      acc.constitution += affix.bonusConstitution;
      acc.intelligence += affix.bonusIntelligence;
      acc.dexterity += affix.bonusDexterity;
      return acc;
    },
    {
      attack: 0,
      defense: 0,
      hp: 0,
      lifeSteal: 0,
      crit: 0,
      skillPower: 0,
      defensePercent: 0,
      constitutionPercent: 0,
      strength: 0,
      constitution: 0,
      intelligence: 0,
      dexterity: 0,
    },
  );

  const baseCon = character.constitution + gear.constitution;
  const con = Math.max(0, Math.floor(baseCon * (1 + gear.constitutionPercent)));
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
    defense: Math.max(0, Math.floor((character.defense + gear.defense) * (1 + gear.defensePercent))),
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
