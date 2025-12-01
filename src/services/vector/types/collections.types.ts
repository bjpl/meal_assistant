/**
 * Collection Schema Types
 * Type definitions for RuVector collections
 */

import { VectorDocument } from './vector.types';

/**
 * Base collection metadata
 */
export interface CollectionMetadata {
  collectionName: string;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  schema?: CollectionSchema;
}

/**
 * Collection schema definition
 */
export interface CollectionSchema {
  name: string;
  fields: FieldSchema[];
  version: string;
}

/**
 * Field schema definition
 */
export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required?: boolean;
  indexed?: boolean;
  description?: string;
}

// ============================================================================
// Meal Pattern Collection
// ============================================================================

/**
 * Meal pattern document metadata
 */
export interface MealPatternMetadata {
  /** Unique meal pattern ID */
  patternId: string;

  /** Optional ID alias for backward compatibility */
  id?: string;

  /** Meal name/title */
  name: string;

  /** Total calories (for graph seeder) */
  totalCalories?: number;

  /** Total protein (for graph seeder) */
  totalProtein?: number;

  /** Meals count (for graph seeder) */
  mealsCount?: number;

  /** Full description of meal */
  description: string;

  /** Meal type */
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';

  /** Cuisines (e.g., Italian, Chinese) */
  cuisines: string[];

  /** Dietary restrictions met */
  dietary: string[];

  /** Main ingredients */
  ingredients: string[];

  /** Estimated preparation time (minutes) */
  prepTime: number;

  /** Estimated cooking time (minutes) */
  cookTime: number;

  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';

  /** Servings */
  servings: number;

  /** Cost estimate */
  cost: 'low' | 'medium' | 'high';

  /** Nutrition information */
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  /** Usage frequency */
  frequency?: number;

  /** Last prepared date */
  lastPrepared?: Date;

  /** User rating */
  rating?: number;
}

export type MealPatternDocument = VectorDocument<MealPatternMetadata>;

// ============================================================================
// Ingredient Collection
// ============================================================================

/**
 * Ingredient document metadata
 */
export interface IngredientMetadata {
  /** Ingredient ID */
  ingredientId: string;

  /** Optional ID alias for backward compatibility */
  id?: string;

  /** Ingredient name */
  name: string;

  /** Alternative names/synonyms */
  aliases: string[];

  /** Category */
  category: 'protein' | 'produce' | 'dairy' | 'grain' | 'spice' | 'other' | 'carb' | 'vegetable' | 'fruit';

  /** Nutrition data for graph seeder */
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  /** Tags for categorization */
  tags?: string[];

  /** Typical storage location */
  storageLocation: 'fridge' | 'freezer' | 'pantry' | 'counter';

  /** Typical shelf life (days) */
  shelfLife: number;

  /** Common substitutes */
  substitutes: string[];

  /** Flavor profile tags */
  flavorProfile: string[];

  /** Nutrition per 100g */
  nutritionPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };

  /** Typical cost category */
  costCategory: 'low' | 'medium' | 'high';

  /** Seasonal availability */
  seasonal?: string[];
}

export type IngredientDocument = VectorDocument<IngredientMetadata>;

// ============================================================================
// Recipe Step Collection
// ============================================================================

/**
 * Recipe step document metadata
 */
export interface RecipeStepMetadata {
  /** Step ID */
  stepId: string;

  /** Parent recipe/pattern ID */
  recipeId: string;

  /** Step order */
  order: number;

  /** Step instruction */
  instruction: string;

  /** Equipment required */
  equipment: string[];

  /** Ingredients used in this step */
  ingredients: string[];

  /** Duration (minutes) */
  duration: number;

  /** Can be done in parallel */
  canParallel: boolean;

  /** Requires active attention */
  requiresAttention: boolean;

  /** Temperature (if applicable) */
  temperature?: number;

  /** Techniques used */
  techniques: string[];
}

export type RecipeStepDocument = VectorDocument<RecipeStepMetadata>;

// ============================================================================
// Meal Log Collection
// ============================================================================

/**
 * Meal log document metadata
 */
export interface MealLogMetadata {
  /** Log entry ID */
  logId: string;

  /** Meal name */
  mealName: string;

  /** Timestamp of meal */
  timestamp: Date;

  /** Meal type */
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';

  /** Pattern ID (if from pattern) */
  patternId?: string;

  /** Ingredients used */
  ingredients: string[];

  /** Mood/context tags */
  tags: string[];

  /** Rating */
  rating?: number;

  /** Notes */
  notes?: string;

  /** Leftover amount */
  leftoverAmount?: number;

  /** User feedback */
  feedback?: 'enjoyed' | 'neutral' | 'disliked';
}

export type MealLogDocument = VectorDocument<MealLogMetadata>;

// ============================================================================
// Cooking Technique Collection
// ============================================================================

/**
 * Cooking technique document metadata
 */
export interface CookingTechniqueMetadata {
  /** Technique ID */
  techniqueId: string;

  /** Technique name */
  name: string;

  /** Description */
  description: string;

  /** Equipment required */
  equipment: string[];

  /** Skill level required */
  skillLevel: 'beginner' | 'intermediate' | 'advanced';

  /** Typical duration */
  typicalDuration: number;

  /** Temperature range */
  temperatureRange?: [number, number];

  /** Common uses */
  commonUses: string[];

  /** Related techniques */
  relatedTechniques: string[];
}

export type CookingTechniqueDocument = VectorDocument<CookingTechniqueMetadata>;

// ============================================================================
// Collection Names (Constants)
// ============================================================================

export const COLLECTION_NAMES = {
  MEAL_PATTERNS: 'meal_patterns',
  INGREDIENTS: 'ingredients',
  RECIPE_STEPS: 'recipe_steps',
  MEAL_LOGS: 'meal_logs',
  COOKING_TECHNIQUES: 'cooking_techniques'
} as const;

export type CollectionName = typeof COLLECTION_NAMES[keyof typeof COLLECTION_NAMES];
