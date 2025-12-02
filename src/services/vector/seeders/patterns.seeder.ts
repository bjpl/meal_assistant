/**
 * Meal Patterns Seeder
 * Seeds the 7 meal patterns from the meal assistant system
 */

import { ruVectorService } from '../core/ruvector.service';
import { embeddingService } from '../core/embedding.service';
import { MealPatternDocument, MealPatternMetadata } from '../types';

/**
 * The 7 meal patterns from patternsSlice.ts
 */
const MEAL_PATTERNS: MealPatternMetadata[] = [
  {
    patternId: 'A',
    name: 'Traditional',
    description: 'Regular schedule with consistent energy throughout the day. Ideal for office work. Optimal for: Regular schedule, Consistent energy, Office work',
    mealType: 'breakfast',
    cuisines: [],
    dietary: [],
    ingredients: [],
    prepTime: 30,
    cookTime: 30,
    difficulty: 'medium',
    servings: 3,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 135,
    mealsCount: 3
  },
  {
    patternId: 'B',
    name: 'Reversed',
    description: 'Light dinner preference with larger midday meal. Great for social lunches. Optimal for: Light dinner, Business lunches, Social midday meals',
    mealType: 'lunch',
    cuisines: [],
    dietary: [],
    ingredients: [],
    prepTime: 40,
    cookTime: 40,
    difficulty: 'medium',
    servings: 3,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 140,
    mealsCount: 3
  },
  {
    patternId: 'C',
    name: 'Intermittent Fasting',
    description: '16:8 fasting window. Skip breakfast, eat within 8-hour window. Optimal for: Fat burning, Mental clarity, Simplified planning',
    mealType: 'lunch',
    cuisines: [],
    dietary: ['intermittent-fasting'],
    ingredients: [],
    prepTime: 25,
    cookTime: 25,
    difficulty: 'easy',
    servings: 2,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 135,
    mealsCount: 2
  },
  {
    patternId: 'D',
    name: 'Grazing - 4 Mini Meals',
    description: 'Four evenly distributed smaller meals throughout the day for steady energy and blood sugar management. Optimal for: Steady energy, Prevents hunger, Blood sugar management',
    mealType: 'snack',
    cuisines: [],
    dietary: [],
    ingredients: [],
    prepTime: 20,
    cookTime: 20,
    difficulty: 'easy',
    servings: 4,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 130,
    mealsCount: 4
  },
  {
    patternId: 'E',
    name: 'Grazing - Platter Method',
    description: 'All-day access to pre-portioned platter with organized stations for visual eaters. Optimal for: Work from home, Visual eaters, Flexible schedule',
    mealType: 'snack',
    cuisines: [],
    dietary: [],
    ingredients: [],
    prepTime: 60,
    cookTime: 0,
    difficulty: 'easy',
    servings: 1,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 135,
    mealsCount: 1
  },
  {
    patternId: 'F',
    name: 'Big Breakfast',
    description: 'Front-loaded calories with large morning meal for breakfast lovers and morning workout enthusiasts. Optimal for: Morning workouts, Weekend leisure, Breakfast lovers',
    mealType: 'breakfast',
    cuisines: [],
    dietary: [],
    ingredients: [],
    prepTime: 35,
    cookTime: 35,
    difficulty: 'medium',
    servings: 3,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 138,
    mealsCount: 3
  },
  {
    patternId: 'G',
    name: 'Morning Feast',
    description: 'Early eating window ending at 1 PM for reverse intermittent fasting with large morning appetite. Optimal for: Reverse IF, Large morning appetite, Evening social plans',
    mealType: 'breakfast',
    cuisines: [],
    dietary: ['reverse-intermittent-fasting'],
    ingredients: [],
    prepTime: 45,
    cookTime: 45,
    difficulty: 'medium',
    servings: 3,
    cost: 'medium',
    totalCalories: 1800,
    totalProtein: 142,
    mealsCount: 3
  }
];

/**
 * Seed meal patterns into the vector database
 */
export async function seedPatterns(): Promise<void> {
  console.log('🌱 Seeding meal patterns...');

  if (!ruVectorService.isInitialized()) {
    console.log('Initializing RuVector service...');
    await ruVectorService.initialize();
  }

  let seededCount = 0;
  let errorCount = 0;

  for (const pattern of MEAL_PATTERNS) {
    try {
      // Create text for embedding that captures the pattern's essence
      const textForEmbedding = [
        `${pattern.name}: ${pattern.description}`,
        `${pattern.totalCalories} calories, ${pattern.totalProtein}g protein`,
        `${pattern.mealsCount} meals per day`
      ].join('\n');

      // Generate embedding
      const embedding = await embeddingService.embed(textForEmbedding);

      // Create document
      const document: MealPatternDocument = {
        id: `pattern_${pattern.patternId}`,
        embedding,
        metadata: pattern,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Upsert to database
      const result = await ruVectorService.upsert('meal_patterns', document);

      if (result.success) {
        console.log(`  ✓ Seeded pattern ${pattern.patternId}: ${pattern.name}`);
        seededCount++;
      } else {
        console.error(`  ✗ Failed to seed pattern ${pattern.patternId}:`, result.error);
        errorCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error seeding pattern ${pattern.patternId}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Seeding complete: ${seededCount} patterns seeded, ${errorCount} errors`);
}

/**
 * Remove all meal patterns (for testing/reset)
 */
export async function clearPatterns(): Promise<void> {
  console.log('🧹 Clearing meal patterns...');

  if (!ruVectorService.isInitialized()) {
    await ruVectorService.initialize();
  }

  for (const pattern of MEAL_PATTERNS) {
    try {
      await ruVectorService.delete('meal_patterns', `pattern_${pattern.patternId}`);
      console.log(`  ✓ Cleared pattern ${pattern.patternId}`);
    } catch (error) {
      console.error(`  ✗ Error clearing pattern ${pattern.patternId}:`, error);
    }
  }

  console.log('✅ Patterns cleared');
}

/**
 * Verify pattern seeding
 */
export async function verifyPatterns(): Promise<boolean> {
  console.log('🔍 Verifying meal patterns...');

  if (!ruVectorService.isInitialized()) {
    await ruVectorService.initialize();
  }

  let verifiedCount = 0;

  for (const pattern of MEAL_PATTERNS) {
    try {
      const doc = await ruVectorService.get('meal_patterns', `pattern_${pattern.patternId}`);
      if (doc) {
        verifiedCount++;
      }
    } catch (error) {
      console.error(`  ✗ Pattern ${pattern.patternId} not found`);
    }
  }

  const allVerified = verifiedCount === MEAL_PATTERNS.length;
  console.log(`\n${allVerified ? '✅' : '⚠️'} Verified ${verifiedCount}/${MEAL_PATTERNS.length} patterns`);

  return allVerified;
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): MealPatternMetadata | undefined {
  return MEAL_PATTERNS.find(p => p.patternId === id);
}

/**
 * Get all patterns
 */
export function getAllPatterns(): MealPatternMetadata[] {
  return [...MEAL_PATTERNS];
}
