import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ENEMY_DIFFICULTY_MULTIPLIER = 1.25;

type EnemySeed = {
  key: string;
  name: string;
  emoji: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  xpReward: number;
  goldMin: number;
  goldMax: number;
  regionKey: "town_outskirts" | "forest_edge" | "ancient_ruins" | "murk_catacombs";
  flags?: {
    isElite?: boolean;
    isAdventureMiniBoss?: boolean;
    isDungeonBoss?: boolean;
  };
};

function scale(n: number) {
  return Math.max(1, Math.floor(n * ENEMY_DIFFICULTY_MULTIPLIER));
}

const ENEMIES: EnemySeed[] = [
  { key: "sewer_rat", name: "Sewer Rat", emoji: "🐀", level: 1, hp: 36, attack: 8, defense: 6, speed: 6, xpReward: 24, goldMin: 3, goldMax: 8, regionKey: "town_outskirts" },
  { key: "plague_burrower", name: "Plague Burrower", emoji: "🐀", level: 2, hp: 66, attack: 14, defense: 9, speed: 7, xpReward: 46, goldMin: 8, goldMax: 18, regionKey: "town_outskirts", flags: { isElite: true } },
  { key: "ditch_scrapper", name: "Ditch Scrapper", emoji: "🥊", level: 1, hp: 51, attack: 12, defense: 8, speed: 7, xpReward: 32, goldMin: 4, goldMax: 10, regionKey: "town_outskirts" },
  { key: "gutter_cur", name: "Gutter Cur", emoji: "🐕", level: 2, hp: 60, attack: 14, defense: 9, speed: 9, xpReward: 38, goldMin: 5, goldMax: 12, regionKey: "town_outskirts" },
  { key: "colossal_snail", name: "Colossal Snail", emoji: "🐌", level: 2, hp: 117, attack: 9, defense: 21, speed: 2, xpReward: 44, goldMin: 7, goldMax: 16, regionKey: "town_outskirts", flags: { isElite: true } },
  { key: "sewer_fencer", name: "Sewer Fencer", emoji: "🤺", level: 3, hp: 99, attack: 23, defense: 14, speed: 11, xpReward: 72, goldMin: 16, goldMax: 34, regionKey: "town_outskirts", flags: { isAdventureMiniBoss: true } },

  { key: "guild_boss_sewer_rat_king", name: "Sewer Rat King", emoji: "👑", level: 4, hp: 120, attack: 18, defense: 12, speed: 10, xpReward: 0, goldMin: 0, goldMax: 0, regionKey: "town_outskirts", flags: { isDungeonBoss: true } },
  { key: "guild_boss_gravebound_ogre", name: "Gravebound Ogre", emoji: "💀", level: 7, hp: 220, attack: 28, defense: 18, speed: 8, xpReward: 0, goldMin: 0, goldMax: 0, regionKey: "town_outskirts", flags: { isDungeonBoss: true } },
  { key: "guild_boss_ancient_warden", name: "Ancient Warden", emoji: "🗿", level: 10, hp: 340, attack: 36, defense: 28, speed: 10, xpReward: 0, goldMin: 0, goldMax: 0, regionKey: "town_outskirts", flags: { isDungeonBoss: true } },
  { key: "guild_boss_ashen_drake", name: "Ashen Drake", emoji: "🐉", level: 14, hp: 480, attack: 44, defense: 32, speed: 14, xpReward: 0, goldMin: 0, goldMax: 0, regionKey: "town_outskirts", flags: { isDungeonBoss: true } },
  { key: "guild_boss_duskforged_titan", name: "Duskforged Titan", emoji: "⚒️", level: 18, hp: 620, attack: 52, defense: 40, speed: 12, xpReward: 0, goldMin: 0, goldMax: 0, regionKey: "town_outskirts", flags: { isDungeonBoss: true } },

  { key: "dire_wolf", name: "Dire Wolf", emoji: "🐺", level: 5, hp: 110, attack: 22, defense: 13, speed: 10, xpReward: 78, goldMin: 14, goldMax: 28, regionKey: "forest_edge" },
  { key: "alpha_dire_wolf", name: "Alpha Dire Wolf", emoji: "🐺", level: 7, hp: 156, attack: 30, defense: 18, speed: 11, xpReward: 120, goldMin: 22, goldMax: 42, regionKey: "forest_edge", flags: { isElite: true } },
  { key: "forest_tree_ent", name: "Forest Tree Ent", emoji: "🌳", level: 8, hp: 214, attack: 34, defense: 24, speed: 7, xpReward: 156, goldMin: 30, goldMax: 56, regionKey: "forest_edge", flags: { isElite: true, isAdventureMiniBoss: true } },

  { key: "gloom_jackal", name: "Gloom Jackal", emoji: "🦴", level: 10, hp: 194, attack: 36, defense: 20, speed: 11, xpReward: 156, goldMin: 28, goldMax: 54, regionKey: "ancient_ruins" },
  {
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
    regionKey: "ancient_ruins",
  },
  { key: "cave_imp", name: "Cave Imp", emoji: "👺", level: 11, hp: 208, attack: 36, defense: 21, speed: 8, xpReward: 232, goldMin: 36, goldMax: 72, regionKey: "ancient_ruins", flags: { isElite: true, isDungeonBoss: true } },
  { key: "ruins_colossus", name: "Ruins Colossus", emoji: "🗿", level: 12, hp: 272, attack: 42, defense: 28, speed: 7, xpReward: 268, goldMin: 42, goldMax: 82, regionKey: "ancient_ruins", flags: { isElite: true, isAdventureMiniBoss: true } },
  { key: "tomb_revenant", name: "Tomb Revenant", emoji: "⚔️", level: 10, hp: 232, attack: 40, defense: 23, speed: 8, xpReward: 184, goldMin: 30, goldMax: 58, regionKey: "ancient_ruins", flags: { isElite: true } },

  { key: "crypt_wraith", name: "Crypt Wraith", emoji: "👻", level: 14, hp: 318, attack: 52, defense: 30, speed: 12, xpReward: 242, goldMin: 40, goldMax: 76, regionKey: "murk_catacombs" },
  { key: "bone_knight", name: "Bone Knight", emoji: "🦴", level: 15, hp: 372, attack: 60, defense: 36, speed: 9, xpReward: 292, goldMin: 46, goldMax: 88, regionKey: "murk_catacombs" },
  { key: "grave_warden", name: "Grave Warden", emoji: "🗿", level: 16, hp: 442, attack: 68, defense: 42, speed: 10, xpReward: 352, goldMin: 56, goldMax: 104, regionKey: "murk_catacombs", flags: { isElite: true, isAdventureMiniBoss: true } },
];

async function main() {
  const regions = await prisma.region.findMany({
    where: { key: { in: ["town_outskirts", "forest_edge", "ancient_ruins", "murk_catacombs"] } },
    select: { id: true, key: true },
  });
  const regionByKey = new Map(regions.map((r) => [r.key, r.id]));

  for (const row of ENEMIES) {
    const regionId = regionByKey.get(row.regionKey);
    if (!regionId) throw new Error(`Missing region ${row.regionKey}. Seed regions first.`);

    const data = {
      name: row.name,
      emoji: row.emoji,
      level: row.level,
      hp: scale(row.hp),
      attack: scale(row.attack),
      defense: scale(row.defense),
      speed: scale(row.speed),
      xpReward: row.xpReward,
      goldMin: row.goldMin,
      goldMax: row.goldMax,
      regionId,
      isElite: row.flags?.isElite ?? false,
      isAdventureMiniBoss: row.flags?.isAdventureMiniBoss ?? false,
      isDungeonBoss: row.flags?.isDungeonBoss ?? false,
    };

    await prisma.enemy.upsert({
      where: { key: row.key },
      update: data,
      create: { key: row.key, ...data },
    });
  }

  console.log(`Re-seeded ${ENEMIES.length} enemies.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
