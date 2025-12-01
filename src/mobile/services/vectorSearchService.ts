/**
 * Vector Search Service for Mobile
 * Provides semantic search and NL meal logging for the mobile app
 */

import { apiClient } from './apiService';

/**
 * Natural language meal logging request
 */
export interface NLMealLogRequest {
  /** Natural language description of the meal */
  description: string;
  /** Optional meal type override */
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  /** Optional timestamp */
  timestamp?: Date;
  /** Optional photo URI */
  photoUri?: string;
}

/**
 * NL meal logging response
 */
export interface NLMealLogResponse {
  /** Parsed meal log */
  mealLog: {
    id: string;
    description: string;
    foods: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      confidence: number;
    }>;
    mealType: string;
    timestamp: Date;
    totalNutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggestions for similar meals */
  suggestions?: string[];
}

/**
 * Meal search request
 */
export interface MealSearchRequest {
  /** Search query */
  query: string;
  /** Maximum results */
  limit?: number;
  /** Similarity threshold */
  threshold?: number;
  /** Filter by meal type */
  mealType?: string;
  /** Filter by available ingredients */
  availableIngredients?: string[];
}

/**
 * Meal search result
 */
export interface MealSearchResult {
  id: string;
  name: string;
  description: string;
  score: number;
  mealType: string;
  ingredients: string[];
  prepTime?: number;
  cookTime?: number;
  matchedIngredients?: string[];
  missingIngredients?: string[];
}

/**
 * Ingredient search result
 */
export interface IngredientSearchResult {
  id: string;
  name: string;
  category: string;
  score: number;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  substitutes?: string[];
}

/**
 * Recipe recommendation
 */
export interface RecipeRecommendation {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  ingredients: Array<{
    name: string;
    available: boolean;
    substitutable: boolean;
  }>;
  totalTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Vector Search API endpoints
 */
const VECTOR_API = {
  NL_LOG: '/api/vector/nl-log',
  SEARCH_MEALS: '/api/vector/search/meals',
  SEARCH_INGREDIENTS: '/api/vector/search/ingredients',
  RECOMMENDATIONS: '/api/vector/recommendations',
  SIMILAR_MEALS: '/api/vector/similar',
  SUBSTITUTIONS: '/api/vector/substitutions'
};

/**
 * Vector Search Service
 */
export const vectorSearchService = {
  /**
   * Log a meal using natural language
   * @param request NL meal log request
   */
  async logMealNL(request: NLMealLogRequest): Promise<NLMealLogResponse> {
    try {
      const response = await apiClient.post<NLMealLogResponse>(
        VECTOR_API.NL_LOG,
        {
          description: request.description,
          mealType: request.mealType,
          timestamp: request.timestamp?.toISOString(),
          photoUri: request.photoUri
        }
      );

      if (response.error) {
        throw new Error(response.message || 'Failed to log meal');
      }

      return response.data as NLMealLogResponse;
    } catch (error) {
      console.error('[VectorSearch] NL meal logging failed:', error);
      throw error;
    }
  },

  /**
   * Parse natural language meal description (local fallback)
   * @param description Meal description
   */
  parseNLMealLocal(description: string): Partial<NLMealLogResponse['mealLog']> {
    // Simple local parsing for offline mode
    const lowerDesc = description.toLowerCase();

    // Detect meal type
    let mealType = 'snack';
    if (lowerDesc.includes('breakfast') || /\b(morning|cereal|toast|eggs?|bacon)\b/.test(lowerDesc)) {
      mealType = 'breakfast';
    } else if (lowerDesc.includes('lunch') || /\b(sandwich|salad|soup)\b/.test(lowerDesc)) {
      mealType = 'lunch';
    } else if (lowerDesc.includes('dinner') || /\b(dinner|evening|steak|chicken|pasta)\b/.test(lowerDesc)) {
      mealType = 'dinner';
    }

    // Extract potential food items (simple tokenization)
    const commonFoods = [
      'eggs', 'toast', 'bacon', 'cereal', 'milk', 'coffee', 'orange juice',
      'sandwich', 'salad', 'soup', 'burger', 'fries', 'pizza',
      'chicken', 'steak', 'fish', 'pasta', 'rice', 'vegetables', 'bread',
      'apple', 'banana', 'yogurt', 'cheese', 'nuts'
    ];

    const detectedFoods = commonFoods.filter(food => lowerDesc.includes(food));

    return {
      description,
      mealType,
      foods: detectedFoods.map(name => ({
        name,
        confidence: 0.7
      })),
      timestamp: new Date()
    };
  },

  /**
   * Search for meals semantically
   * @param request Search request
   */
  async searchMeals(request: MealSearchRequest): Promise<MealSearchResult[]> {
    try {
      const response = await apiClient.get<MealSearchResult[]>(
        VECTOR_API.SEARCH_MEALS,
        {
          params: {
            q: request.query,
            limit: request.limit || 10,
            threshold: request.threshold || 0.5,
            mealType: request.mealType,
            ingredients: request.availableIngredients?.join(',')
          }
        }
      );

      if (response.error) {
        throw new Error(response.message || 'Search failed');
      }

      return response.data as MealSearchResult[];
    } catch (error) {
      console.error('[VectorSearch] Meal search failed:', error);
      return [];
    }
  },

  /**
   * Search for ingredients
   * @param query Search query
   * @param options Search options
   */
  async searchIngredients(
    query: string,
    options?: { limit?: number; category?: string }
  ): Promise<IngredientSearchResult[]> {
    try {
      const response = await apiClient.get<IngredientSearchResult[]>(
        VECTOR_API.SEARCH_INGREDIENTS,
        {
          params: {
            q: query,
            limit: options?.limit || 10,
            category: options?.category
          }
        }
      );

      if (response.error) {
        throw new Error(response.message || 'Search failed');
      }

      return response.data as IngredientSearchResult[];
    } catch (error) {
      console.error('[VectorSearch] Ingredient search failed:', error);
      return [];
    }
  },

  /**
   * Get recipe recommendations based on context
   * @param context Recommendation context
   */
  async getRecommendations(context: {
    availableIngredients?: string[];
    dietaryRestrictions?: string[];
    timeConstraint?: number;
    cuisines?: string[];
  }): Promise<RecipeRecommendation[]> {
    try {
      const response = await apiClient.post<RecipeRecommendation[]>(
        VECTOR_API.RECOMMENDATIONS,
        context
      );

      if (response.error) {
        throw new Error(response.message || 'Recommendations failed');
      }

      return response.data as RecipeRecommendation[];
    } catch (error) {
      console.error('[VectorSearch] Recommendations failed:', error);
      return [];
    }
  },

  /**
   * Find similar meals to a given meal
   * @param mealId Meal ID
   * @param limit Number of results
   */
  async findSimilarMeals(mealId: string, limit: number = 5): Promise<MealSearchResult[]> {
    try {
      const response = await apiClient.get<MealSearchResult[]>(
        `${VECTOR_API.SIMILAR_MEALS}/${mealId}`,
        { params: { limit } }
      );

      if (response.error) {
        throw new Error(response.message || 'Similar meal search failed');
      }

      return response.data as MealSearchResult[];
    } catch (error) {
      console.error('[VectorSearch] Similar meal search failed:', error);
      return [];
    }
  },

  /**
   * Get ingredient substitutions
   * @param ingredient Ingredient to substitute
   * @param options Substitution options
   */
  async getSubstitutions(
    ingredient: string,
    options?: {
      dietaryRestrictions?: string[];
      availableIngredients?: string[];
      context?: string;
    }
  ): Promise<Array<{
    substitute: string;
    confidence: number;
    ratio: number;
    reason: string;
    notes?: string[];
  }>> {
    try {
      const response = await apiClient.post(
        VECTOR_API.SUBSTITUTIONS,
        {
          ingredient,
          ...options
        }
      );

      if (response.error) {
        throw new Error(response.message || 'Substitution lookup failed');
      }

      return response.data as any[];
    } catch (error) {
      console.error('[VectorSearch] Substitution lookup failed:', error);
      return [];
    }
  }
};

export default vectorSearchService;
