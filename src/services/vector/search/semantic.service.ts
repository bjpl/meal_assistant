/**
 * Semantic Search Service
 * Domain-specific semantic search for meals and ingredients
 */

import { RuVectorService } from '../core/ruvector.service';
import { EmbeddingService } from '../core/embedding.service';
import {
  SearchResult,
  VectorFilter,
  VectorError,
  VectorErrorType
} from '../types';
import {
  MealPatternMetadata,
  IngredientMetadata,
  COLLECTION_NAMES
} from '../types/collections.types';

/**
 * Meal search options
 */
export interface MealSearchOptions {
  limit?: number;
  threshold?: number;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cuisines?: string[];
  dietary?: string[];
  maxPrepTime?: number;
  maxCookTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  availableIngredients?: string[];
}

/**
 * Meal search result with enriched data
 */
export interface MealSearchResult extends SearchResult<MealPatternMetadata> {
  matchedIngredients?: string[];
  missingIngredients?: string[];
  substitutionSuggestions?: Array<{
    original: string;
    substitute: string;
    confidence: number;
  }>;
}

/**
 * Ingredient search result
 */
export interface IngredientSearchResult extends SearchResult<IngredientMetadata> {
  availableSubstitutes?: string[];
  seasonalAvailability?: string[];
}

/**
 * Semantic search service
 */
export class SemanticSearchService {
  constructor(
    private vectorService: RuVectorService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Search for meals by query
   * @param query Natural language search query
   * @param options Search options
   */
  public async searchMeals(
    query: string,
    options?: MealSearchOptions
  ): Promise<MealSearchResult[]> {
    try {
      // Generate embedding for query
      const embedding = await this.embeddingService.embed(query, {
        normalize: true
      });

      // Build filter from options
      const filter = this.buildMealFilter(options);

      // Search in meal patterns collection
      const results = await this.vectorService.search<MealPatternMetadata>(
        COLLECTION_NAMES.MEAL_PATTERNS,
        {
          vector: embedding,
          topK: options?.limit || 10,
          threshold: options?.threshold || 0.5,
          filter
        }
      );

      // Enrich results with additional context
      return this.enrichMealResults(results, options);
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Meal search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for ingredients
   * @param query Search query
   * @param options Search options
   */
  public async searchIngredients(
    query: string,
    options?: { limit?: number; threshold?: number; category?: string }
  ): Promise<IngredientSearchResult[]> {
    try {
      const embedding = await this.embeddingService.embed(query, {
        normalize: true
      });

      const filter: VectorFilter = {};
      if (options?.category) {
        filter.equals = { category: options.category };
      }

      const results = await this.vectorService.search<IngredientMetadata>(
        COLLECTION_NAMES.INGREDIENTS,
        {
          vector: embedding,
          topK: options?.limit || 10,
          threshold: options?.threshold || 0.5,
          filter
        }
      );

      return results.map(result => ({
        ...result,
        availableSubstitutes: result.document.substitutes,
        seasonalAvailability: result.document.seasonal
      }));
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Ingredient search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Find similar meals to a given meal
   * @param mealId Meal pattern ID
   * @param topK Number of similar meals to return
   */
  public async findSimilar(
    mealId: string,
    topK: number = 5
  ): Promise<MealSearchResult[]> {
    try {
      // Get the source meal
      const sourceMeal = await this.vectorService.get<MealPatternMetadata>(
        COLLECTION_NAMES.MEAL_PATTERNS,
        mealId
      );

      if (!sourceMeal) {
        throw new VectorError(
          VectorErrorType.SEARCH_FAILED,
          `Meal with ID '${mealId}' not found`
        );
      }

      // Search using its embedding
      const results = await this.vectorService.search<MealPatternMetadata>(
        COLLECTION_NAMES.MEAL_PATTERNS,
        {
          vector: sourceMeal.embedding,
          topK: topK + 1 // +1 to exclude the source meal
        }
      );

      // Filter out the source meal and enrich results
      const filtered = results.filter(r => r.id !== mealId);
      return this.enrichMealResults(filtered.slice(0, topK));
    } catch (error) {
      if (error instanceof VectorError) {
        throw error;
      }
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Failed to find similar meals: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search by available ingredients
   * @param ingredients List of available ingredients
   * @param options Search options
   */
  public async searchByIngredients(
    ingredients: string[],
    options?: Omit<MealSearchOptions, 'availableIngredients'>
  ): Promise<MealSearchResult[]> {
    // Create query from ingredients
    const query = `meal with ${ingredients.join(' and ')}`;

    return this.searchMeals(query, {
      ...options,
      availableIngredients: ingredients
    });
  }

  /**
   * Build filter for meal search
   * @private
   */
  private buildMealFilter(options?: MealSearchOptions): VectorFilter {
    const filter: VectorFilter = {};

    if (options?.mealType) {
      filter.equals = { mealType: options.mealType };
    }

    if (options?.cuisines && options.cuisines.length > 0) {
      filter.in = { cuisines: options.cuisines };
    }

    if (options?.difficulty) {
      filter.equals = { ...filter.equals, difficulty: options.difficulty };
    }

    if (options?.maxPrepTime || options?.maxCookTime) {
      filter.range = {};
      if (options.maxPrepTime) {
        filter.range.prepTime = { max: options.maxPrepTime };
      }
      if (options.maxCookTime) {
        filter.range.cookTime = { max: options.maxCookTime };
      }
    }

    return filter;
  }

  /**
   * Enrich meal results with additional context
   * @private
   */
  private enrichMealResults(
    results: SearchResult<MealPatternMetadata>[],
    options?: MealSearchOptions
  ): MealSearchResult[] {
    return results.map(result => {
      const enriched: MealSearchResult = { ...result };

      // Add ingredient matching if available ingredients provided
      if (options?.availableIngredients) {
        const mealIngredients = result.document.ingredients;
        const available = options.availableIngredients;

        enriched.matchedIngredients = mealIngredients.filter(ing =>
          available.some(avail =>
            ing.toLowerCase().includes(avail.toLowerCase()) ||
            avail.toLowerCase().includes(ing.toLowerCase())
          )
        );

        enriched.missingIngredients = mealIngredients.filter(ing =>
          !enriched.matchedIngredients?.includes(ing)
        );
      }

      return enriched;
    });
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService(
  require('../core/ruvector.service').ruVectorService,
  require('../core/embedding.service').embeddingService
);
