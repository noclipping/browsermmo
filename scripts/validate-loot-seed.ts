import {
  buildCompleteRegionalLootItems,
  buildRegionalDropRows,
  ENEMY_TYPE_RARITY_BUCKET_CHANCE,
  LOOT_RARITIES,
  REGIONAL_LOOT_DEFINITIONS,
  validateLootConfiguration,
} from "../prisma/loot-generation";

function main() {
  const items = buildCompleteRegionalLootItems();
  const drops = buildRegionalDropRows(items);
  const errors = validateLootConfiguration(items, drops);

  for (const region of REGIONAL_LOOT_DEFINITIONS) {
    const seen = new Set<string>();
    for (const type of ["COMMON", "ELITE", "BOSS"] as const) {
      for (const enemyKey of region.enemyKeysByType[type]) {
        if (seen.has(enemyKey)) {
          errors.push(`${region.key}: enemy ${enemyKey} appears more than once across enemy types`);
        }
        seen.add(enemyKey);
      }
    }
    for (const type of ["COMMON", "ELITE", "BOSS"] as const) {
      for (const rarity of LOOT_RARITIES) {
        const expectedBucketChance = ENEMY_TYPE_RARITY_BUCKET_CHANCE[type][rarity];
        const sampleRow = drops.find(
          (row) =>
            row.regionKey === region.key &&
            row.enemyType === type &&
            row.rarity === rarity &&
            row.itemKey.startsWith(`loot_reg${region.tier}_`),
        );
        if (!sampleRow) continue;
        const rowsForOneEnemy = drops.filter(
          (row) =>
            row.regionKey === region.key &&
            row.enemyType === type &&
            row.rarity === rarity &&
            row.enemyKey === sampleRow.enemyKey &&
            row.itemKey.startsWith(`loot_reg${region.tier}_`),
        );
        const rowChance = rowsForOneEnemy[0]?.chance ?? 0;
        const reconstructedBucket = 1 - Math.pow(1 - rowChance, rowsForOneEnemy.length);
        if (Math.abs(reconstructedBucket - expectedBucketChance) > 0.000001) {
          errors.push(
            `${region.key}: ${type}/${rarity} bucket mismatch (expected ${expectedBucketChance}, reconstructed ${reconstructedBucket})`,
          );
        }
      }
    }
  }

  if (errors.length) {
    console.error("Loot validation failed:");
    for (const err of errors) console.error(`- ${err}`);
    process.exitCode = 1;
    return;
  }

  console.log("Loot validation passed.");
  console.log(`Generated items: ${items.length}`);
  console.log(`Generated drop rows: ${drops.length}`);
}

main();
