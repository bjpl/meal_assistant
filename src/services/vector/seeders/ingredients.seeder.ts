/**
 * Ingredients Seeder
 * Seeds common ingredients with nutritional data
 */

import { ruVectorService } from '../core/ruvector.service';
import { embeddingService } from '../core/embedding.service';
import { IngredientDocument, IngredientMetadata } from '../types';

/**
 * Common ingredients with nutritional data (per 100g)
 * Expanded from ingredient_substitution model
 */
const INGREDIENTS: IngredientMetadata[] = [
  // Proteins
  { id: 'chicken-breast', name: 'Chicken Breast', category: 'protein', calories: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0, tags: ['lean', 'poultry', 'versatile'] },
  { id: 'salmon', name: 'Salmon', category: 'protein', calories: 208, protein: 20, fat: 13, carbs: 0, fiber: 0, tags: ['fish', 'omega-3', 'fatty'] },
  { id: 'tofu', name: 'Tofu', category: 'protein', calories: 76, protein: 8, fat: 4.8, carbs: 1.9, fiber: 0.3, tags: ['plant-based', 'soy', 'vegetarian'] },
  { id: 'eggs', name: 'Eggs', category: 'protein', calories: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0, tags: ['versatile', 'breakfast', 'complete-protein'] },
  { id: 'greek-yogurt', name: 'Greek Yogurt', category: 'protein', calories: 59, protein: 10, fat: 0.4, carbs: 3.6, fiber: 0, tags: ['dairy', 'probiotic', 'breakfast'] },
  { id: 'ground-beef', name: 'Ground Beef (93% lean)', category: 'protein', calories: 176, protein: 20, fat: 10, carbs: 0, fiber: 0, tags: ['red-meat', 'versatile'] },
  { id: 'turkey-breast', name: 'Turkey Breast', category: 'protein', calories: 135, protein: 30, fat: 0.7, carbs: 0, fiber: 0, tags: ['lean', 'poultry'] },
  { id: 'shrimp', name: 'Shrimp', category: 'protein', calories: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0, tags: ['seafood', 'lean', 'low-calorie'] },
  { id: 'cottage-cheese', name: 'Cottage Cheese', category: 'protein', calories: 98, protein: 11, fat: 4.3, carbs: 3.4, fiber: 0, tags: ['dairy', 'snack'] },
  { id: 'pork-tenderloin', name: 'Pork Tenderloin', category: 'protein', calories: 143, protein: 26, fat: 3.5, carbs: 0, fiber: 0, tags: ['lean', 'versatile'] },

  // Carbohydrates
  { id: 'brown-rice', name: 'Brown Rice', category: 'carb', calories: 216, protein: 5, fat: 1.8, carbs: 45, fiber: 3.5, tags: ['whole-grain', 'staple', 'gluten-free'] },
  { id: 'quinoa', name: 'Quinoa', category: 'carb', calories: 222, protein: 8, fat: 3.6, carbs: 39, fiber: 5, tags: ['complete-protein', 'ancient-grain', 'gluten-free'] },
  { id: 'sweet-potato', name: 'Sweet Potato', category: 'carb', calories: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3, tags: ['root-vegetable', 'vitamin-a', 'starchy'] },
  { id: 'oats', name: 'Oats', category: 'carb', calories: 389, protein: 17, fat: 6.9, carbs: 66, fiber: 10.6, tags: ['breakfast', 'whole-grain', 'fiber'] },
  { id: 'whole-wheat-bread', name: 'Whole Wheat Bread', category: 'carb', calories: 247, protein: 13, fat: 3.4, carbs: 41, fiber: 7, tags: ['bread', 'whole-grain'] },
  { id: 'pasta', name: 'Whole Wheat Pasta', category: 'carb', calories: 348, protein: 14.6, fat: 2.9, carbs: 70, fiber: 12, tags: ['pasta', 'whole-grain', 'italian'] },
  { id: 'white-rice', name: 'White Rice', category: 'carb', calories: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4, tags: ['staple', 'refined'] },

  // Vegetables
  { id: 'spinach', name: 'Spinach', category: 'vegetable', calories: 23, protein: 3, fat: 0.4, carbs: 3.6, fiber: 2.2, tags: ['leafy-green', 'iron', 'low-calorie'] },
  { id: 'broccoli', name: 'Broccoli', category: 'vegetable', calories: 55, protein: 4, fat: 0.6, carbs: 11, fiber: 2.4, tags: ['cruciferous', 'vitamin-c', 'fiber'] },
  { id: 'bell-peppers', name: 'Bell Peppers', category: 'vegetable', calories: 31, protein: 1, fat: 0.3, carbs: 6, fiber: 2.1, tags: ['vitamin-c', 'colorful', 'versatile'] },
  { id: 'carrots', name: 'Carrots', category: 'vegetable', calories: 41, protein: 0.9, fat: 0.2, carbs: 10, fiber: 2.8, tags: ['root-vegetable', 'vitamin-a', 'sweet'] },
  { id: 'tomatoes', name: 'Tomatoes', category: 'vegetable', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2, tags: ['lycopene', 'versatile', 'acidic'] },
  { id: 'kale', name: 'Kale', category: 'vegetable', calories: 35, protein: 2.9, fat: 1.5, carbs: 4.4, fiber: 4.1, tags: ['leafy-green', 'superfood', 'vitamin-k'] },
  { id: 'zucchini', name: 'Zucchini', category: 'vegetable', calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1, tags: ['summer-squash', 'low-calorie', 'versatile'] },
  { id: 'cauliflower', name: 'Cauliflower', category: 'vegetable', calories: 25, protein: 2, fat: 0.3, carbs: 5, fiber: 2, tags: ['cruciferous', 'low-carb', 'versatile'] },
  { id: 'asparagus', name: 'Asparagus', category: 'vegetable', calories: 20, protein: 2.2, fat: 0.2, carbs: 3.9, fiber: 2.1, tags: ['spring-vegetable', 'folate'] },

  // Fruits
  { id: 'banana', name: 'Banana', category: 'fruit', calories: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6, tags: ['potassium', 'quick-energy', 'sweet'] },
  { id: 'apple', name: 'Apple', category: 'fruit', calories: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4, tags: ['fiber', 'vitamin-c', 'crunchy'] },
  { id: 'berries', name: 'Mixed Berries', category: 'fruit', calories: 57, protein: 0.7, fat: 0.3, carbs: 14, fiber: 2, tags: ['antioxidants', 'low-sugar', 'colorful'] },
  { id: 'orange', name: 'Orange', category: 'fruit', calories: 47, protein: 0.9, fat: 0.1, carbs: 12, fiber: 2.4, tags: ['vitamin-c', 'citrus', 'juicy'] },
  { id: 'avocado', name: 'Avocado', category: 'fruit', calories: 160, protein: 2, fat: 15, carbs: 9, fiber: 7, tags: ['healthy-fat', 'creamy', 'versatile'] },

  // Fats/Oils
  { id: 'olive-oil', name: 'Olive Oil', category: 'fat', calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, tags: ['healthy-fat', 'monounsaturated', 'mediterranean'] },
  { id: 'almonds', name: 'Almonds', category: 'fat', calories: 579, protein: 21, fat: 50, carbs: 22, fiber: 12.5, tags: ['nuts', 'vitamin-e', 'protein'] },
  { id: 'peanut-butter', name: 'Peanut Butter', category: 'fat', calories: 588, protein: 25, fat: 50, carbs: 20, fiber: 6, tags: ['spread', 'protein', 'versatile'] },
  { id: 'chia-seeds', name: 'Chia Seeds', category: 'fat', calories: 486, protein: 17, fat: 31, carbs: 42, fiber: 34, tags: ['superfood', 'omega-3', 'fiber'] }
];

/**
 * Seed ingredients into the vector database
 */
export async function seedIngredients(): Promise<void> {
  console.log('🌱 Seeding ingredients...');

  if (!ruVectorService.isInitialized()) {
    console.log('Initializing RuVector service...');
    await ruVectorService.initialize();
  }

  let seededCount = 0;
  let errorCount = 0;

  for (const ingredient of INGREDIENTS) {
    try {
      // Create rich text for embedding
      const textForEmbedding = [
        `${ingredient.name} is a ${ingredient.category}`,
        `Nutrition per 100g: ${ingredient.calories} calories, ${ingredient.protein}g protein, ${ingredient.fat}g fat, ${ingredient.carbs}g carbs, ${ingredient.fiber}g fiber`,
        `Characteristics: ${ingredient.tags.join(', ')}`
      ].join('\n');

      // Generate embedding
      const embedding = await embeddingService.embed(textForEmbedding);

      // Create document
      const document: IngredientDocument = {
        id: `ingredient_${ingredient.id}`,
        embedding,
        metadata: ingredient,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Upsert to database
      const result = await ruVectorService.upsert('ingredients', document);

      if (result.success) {
        console.log(`  ✓ Seeded ingredient: ${ingredient.name}`);
        seededCount++;
      } else {
        console.error(`  ✗ Failed to seed ingredient ${ingredient.id}:`, result.error);
        errorCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error seeding ingredient ${ingredient.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Seeding complete: ${seededCount} ingredients seeded, ${errorCount} errors`);
}

/**
 * Remove all ingredients (for testing/reset)
 */
export async function clearIngredients(): Promise<void> {
  console.log('🧹 Clearing ingredients...');

  if (!ruVectorService.isInitialized()) {
    await ruVectorService.initialize();
  }

  for (const ingredient of INGREDIENTS) {
    try {
      await ruVectorService.delete('ingredients', `ingredient_${ingredient.id}`);
      console.log(`  ✓ Cleared ingredient: ${ingredient.name}`);
    } catch (error) {
      console.error(`  ✗ Error clearing ingredient ${ingredient.id}:`, error);
    }
  }

  console.log('✅ Ingredients cleared');
}

/**
 * Verify ingredient seeding
 */
export async function verifyIngredients(): Promise<boolean> {
  console.log('🔍 Verifying ingredients...');

  if (!ruVectorService.isInitialized()) {
    await ruVectorService.initialize();
  }

  let verifiedCount = 0;

  for (const ingredient of INGREDIENTS) {
    try {
      const doc = await ruVectorService.get('ingredients', `ingredient_${ingredient.id}`);
      if (doc) {
        verifiedCount++;
      }
    } catch (error) {
      console.error(`  ✗ Ingredient ${ingredient.id} not found`);
    }
  }

  const allVerified = verifiedCount === INGREDIENTS.length;
  console.log(`\n${allVerified ? '✅' : '⚠️'} Verified ${verifiedCount}/${INGREDIENTS.length} ingredients`);

  return allVerified;
}

/**
 * Get ingredient by ID
 */
export function getIngredientById(id: string): IngredientMetadata | undefined {
  return INGREDIENTS.find(i => i.id === id);
}

/**
 * Get ingredients by category
 */
export function getIngredientsByCategory(category: string): IngredientMetadata[] {
  return INGREDIENTS.filter(i => i.category === category);
}

/**
 * Get all ingredients
 */
export function getAllIngredients(): IngredientMetadata[] {
  return [...INGREDIENTS];
}
