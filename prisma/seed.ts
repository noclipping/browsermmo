import { PrismaClient, CharacterClass, ItemSlot, Rarity, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  CLASS_BASE_STATS,
  CLASS_STARTING_ATTRIBUTES,
  HEALTH_POTION_ITEM_KEY,
  SMITHING_STONE_ITEM_KEY,
  STAT_POINTS_ON_CREATE,
} from "../src/lib/game/constants";
import { ACHIEVEMENT_CATALOG_SEED } from "../src/lib/game/achievement-seed-catalog";
import {
  buildCompleteRegionalLootItems,
  buildRegionalDropRows,
  REGIONAL_LOOT_DEFINITIONS,
  validateLootConfiguration,
} from "./loot-generation";

const prisma = new PrismaClient();
const SLOT_ORDER: ItemSlot[] = ["WEAPON", "HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"];
const ENEMY_DIFFICULTY_MULTIPLIER = 1.25;

type EnemyStatBlock = { hp: number; attack: number; defense: number; speed: number };

function scaleEnemyCombatStat(value: number): number {
  return Math.max(1, Math.floor(value * ENEMY_DIFFICULTY_MULTIPLIER));
}

function applyEnemyDifficulty<T extends EnemyStatBlock>(enemy: T): T {
  return {
    ...enemy,
    hp: scaleEnemyCombatStat(enemy.hp),
    attack: scaleEnemyCombatStat(enemy.attack),
    defense: scaleEnemyCombatStat(enemy.defense),
    speed: scaleEnemyCombatStat(enemy.speed),
  };
}

function upsertEnemyWithDifficulty(args: Prisma.EnemyUpsertArgs) {
  const update = applyEnemyDifficulty(args.update as Prisma.EnemyUncheckedUpdateInput & EnemyStatBlock);
  const create = applyEnemyDifficulty(args.create as Prisma.EnemyUncheckedCreateInput & EnemyStatBlock);
  return prisma.enemy.upsert({
    ...args,
    update,
    create,
  });
}

type ItemSeed = {
  key: string;
  name: string;
  emoji: string;
  slot: ItemSlot;
  rarity: Rarity;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  value: number;
  requiredLevel?: number;
  requiredStrength?: number;
  requiredConstitution?: number;
  requiredIntelligence?: number;
  requiredDexterity?: number;
  description?: string;
  sellPrice?: number;
};

function sellPriceFor(rarity: Rarity, value: number): number {
  const mult =
    rarity === "COMMON"
      ? 0.3
      : rarity === "UNCOMMON"
        ? 0.38
        : rarity === "RARE"
          ? 0.46
          : rarity === "EPIC"
            ? 0.54
            : 0.62;
  return Math.max(1, Math.floor(value * mult));
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/** Legacy regional builders kept for reference while seed transitions to `prisma/loot-generation.ts`. */
/** Per-zone weapon line: warrior (STR), ranger (DEX + speed), mage (INT + hp). All four rarities roll from every enemy in that zone. */
const WEAPON_DROP_RARITIES = ["COMMON", "UNCOMMON", "RARE", "LEGENDARY"] as const satisfies readonly Rarity[];
type WeaponDropRarity = (typeof WEAPON_DROP_RARITIES)[number];
const WEAPON_CLASS_KEYS = ["warrior", "ranger", "mage"] as const;
type WeaponClassKey = (typeof WEAPON_CLASS_KEYS)[number];

function regionalWeaponItemKey(tier: number, cls: WeaponClassKey, rarity: WeaponDropRarity): string {
  return `loot_reg${tier}_${cls}_${rarity}`;
}

function regionalGodlyWeaponItemKey(tier: number, cls: WeaponClassKey): string {
  return `loot_reg${tier}_${cls}_GODLY`;
}

function regionalDaggerItemKey(tier: number, rarity: WeaponDropRarity): string {
  return `loot_reg${tier}_ranger_dagger_${rarity}`;
}

function regionalGodlyDaggerItemKey(tier: number): string {
  return `loot_reg${tier}_ranger_dagger_GODLY`;
}

type WStats = Pick<ItemSeed, "attack" | "defense" | "hp" | "speed" | "value"> &
  Partial<Pick<ItemSeed, "requiredLevel" | "requiredStrength" | "requiredConstitution" | "requiredIntelligence" | "requiredDexterity">>;

const REGIONAL_WEAPON_NAMES: Record<
  number,
  Record<WeaponClassKey, Record<WeaponDropRarity, { name: string; description: string }>>
> = {
  0: {
    warrior: {
      COMMON: { name: "Gutter Cleaver", description: "Salvaged iron from the ditch — crude but heavy." },
      UNCOMMON: { name: "Cur Watchblade", description: "Street-forged steel with a chipped edge." },
      RARE: { name: "Outskirts War-Axe", description: "Balanced for brawls on the town roads." },
      LEGENDARY: { name: "Cobbled Crownblade", description: "Every nick tells a story from the outer wards." },
    },
    ranger: {
      COMMON: { name: "Scrap Shortbow", description: "Tension cord from wagon tarps — it shoots true enough." },
      UNCOMMON: { name: "Alley Stinger", description: "Quick draws in close quarters." },
      RARE: { name: "Ditch Hunter's Bow", description: "Waxed string and bone tips — outskirts favorite." },
      LEGENDARY: { name: "Gutterthread Longbow", description: "Silent as smoke off the gutters." },
    },
    mage: {
      COMMON: { name: "Ditchfocus Rod", description: "A cracked crystal on a lead rod — still channels." },
      UNCOMMON: { name: "Runescrap Channel", description: "Carvings copied from tavern tall tales." },
      RARE: { name: "Outskirts Emberstaff", description: "Warm to the touch when danger is near." },
      LEGENDARY: { name: "Wardline Archstaff", description: "Old town warding sigils spiral the haft." },
    },
  },
  1: {
    warrior: {
      COMMON: { name: "Wolfjaw Cleaver", description: "Teeth marks on the haft — trophies of the edge." },
      UNCOMMON: { name: "Canopy Broadsword", description: "Forest iron, green patina under the polish." },
      RARE: { name: "Alpha Rend Saber", description: "Weighted for finishing wounded prey." },
      LEGENDARY: { name: "Moonhowl Executioner", description: "The pack's echo seems to follow each swing." },
    },
    ranger: {
      COMMON: { name: "Briar Shortbow", description: "Flexes with the thicket — never snags for long." },
      UNCOMMON: { name: "Canopy Warbow", description: "Longer draw for shadowed game trails." },
      RARE: { name: "Direstring Recurve", description: "Sinew and ash — forest alphas fear this pull." },
      LEGENDARY: { name: "Silverbark Greatbow", description: "Moonlit bark laminates whisper on release." },
    },
    mage: {
      COMMON: { name: "Mosswick Staff", description: "Damp focus — power clings like morning fog." },
      UNCOMMON: { name: "Rootcircle Rod", description: "Rings of old growth carved along the shaft." },
      RARE: { name: "Wildwood Channel", description: "Sap still weeps when spells surge." },
      LEGENDARY: { name: "Heartwood Archstaff", description: "The living core hums when moonlight filters the canopy." },
    },
  },
  2: {
    warrior: {
      COMMON: { name: "Ruin Notchblade", description: "Pitted by sand — still splits mail." },
      UNCOMMON: { name: "Jackal-Fang Saber", description: "Curved like scavengers' grins." },
      RARE: { name: "Hallbreaker Claymore", description: "Wide enough to clear crumbling doorways." },
      LEGENDARY: { name: "Sunken Regalia Blade", description: "Inlaid with scripts no tongue still speaks." },
    },
    ranger: {
      COMMON: { name: "Cracked Warbow", description: "Ancient laminate, held together by spite." },
      UNCOMMON: { name: "Impsting Recurve", description: "Short and vicious for tight crypt halls." },
      RARE: { name: "Revenant Piercer", description: "Arrows seem to find gaps in old armor." },
      LEGENDARY: { name: "Tombwind Greatbow", description: "Each shot carries a draft from buried kings." },
    },
    mage: {
      COMMON: { name: "Ash-Sigil Staff", description: "Sigils ground to dust still spark on command." },
      UNCOMMON: { name: "Impcoal Rod", description: "Warm ember heart under blackened wood." },
      RARE: { name: "Revenant Lament", description: "Wails softly when mana gathers." },
      LEGENDARY: { name: "Archvault Channel", description: "Channels the weight of collapsed ceilings." },
    },
  },
  3: {
    warrior: {
      COMMON: { name: "Crypt Warden Sword", description: "Issued to guardians who never clocked out." },
      UNCOMMON: { name: "Boneplate Cleaver", description: "Each ring on the blade matches a fallen knight." },
      RARE: { name: "Murk Executioner", description: "Heavy enough to silence the restless." },
      LEGENDARY: { name: "Wraithplate Reaver", description: "Forged where plate and specter became one." },
    },
    ranger: {
      COMMON: { name: "Cryptstring Bow", description: "Taut cord that never rots in the damp." },
      UNCOMMON: { name: "Ossuary Recurve", description: "Bone tips and a grip of wrapped shroud." },
      RARE: { name: "Wraithpierce Longbow", description: "Arrows pass where flesh should be." },
      LEGENDARY: { name: "Murkveil Greatbow", description: "The string drinks mist from the catacombs." },
    },
    mage: {
      COMMON: { name: "Cryptfocus Staff", description: "Cold crystal — patience in the dark." },
      UNCOMMON: { name: "Gravemist Rod", description: "Condensation beads into power." },
      RARE: { name: "Bonechoir Channel", description: "Harmonics rattle loose teeth nearby." },
      LEGENDARY: { name: "Ossuary Archstaff", description: "Every skull in earshot listens when you cast." },
    },
  },
};

const REGIONAL_WEAPON_STATS: Record<number, Record<WeaponClassKey, Record<WeaponDropRarity, WStats>>> = {
  0: {
    warrior: {
      COMMON: { attack: 2, defense: 0, hp: 0, speed: 0, value: 10, requiredStrength: 10 },
      UNCOMMON: { attack: 4, defense: 0, hp: 0, speed: 0, value: 22, requiredStrength: 11 },
      RARE: { attack: 7, defense: 1, hp: 3, speed: 0, value: 44, requiredStrength: 12, requiredConstitution: 10 },
      LEGENDARY: { attack: 10, defense: 2, hp: 6, speed: 0, value: 110, requiredLevel: 5, requiredStrength: 14, requiredConstitution: 11 },
    },
    ranger: {
      COMMON: { attack: 1, defense: 0, hp: 0, speed: 1, value: 10, requiredDexterity: 10 },
      UNCOMMON: { attack: 3, defense: 0, hp: 0, speed: 2, value: 22, requiredDexterity: 11 },
      RARE: { attack: 6, defense: 0, hp: 1, speed: 2, value: 44, requiredDexterity: 13 },
      LEGENDARY: { attack: 9, defense: 0, hp: 2, speed: 3, value: 110, requiredLevel: 4, requiredDexterity: 14 },
    },
    mage: {
      COMMON: { attack: 1, defense: 0, hp: 1, speed: 0, value: 10, requiredIntelligence: 10 },
      UNCOMMON: { attack: 3, defense: 0, hp: 3, speed: 0, value: 22, requiredIntelligence: 11 },
      RARE: { attack: 6, defense: 0, hp: 5, speed: 0, value: 44, requiredIntelligence: 12 },
      LEGENDARY: { attack: 9, defense: 0, hp: 8, speed: 0, value: 110, requiredLevel: 4, requiredIntelligence: 14 },
    },
  },
  1: {
    warrior: {
      COMMON: { attack: 6, defense: 0, hp: 0, speed: 0, value: 28, requiredLevel: 5, requiredStrength: 14 },
      UNCOMMON: { attack: 9, defense: 0, hp: 0, speed: 0, value: 42, requiredLevel: 6, requiredStrength: 15 },
      RARE: { attack: 13, defense: 1, hp: 4, speed: 0, value: 68, requiredLevel: 7, requiredStrength: 16, requiredConstitution: 12 },
      LEGENDARY: { attack: 17, defense: 2, hp: 9, speed: 0, value: 165, requiredLevel: 10, requiredStrength: 17, requiredConstitution: 13 },
    },
    ranger: {
      COMMON: { attack: 5, defense: 0, hp: 0, speed: 2, value: 28, requiredLevel: 5, requiredDexterity: 13 },
      UNCOMMON: { attack: 8, defense: 0, hp: 0, speed: 2, value: 42, requiredLevel: 6, requiredDexterity: 14 },
      RARE: { attack: 12, defense: 0, hp: 2, speed: 3, value: 68, requiredLevel: 8, requiredDexterity: 15 },
      LEGENDARY: { attack: 16, defense: 0, hp: 3, speed: 4, value: 165, requiredLevel: 10, requiredDexterity: 16 },
    },
    mage: {
      COMMON: { attack: 5, defense: 0, hp: 3, speed: 0, value: 28, requiredLevel: 5, requiredIntelligence: 13 },
      UNCOMMON: { attack: 8, defense: 0, hp: 5, speed: 0, value: 42, requiredLevel: 6, requiredIntelligence: 14 },
      RARE: { attack: 12, defense: 0, hp: 8, speed: 0, value: 68, requiredLevel: 8, requiredIntelligence: 15 },
      LEGENDARY: { attack: 16, defense: 0, hp: 12, speed: 0, value: 165, requiredLevel: 10, requiredIntelligence: 16 },
    },
  },
  2: {
    warrior: {
      COMMON: { attack: 10, defense: 0, hp: 0, speed: 0, value: 48, requiredLevel: 10, requiredStrength: 16 },
      UNCOMMON: { attack: 14, defense: 0, hp: 0, speed: 0, value: 64, requiredLevel: 11, requiredStrength: 17 },
      RARE: { attack: 19, defense: 2, hp: 6, speed: 0, value: 98, requiredLevel: 12, requiredStrength: 18, requiredConstitution: 14 },
      LEGENDARY: { attack: 25, defense: 3, hp: 12, speed: 0, value: 235, requiredLevel: 14, requiredStrength: 19, requiredConstitution: 15 },
    },
    ranger: {
      COMMON: { attack: 9, defense: 0, hp: 0, speed: 3, value: 48, requiredLevel: 10, requiredDexterity: 15 },
      UNCOMMON: { attack: 13, defense: 0, hp: 0, speed: 3, value: 64, requiredLevel: 11, requiredDexterity: 16 },
      RARE: { attack: 18, defense: 0, hp: 3, speed: 4, value: 98, requiredLevel: 12, requiredDexterity: 17 },
      LEGENDARY: { attack: 23, defense: 0, hp: 5, speed: 5, value: 235, requiredLevel: 14, requiredDexterity: 18 },
    },
    mage: {
      COMMON: { attack: 9, defense: 0, hp: 4, speed: 0, value: 48, requiredLevel: 10, requiredIntelligence: 15 },
      UNCOMMON: { attack: 13, defense: 0, hp: 6, speed: 0, value: 64, requiredLevel: 11, requiredIntelligence: 16 },
      RARE: { attack: 18, defense: 0, hp: 10, speed: 0, value: 98, requiredLevel: 12, requiredIntelligence: 17 },
      LEGENDARY: { attack: 23, defense: 0, hp: 14, speed: 0, value: 235, requiredLevel: 14, requiredIntelligence: 18 },
    },
  },
  3: {
    warrior: {
      COMMON: { attack: 14, defense: 0, hp: 0, speed: 0, value: 72, requiredLevel: 14, requiredStrength: 18 },
      UNCOMMON: { attack: 19, defense: 0, hp: 0, speed: 0, value: 92, requiredLevel: 15, requiredStrength: 19 },
      RARE: { attack: 25, defense: 3, hp: 9, speed: 0, value: 138, requiredLevel: 16, requiredStrength: 20, requiredConstitution: 16 },
      LEGENDARY: { attack: 33, defense: 5, hp: 18, speed: 0, value: 320, requiredLevel: 18, requiredStrength: 21, requiredConstitution: 18 },
    },
    ranger: {
      COMMON: { attack: 13, defense: 0, hp: 0, speed: 3, value: 72, requiredLevel: 14, requiredDexterity: 17 },
      UNCOMMON: { attack: 18, defense: 0, hp: 0, speed: 4, value: 92, requiredLevel: 15, requiredDexterity: 18 },
      RARE: { attack: 24, defense: 0, hp: 4, speed: 5, value: 138, requiredLevel: 16, requiredDexterity: 19 },
      LEGENDARY: { attack: 31, defense: 0, hp: 6, speed: 6, value: 320, requiredLevel: 18, requiredDexterity: 20 },
    },
    mage: {
      COMMON: { attack: 13, defense: 0, hp: 5, speed: 0, value: 72, requiredLevel: 14, requiredIntelligence: 17 },
      UNCOMMON: { attack: 18, defense: 0, hp: 8, speed: 0, value: 92, requiredLevel: 15, requiredIntelligence: 18 },
      RARE: { attack: 24, defense: 0, hp: 12, speed: 0, value: 138, requiredLevel: 16, requiredIntelligence: 19 },
      LEGENDARY: { attack: 31, defense: 0, hp: 17, speed: 0, value: 320, requiredLevel: 18, requiredIntelligence: 20 },
    },
  },
};

const WEAPON_CLASS_EMOJI: Record<WeaponClassKey, string> = {
  warrior: "🗡️",
  ranger: "🏹",
  mage: "🪄",
};

const APPAREL_SLOTS: ItemSlot[] = ["HELMET", "CHEST", "GLOVES", "BOOTS", "RING", "AMULET"];
const ARMOR_SLOTS: ItemSlot[] = ["HELMET", "CHEST", "GLOVES", "BOOTS"];

const APPAREL_TIER_LABELS: Record<number, [string, string]> = {
  0: ["Outskirts", "Gutter"],
  1: ["Forest", "Wolf"],
  2: ["Ruins", "Ash"],
  3: ["Crypt", "Murk"],
};

/** COMMON non-weapon gear per zone tier and warrior / ranger / mage lines (shop + drops later). */
function buildRegionalCommonApparel(): ItemSeed[] {
  const out: ItemSeed[] = [];
  for (let tier = 0; tier <= 3; tier++) {
    const [zone, prefix] = APPAREL_TIER_LABELS[tier];
    for (const cls of WEAPON_CLASS_KEYS) {
      const wstat = REGIONAL_WEAPON_STATS[tier][cls].COMMON;
      const lv = wstat.requiredLevel ?? 1;
      const rs = wstat.requiredStrength ?? 0;
      const rc = wstat.requiredConstitution ?? 0;
      const ri = wstat.requiredIntelligence ?? 0;
      const rd = wstat.requiredDexterity ?? 0;
      const baseVal = Math.max(10, Math.floor(wstat.value * 0.82));

      for (const slot of APPAREL_SLOTS) {
        let attack = 0;
        let defense = 0;
        let hp = 0;
        let speed = 0;
        let name = "";
        if (slot === "HELMET") {
          defense = cls === "warrior" ? 2 + tier : cls === "ranger" ? 1 + tier : Math.max(0, tier);
          hp = cls === "warrior" ? 4 + tier * 3 : cls === "ranger" ? 2 + tier * 2 : 1 + tier;
          attack = cls === "ranger" ? 1 + Math.floor(tier / 2) : cls === "mage" ? 1 + tier : 0;
          name =
            cls === "warrior" ? `${prefix} Bascinet` : cls === "ranger" ? `${prefix} Leather Hood` : `${prefix} Circlet`;
        } else if (slot === "CHEST") {
          defense = cls === "warrior" ? 4 + tier : cls === "ranger" ? 2 + tier : 1 + Math.floor(tier / 2);
          hp = cls === "warrior" ? 8 + tier * 4 : cls === "ranger" ? 4 + tier * 2 : 3 + tier * 2;
          attack = cls === "ranger" ? 1 + tier : cls === "mage" ? 2 + tier : 0;
          speed = cls === "ranger" ? 1 : 0;
          name = cls === "warrior" ? `${prefix} Hauberk` : cls === "ranger" ? `${prefix} Jerkin` : `${prefix} Spellwrap`;
        } else if (slot === "GLOVES") {
          attack = cls === "warrior" ? 0 : cls === "ranger" ? 1 + Math.floor(tier / 2) : 1 + tier;
          defense = cls === "warrior" ? 2 : 1;
          speed = cls === "ranger" ? 2 : cls === "mage" ? 1 : 0;
          hp = cls === "warrior" ? 2 + tier : cls === "ranger" ? 1 : 0;
          name = cls === "warrior" ? `${prefix} Gauntlets` : cls === "ranger" ? `${prefix} Bracers` : `${prefix} Grips`;
        } else if (slot === "BOOTS") {
          attack = cls === "ranger" ? 1 + Math.floor(tier / 2) : cls === "mage" ? 1 + tier : 0;
          defense = cls === "warrior" ? 2 : cls === "ranger" ? 1 + Math.floor(tier / 2) : 1;
          speed = cls === "ranger" ? 2 + tier : cls === "mage" ? 1 + Math.floor(tier / 2) : 0;
          hp = cls === "warrior" ? 3 + tier : cls === "ranger" ? 1 + Math.floor(tier / 2) : 0;
          name = cls === "ranger" ? `${prefix} Treads` : `${prefix} Marchers`;
        } else if (slot === "RING") {
          attack = cls === "warrior" ? 0 : cls === "ranger" ? 2 + tier : 2 + tier;
          defense = cls === "warrior" ? 2 : cls === "ranger" ? 1 : 0;
          hp = cls === "warrior" ? 3 + tier * 2 : cls === "mage" ? 1 + tier : 1;
          speed = cls === "ranger" ? 1 : cls === "mage" ? 1 : 0;
          name = cls === "warrior" ? `${zone} Signet` : cls === "ranger" ? `${zone} Loop` : `${zone} Band`;
        } else if (slot === "AMULET") {
          attack = cls === "warrior" ? 0 : cls === "ranger" ? 2 + tier : 3 + tier;
          defense = cls === "warrior" ? 2 + Math.floor(tier / 2) : cls === "ranger" ? 1 : 0;
          hp = cls === "warrior" ? 4 + tier * 3 : cls === "ranger" ? 2 + tier : 1 + tier;
          speed = cls === "ranger" ? 1 : cls === "mage" ? 1 : 0;
          name = cls === "warrior" ? `${zone} Token` : cls === "ranger" ? `${zone} Talisman` : `${zone} Charm`;
        }
        const slotSlug = slot.toLowerCase();
        const value =
          baseVal + (slot === "CHEST" ? 10 : slot === "RING" ? 4 : slot === "AMULET" ? 6 : 5);
        const emoji =
          slot === "HELMET"
            ? "🪖"
            : slot === "CHEST"
              ? "🧥"
              : slot === "GLOVES"
                ? "🧤"
                : slot === "BOOTS"
                  ? "🥾"
                  : slot === "RING"
                    ? "💍"
                    : "🔮";
        out.push({
          key: `loot_reg${tier}_${cls}_${slotSlug}_COMMON`,
          name,
          emoji,
          slot,
          rarity: "COMMON",
          attack,
          defense,
          hp,
          speed,
          value,
          requiredLevel: lv,
          requiredStrength: rs,
          requiredConstitution: rc,
          requiredIntelligence: ri,
          requiredDexterity: rd,
          description: `Merchant ${zone.toLowerCase()} kit — ${cls} cut, common make.`,
        });
      }
    }
  }
  return out;
}

/** Legendary armor variants (helm/chest/gloves/boots) for each region + class line. */
function buildRegionalLegendaryArmor(): ItemSeed[] {
  const common = buildRegionalCommonApparel();
  const out: ItemSeed[] = [];
  for (const base of common) {
    if (!ARMOR_SLOTS.includes(base.slot)) continue;
    const key = base.key.replace("_COMMON", "_LEGENDARY");
    const cls =
      key.includes("_warrior_") ? "warrior" : key.includes("_ranger_") ? "ranger" : key.includes("_mage_") ? "mage" : "neutral";
    const [prefix] = base.name.split(" ");
    const legendaryNamePrefix = cls === "warrior" ? "Bulwark" : cls === "ranger" ? "Shadowstep" : "Arcanist";
    const legendaryName = `${legendaryNamePrefix} ${base.name}`;
    out.push({
      key,
      name: legendaryName,
      emoji: base.emoji,
      slot: base.slot,
      rarity: "LEGENDARY",
      attack: Math.max(0, Math.floor(base.attack * 1.75) + (cls === "mage" || cls === "ranger" ? 1 : 0)),
      defense: Math.max(0, Math.floor(base.defense * 1.6) + (cls === "warrior" ? 2 : cls === "ranger" ? 1 : 0)),
      hp: Math.max(0, Math.floor(base.hp * 1.7) + (cls === "warrior" ? 4 : cls === "ranger" ? 2 : 1)),
      speed: Math.max(0, Math.floor(base.speed * 1.5) + (cls === "ranger" ? 1 : 0)),
      value: Math.floor(base.value * 4.2),
      requiredLevel: (base.requiredLevel ?? 1) + 4,
      requiredStrength: Math.max(0, (base.requiredStrength ?? 0) + (cls === "warrior" ? 2 : 0)),
      requiredConstitution: Math.max(0, (base.requiredConstitution ?? 0) + (cls === "warrior" ? 2 : 1)),
      requiredIntelligence: Math.max(0, (base.requiredIntelligence ?? 0) + (cls === "mage" ? 2 : 0)),
      requiredDexterity: Math.max(0, (base.requiredDexterity ?? 0) + (cls === "ranger" ? 2 : 0)),
      description: `Legendary ${prefix.toLowerCase()} armor — ${cls} lineage, apex-forged.`,
    });
  }
  return out;
}

function buildRegionalWeaponItems(): ItemSeed[] {
  const out: ItemSeed[] = [];
  const daggerMeta: Record<number, Record<WeaponDropRarity, { name: string; description: string }>> = {
    0: {
      COMMON: { name: "Back-Alley Shiv", description: "Rag-wrapped grip, quick in close quarters." },
      UNCOMMON: { name: "Gutter Dirk", description: "Narrow blade made for fast hands." },
      RARE: { name: "Sewer Fang", description: "Twin-edged point that finds soft gaps." },
      LEGENDARY: { name: "Nightmarket Stiletto", description: "A whisper-thin legendary blade from outlaw stalls." },
    },
    1: {
      COMMON: { name: "Thornknife", description: "Forest-cut steel, surprisingly balanced." },
      UNCOMMON: { name: "Wolftooth Dirk", description: "Hooks and serrations for savage flurries." },
      RARE: { name: "Briarfang Twinblade", description: "Leaf-quick cuts with predatory bite." },
      LEGENDARY: { name: "Moonshade Stiletto", description: "Its edge vanishes in moonlit motion." },
    },
    2: {
      COMMON: { name: "Ruin Fang", description: "Dust-pitted but eager for blood." },
      UNCOMMON: { name: "Crypt Knife", description: "Short, cruel, and hard to track." },
      RARE: { name: "Tombstep Dagger", description: "Built for silent work between collapsed halls." },
      LEGENDARY: { name: "Regalia Needle", description: "An imperial assassin's relic point." },
    },
    3: {
      COMMON: { name: "Murk Shiv", description: "Darkened steel that drinks catacomb mist." },
      UNCOMMON: { name: "Wraithfang Dirk", description: "The tip seems a breath ahead of your hand." },
      RARE: { name: "Graveshade Twinblade", description: "Rapid cuts leave ghostly afterimages." },
      LEGENDARY: { name: "Catacomb Heartpiercer", description: "A fabled dagger that ends duels in one breath." },
    },
  };
  for (let tier = 0; tier <= 3; tier++) {
    for (const cls of WEAPON_CLASS_KEYS) {
      for (const rarity of WEAPON_DROP_RARITIES) {
        const meta = REGIONAL_WEAPON_NAMES[tier][cls][rarity];
        const st = REGIONAL_WEAPON_STATS[tier][cls][rarity];
        out.push({
          key: regionalWeaponItemKey(tier, cls, rarity),
          name: meta.name,
          emoji: WEAPON_CLASS_EMOJI[cls],
          slot: "WEAPON",
          rarity,
          attack: st.attack,
          defense: st.defense,
          hp: st.hp,
          speed: st.speed,
          value: st.value,
          requiredLevel: st.requiredLevel,
          requiredStrength: st.requiredStrength,
          requiredConstitution: st.requiredConstitution,
          requiredIntelligence: st.requiredIntelligence,
          requiredDexterity: st.requiredDexterity,
          description: meta.description,
        });
      }
      const godlyBase = REGIONAL_WEAPON_STATS[tier][cls].LEGENDARY;
      const godlyMeta = REGIONAL_WEAPON_NAMES[tier][cls].LEGENDARY;
      out.push({
        key: regionalGodlyWeaponItemKey(tier, cls),
        name: `Godly ${godlyMeta.name}`,
        emoji: WEAPON_CLASS_EMOJI[cls],
        slot: "WEAPON",
        rarity: "GODLY",
        attack: Math.floor(godlyBase.attack * 1.28) + 2,
        defense: Math.floor(godlyBase.defense * 1.2) + 1,
        hp: Math.floor(godlyBase.hp * 1.3) + 2,
        speed: Math.floor(godlyBase.speed * 1.2) + 1,
        value: Math.floor(godlyBase.value * 2.2),
        requiredLevel: (godlyBase.requiredLevel ?? 1) + 2,
        requiredStrength: Math.max(0, (godlyBase.requiredStrength ?? 0) + 2),
        requiredConstitution: Math.max(0, (godlyBase.requiredConstitution ?? 0) + 2),
        requiredIntelligence: Math.max(0, (godlyBase.requiredIntelligence ?? 0) + 2),
        requiredDexterity: Math.max(0, (godlyBase.requiredDexterity ?? 0) + 2),
        description: `An apex-grade relic from ${godlyMeta.name}. Super rare boss-tier drop.`,
      });
    }
    for (const rarity of WEAPON_DROP_RARITIES) {
      const base = REGIONAL_WEAPON_STATS[tier].ranger[rarity];
      const meta = daggerMeta[tier][rarity];
      out.push({
        key: regionalDaggerItemKey(tier, rarity),
        name: meta.name,
        emoji: "🗡️",
        slot: "WEAPON",
        rarity,
        attack: Math.max(1, base.attack - 1),
        defense: Math.max(0, base.defense),
        hp: Math.max(0, base.hp),
        speed: base.speed + 1,
        value: Math.max(8, Math.floor(base.value * 0.98)),
        requiredLevel: base.requiredLevel,
        requiredStrength: Math.max(0, (base.requiredStrength ?? 0) - 1),
        requiredConstitution: base.requiredConstitution,
        requiredIntelligence: 0,
        requiredDexterity: Math.max(1, (base.requiredDexterity ?? 0) + 1),
        description: meta.description,
      });
    }
    const godlyBase = REGIONAL_WEAPON_STATS[tier].ranger.LEGENDARY;
    out.push({
      key: regionalGodlyDaggerItemKey(tier),
      name: `Godly ${daggerMeta[tier].LEGENDARY.name}`,
      emoji: "🗡️",
      slot: "WEAPON",
      rarity: "GODLY",
      attack: Math.max(1, Math.floor((godlyBase.attack - 1) * 1.25) + 2),
      defense: Math.floor(godlyBase.defense * 1.15) + 1,
      hp: Math.floor(godlyBase.hp * 1.25) + 2,
      speed: Math.floor((godlyBase.speed + 1) * 1.2) + 1,
      value: Math.floor(godlyBase.value * 2.1),
      requiredLevel: (godlyBase.requiredLevel ?? 1) + 2,
      requiredStrength: Math.max(0, (godlyBase.requiredStrength ?? 0) + 1),
      requiredConstitution: Math.max(0, (godlyBase.requiredConstitution ?? 0) + 1),
      requiredIntelligence: 0,
      requiredDexterity: Math.max(1, (godlyBase.requiredDexterity ?? 0) + 3),
      description: "A godly assassin relic — speed and precision above all else.",
    });
  }
  return out;
}

/** Independent roll per row; keep sum modest so fights are not loot piñatas. */
const REGIONAL_WEAPON_DROP_P: Record<WeaponDropRarity, number> = {
  COMMON: 0.04,
  UNCOMMON: 0.027,
  RARE: 0.015,
  LEGENDARY: 0.005,
};
const REGIONAL_GODLY_WEAPON_DROP_P = 0.0005;
const REGIONAL_DAGGER_DROP_P: Record<WeaponDropRarity, number> = {
  COMMON: 0.03,
  UNCOMMON: 0.02,
  RARE: 0.012,
  LEGENDARY: 0.0045,
};
const REGIONAL_GODLY_DAGGER_DROP_P = 0.00045;
const REGIONAL_COMMON_APPAREL_DROP_P = 0.006;
const REGIONAL_LEGENDARY_ARMOR_DROP_P = 0.0009;
const BOSS_WEAPON_DROP_P: Record<WeaponDropRarity, number> = {
  COMMON: REGIONAL_WEAPON_DROP_P.COMMON,
  UNCOMMON: REGIONAL_WEAPON_DROP_P.UNCOMMON,
  RARE: REGIONAL_WEAPON_DROP_P.RARE,
  LEGENDARY: 0.028,
};
const BOSS_GODLY_WEAPON_DROP_P = 0.004;
const BOSS_DAGGER_DROP_P: Record<WeaponDropRarity, number> = {
  COMMON: REGIONAL_DAGGER_DROP_P.COMMON,
  UNCOMMON: REGIONAL_DAGGER_DROP_P.UNCOMMON,
  RARE: REGIONAL_DAGGER_DROP_P.RARE,
  LEGENDARY: 0.024,
};
const BOSS_GODLY_DAGGER_DROP_P = 0.0035;
const BOSS_LEGENDARY_ARMOR_DROP_P = 0.008;

function pushRegionalWeaponDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyIds: string[],
  tier: number,
) {
  for (const enemyId of enemyIds) {
    for (const cls of WEAPON_CLASS_KEYS) {
      for (const rarity of WEAPON_DROP_RARITIES) {
        drops.push({
          enemyId,
          itemKey: regionalWeaponItemKey(tier, cls, rarity),
          chance: REGIONAL_WEAPON_DROP_P[rarity],
        });
      }
      drops.push({
        enemyId,
        itemKey: regionalGodlyWeaponItemKey(tier, cls),
        chance: REGIONAL_GODLY_WEAPON_DROP_P,
      });
    }
  }
}

function pushRegionalDaggerDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyIds: string[],
  tier: number,
) {
  for (const enemyId of enemyIds) {
    for (const rarity of WEAPON_DROP_RARITIES) {
      drops.push({
        enemyId,
        itemKey: regionalDaggerItemKey(tier, rarity),
        chance: REGIONAL_DAGGER_DROP_P[rarity],
      });
    }
    drops.push({
      enemyId,
      itemKey: regionalGodlyDaggerItemKey(tier),
      chance: REGIONAL_GODLY_DAGGER_DROP_P,
    });
  }
}

function pushRegionalCommonApparelDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyIds: string[],
  tier: number,
) {
  for (const enemyId of enemyIds) {
    for (const cls of WEAPON_CLASS_KEYS) {
      for (const slot of APPAREL_SLOTS) {
        drops.push({
          enemyId,
          itemKey: `loot_reg${tier}_${cls}_${slot.toLowerCase()}_COMMON`,
          chance: REGIONAL_COMMON_APPAREL_DROP_P,
        });
      }
    }
  }
}

function pushRegionalLegendaryArmorDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyIds: string[],
  tier: number,
) {
  for (const enemyId of enemyIds) {
    for (const cls of WEAPON_CLASS_KEYS) {
      for (const slot of ARMOR_SLOTS) {
        drops.push({
          enemyId,
          itemKey: `loot_reg${tier}_${cls}_${slot.toLowerCase()}_LEGENDARY`,
          chance: REGIONAL_LEGENDARY_ARMOR_DROP_P,
        });
      }
    }
  }
}

/** Bosses get elevated legendary/godly odds to make clears feel special. */
function pushBossWeaponDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyId: string,
  tier: number,
) {
  for (const cls of WEAPON_CLASS_KEYS) {
    for (const rarity of WEAPON_DROP_RARITIES) {
      drops.push({
        enemyId,
        itemKey: regionalWeaponItemKey(tier, cls, rarity),
        chance: BOSS_WEAPON_DROP_P[rarity],
      });
    }
    drops.push({
      enemyId,
      itemKey: regionalGodlyWeaponItemKey(tier, cls),
      chance: BOSS_GODLY_WEAPON_DROP_P,
    });
  }
}

function pushBossDaggerDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyId: string,
  tier: number,
) {
  for (const rarity of WEAPON_DROP_RARITIES) {
    drops.push({
      enemyId,
      itemKey: regionalDaggerItemKey(tier, rarity),
      chance: BOSS_DAGGER_DROP_P[rarity],
    });
  }
  drops.push({
    enemyId,
    itemKey: regionalGodlyDaggerItemKey(tier),
    chance: BOSS_GODLY_DAGGER_DROP_P,
  });
}

function pushBossLegendaryArmorDrops(
  drops: Array<{ enemyId: string; itemKey: string; chance: number }>,
  enemyId: string,
  tier: number,
) {
  for (const cls of WEAPON_CLASS_KEYS) {
    for (const slot of ARMOR_SLOTS) {
      drops.push({
        enemyId,
        itemKey: `loot_reg${tier}_${cls}_${slot.toLowerCase()}_LEGENDARY`,
        chance: BOSS_LEGENDARY_ARMOR_DROP_P,
      });
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

async function main() {
  const [town, forest, ruins, catacombs] = await Promise.all([
    prisma.region.upsert({
      where: { key: "town_outskirts" },
      update: { minLevel: 1, description: "Safe roads — weak critters and the occasional brute." },
      create: { key: "town_outskirts", name: "Town Outskirts", description: "Safe roads — weak critters.", minLevel: 1 },
    }),
    prisma.region.upsert({
      where: { key: "forest_edge" },
      update: { minLevel: 5, description: "Darker woods — wolves and alphas hunt here." },
      create: { key: "forest_edge", name: "Forest Edge", description: "Darker woods.", minLevel: 5 },
    }),
    prisma.region.upsert({
      where: { key: "ancient_ruins" },
      update: { minLevel: 10, description: "Cracked halls — jackals, imps, and tomb revenants." },
      create: { key: "ancient_ruins", name: "Ancient Ruins", description: "Cracked halls.", minLevel: 10 },
    }),
    prisma.region.upsert({
      where: { key: "murk_catacombs" },
      update: { minLevel: 14, description: "Flooded ossuaries — wraiths and bone knights." },
      create: {
        key: "murk_catacombs",
        name: "Murk Catacombs",
        description: "Flooded ossuaries and restless dead.",
        minLevel: 14,
      },
    }),
  ]);

  const baseItems: ItemSeed[] = [
    {
      key: "rusty_sword",
      name: "Rusty Sword",
      emoji: "🗡️",
      slot: "WEAPON",
      rarity: "COMMON",
      attack: 2,
      defense: 0,
      hp: 0,
      speed: 0,
      value: 8,
      requiredStrength: 10,
      description: "Barely straight, but it cuts.",
    },
    {
      key: "slingshot",
      name: "Scrap Slingshot",
      emoji: "🏹",
      slot: "WEAPON",
      rarity: "COMMON",
      attack: 1,
      defense: 0,
      hp: 0,
      speed: 1,
      value: 8,
      requiredDexterity: 10,
      description: "A simple ranged weapon favored by quick hands.",
    },
    {
      key: "apprentice_staff",
      name: "Apprentice Staff",
      emoji: "🪄",
      slot: "WEAPON",
      rarity: "COMMON",
      attack: 1,
      defense: 0,
      hp: 1,
      speed: 0,
      value: 8,
      requiredIntelligence: 10,
      description: "A training focus for first-circle mages.",
    },
    {
      key: "rogue_cloak_t1",
      name: "Rogue Cloak",
      emoji: "🧥",
      slot: "CHEST",
      rarity: "UNCOMMON",
      attack: 1,
      defense: 1,
      hp: 2,
      speed: 1,
      value: 14,
      requiredDexterity: 11,
    },
    {
      key: "mage_robe_t1",
      name: "Initiate Robe",
      emoji: "🥻",
      slot: "CHEST",
      rarity: "UNCOMMON",
      attack: 1,
      defense: 1,
      hp: 3,
      speed: 0,
      value: 14,
      requiredIntelligence: 11,
    },
    {
      key: "outskirts_legend_blade",
      name: "Cobbled Relic Blade",
      emoji: "⚔️",
      slot: "WEAPON",
      rarity: "LEGENDARY",
      attack: 7,
      defense: 1,
      hp: 2,
      speed: 0,
      value: 120,
      requiredLevel: 4,
      requiredStrength: 12,
    },
    {
      key: "oak_staff",
      name: "Oak Staff",
      emoji: "🪄",
      slot: "WEAPON",
      rarity: "UNCOMMON",
      attack: 3,
      defense: 0,
      hp: 2,
      speed: 0,
      value: 14,
      requiredIntelligence: 12,
      description: "Channelled focus hums along the grain.",
    },
    { key: "iron_spear", name: "Iron Spear", emoji: "🔱", slot: "WEAPON", rarity: "UNCOMMON", attack: 5, defense: 0, hp: 0, speed: 1, value: 22, requiredLevel: 6, requiredStrength: 14 },
    { key: "hunter_bow", name: "Hunter Bow", emoji: "🏹", slot: "WEAPON", rarity: "UNCOMMON", attack: 4, defense: 0, hp: 0, speed: 2, value: 20, requiredLevel: 5, requiredDexterity: 13 },
    { key: "ranger_slingshot_t2", name: "Ranger Slingshot", emoji: "🏹", slot: "WEAPON", rarity: "RARE", attack: 6, defense: 0, hp: 1, speed: 2, value: 36, requiredLevel: 6, requiredDexterity: 14 },
    { key: "battle_staff_t2", name: "Battle Staff", emoji: "🪄", slot: "WEAPON", rarity: "RARE", attack: 6, defense: 0, hp: 2, speed: 0, value: 36, requiredLevel: 6, requiredIntelligence: 14 },
    { key: "plate_tunic_t2", name: "Plate Tunic", emoji: "🥋", slot: "CHEST", rarity: "RARE", attack: 0, defense: 5, hp: 7, speed: 0, value: 40, requiredLevel: 6, requiredConstitution: 14 },
    { key: "rogue_cloak_t2", name: "Shadow Cloak", emoji: "🧥", slot: "CHEST", rarity: "RARE", attack: 2, defense: 2, hp: 4, speed: 2, value: 40, requiredLevel: 6, requiredDexterity: 14 },
    { key: "mage_robe_t2", name: "Runed Robe", emoji: "🥻", slot: "CHEST", rarity: "RARE", attack: 2, defense: 2, hp: 5, speed: 0, value: 40, requiredLevel: 6, requiredIntelligence: 14 },
    { key: "forest_legend_cloak", name: "Moonthread Cloak", emoji: "🌙", slot: "CHEST", rarity: "LEGENDARY", attack: 4, defense: 4, hp: 8, speed: 2, value: 160, requiredLevel: 8, requiredDexterity: 15 },
    {
      key: "shadowfang_dagger",
      name: "Shadowfang Dagger",
      emoji: "🗡️",
      slot: "WEAPON",
      rarity: "RARE",
      attack: 8,
      defense: 0,
      hp: 0,
      speed: 3,
      value: 95,
      requiredLevel: 10,
      requiredStrength: 12,
      requiredDexterity: 14,
      description: "Forged in rumor and moonlight — a collector's blade.",
    },
    { key: "ruins_legend_staff", name: "Sunken Archstaff", emoji: "🔱", slot: "WEAPON", rarity: "LEGENDARY", attack: 10, defense: 1, hp: 8, speed: 1, value: 220, requiredLevel: 11, requiredIntelligence: 17 },
    {
      key: "sunlit_rapier",
      name: "Sunlit Rapier",
      emoji: "⚜️",
      slot: "WEAPON",
      rarity: "LEGENDARY",
      attack: 11,
      defense: 1,
      hp: 5,
      speed: 4,
      value: 220,
      requiredLevel: 4,
      requiredStrength: 11,
      requiredDexterity: 12,
      description: "A duelist's prize — the steel seems to ring when honor is on the line.",
    },
    { key: "tin_helm", name: "Tin Helm", emoji: "🪖", slot: "HELMET", rarity: "COMMON", attack: 0, defense: 2, hp: 4, speed: 0, value: 8, requiredConstitution: 9 },
    { key: "worn_chestpiece", name: "Worn Chestpiece", emoji: "🧥", slot: "CHEST", rarity: "COMMON", attack: 0, defense: 3, hp: 5, speed: 0, value: 10, requiredConstitution: 10 },
    {
      key: "grave_breastplate",
      name: "Grave Breastplate",
      emoji: "🛡️",
      slot: "CHEST",
      rarity: "EPIC",
      attack: 0,
      defense: 9,
      hp: 14,
      speed: 0,
      value: 140,
      requiredLevel: 11,
      requiredConstitution: 16,
      requiredStrength: 12,
    },
    { key: "catacomb_legend_plate", name: "Wraithplate", emoji: "🛡️", slot: "CHEST", rarity: "LEGENDARY", attack: 2, defense: 12, hp: 18, speed: 0, value: 280, requiredLevel: 15, requiredConstitution: 18 },
    { key: "leather_gloves", name: "Leather Gloves", emoji: "🧤", slot: "GLOVES", rarity: "COMMON", attack: 1, defense: 1, hp: 0, speed: 1, value: 6, requiredDexterity: 8 },
    { key: "traveler_boots", name: "Traveler Boots", emoji: "🥾", slot: "BOOTS", rarity: "COMMON", attack: 0, defense: 1, hp: 0, speed: 2, value: 6, requiredConstitution: 7 },
    { key: "copper_ring", name: "Copper Ring", emoji: "💍", slot: "RING", rarity: "UNCOMMON", attack: 1, defense: 1, hp: 2, speed: 0, value: 12 },
    { key: "wizard_band", name: "Wizard Band", emoji: "💠", slot: "RING", rarity: "RARE", attack: 2, defense: 1, hp: 4, speed: 1, value: 72, requiredLevel: 9, requiredIntelligence: 15 },
    { key: "mana_charm", name: "Mana Charm", emoji: "🔮", slot: "AMULET", rarity: "RARE", attack: 2, defense: 0, hp: 4, speed: 1, value: 20, requiredIntelligence: 11 },
    {
      key: HEALTH_POTION_ITEM_KEY,
      name: "Crimson Tonic",
      emoji: "🧪",
      slot: "CONSUMABLE",
      rarity: "COMMON",
      attack: 0,
      defense: 0,
      hp: 0,
      speed: 0,
      value: 6,
    },
    {
      key: SMITHING_STONE_ITEM_KEY,
      name: "Smithing Stone",
      emoji: "🪨",
      slot: "CONSUMABLE",
      rarity: "RARE",
      attack: 0,
      defense: 0,
      hp: 0,
      speed: 0,
      value: 80,
    },
  ];

  const items = [...baseItems, ...buildCompleteRegionalLootItems()];

  for (const item of items) {
    const reqLvl = item.requiredLevel ?? 1;
    const rs = item.requiredStrength ?? 0;
    const rc = item.requiredConstitution ?? 0;
    const ri = item.requiredIntelligence ?? 0;
    const rd = item.requiredDexterity ?? 0;
    const description = item.description ?? "";
    const sellPrice = item.sellPrice ?? sellPriceFor(item.rarity, item.value);
    await prisma.item.upsert({
      where: { key: item.key },
      update: {
        name: item.name,
        emoji: item.emoji,
        slot: item.slot,
        rarity: item.rarity,
        attack: item.attack,
        defense: item.defense,
        hp: item.hp,
        speed: item.speed,
        value: item.value,
        requiredLevel: reqLvl,
        requiredStrength: rs,
        requiredConstitution: rc,
        requiredIntelligence: ri,
        requiredDexterity: rd,
        description,
        sellPrice,
      },
      create: {
        key: item.key,
        name: item.name,
        emoji: item.emoji,
        slot: item.slot,
        rarity: item.rarity,
        attack: item.attack,
        defense: item.defense,
        hp: item.hp,
        speed: item.speed,
        value: item.value,
        requiredLevel: reqLvl,
        requiredStrength: rs,
        requiredConstitution: rc,
        requiredIntelligence: ri,
        requiredDexterity: rd,
        description,
        sellPrice,
      },
    });
  }

  const rat = await upsertEnemyWithDifficulty({
    where: { key: "sewer_rat" },
    update: { name: "Sewer Rat", emoji: "🐀", level: 1, hp: 36, attack: 8, defense: 6, speed: 6, xpReward: 24, goldMin: 3, goldMax: 8, regionId: town.id, isElite: false },
    create: { key: "sewer_rat", name: "Sewer Rat", emoji: "🐀", level: 1, hp: 36, attack: 8, defense: 6, speed: 6, xpReward: 24, goldMin: 3, goldMax: 8, regionId: town.id, isElite: false },
  });
  const plague = await upsertEnemyWithDifficulty({
    where: { key: "plague_burrower" },
    update: {
      name: "Plague Burrower",
      emoji: "🐀",
      level: 2,
      hp: 66,
      attack: 14,
      defense: 9,
      speed: 7,
      xpReward: 46,
      goldMin: 8,
      goldMax: 18,
      regionId: town.id,
      isElite: true,
    },
    create: {
      key: "plague_burrower",
      name: "Plague Burrower",
      emoji: "🐀",
      level: 2,
      hp: 66,
      attack: 14,
      defense: 9,
      speed: 7,
      xpReward: 46,
      goldMin: 8,
      goldMax: 18,
      regionId: town.id,
      isElite: true,
    },
  });
  const ditch = await upsertEnemyWithDifficulty({
    where: { key: "ditch_scrapper" },
    update: {
      name: "Ditch Scrapper",
      emoji: "🥊",
      level: 1,
      hp: 51,
      attack: 12,
      defense: 8,
      speed: 7,
      xpReward: 32,
      goldMin: 4,
      goldMax: 10,
      regionId: town.id,
      isElite: false,
      isAdventureMiniBoss: false,
    },
    create: {
      key: "ditch_scrapper",
      name: "Ditch Scrapper",
      emoji: "🥊",
      level: 1,
      hp: 51,
      attack: 12,
      defense: 8,
      speed: 7,
      xpReward: 32,
      goldMin: 4,
      goldMax: 10,
      regionId: town.id,
      isElite: false,
      isAdventureMiniBoss: false,
    },
  });
  const gutter = await upsertEnemyWithDifficulty({
    where: { key: "gutter_cur" },
    update: {
      name: "Gutter Cur",
      emoji: "🐕",
      level: 2,
      hp: 60,
      attack: 14,
      defense: 9,
      speed: 9,
      xpReward: 38,
      goldMin: 5,
      goldMax: 12,
      regionId: town.id,
      isElite: false,
      isAdventureMiniBoss: false,
    },
    create: {
      key: "gutter_cur",
      name: "Gutter Cur",
      emoji: "🐕",
      level: 2,
      hp: 60,
      attack: 14,
      defense: 9,
      speed: 9,
      xpReward: 38,
      goldMin: 5,
      goldMax: 12,
      regionId: town.id,
      isElite: false,
      isAdventureMiniBoss: false,
    },
  });
  const snail = await upsertEnemyWithDifficulty({
    where: { key: "colossal_snail" },
    update: {
      name: "Colossal Snail",
      emoji: "🐌",
      level: 2,
      hp: 117,
      attack: 9,
      defense: 21,
      speed: 2,
      xpReward: 44,
      goldMin: 7,
      goldMax: 16,
      regionId: town.id,
      isElite: true,
      isAdventureMiniBoss: false,
    },
    create: {
      key: "colossal_snail",
      name: "Colossal Snail",
      emoji: "🐌",
      level: 2,
      hp: 117,
      attack: 9,
      defense: 21,
      speed: 2,
      xpReward: 44,
      goldMin: 7,
      goldMax: 16,
      regionId: town.id,
      isElite: true,
      isAdventureMiniBoss: false,
    },
  });
  const fencer = await upsertEnemyWithDifficulty({
    where: { key: "sewer_fencer" },
    update: {
      name: "Sewer Fencer",
      emoji: "🤺",
      level: 3,
      hp: 99,
      attack: 23,
      defense: 14,
      speed: 11,
      xpReward: 72,
      goldMin: 16,
      goldMax: 34,
      regionId: town.id,
      isElite: false,
      isAdventureMiniBoss: true,
    },
    create: {
      key: "sewer_fencer",
      name: "Sewer Fencer",
      emoji: "🤺",
      level: 3,
      hp: 99,
      attack: 23,
      defense: 14,
      speed: 11,
      xpReward: 72,
      goldMin: 16,
      goldMax: 34,
      regionId: town.id,
      isElite: false,
      isAdventureMiniBoss: true,
    },
  });

  /** Async guild bosses (Phase 4): stats tuned for raid slices; not spawned in adventure routes. */
  const guildBossTemplate = {
    regionId: town.id,
    isElite: false,
    isAdventureMiniBoss: false,
    isDungeonBoss: true,
    xpReward: 0,
    goldMin: 0,
    goldMax: 0,
  } as const;
  await upsertEnemyWithDifficulty({
    where: { key: "guild_boss_sewer_rat_king" },
    update: {
      name: "Sewer Rat King",
      emoji: "👑",
      level: 4,
      hp: 120,
      attack: 18,
      defense: 12,
      speed: 10,
      ...guildBossTemplate,
    },
    create: {
      key: "guild_boss_sewer_rat_king",
      name: "Sewer Rat King",
      emoji: "👑",
      level: 4,
      hp: 120,
      attack: 18,
      defense: 12,
      speed: 10,
      ...guildBossTemplate,
    },
  });
  await upsertEnemyWithDifficulty({
    where: { key: "guild_boss_gravebound_ogre" },
    update: {
      name: "Gravebound Ogre",
      emoji: "💀",
      level: 7,
      hp: 220,
      attack: 28,
      defense: 18,
      speed: 8,
      ...guildBossTemplate,
    },
    create: {
      key: "guild_boss_gravebound_ogre",
      name: "Gravebound Ogre",
      emoji: "💀",
      level: 7,
      hp: 220,
      attack: 28,
      defense: 18,
      speed: 8,
      ...guildBossTemplate,
    },
  });
  await upsertEnemyWithDifficulty({
    where: { key: "guild_boss_ancient_warden" },
    update: {
      name: "Ancient Warden",
      emoji: "🗿",
      level: 10,
      hp: 340,
      attack: 36,
      defense: 28,
      speed: 10,
      ...guildBossTemplate,
    },
    create: {
      key: "guild_boss_ancient_warden",
      name: "Ancient Warden",
      emoji: "🗿",
      level: 10,
      hp: 340,
      attack: 36,
      defense: 28,
      speed: 10,
      ...guildBossTemplate,
    },
  });
  await upsertEnemyWithDifficulty({
    where: { key: "guild_boss_ashen_drake" },
    update: {
      name: "Ashen Drake",
      emoji: "🐉",
      level: 14,
      hp: 480,
      attack: 44,
      defense: 32,
      speed: 14,
      ...guildBossTemplate,
    },
    create: {
      key: "guild_boss_ashen_drake",
      name: "Ashen Drake",
      emoji: "🐉",
      level: 14,
      hp: 480,
      attack: 44,
      defense: 32,
      speed: 14,
      ...guildBossTemplate,
    },
  });
  await upsertEnemyWithDifficulty({
    where: { key: "guild_boss_duskforged_titan" },
    update: {
      name: "Duskforged Titan",
      emoji: "⚒️",
      level: 18,
      hp: 620,
      attack: 52,
      defense: 40,
      speed: 12,
      ...guildBossTemplate,
    },
    create: {
      key: "guild_boss_duskforged_titan",
      name: "Duskforged Titan",
      emoji: "⚒️",
      level: 18,
      hp: 620,
      attack: 52,
      defense: 40,
      speed: 12,
      ...guildBossTemplate,
    },
  });

  const wolf = await upsertEnemyWithDifficulty({
    where: { key: "dire_wolf" },
    update: { name: "Dire Wolf", emoji: "🐺", level: 5, hp: 110, attack: 22, defense: 13, speed: 10, xpReward: 78, goldMin: 14, goldMax: 28, regionId: forest.id, isElite: false },
    create: { key: "dire_wolf", name: "Dire Wolf", emoji: "🐺", level: 5, hp: 110, attack: 22, defense: 13, speed: 10, xpReward: 78, goldMin: 14, goldMax: 28, regionId: forest.id, isElite: false },
  });
  const alpha = await upsertEnemyWithDifficulty({
    where: { key: "alpha_dire_wolf" },
    update: {
      name: "Alpha Dire Wolf",
      emoji: "🐺",
      level: 7,
      hp: 156,
      attack: 30,
      defense: 18,
      speed: 11,
      xpReward: 120,
      goldMin: 22,
      goldMax: 42,
      regionId: forest.id,
      isElite: true,
    },
    create: {
      key: "alpha_dire_wolf",
      name: "Alpha Dire Wolf",
      emoji: "🐺",
      level: 7,
      hp: 156,
      attack: 30,
      defense: 18,
      speed: 11,
      xpReward: 120,
      goldMin: 22,
      goldMax: 42,
      regionId: forest.id,
      isElite: true,
    },
  });
  const forestEnt = await upsertEnemyWithDifficulty({
    where: { key: "forest_tree_ent" },
    update: {
      name: "Forest Tree Ent",
      emoji: "🌳",
      level: 8,
      hp: 214,
      attack: 34,
      defense: 24,
      speed: 7,
      xpReward: 156,
      goldMin: 30,
      goldMax: 56,
      regionId: forest.id,
      isElite: true,
      isAdventureMiniBoss: true,
    },
    create: {
      key: "forest_tree_ent",
      name: "Forest Tree Ent",
      emoji: "🌳",
      level: 8,
      hp: 214,
      attack: 34,
      defense: 24,
      speed: 7,
      xpReward: 156,
      goldMin: 30,
      goldMax: 56,
      regionId: forest.id,
      isElite: true,
      isAdventureMiniBoss: true,
    },
  });
  const jackal = await upsertEnemyWithDifficulty({
    where: { key: "gloom_jackal" },
    update: {
      name: "Gloom Jackal",
      emoji: "🦴",
      level: 10,
      hp: 194,
      attack: 36,
      defense: 20,
      speed: 11,
      xpReward: 156,
      goldMin: 28,
      goldMax: 54,
      regionId: ruins.id,
      isDungeonBoss: false,
      isElite: false,
    },
    create: {
      key: "gloom_jackal",
      name: "Gloom Jackal",
      emoji: "🦴",
      level: 10,
      hp: 194,
      attack: 36,
      defense: 20,
      speed: 11,
      xpReward: 156,
      goldMin: 28,
      goldMax: 54,
      regionId: ruins.id,
      isDungeonBoss: false,
      isElite: false,
    },
  });
  const ashCrawler = await upsertEnemyWithDifficulty({
    where: { key: "ash_crawler" },
    update: {
      name: "Ash Crawler",
      emoji: "🪳",
      level: 9,
      hp: 176,
      attack: 33,
      defense: 19,
      speed: 10,
      xpReward: 142,
      goldMin: 26,
      goldMax: 52,
      regionId: ruins.id,
      isDungeonBoss: false,
      isElite: false,
    },
    create: {
      key: "ash_crawler",
      name: "Ash Crawler",
      emoji: "🪳",
      level: 9,
      hp: 176,
      attack: 33,
      defense: 19,
      speed: 10,
      xpReward: 142,
      goldMin: 26,
      goldMax: 52,
      regionId: ruins.id,
      isDungeonBoss: false,
      isElite: false,
    },
  });
  const imp = await upsertEnemyWithDifficulty({
    where: { key: "cave_imp" },
    update: {
      name: "Cave Imp",
      emoji: "👺",
      level: 11,
      hp: 208,
      attack: 36,
      defense: 21,
      speed: 8,
      xpReward: 232,
      goldMin: 36,
      goldMax: 72,
      regionId: ruins.id,
      isDungeonBoss: true,
      isElite: true,
      isAdventureMiniBoss: false,
    },
    create: {
      key: "cave_imp",
      name: "Cave Imp",
      emoji: "👺",
      level: 11,
      hp: 208,
      attack: 36,
      defense: 21,
      speed: 8,
      xpReward: 232,
      goldMin: 36,
      goldMax: 72,
      regionId: ruins.id,
      isDungeonBoss: true,
      isElite: true,
      isAdventureMiniBoss: false,
    },
  });
  const ruinsColossus = await upsertEnemyWithDifficulty({
    where: { key: "ruins_colossus" },
    update: {
      name: "Ruins Colossus",
      emoji: "🗿",
      level: 12,
      hp: 272,
      attack: 42,
      defense: 28,
      speed: 7,
      xpReward: 268,
      goldMin: 42,
      goldMax: 82,
      regionId: ruins.id,
      isElite: true,
      isAdventureMiniBoss: true,
    },
    create: {
      key: "ruins_colossus",
      name: "Ruins Colossus",
      emoji: "🗿",
      level: 12,
      hp: 272,
      attack: 42,
      defense: 28,
      speed: 7,
      xpReward: 268,
      goldMin: 42,
      goldMax: 82,
      regionId: ruins.id,
      isElite: true,
      isAdventureMiniBoss: true,
    },
  });
  const revenant = await upsertEnemyWithDifficulty({
    where: { key: "tomb_revenant" },
    update: {
      name: "Tomb Revenant",
      emoji: "⚔️",
      level: 10,
      hp: 232,
      attack: 40,
      defense: 23,
      speed: 8,
      xpReward: 184,
      goldMin: 30,
      goldMax: 58,
      regionId: ruins.id,
      isElite: true,
      isDungeonBoss: false,
    },
    create: {
      key: "tomb_revenant",
      name: "Tomb Revenant",
      emoji: "⚔️",
      level: 10,
      hp: 232,
      attack: 40,
      defense: 23,
      speed: 8,
      xpReward: 184,
      goldMin: 30,
      goldMax: 58,
      regionId: ruins.id,
      isElite: true,
      isDungeonBoss: false,
    },
  });
  const wraith = await upsertEnemyWithDifficulty({
    where: { key: "crypt_wraith" },
    update: {
      name: "Crypt Wraith",
      emoji: "👻",
      level: 14,
      hp: 318,
      attack: 52,
      defense: 30,
      speed: 12,
      xpReward: 242,
      goldMin: 40,
      goldMax: 76,
      regionId: catacombs.id,
      isElite: false,
    },
    create: {
      key: "crypt_wraith",
      name: "Crypt Wraith",
      emoji: "👻",
      level: 14,
      hp: 318,
      attack: 52,
      defense: 30,
      speed: 12,
      xpReward: 242,
      goldMin: 40,
      goldMax: 76,
      regionId: catacombs.id,
      isElite: false,
    },
  });
  const boneKnight = await upsertEnemyWithDifficulty({
    where: { key: "bone_knight" },
    update: {
      name: "Bone Knight",
      emoji: "🦴",
      level: 15,
      hp: 372,
      attack: 60,
      defense: 36,
      speed: 9,
      xpReward: 292,
      goldMin: 46,
      goldMax: 88,
      regionId: catacombs.id,
      isElite: false,
    },
    create: {
      key: "bone_knight",
      name: "Bone Knight",
      emoji: "🦴",
      level: 15,
      hp: 372,
      attack: 60,
      defense: 36,
      speed: 9,
      xpReward: 292,
      goldMin: 46,
      goldMax: 88,
      regionId: catacombs.id,
      isElite: false,
    },
  });
  const warden = await upsertEnemyWithDifficulty({
    where: { key: "grave_warden" },
    update: {
      name: "Grave Warden",
      emoji: "🗿",
      level: 16,
      hp: 442,
      attack: 68,
      defense: 42,
      speed: 10,
      xpReward: 352,
      goldMin: 56,
      goldMax: 104,
      regionId: catacombs.id,
      isElite: true,
      isAdventureMiniBoss: true,
    },
    create: {
      key: "grave_warden",
      name: "Grave Warden",
      emoji: "🗿",
      level: 16,
      hp: 442,
      attack: 68,
      defense: 42,
      speed: 10,
      xpReward: 352,
      goldMin: 56,
      goldMax: 104,
      regionId: catacombs.id,
      isElite: true,
      isAdventureMiniBoss: true,
    },
  });

  const enemyIdByKey = new Map<string, string>([
    ["sewer_rat", rat.id],
    ["plague_burrower", plague.id],
    ["ditch_scrapper", ditch.id],
    ["gutter_cur", gutter.id],
    ["colossal_snail", snail.id],
    ["sewer_fencer", fencer.id],
    ["dire_wolf", wolf.id],
    ["alpha_dire_wolf", alpha.id],
    ["forest_tree_ent", forestEnt.id],
    ["gloom_jackal", jackal.id],
    ["ash_crawler", ashCrawler.id],
    ["cave_imp", imp.id],
    ["ruins_colossus", ruinsColossus.id],
    ["tomb_revenant", revenant.id],
    ["crypt_wraith", wraith.id],
    ["bone_knight", boneKnight.id],
    ["grave_warden", warden.id],
  ]);

  const generatedDrops = buildRegionalDropRows(items);
  const lootValidationErrors = validateLootConfiguration(items, generatedDrops);
  if (lootValidationErrors.length) {
    throw new Error(`Loot generation validation failed:\n${lootValidationErrors.map((err) => `- ${err}`).join("\n")}`);
  }

  const configuredEnemies = new Set(
    REGIONAL_LOOT_DEFINITIONS.flatMap((region) => [
      ...region.enemyKeysByType.COMMON,
      ...region.enemyKeysByType.ELITE,
      ...region.enemyKeysByType.BOSS,
    ]),
  );
  for (const enemyKey of configuredEnemies) {
    if (!enemyIdByKey.has(enemyKey)) throw new Error(`Loot config references unknown enemy key: ${enemyKey}`);
  }

  const dropMap: Array<{ enemyId: string; itemKey: string; chance: number }> = generatedDrops.map((drop) => {
    const enemyId = enemyIdByKey.get(drop.enemyKey);
    if (!enemyId) throw new Error(`Missing enemy id mapping for drop enemy key: ${drop.enemyKey}`);
    return { enemyId, itemKey: drop.itemKey, chance: drop.chance };
  });

  await prisma.lootTableEntry.deleteMany({});
  for (const drop of dropMap) {
    const item = await prisma.item.findUniqueOrThrow({ where: { key: drop.itemKey } });
    await prisma.lootTableEntry.create({ data: { enemyId: drop.enemyId, itemId: item.id, chance: drop.chance } });
  }

  await prisma.dungeon.upsert({
    where: { key: "mossy_cellar" },
    update: { minLevel: 8, description: "A short solo run ending with a Cave Imp champion (suggested Lv 8+)." },
    create: { key: "mossy_cellar", name: "Mossy Cellar", description: "A short solo run ending with a Cave Imp champion.", minLevel: 8, regionId: ruins.id, bossEnemyId: imp.id },
  });

  for (const row of ACHIEVEMENT_CATALOG_SEED) {
    await prisma.achievement.upsert({
      where: { key: row.key },
      create: {
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        icon: row.icon,
        titleReward: row.titleReward,
        category: row.category,
        sortOrder: row.sortOrder,
      },
      update: {
        name: row.name,
        description: row.description,
        icon: row.icon,
        titleReward: row.titleReward,
        category: row.category,
        sortOrder: row.sortOrder,
      },
    });
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { email: "tester@local.dev" },
    update: { username: "tester", passwordHash },
    create: { username: "tester", email: "tester@local.dev", passwordHash },
  });

  const w = CLASS_BASE_STATS.WARRIOR;
  const wAttr = CLASS_STARTING_ATTRIBUTES[CharacterClass.WARRIOR];
  const existing = await prisma.character.findFirst({ where: { userId: user.id } });
  if (!existing) {
    const character = await prisma.character.create({
      data: {
        userId: user.id,
        name: "Aelric",
        class: CharacterClass.WARRIOR,
        level: 1,
        xp: 0,
        hp: w.hp,
        maxHp: w.hp,
        attack: w.attack,
        defense: w.defense,
        speed: w.speed,
        critChance: w.critChance,
        ...wAttr,
        statPoints: STAT_POINTS_ON_CREATE,
        gold: 25,
        regionId: town.id,
      },
    });
    await prisma.characterEquipment.createMany({ data: SLOT_ORDER.map((slot) => ({ characterId: character.id, slot })) });
  }

  const potion = await prisma.item.findUnique({ where: { key: HEALTH_POTION_ITEM_KEY } });
  const testerChar = await prisma.character.findFirst({ where: { userId: user.id } });
  if (potion && testerChar) {
    const potionStack = await prisma.inventoryItem.findFirst({
      where: {
        characterId: testerChar.id,
        itemId: potion.id,
        forgeLevel: 0,
        affixPrefix: null,
        bonusLifeSteal: 0,
        bonusCritChance: 0,
        bonusSkillPower: 0,
        bonusStrength: 0,
        bonusConstitution: 0,
        bonusIntelligence: 0,
        bonusDexterity: 0,
      },
    });
    if (potionStack) {
      await prisma.inventoryItem.update({ where: { id: potionStack.id }, data: { quantity: 3 } });
    } else {
      await prisma.inventoryItem.create({
        data: {
          characterId: testerChar.id,
          itemId: potion.id,
          quantity: 3,
          forgeLevel: 0,
          affixPrefix: null,
          bonusLifeSteal: 0,
          bonusCritChance: 0,
          bonusSkillPower: 0,
          bonusStrength: 0,
          bonusConstitution: 0,
          bonusIntelligence: 0,
          bonusDexterity: 0,
        },
      });
    }
  }

  const founderAch = await prisma.achievement.findUnique({ where: { key: "founder" } });
  if (founderAch) {
    const allChars = await prisma.character.findMany({ select: { id: true } });
    await prisma.characterAchievement.createMany({
      data: allChars.map((c) => ({ characterId: c.id, achievementId: founderAch.id })),
      skipDuplicates: true,
    });
  }
}

main().finally(() => prisma.$disconnect());
