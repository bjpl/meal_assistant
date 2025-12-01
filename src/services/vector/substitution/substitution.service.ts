/**
 * Context-Aware Substitution Service
 * Provides intelligent ingredient substitutions based on dietary restrictions,
 * availability, nutritional profiles, and cooking context
 */

import { RuVectorService } from '../core/ruvector.service';
import { EmbeddingService } from '../core/embedding.service';
import { GraphService } from '../graph/graph.service';
import {
  VectorError,
  VectorErrorType
} from '../types';
import { COLLECTION_NAMES, IngredientMetadata } from '../types/collections.types';

/**
 * Dietary restriction type
 */
export type DietaryRestriction =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'low-sodium'
  | 'low-sugar'
  | 'keto'
  | 'paleo'
  | 'halal'
  | 'kosher';

/**
 * Cooking context for substitutions
 */
export interface CookingContext {
  /** Dish type (e.g., 'baking', 'sauce', 'marinade') */
  dishType?: string;
  /** Role of ingredient in dish */
  ingredientRole?: 'binding' | 'leavening' | 'fat' | 'sweetener' | 'protein' | 'flavor' | 'texture';
  /** Cooking method */
  cookingMethod?: 'baking' | 'frying' | 'grilling' | 'steaming' | 'raw' | 'braising';
  /** Importance level */
  importance?: 'critical' | 'important' | 'optional';
}

/**
 * Substitution request
 */
export interface SubstitutionRequest {
  /** Ingredient to substitute */
  ingredient: string;
  /** Quantity of original ingredient */
  quantity?: number;
  /** Unit of measurement */
  unit?: string;
  /** Dietary restrictions to consider */
  dietaryRestrictions?: DietaryRestriction[];
  /** Available ingredients for substitution */
  availableIngredients?: string[];
  /** Cooking context */
  context?: CookingContext;
  /** Maximum number of suggestions */
  maxSuggestions?: number;
}

/**
 * Substitution suggestion
 */
export interface SubstitutionSuggestion {
  /** Suggested substitute ingredient */
  substitute: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Quantity conversion ratio */
  ratio: number;
  /** Adjusted quantity */
  adjustedQuantity?: number;
  /** Adjusted unit */
  adjustedUnit?: string;
  /** Explanation of why this substitution works */
  reason: string;
  /** How well it matches the original's nutrition */
  nutritionalMatch: number;
  /** Any notes or caveats */
  notes?: string[];
  /** Tags describing the substitution */
  tags?: string[];
}

/**
 * Substitution result
 */
export interface SubstitutionResult {
  /** Original ingredient */
  original: string;
  /** List of suggestions */
  suggestions: SubstitutionSuggestion[];
  /** Whether any suggestion was found */
  found: boolean;
  /** Any warnings about the substitutions */
  warnings?: string[];
}

/**
 * Context-aware substitution rules
 */
const CONTEXT_SUBSTITUTION_RULES: Record<string, Record<string, { substitute: string; ratio: number; note: string }[]>> = {
  binding: {
    egg: [
      { substitute: 'flax egg (1 tbsp ground flax + 3 tbsp water)', ratio: 1, note: 'Works best in baked goods' },
      { substitute: 'chia egg (1 tbsp chia + 3 tbsp water)', ratio: 1, note: 'Slight texture difference' },
      { substitute: 'mashed banana', ratio: 0.25, note: 'Adds sweetness, best for sweet bakes' },
      { substitute: 'applesauce', ratio: 0.25, note: 'Adds moisture, works well in muffins' },
      { substitute: 'silken tofu', ratio: 0.25, note: 'Blended smooth, good for dense cakes' }
    ]
  },
  fat: {
    butter: [
      { substitute: 'coconut oil', ratio: 1, note: 'Solid at room temp, good for baking' },
      { substitute: 'olive oil', ratio: 0.75, note: 'Use in savory dishes' },
      { substitute: 'avocado', ratio: 0.5, note: 'Creamy texture, adds nutrition' },
      { substitute: 'Greek yogurt', ratio: 0.5, note: 'Adds protein, keeps moisture' }
    ],
    oil: [
      { substitute: 'applesauce', ratio: 0.5, note: 'For baking, reduces fat' },
      { substitute: 'mashed banana', ratio: 0.5, note: 'Adds natural sweetness' },
      { substitute: 'Greek yogurt', ratio: 0.5, note: 'Adds protein and moisture' }
    ]
  },
  sweetener: {
    sugar: [
      { substitute: 'honey', ratio: 0.75, note: 'Reduce other liquids slightly' },
      { substitute: 'maple syrup', ratio: 0.75, note: 'Adds flavor, reduce liquids' },
      { substitute: 'stevia', ratio: 0.1, note: 'Much sweeter, adjust to taste' },
      { substitute: 'mashed banana', ratio: 1, note: 'Natural sweetness plus binding' },
      { substitute: 'applesauce', ratio: 0.5, note: 'Adds moisture and mild sweetness' }
    ]
  },
  protein: {
    chicken: [
      { substitute: 'tofu', ratio: 1, note: 'Press well and marinate' },
      { substitute: 'tempeh', ratio: 1, note: 'Nutty flavor, firm texture' },
      { substitute: 'seitan', ratio: 1, note: 'Wheat-based, chewy texture' },
      { substitute: 'jackfruit', ratio: 1, note: 'Shredded texture, mild flavor' }
    ],
    beef: [
      { substitute: 'portobello mushroom', ratio: 1, note: 'Meaty texture' },
      { substitute: 'lentils', ratio: 0.75, note: 'Good for ground beef dishes' },
      { substitute: 'black beans', ratio: 1, note: 'Works in tacos, burgers' },
      { substitute: 'tempeh', ratio: 1, note: 'Crumble for ground beef substitute' }
    ]
  },
  leavening: {
    'baking powder': [
      { substitute: 'baking soda + cream of tartar', ratio: 1, note: 'Mix 1:2 ratio' },
      { substitute: 'self-rising flour', ratio: 1, note: 'Replace regular flour' }
    ],
    'baking soda': [
      { substitute: 'baking powder', ratio: 3, note: 'Triple the amount' }
    ]
  }
};

/**
 * Dietary restriction filters
 */
const DIETARY_FILTERS: Record<DietaryRestriction, string[]> = {
  vegetarian: ['meat', 'poultry', 'fish', 'seafood', 'gelatin'],
  vegan: ['meat', 'poultry', 'fish', 'seafood', 'dairy', 'egg', 'honey', 'gelatin'],
  'gluten-free': ['wheat', 'barley', 'rye', 'oats', 'flour', 'bread', 'pasta'],
  'dairy-free': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey'],
  'nut-free': ['almond', 'cashew', 'walnut', 'pecan', 'peanut', 'hazelnut', 'pistachio'],
  'low-sodium': ['salt', 'soy sauce', 'msg', 'bouillon'],
  'low-sugar': ['sugar', 'honey', 'syrup', 'molasses'],
  keto: ['sugar', 'bread', 'pasta', 'rice', 'potato', 'corn', 'beans'],
  paleo: ['grains', 'legumes', 'dairy', 'sugar', 'processed'],
  halal: ['pork', 'alcohol', 'gelatin'],
  kosher: ['pork', 'shellfish', 'mixing meat and dairy']
};

/**
 * Context-Aware Substitution Service
 */
export class SubstitutionService {
  constructor(
    private vectorService: RuVectorService,
    private embeddingService: EmbeddingService,
    private graphService: GraphService
  ) {}

  /**
   * Get substitution suggestions for an ingredient
   * @param request Substitution request
   */
  public async getSubstitutions(request: SubstitutionRequest): Promise<SubstitutionResult> {
    const { ingredient, maxSuggestions = 5 } = request;

    try {
      const suggestions: SubstitutionSuggestion[] = [];
      const warnings: string[] = [];

      // Step 1: Check context-based rules first
      if (request.context?.ingredientRole) {
        const contextSuggestions = this.getContextBasedSubstitutions(
          ingredient,
          request.context.ingredientRole
        );
        suggestions.push(...contextSuggestions);
      }

      // Step 2: Get vector-based semantic substitutions
      const semanticSuggestions = await this.getSemanticSubstitutions(
        ingredient,
        maxSuggestions * 2
      );
      suggestions.push(...semanticSuggestions);

      // Step 3: Get graph-based substitutions
      const graphSuggestions = await this.getGraphSubstitutions(ingredient);
      suggestions.push(...graphSuggestions);

      // Step 4: Filter by dietary restrictions
      const filteredSuggestions = this.filterByDietaryRestrictions(
        suggestions,
        request.dietaryRestrictions
      );

      // Step 5: Filter by availability if specified
      const availableSuggestions = request.availableIngredients
        ? this.filterByAvailability(filteredSuggestions, request.availableIngredients)
        : filteredSuggestions;

      // Step 6: Adjust quantities
      const adjustedSuggestions = availableSuggestions.map(s => ({
        ...s,
        adjustedQuantity: request.quantity ? request.quantity * s.ratio : undefined,
        adjustedUnit: request.unit
      }));

      // Step 7: Deduplicate and sort by confidence
      const uniqueSuggestions = this.deduplicateSuggestions(adjustedSuggestions);
      uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

      // Add warnings if needed
      if (availableSuggestions.length < suggestions.length) {
        warnings.push('Some substitutions filtered due to dietary restrictions or availability');
      }

      return {
        original: ingredient,
        suggestions: uniqueSuggestions.slice(0, maxSuggestions),
        found: uniqueSuggestions.length > 0,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Substitution search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get context-based substitutions from rules
   * @private
   */
  private getContextBasedSubstitutions(
    ingredient: string,
    role: CookingContext['ingredientRole']
  ): SubstitutionSuggestion[] {
    if (!role) return [];

    const normalizedIngredient = ingredient.toLowerCase();
    const roleRules = CONTEXT_SUBSTITUTION_RULES[role];

    if (!roleRules) return [];

    const suggestions: SubstitutionSuggestion[] = [];

    for (const [key, subs] of Object.entries(roleRules)) {
      if (normalizedIngredient.includes(key)) {
        for (const sub of subs) {
          suggestions.push({
            substitute: sub.substitute,
            confidence: 0.9, // High confidence for rule-based
            ratio: sub.ratio,
            reason: `Direct ${role} substitute`,
            nutritionalMatch: 0.7,
            notes: [sub.note],
            tags: ['rule-based', role]
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Get semantic substitutions using vector similarity
   * @private
   */
  private async getSemanticSubstitutions(
    ingredient: string,
    topK: number
  ): Promise<SubstitutionSuggestion[]> {
    try {
      // Create embedding for the ingredient
      const embedding = await this.embeddingService.embed(
        `substitute for ${ingredient} in cooking`,
        { normalize: true }
      );

      // Search for similar ingredients
      const results = await this.vectorService.search<IngredientMetadata>(
        COLLECTION_NAMES.INGREDIENTS,
        {
          vector: embedding,
          topK: topK + 1 // +1 to exclude the original
        }
      );

      // Filter out the original ingredient and map to suggestions
      return results
        .filter(r => !r.document.name.toLowerCase().includes(ingredient.toLowerCase()))
        .map(result => ({
          substitute: result.document.name,
          confidence: result.score * 0.8, // Scale down slightly
          ratio: 1, // Default to 1:1 ratio
          reason: `Similar ${result.document.category} ingredient`,
          nutritionalMatch: this.calculateNutritionalMatch(result.document),
          tags: ['semantic', result.document.category]
        }));
    } catch (error) {
      console.error('Semantic substitution search failed:', error);
      return [];
    }
  }

  /**
   * Get graph-based substitutions using knowledge graph
   * @private
   */
  private async getGraphSubstitutions(
    ingredient: string
  ): Promise<SubstitutionSuggestion[]> {
    try {
      // Use the GraphService's built-in substitution finder
      const graphSubs = await this.graphService.getSubstitutions(ingredient);

      if (!graphSubs || graphSubs.length === 0) {
        return [];
      }

      // Convert graph substitutions to SubstitutionSuggestion format
      return graphSubs.map(sub => ({
        substitute: sub.substitute,
        confidence: sub.confidence,
        ratio: sub.ratio,
        reason: `Knowledge graph relationship (${sub.impact} impact)`,
        nutritionalMatch: sub.confidence * 0.9, // Estimate based on confidence
        notes: sub.notes ? [sub.notes] : undefined,
        tags: ['graph-based', ...sub.context]
      }));
    } catch (error) {
      console.error('Graph substitution search failed:', error);
      return [];
    }
  }

  /**
   * Filter suggestions by dietary restrictions
   * @private
   */
  private filterByDietaryRestrictions(
    suggestions: SubstitutionSuggestion[],
    restrictions?: DietaryRestriction[]
  ): SubstitutionSuggestion[] {
    if (!restrictions || restrictions.length === 0) {
      return suggestions;
    }

    // Collect all forbidden ingredients
    const forbidden = new Set<string>();
    for (const restriction of restrictions) {
      const forbiddenItems = DIETARY_FILTERS[restriction] || [];
      forbiddenItems.forEach(item => forbidden.add(item.toLowerCase()));
    }

    // Filter out suggestions that contain forbidden items
    return suggestions.filter(suggestion => {
      const substituteLower = suggestion.substitute.toLowerCase();
      for (const forbiddenItem of forbidden) {
        if (substituteLower.includes(forbiddenItem)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Filter suggestions by available ingredients
   * @private
   */
  private filterByAvailability(
    suggestions: SubstitutionSuggestion[],
    available: string[]
  ): SubstitutionSuggestion[] {
    const availableLower = new Set(available.map(a => a.toLowerCase()));

    // Boost confidence for available ingredients, but don't exclude others
    return suggestions.map(suggestion => {
      const isAvailable = availableLower.has(suggestion.substitute.toLowerCase());
      return {
        ...suggestion,
        confidence: isAvailable ? suggestion.confidence * 1.2 : suggestion.confidence,
        tags: isAvailable
          ? [...(suggestion.tags || []), 'available']
          : suggestion.tags
      };
    });
  }

  /**
   * Calculate nutritional match score
   * @private
   */
  private calculateNutritionalMatch(ingredient: IngredientMetadata): number {
    // Simplified nutritional match - would use actual nutrition data in production
    if (ingredient.nutrition) {
      return 0.8;
    }
    return 0.5;
  }

  /**
   * Remove duplicate suggestions
   * @private
   */
  private deduplicateSuggestions(
    suggestions: SubstitutionSuggestion[]
  ): SubstitutionSuggestion[] {
    const seen = new Map<string, SubstitutionSuggestion>();

    for (const suggestion of suggestions) {
      const key = suggestion.substitute.toLowerCase();
      const existing = seen.get(key);

      if (!existing || suggestion.confidence > existing.confidence) {
        seen.set(key, suggestion);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Get batch substitutions for multiple ingredients
   * @param ingredients List of ingredients to substitute
   * @param options Common options for all substitutions
   */
  public async getBatchSubstitutions(
    ingredients: string[],
    options?: Omit<SubstitutionRequest, 'ingredient'>
  ): Promise<Map<string, SubstitutionResult>> {
    const results = new Map<string, SubstitutionResult>();

    // Process in parallel for efficiency
    const promises = ingredients.map(async ingredient => {
      const result = await this.getSubstitutions({
        ingredient,
        ...options
      });
      results.set(ingredient, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get quick substitution for common ingredients
   * @param ingredient Ingredient to substitute
   */
  public getQuickSubstitution(ingredient: string): SubstitutionSuggestion | null {
    const normalized = ingredient.toLowerCase();

    // Quick lookup table for common substitutions
    const quickSubs: Record<string, SubstitutionSuggestion> = {
      egg: {
        substitute: 'flax egg',
        confidence: 0.85,
        ratio: 1,
        reason: 'Common vegan substitute',
        nutritionalMatch: 0.6,
        notes: ['Mix 1 tbsp ground flax with 3 tbsp water, let sit 5 min']
      },
      butter: {
        substitute: 'coconut oil',
        confidence: 0.8,
        ratio: 1,
        reason: 'Dairy-free alternative',
        nutritionalMatch: 0.7
      },
      milk: {
        substitute: 'oat milk',
        confidence: 0.85,
        ratio: 1,
        reason: 'Creamy plant-based alternative',
        nutritionalMatch: 0.6
      },
      cream: {
        substitute: 'coconut cream',
        confidence: 0.75,
        ratio: 1,
        reason: 'Rich dairy-free option',
        nutritionalMatch: 0.5
      },
      sugar: {
        substitute: 'maple syrup',
        confidence: 0.7,
        ratio: 0.75,
        reason: 'Natural sweetener',
        nutritionalMatch: 0.6,
        notes: ['Reduce other liquids slightly']
      },
      flour: {
        substitute: 'almond flour',
        confidence: 0.65,
        ratio: 1,
        reason: 'Gluten-free alternative',
        nutritionalMatch: 0.5,
        notes: ['Results may vary, works best in cookies and cakes']
      }
    };

    return quickSubs[normalized] || null;
  }
}

// Export singleton (lazy initialization)
let _substitutionService: SubstitutionService | null = null;

export function getSubstitutionService(): SubstitutionService {
  if (!_substitutionService) {
    const { ruVectorService } = require('../core/ruvector.service');
    const { embeddingService } = require('../core/embedding.service');
    const { graphService } = require('../graph/graph.service');
    _substitutionService = new SubstitutionService(
      ruVectorService,
      embeddingService,
      graphService
    );
  }
  return _substitutionService;
}

export const substitutionService = {
  get instance() {
    return getSubstitutionService();
  }
};
