/**
 * Knowledge Graph Seeder
 * Seeds ingredient relationships and substitutions
 */

import { graphService } from '../graph/graph.service';
import { getAllIngredients, getIngredientById } from './ingredients.seeder';
import { getAllPatterns, getPatternById } from './patterns.seeder';
import { GraphNode, GraphEdge } from '../types';

/**
 * Ingredient substitution relationships with scores
 */
const SUBSTITUTION_RELATIONSHIPS = [
  // Protein substitutions
  { from: 'chicken-breast', to: 'turkey-breast', score: 0.95, context: 'poultry-swap', nutritionalMatch: 0.9 },
  { from: 'chicken-breast', to: 'tofu', score: 0.75, context: 'vegetarian', nutritionalMatch: 0.7 },
  { from: 'salmon', to: 'shrimp', score: 0.8, context: 'seafood-swap', nutritionalMatch: 0.75 },
  { from: 'ground-beef', to: 'turkey-breast', score: 0.85, context: 'lean-option', nutritionalMatch: 0.8 },
  { from: 'eggs', to: 'tofu', score: 0.7, context: 'vegan', nutritionalMatch: 0.6 },
  { from: 'greek-yogurt', to: 'cottage-cheese', score: 0.9, context: 'dairy-swap', nutritionalMatch: 0.85 },

  // Carb substitutions
  { from: 'white-rice', to: 'brown-rice', score: 0.9, context: 'whole-grain', nutritionalMatch: 0.8 },
  { from: 'white-rice', to: 'quinoa', score: 0.85, context: 'protein-boost', nutritionalMatch: 0.75 },
  { from: 'pasta', to: 'zucchini', score: 0.6, context: 'low-carb', nutritionalMatch: 0.4 },
  { from: 'sweet-potato', to: 'cauliflower', score: 0.65, context: 'low-carb', nutritionalMatch: 0.5 },

  // Vegetable substitutions
  { from: 'spinach', to: 'kale', score: 0.9, context: 'leafy-green', nutritionalMatch: 0.85 },
  { from: 'broccoli', to: 'cauliflower', score: 0.85, context: 'cruciferous', nutritionalMatch: 0.8 },
  { from: 'bell-peppers', to: 'tomatoes', score: 0.7, context: 'color-flavor', nutritionalMatch: 0.6 }
];

/**
 * Pattern-ingredient relationships (what fits each pattern)
 */
const PATTERN_INGREDIENT_RELATIONSHIPS = [
  // Traditional pattern (A) - balanced throughout day
  { pattern: 'A', ingredient: 'chicken-breast', mealType: 'noon', portion: 'medium', score: 0.95 },
  { pattern: 'A', ingredient: 'brown-rice', mealType: 'noon', portion: 'medium', score: 0.9 },
  { pattern: 'A', ingredient: 'eggs', mealType: 'morning', portion: 'medium', score: 0.95 },
  { pattern: 'A', ingredient: 'salmon', mealType: 'evening', portion: 'medium', score: 0.9 },

  // Intermittent Fasting (C) - larger meals
  { pattern: 'C', ingredient: 'chicken-breast', mealType: 'noon', portion: 'large', score: 0.95 },
  { pattern: 'C', ingredient: 'sweet-potato', mealType: 'noon', portion: 'large', score: 0.9 },
  { pattern: 'C', ingredient: 'avocado', mealType: 'noon', portion: 'medium', score: 0.85 },

  // Grazing patterns (D, E) - smaller portions, frequent
  { pattern: 'D', ingredient: 'greek-yogurt', mealType: 'morning', portion: 'small', score: 0.9 },
  { pattern: 'D', ingredient: 'almonds', mealType: 'snack', portion: 'small', score: 0.85 },
  { pattern: 'E', ingredient: 'berries', mealType: 'platter', portion: 'small', score: 0.9 },
  { pattern: 'E', ingredient: 'carrots', mealType: 'platter', portion: 'small', score: 0.85 },

  // Big Breakfast (F) - front-loaded
  { pattern: 'F', ingredient: 'eggs', mealType: 'morning', portion: 'large', score: 0.95 },
  { pattern: 'F', ingredient: 'oats', mealType: 'morning', portion: 'large', score: 0.9 },
  { pattern: 'F', ingredient: 'banana', mealType: 'morning', portion: 'medium', score: 0.85 }
];

/**
 * Complementary ingredient pairings (what goes well together)
 */
const FLAVOR_PAIRINGS = [
  { from: 'chicken-breast', to: 'broccoli', score: 0.9, cuisine: 'universal' },
  { from: 'salmon', to: 'asparagus', score: 0.95, cuisine: 'western' },
  { from: 'eggs', to: 'spinach', score: 0.9, cuisine: 'universal' },
  { from: 'quinoa', to: 'kale', score: 0.85, cuisine: 'healthy' },
  { from: 'tofu', to: 'broccoli', score: 0.85, cuisine: 'asian' },
  { from: 'sweet-potato', to: 'chicken-breast', score: 0.9, cuisine: 'universal' }
];

/**
 * Seed the knowledge graph with all relationships
 */
export async function seedGraph(): Promise<void> {
  console.log('🌱 Seeding knowledge graph...');

  if (!graphService.isInitialized()) {
    console.log('Initializing graph service...');
    await graphService.initialize();
  }

  let nodesCreated = 0;
  let edgesCreated = 0;
  let errors = 0;

  // 1. Create ingredient nodes
  console.log('\n📦 Creating ingredient nodes...');
  const ingredients = getAllIngredients();
  for (const ingredient of ingredients) {
    try {
      await graphService.createNode('Ingredient', {
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        calories: ingredient.calories,
        protein: ingredient.protein,
        tags: ingredient.tags
      });
      console.log(`  ✓ Created node: ${ingredient.name}`);
      nodesCreated++;
    } catch (error) {
      console.error(`  ✗ Error creating node ${ingredient.id}:`, error);
      errors++;
    }
  }

  // 2. Create pattern nodes
  console.log('\n📋 Creating pattern nodes...');
  const patterns = getAllPatterns();
  for (const pattern of patterns) {
    try {
      await graphService.createNode('MealPattern', {
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        totalCalories: pattern.totalCalories,
        totalProtein: pattern.totalProtein,
        mealsCount: pattern.mealsCount
      });
      console.log(`  ✓ Created node: ${pattern.name}`);
      nodesCreated++;
    } catch (error) {
      console.error(`  ✗ Error creating pattern node ${pattern.id}:`, error);
      errors++;
    }
  }

  // 3. Create substitution relationships
  console.log('\n🔄 Creating substitution relationships...');
  for (const sub of SUBSTITUTION_RELATIONSHIPS) {
    try {
      await graphService.createEdge(sub.from, sub.to, 'SUBSTITUTE_FOR', {
        score: sub.score,
        context: sub.context,
        nutritionalMatch: sub.nutritionalMatch,
        bidirectional: true
      });
      console.log(`  ✓ ${sub.from} ↔️ ${sub.to} (${sub.context})`);
      edgesCreated++;
    } catch (error) {
      console.error(`  ✗ Error creating substitution ${sub.from} -> ${sub.to}:`, error);
      errors++;
    }
  }

  // 4. Create pattern-ingredient relationships
  console.log('\n🍽️ Creating pattern-ingredient relationships...');
  for (const rel of PATTERN_INGREDIENT_RELATIONSHIPS) {
    try {
      await graphService.createEdge(rel.ingredient, `pattern_${rel.pattern}`, 'FITS_PATTERN', {
        mealType: rel.mealType,
        portion: rel.portion,
        score: rel.score
      });
      console.log(`  ✓ ${rel.ingredient} → Pattern ${rel.pattern} (${rel.mealType})`);
      edgesCreated++;
    } catch (error) {
      console.error(`  ✗ Error creating pattern relationship:`, error);
      errors++;
    }
  }

  // 5. Create flavor pairings
  console.log('\n👫 Creating flavor pairings...');
  for (const pair of FLAVOR_PAIRINGS) {
    try {
      await graphService.createEdge(pair.from, pair.to, 'PAIRS_WITH', {
        score: pair.score,
        cuisine: pair.cuisine,
        bidirectional: true
      });
      console.log(`  ✓ ${pair.from} + ${pair.to} (${pair.cuisine})`);
      edgesCreated++;
    } catch (error) {
      console.error(`  ✗ Error creating pairing ${pair.from} + ${pair.to}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Graph seeding complete:`);
  console.log(`   Nodes created: ${nodesCreated}`);
  console.log(`   Edges created: ${edgesCreated}`);
  console.log(`   Errors: ${errors}`);
}

/**
 * Clear the entire knowledge graph (for testing/reset)
 */
export async function clearGraph(): Promise<void> {
  console.log('🧹 Clearing knowledge graph...');

  if (!graphService.isInitialized()) {
    await graphService.initialize();
  }

  try {
    await graphService.clear();
    console.log('✅ Graph cleared');
  } catch (error) {
    console.error('✗ Error clearing graph:', error);
  }
}

/**
 * Verify graph seeding
 */
export async function verifyGraph(): Promise<boolean> {
  console.log('🔍 Verifying knowledge graph...');

  if (!graphService.isInitialized()) {
    await graphService.initialize();
  }

  try {
    const stats = await graphService.getStats();
    console.log(`\n📊 Graph Statistics:`);
    console.log(`   Total nodes: ${stats.totalNodes}`);
    console.log(`   Total edges: ${stats.totalEdges}`);
    console.log(`   Node types: ${JSON.stringify(stats.nodesByType)}`);
    console.log(`   Edge types: ${JSON.stringify(stats.edgesByType)}`);

    const expectedNodes = getAllIngredients().length + getAllPatterns().length;
    const expectedEdges = SUBSTITUTION_RELATIONSHIPS.length +
                          PATTERN_INGREDIENT_RELATIONSHIPS.length +
                          FLAVOR_PAIRINGS.length;

    const nodesMatch = stats.totalNodes >= expectedNodes * 0.9; // Allow 10% tolerance
    const edgesMatch = stats.totalEdges >= expectedEdges * 0.9;

    const verified = nodesMatch && edgesMatch;
    console.log(`\n${verified ? '✅' : '⚠️'} Graph verification ${verified ? 'passed' : 'failed'}`);

    return verified;
  } catch (error) {
    console.error('✗ Error verifying graph:', error);
    return false;
  }
}

/**
 * Seed all data (convenience function)
 */
export async function seedAll(): Promise<void> {
  console.log('🚀 Starting complete data seeding...\n');

  try {
    await seedGraph();
    console.log('\n✅ All seeding operations completed successfully');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}
