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
    id: 'A',
    name: 'Traditional',
    description: 'Regular schedule with consistent energy throughout the day. Ideal for office work.',
    optimalFor: ['Regular schedule', 'Consistent energy', 'Office work'],
    totalCalories: 1800,
    totalProtein: 135,
    mealsCount: 3,
    tags: ['traditional', 'office', 'consistent-energy']
  },
  {
    id: 'B',
    name: 'Reversed',
    description: 'Light dinner preference with larger midday meal. Great for social lunches.',
    optimalFor: ['Light dinner', 'Business lunches', 'Social midday meals'],
    totalCalories: 1800,
    totalProtein: 140,
    mealsCount: 3,
    tags: ['light-dinner', 'social', 'business-lunch']
  },
  {
    id: 'C',
    name: 'Intermittent Fasting',
    description: '16:8 fasting window. Skip breakfast, eat within 8-hour window.',
    optimalFor: ['Fat burning', 'Mental clarity', 'Simplified planning'],
    totalCalories: 1800,
    totalProtein: 135,
    mealsCount: 2,
    tags: ['intermittent-fasting', '16-8', 'skip-breakfast', 'fat-burning']
  },
  {
    id: 'D',
    name: 'Grazing - 4 Mini Meals',
    description: 'Four evenly distributed smaller meals throughout the day for steady energy and blood sugar management.',
    optimalFor: ['Steady energy', 'Prevents hunger', 'Blood sugar management'],
    totalCalories: 1800,
    totalProtein: 130,
    mealsCount: 4,
    tags: ['grazing', 'mini-meals', 'steady-energy', 'blood-sugar']
  },
  {
    id: 'E',
    name: 'Grazing - Platter Method',
    description: 'All-day access to pre-portioned platter with organized stations for visual eaters.',
    optimalFor: ['Work from home', 'Visual eaters', 'Flexible schedule'],
    totalCalories: 1800,
    totalProtein: 135,
    mealsCount: 1,
    tags: ['grazing', 'platter', 'work-from-home', 'visual', 'flexible']
  },
  {
    id: 'F',
    name: 'Big Breakfast',
    description: 'Front-loaded calories with large morning meal for breakfast lovers and morning workout enthusiasts.',
    optimalFor: ['Morning workouts', 'Weekend leisure', 'Breakfast lovers'],
    totalCalories: 1800,
    totalProtein: 138,
    mealsCount: 3,
    tags: ['big-breakfast', 'morning-workout', 'front-loaded']
  },
  {
    id: 'G',
    name: 'Morning Feast',
    description: 'Early eating window ending at 1 PM for reverse intermittent fasting with large morning appetite.',
    optimalFor: ['Reverse IF', 'Large morning appetite', 'Evening social plans'],
    totalCalories: 1800,
    totalProtein: 142,
    mealsCount: 3,
    tags: ['reverse-if', 'early-window', 'morning-feast']
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
        `Optimal for: ${pattern.optimalFor.join(', ')}`,
        `${pattern.totalCalories} calories, ${pattern.totalProtein}g protein`,
        `${pattern.mealsCount} meals per day`,
        `Tags: ${pattern.tags.join(', ')}`
      ].join('\n');

      // Generate embedding
      const embedding = await embeddingService.embed(textForEmbedding);

      // Create document
      const document: MealPatternDocument = {
        id: `pattern_${pattern.id}`,
        embedding,
        metadata: pattern,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Upsert to database
      const result = await ruVectorService.upsert('meal_patterns', document);

      if (result.success) {
        console.log(`  ✓ Seeded pattern ${pattern.id}: ${pattern.name}`);
        seededCount++;
      } else {
        console.error(`  ✗ Failed to seed pattern ${pattern.id}:`, result.error);
        errorCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error seeding pattern ${pattern.id}:`, error);
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
      await ruVectorService.delete('meal_patterns', `pattern_${pattern.id}`);
      console.log(`  ✓ Cleared pattern ${pattern.id}`);
    } catch (error) {
      console.error(`  ✗ Error clearing pattern ${pattern.id}:`, error);
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
      const doc = await ruVectorService.get('meal_patterns', `pattern_${pattern.id}`);
      if (doc) {
        verifiedCount++;
      }
    } catch (error) {
      console.error(`  ✗ Pattern ${pattern.id} not found`);
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
  return MEAL_PATTERNS.find(p => p.id === id);
}

/**
 * Get all patterns
 */
export function getAllPatterns(): MealPatternMetadata[] {
  return [...MEAL_PATTERNS];
}
