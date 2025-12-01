/**
 * Seeders Index
 * Main export point for all data seeders
 */

// Pattern seeder
export {
  seedPatterns,
  clearPatterns,
  verifyPatterns,
  getPatternById,
  getAllPatterns
} from './patterns.seeder';

// Ingredient seeder
export {
  seedIngredients,
  clearIngredients,
  verifyIngredients,
  getIngredientById,
  getIngredientsByCategory,
  getAllIngredients
} from './ingredients.seeder';

// Graph seeder
export {
  seedGraph,
  clearGraph,
  verifyGraph,
  seedAll
} from './graph.seeder';

/**
 * Run all seeders in sequence
 */
export async function runAllSeeders(): Promise<void> {
  const { seedPatterns } = await import('./patterns.seeder');
  const { seedIngredients } = await import('./ingredients.seeder');
  const { seedGraph } = await import('./graph.seeder');

  console.log('🌱 Running all seeders...\n');

  try {
    // Seed patterns first
    await seedPatterns();
    console.log('');

    // Then seed ingredients
    await seedIngredients();
    console.log('');

    // Finally seed graph relationships
    await seedGraph();

    console.log('\n✅ All seeders completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Verify all seeded data
 */
export async function verifyAllSeeders(): Promise<boolean> {
  const { verifyPatterns } = await import('./patterns.seeder');
  const { verifyIngredients } = await import('./ingredients.seeder');
  const { verifyGraph } = await import('./graph.seeder');

  console.log('🔍 Verifying all seeded data...\n');

  try {
    const patternsOk = await verifyPatterns();
    console.log('');

    const ingredientsOk = await verifyIngredients();
    console.log('');

    const graphOk = await verifyGraph();

    const allOk = patternsOk && ingredientsOk && graphOk;
    console.log(`\n${allOk ? '✅' : '⚠️'} Overall verification: ${allOk ? 'PASSED' : 'FAILED'}`);

    return allOk;
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clear all seeded data
 */
export async function clearAllSeeders(): Promise<void> {
  const { clearPatterns } = await import('./patterns.seeder');
  const { clearIngredients } = await import('./ingredients.seeder');
  const { clearGraph } = await import('./graph.seeder');

  console.log('🧹 Clearing all seeded data...\n');

  try {
    await clearGraph();
    console.log('');

    await clearIngredients();
    console.log('');

    await clearPatterns();

    console.log('\n✅ All data cleared successfully!');
  } catch (error) {
    console.error('\n❌ Clearing failed:', error);
    throw error;
  }
}
