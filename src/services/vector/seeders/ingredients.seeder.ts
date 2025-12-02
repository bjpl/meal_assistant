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
  { ingredientId: 'chicken-breast', name: 'Chicken Breast', aliases: [], category: 'protein', nutritionPer100g: { calories: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0 }, tags: ['lean', 'poultry', 'versatile'], storageLocation: 'fridge', shelfLife: 2, substitutes: ['turkey-breast'], flavorProfile: ['savory', 'mild'], costCategory: 'medium' },
  { ingredientId: 'salmon', name: 'Salmon', aliases: [], category: 'protein', nutritionPer100g: { calories: 208, protein: 20, fat: 13, carbs: 0, fiber: 0 }, tags: ['fish', 'omega-3', 'fatty'], storageLocation: 'fridge', shelfLife: 2, substitutes: ['trout'], flavorProfile: ['rich', 'fatty'], costCategory: 'high' },
  { ingredientId: 'tofu', name: 'Tofu', aliases: [], category: 'protein', nutritionPer100g: { calories: 76, protein: 8, fat: 4.8, carbs: 1.9, fiber: 0.3 }, tags: ['plant-based', 'soy', 'vegetarian'], storageLocation: 'fridge', shelfLife: 7, substitutes: ['tempeh'], flavorProfile: ['neutral', 'mild'], costCategory: 'low' },
  { ingredientId: 'eggs', name: 'Eggs', aliases: [], category: 'protein', nutritionPer100g: { calories: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0 }, tags: ['versatile', 'breakfast', 'complete-protein'], storageLocation: 'fridge', shelfLife: 21, substitutes: [], flavorProfile: ['rich'], costCategory: 'low' },
  { ingredientId: 'greek-yogurt', name: 'Greek Yogurt', aliases: [], category: 'dairy', nutritionPer100g: { calories: 59, protein: 10, fat: 0.4, carbs: 3.6, fiber: 0 }, tags: ['probiotic', 'breakfast'], storageLocation: 'fridge', shelfLife: 14, substitutes: ['regular-yogurt'], flavorProfile: ['tangy', 'creamy'], costCategory: 'medium' },
  { ingredientId: 'ground-beef', name: 'Ground Beef (93% lean)', aliases: [], category: 'protein', nutritionPer100g: { calories: 176, protein: 20, fat: 10, carbs: 0, fiber: 0 }, tags: ['red-meat', 'versatile'], storageLocation: 'fridge', shelfLife: 2, substitutes: ['ground-turkey'], flavorProfile: ['savory', 'rich'], costCategory: 'medium' },
  { ingredientId: 'turkey-breast', name: 'Turkey Breast', aliases: [], category: 'protein', nutritionPer100g: { calories: 135, protein: 30, fat: 0.7, carbs: 0, fiber: 0 }, tags: ['lean', 'poultry'], storageLocation: 'fridge', shelfLife: 2, substitutes: ['chicken-breast'], flavorProfile: ['mild', 'savory'], costCategory: 'medium' },
  { ingredientId: 'shrimp', name: 'Shrimp', aliases: [], category: 'protein', nutritionPer100g: { calories: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0 }, tags: ['seafood', 'lean', 'low-calorie'], storageLocation: 'freezer', shelfLife: 90, substitutes: [], flavorProfile: ['sweet', 'delicate'], costCategory: 'high' },
  { ingredientId: 'cottage-cheese', name: 'Cottage Cheese', aliases: [], category: 'dairy', nutritionPer100g: { calories: 98, protein: 11, fat: 4.3, carbs: 3.4, fiber: 0 }, tags: ['snack'], storageLocation: 'fridge', shelfLife: 10, substitutes: ['ricotta'], flavorProfile: ['mild', 'creamy'], costCategory: 'medium' },
  { ingredientId: 'pork-tenderloin', name: 'Pork Tenderloin', aliases: [], category: 'protein', nutritionPer100g: { calories: 143, protein: 26, fat: 3.5, carbs: 0, fiber: 0 }, tags: ['lean', 'versatile'], storageLocation: 'fridge', shelfLife: 3, substitutes: ['chicken-breast'], flavorProfile: ['mild', 'savory'], costCategory: 'medium' },

  // Carbohydrates
  { ingredientId: 'brown-rice', name: 'Brown Rice', aliases: [], category: 'grain', nutritionPer100g: { calories: 216, protein: 5, fat: 1.8, carbs: 45, fiber: 3.5 }, tags: ['whole-grain', 'staple', 'gluten-free'], storageLocation: 'pantry', shelfLife: 365, substitutes: ['white-rice', 'quinoa'], flavorProfile: ['nutty', 'earthy'], costCategory: 'low' },
  { ingredientId: 'quinoa', name: 'Quinoa', aliases: [], category: 'grain', nutritionPer100g: { calories: 222, protein: 8, fat: 3.6, carbs: 39, fiber: 5 }, tags: ['complete-protein', 'ancient-grain', 'gluten-free'], storageLocation: 'pantry', shelfLife: 365, substitutes: ['brown-rice'], flavorProfile: ['nutty'], costCategory: 'medium' },
  { ingredientId: 'sweet-potato', name: 'Sweet Potato', aliases: [], category: 'produce', nutritionPer100g: { calories: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3 }, tags: ['root-vegetable', 'vitamin-a', 'starchy'], storageLocation: 'pantry', shelfLife: 14, substitutes: ['regular-potato'], flavorProfile: ['sweet', 'earthy'], costCategory: 'low' },
  { ingredientId: 'oats', name: 'Oats', aliases: [], category: 'grain', nutritionPer100g: { calories: 389, protein: 17, fat: 6.9, carbs: 66, fiber: 10.6 }, tags: ['breakfast', 'whole-grain', 'fiber'], storageLocation: 'pantry', shelfLife: 365, substitutes: [], flavorProfile: ['mild', 'nutty'], costCategory: 'low' },
  { ingredientId: 'whole-wheat-bread', name: 'Whole Wheat Bread', aliases: [], category: 'grain', nutritionPer100g: { calories: 247, protein: 13, fat: 3.4, carbs: 41, fiber: 7 }, tags: ['bread', 'whole-grain'], storageLocation: 'pantry', shelfLife: 7, substitutes: ['sourdough'], flavorProfile: ['nutty'], costCategory: 'low' },
  { ingredientId: 'pasta', name: 'Whole Wheat Pasta', aliases: [], category: 'grain', nutritionPer100g: { calories: 348, protein: 14.6, fat: 2.9, carbs: 70, fiber: 12 }, tags: ['pasta', 'whole-grain', 'italian'], storageLocation: 'pantry', shelfLife: 730, substitutes: ['white-pasta'], flavorProfile: ['nutty'], costCategory: 'low' },
  { ingredientId: 'white-rice', name: 'White Rice', aliases: [], category: 'grain', nutritionPer100g: { calories: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4 }, tags: ['staple', 'refined'], storageLocation: 'pantry', shelfLife: 730, substitutes: ['brown-rice'], flavorProfile: ['mild'], costCategory: 'low' },

  // Vegetables
  { ingredientId: 'spinach', name: 'Spinach', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 23, protein: 3, fat: 0.4, carbs: 3.6, fiber: 2.2 }, tags: ['leafy-green', 'iron', 'low-calorie'], storageLocation: 'fridge', shelfLife: 5, substitutes: ['kale'], flavorProfile: ['mild', 'earthy'], costCategory: 'low' },
  { ingredientId: 'broccoli', name: 'Broccoli', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 55, protein: 4, fat: 0.6, carbs: 11, fiber: 2.4 }, tags: ['cruciferous', 'vitamin-c', 'fiber'], storageLocation: 'fridge', shelfLife: 7, substitutes: ['cauliflower'], flavorProfile: ['mild', 'slightly-bitter'], costCategory: 'low' },
  { ingredientId: 'bell-peppers', name: 'Bell Peppers', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 31, protein: 1, fat: 0.3, carbs: 6, fiber: 2.1 }, tags: ['vitamin-c', 'colorful', 'versatile'], storageLocation: 'fridge', shelfLife: 7, substitutes: [], flavorProfile: ['sweet', 'crisp'], costCategory: 'medium' },
  { ingredientId: 'carrots', name: 'Carrots', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 41, protein: 0.9, fat: 0.2, carbs: 10, fiber: 2.8 }, tags: ['root-vegetable', 'vitamin-a', 'sweet'], storageLocation: 'fridge', shelfLife: 14, substitutes: [], flavorProfile: ['sweet', 'earthy'], costCategory: 'low' },
  { ingredientId: 'tomatoes', name: 'Tomatoes', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2 }, tags: ['lycopene', 'versatile', 'acidic'], storageLocation: 'counter', shelfLife: 7, substitutes: [], flavorProfile: ['acidic', 'sweet'], costCategory: 'low' },
  { ingredientId: 'kale', name: 'Kale', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 35, protein: 2.9, fat: 1.5, carbs: 4.4, fiber: 4.1 }, tags: ['leafy-green', 'superfood', 'vitamin-k'], storageLocation: 'fridge', shelfLife: 5, substitutes: ['spinach'], flavorProfile: ['bitter', 'earthy'], costCategory: 'medium' },
  { ingredientId: 'zucchini', name: 'Zucchini', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1 }, tags: ['summer-squash', 'low-calorie', 'versatile'], storageLocation: 'fridge', shelfLife: 7, substitutes: [], flavorProfile: ['mild'], costCategory: 'low' },
  { ingredientId: 'cauliflower', name: 'Cauliflower', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 25, protein: 2, fat: 0.3, carbs: 5, fiber: 2 }, tags: ['cruciferous', 'low-carb', 'versatile'], storageLocation: 'fridge', shelfLife: 7, substitutes: ['broccoli'], flavorProfile: ['mild', 'nutty'], costCategory: 'low' },
  { ingredientId: 'asparagus', name: 'Asparagus', aliases: [], category: 'vegetable', nutritionPer100g: { calories: 20, protein: 2.2, fat: 0.2, carbs: 3.9, fiber: 2.1 }, tags: ['spring-vegetable', 'folate'], storageLocation: 'fridge', shelfLife: 3, substitutes: [], flavorProfile: ['earthy', 'grassy'], costCategory: 'medium' },

  // Fruits
  { ingredientId: 'banana', name: 'Banana', aliases: [], category: 'fruit', nutritionPer100g: { calories: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6 }, tags: ['potassium', 'quick-energy', 'sweet'], storageLocation: 'counter', shelfLife: 5, substitutes: [], flavorProfile: ['sweet'], costCategory: 'low' },
  { ingredientId: 'apple', name: 'Apple', aliases: [], category: 'fruit', nutritionPer100g: { calories: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4 }, tags: ['fiber', 'vitamin-c', 'crunchy'], storageLocation: 'counter', shelfLife: 14, substitutes: [], flavorProfile: ['sweet', 'tart'], costCategory: 'low' },
  { ingredientId: 'berries', name: 'Mixed Berries', aliases: [], category: 'fruit', nutritionPer100g: { calories: 57, protein: 0.7, fat: 0.3, carbs: 14, fiber: 2 }, tags: ['antioxidants', 'low-sugar', 'colorful'], storageLocation: 'fridge', shelfLife: 3, substitutes: [], flavorProfile: ['sweet', 'tart'], costCategory: 'medium' },
  { ingredientId: 'orange', name: 'Orange', aliases: [], category: 'fruit', nutritionPer100g: { calories: 47, protein: 0.9, fat: 0.1, carbs: 12, fiber: 2.4 }, tags: ['vitamin-c', 'citrus', 'juicy'], storageLocation: 'counter', shelfLife: 7, substitutes: [], flavorProfile: ['citrus', 'sweet'], costCategory: 'low' },
  { ingredientId: 'avocado', name: 'Avocado', aliases: [], category: 'fruit', nutritionPer100g: { calories: 160, protein: 2, fat: 15, carbs: 9, fiber: 7 }, tags: ['healthy-fat', 'creamy', 'versatile'], storageLocation: 'counter', shelfLife: 5, substitutes: [], flavorProfile: ['creamy', 'rich'], costCategory: 'medium' },

  // Fats/Oils
  { ingredientId: 'olive-oil', name: 'Olive Oil', aliases: [], category: 'other', nutritionPer100g: { calories: 884, protein: 0, fat: 100, carbs: 0, fiber: 0 }, tags: ['healthy-fat', 'monounsaturated', 'mediterranean'], storageLocation: 'pantry', shelfLife: 365, substitutes: ['avocado-oil'], flavorProfile: ['fruity'], costCategory: 'medium' },
  { ingredientId: 'almonds', name: 'Almonds', aliases: [], category: 'other', nutritionPer100g: { calories: 579, protein: 21, fat: 50, carbs: 22, fiber: 12.5 }, tags: ['nuts', 'vitamin-e', 'protein'], storageLocation: 'pantry', shelfLife: 180, substitutes: ['walnuts'], flavorProfile: ['nutty'], costCategory: 'medium' },
  { ingredientId: 'peanut-butter', name: 'Peanut Butter', aliases: [], category: 'other', nutritionPer100g: { calories: 588, protein: 25, fat: 50, carbs: 20, fiber: 6 }, tags: ['spread', 'protein', 'versatile'], storageLocation: 'pantry', shelfLife: 180, substitutes: ['almond-butter'], flavorProfile: ['nutty', 'rich'], costCategory: 'low' },
  { ingredientId: 'chia-seeds', name: 'Chia Seeds', aliases: [], category: 'other', nutritionPer100g: { calories: 486, protein: 17, fat: 31, carbs: 42, fiber: 34 }, tags: ['superfood', 'omega-3', 'fiber'], storageLocation: 'pantry', shelfLife: 730, substitutes: ['flax-seeds'], flavorProfile: ['mild'], costCategory: 'medium' }
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
      const nutrition = ingredient.nutritionPer100g!;
      const textForEmbedding = [
        `${ingredient.name} is a ${ingredient.category}`,
        `Nutrition per 100g: ${nutrition.calories} calories, ${nutrition.protein}g protein, ${nutrition.fat}g fat, ${nutrition.carbs}g carbs${nutrition.fiber ? `, ${nutrition.fiber}g fiber` : ''}`,
        ingredient.tags ? `Characteristics: ${ingredient.tags.join(', ')}` : ''
      ].filter(Boolean).join('\n');

      // Generate embedding
      const embedding = await embeddingService.embed(textForEmbedding);

      // Create document
      const document: IngredientDocument = {
        id: `ingredient_${ingredient.ingredientId}`,
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
        console.error(`  ✗ Failed to seed ingredient ${ingredient.ingredientId}:`, result.error);
        errorCount++;
      }
    } catch (error) {
      console.error(`  ✗ Error seeding ingredient ${ingredient.ingredientId}:`, error);
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
      await ruVectorService.delete('ingredients', `ingredient_${ingredient.ingredientId}`);
      console.log(`  ✓ Cleared ingredient: ${ingredient.name}`);
    } catch (error) {
      console.error(`  ✗ Error clearing ingredient ${ingredient.ingredientId}:`, error);
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
      const doc = await ruVectorService.get('ingredients', `ingredient_${ingredient.ingredientId}`);
      if (doc) {
        verifiedCount++;
      }
    } catch (error) {
      console.error(`  ✗ Ingredient ${ingredient.ingredientId} not found`);
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
  return INGREDIENTS.find(i => i.ingredientId === id);
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
