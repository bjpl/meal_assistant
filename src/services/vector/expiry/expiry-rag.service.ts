/**
 * Expiry RAG Service
 * Connects expiry alerts to RAG-powered recipe recommendations
 */

import { RAGService } from '../rag/rag.service';
import { EmbeddingService } from '../core/embedding.service';
import { RuVectorService } from '../core/ruvector.service';
import {
  VectorError,
  VectorErrorType
} from '../types';
import { COLLECTION_NAMES } from '../types/collections.types';

/**
 * Expiring item info
 */
export interface ExpiringItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  daysUntilExpiry: number;
  expiryDate: Date;
}

/**
 * Recipe recommendation for expiring items
 */
export interface ExpiryRecipeRecommendation {
  /** Recipe/pattern ID */
  recipeId: string;
  /** Recipe name */
  name: string;
  /** Match score */
  score: number;
  /** Expiring items this recipe uses */
  usesExpiringItems: Array<{
    itemId: string;
    itemName: string;
    quantityNeeded: number;
    unit: string;
  }>;
  /** Additional ingredients needed */
  additionalIngredients: string[];
  /** Total time (prep + cook) */
  totalTime: number;
  /** Urgency level based on expiry dates */
  urgency: 'critical' | 'high' | 'medium' | 'low';
  /** Reasons this recipe was recommended */
  reasons: string[];
  /** Estimated portions */
  servings?: number;
}

/**
 * Expiry recommendation result
 */
export interface ExpiryRecommendationResult {
  /** Recommendations sorted by urgency and score */
  recommendations: ExpiryRecipeRecommendation[];
  /** Summary of expiring items used */
  summary: {
    totalExpiringItems: number;
    itemsWithRecipes: number;
    itemsWithoutRecipes: string[];
    potentialWastePrevented: number;
  };
  /** Freezer transfer suggestions */
  freezerSuggestions: Array<{
    itemId: string;
    itemName: string;
    freezerLife: string;
    instructions: string;
  }>;
}

/**
 * Expiry RAG Service
 */
export class ExpiryRAGService {
  constructor(
    private ragService: RAGService,
    private embeddingService: EmbeddingService,
    private vectorService: RuVectorService
  ) {}

  /**
   * Get recipe recommendations for expiring items
   * @param expiringItems List of items approaching expiry
   */
  public async getRecommendationsForExpiringItems(
    expiringItems: ExpiringItem[]
  ): Promise<ExpiryRecommendationResult> {
    if (expiringItems.length === 0) {
      return {
        recommendations: [],
        summary: {
          totalExpiringItems: 0,
          itemsWithRecipes: 0,
          itemsWithoutRecipes: [],
          potentialWastePrevented: 0
        },
        freezerSuggestions: []
      };
    }

    try {
      // Sort by urgency (days until expiry)
      const sortedItems = [...expiringItems].sort(
        (a, b) => a.daysUntilExpiry - b.daysUntilExpiry
      );

      // Generate recommendations
      const recommendations: ExpiryRecipeRecommendation[] = [];
      const usedItems = new Set<string>();

      // Group items by category for more effective searching
      const itemsByCategory = this.groupByCategory(sortedItems);

      // Search for recipes using each category group
      for (const [category, items] of Object.entries(itemsByCategory)) {
        const categoryRecs = await this.findRecipesForCategory(category, items);
        recommendations.push(...categoryRecs);

        categoryRecs.forEach(rec => {
          rec.usesExpiringItems.forEach(item => usedItems.add(item.itemId));
        });
      }

      // Find individual item recommendations for those not covered
      const uncoveredItems = sortedItems.filter(item => !usedItems.has(item.id));
      for (const item of uncoveredItems) {
        const itemRecs = await this.findRecipesForItem(item);
        if (itemRecs.length > 0) {
          recommendations.push(...itemRecs);
          usedItems.add(item.id);
        }
      }

      // Sort by urgency then score
      recommendations.sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.score - a.score;
      });

      // Deduplicate by recipe ID
      const uniqueRecs = this.deduplicateRecommendations(recommendations);

      // Get freezer suggestions
      const freezerSuggestions = this.generateFreezerSuggestions(sortedItems);

      // Build summary
      const itemsWithoutRecipes = sortedItems
        .filter(item => !usedItems.has(item.id))
        .map(item => item.name);

      return {
        recommendations: uniqueRecs.slice(0, 10), // Top 10 recommendations
        summary: {
          totalExpiringItems: expiringItems.length,
          itemsWithRecipes: usedItems.size,
          itemsWithoutRecipes,
          potentialWastePrevented: usedItems.size
        },
        freezerSuggestions
      };
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Expiry recommendation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Group items by category
   * @private
   */
  private groupByCategory(items: ExpiringItem[]): Record<string, ExpiringItem[]> {
    const groups: Record<string, ExpiringItem[]> = {};

    for (const item of items) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    }

    return groups;
  }

  /**
   * Find recipes for a category of items
   * @private
   */
  private async findRecipesForCategory(
    _category: string,
    items: ExpiringItem[]
  ): Promise<ExpiryRecipeRecommendation[]> {
    const ingredientNames = items.map(i => i.name);

    // Use RAG to find relevant recipes
    const ragResponse = await this.ragService.recommendMeals({
      context: {
        availableIngredients: ingredientNames,
        timeConstraint: 60 // Max 1 hour
      },
      topK: 5
    });

    // Convert to expiry recommendations
    return ragResponse.map(rec => ({
      recipeId: rec.patternId,
      name: rec.name,
      score: rec.score,
      usesExpiringItems: items
        .filter(item =>
          rec.ingredients.some(ing =>
            ing.name.toLowerCase().includes(item.name.toLowerCase())
          )
        )
        .map(item => ({
          itemId: item.id,
          itemName: item.name,
          quantityNeeded: 1, // Simplified
          unit: item.unit
        })),
      additionalIngredients: rec.ingredients
        .filter(ing => !ing.available)
        .map(ing => ing.name),
      totalTime: rec.totalTime,
      urgency: this.calculateUrgency(items),
      reasons: rec.reasons,
      servings: 4 // Default
    }));
  }

  /**
   * Find recipes for a single item
   * @private
   */
  private async findRecipesForItem(
    item: ExpiringItem
  ): Promise<ExpiryRecipeRecommendation[]> {
    const query = `quick recipe using ${item.name}`;

    const embedding = await this.embeddingService.embed(query, {
      normalize: true
    });

    const results = await this.vectorService.search(
      COLLECTION_NAMES.MEAL_PATTERNS,
      {
        vector: embedding,
        topK: 3,
        threshold: 0.4
      }
    );

    return results.map(result => {
      const doc = result.document as any;
      return {
        recipeId: result.id,
        name: doc.name || 'Unknown Recipe',
        score: result.score,
        usesExpiringItems: [{
          itemId: item.id,
          itemName: item.name,
          quantityNeeded: 1,
          unit: item.unit
        }],
        additionalIngredients: doc.ingredients?.filter(
          (ing: string) => !ing.toLowerCase().includes(item.name.toLowerCase())
        ) || [],
        totalTime: (doc.prepTime || 0) + (doc.cookTime || 0),
        urgency: this.getItemUrgency(item.daysUntilExpiry),
        reasons: [`Uses your ${item.name} before it expires`]
      };
    });
  }

  /**
   * Calculate urgency for a group of items
   * @private
   */
  private calculateUrgency(items: ExpiringItem[]): ExpiryRecipeRecommendation['urgency'] {
    const minDays = Math.min(...items.map(i => i.daysUntilExpiry));
    return this.getItemUrgency(minDays);
  }

  /**
   * Get urgency level for days until expiry
   * @private
   */
  private getItemUrgency(daysUntilExpiry: number): ExpiryRecipeRecommendation['urgency'] {
    if (daysUntilExpiry <= 0) return 'critical';
    if (daysUntilExpiry <= 1) return 'high';
    if (daysUntilExpiry <= 3) return 'medium';
    return 'low';
  }

  /**
   * Deduplicate recommendations by recipe ID
   * @private
   */
  private deduplicateRecommendations(
    recommendations: ExpiryRecipeRecommendation[]
  ): ExpiryRecipeRecommendation[] {
    const seen = new Map<string, ExpiryRecipeRecommendation>();

    for (const rec of recommendations) {
      const existing = seen.get(rec.recipeId);
      if (!existing || rec.score > existing.score) {
        // Merge expiring items if duplicate
        if (existing) {
          rec.usesExpiringItems = [
            ...rec.usesExpiringItems,
            ...existing.usesExpiringItems.filter(
              item => !rec.usesExpiringItems.some(r => r.itemId === item.itemId)
            )
          ];
        }
        seen.set(rec.recipeId, rec);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Generate freezer transfer suggestions
   * @private
   */
  private generateFreezerSuggestions(
    items: ExpiringItem[]
  ): ExpiryRecommendationResult['freezerSuggestions'] {
    const freezableCategories: Record<string, { freezerLife: string; instructions: string }> = {
      protein: {
        freezerLife: '3-6 months',
        instructions: 'Wrap tightly in freezer-safe packaging. Label with date.'
      },
      dairy: {
        freezerLife: '3-4 months (cheese), 1-2 months (milk)',
        instructions: 'Hard cheese can be frozen grated. Milk may separate - shake after thawing.'
      },
      bread: {
        freezerLife: '3 months',
        instructions: 'Slice before freezing for easy thawing. Double wrap to prevent freezer burn.'
      },
      fruit: {
        freezerLife: '8-12 months',
        instructions: 'Wash, dry, and spread on tray before bagging. Great for smoothies.'
      },
      vegetables: {
        freezerLife: '8-12 months',
        instructions: 'Blanch before freezing for best texture. Spread on tray first.'
      },
      prepared: {
        freezerLife: '2-3 months',
        instructions: 'Cool completely before freezing. Leave space for expansion.'
      }
    };

    return items
      .filter(item => freezableCategories[item.category])
      .filter(item => item.daysUntilExpiry <= 2) // Only suggest for urgent items
      .map(item => ({
        itemId: item.id,
        itemName: item.name,
        freezerLife: freezableCategories[item.category].freezerLife,
        instructions: freezableCategories[item.category].instructions
      }));
  }

  /**
   * Get quick use suggestions for an item
   * @param item Expiring item
   */
  public async getQuickUseSuggestions(item: ExpiringItem): Promise<string[]> {
    const quickSuggestions: Record<string, string[]> = {
      protein: [
        'Marinate and grill',
        'Slice thin for stir-fry',
        'Shred for tacos or salads',
        'Make a protein bowl'
      ],
      dairy: [
        'Make a smoothie',
        'Bake into a casserole',
        'Create a cheese sauce',
        'Add to scrambled eggs'
      ],
      vegetables: [
        'Roast with olive oil and seasonings',
        'Add to a stir-fry',
        'Blend into a soup',
        'Make a veggie frittata'
      ],
      fruit: [
        'Blend into a smoothie',
        'Bake into a crumble',
        'Make jam or compote',
        'Add to yogurt or oatmeal'
      ],
      bread: [
        'Make croutons',
        'Create breadcrumbs',
        'Make French toast',
        'Toast for bruschetta'
      ]
    };

    const categorySuggestions = quickSuggestions[item.category] || [
      'Use in a mixed dish',
      'Add to a soup or stew',
      'Incorporate into a salad'
    ];

    // Add item-specific context using RAG
    try {
      const ragResponse = await this.ragService.query(
        `Quick ways to use ${item.name} before it expires`,
        { topK: 3 }
      );

      const ragSuggestions = ragResponse.sources
        .slice(0, 2)
        .map(s => s.excerpt)
        .filter(Boolean);

      return [...categorySuggestions, ...ragSuggestions];
    } catch {
      return categorySuggestions;
    }
  }
}

// Export singleton (lazy initialization)
let _expiryRAGService: ExpiryRAGService | null = null;

export function getExpiryRAGService(): ExpiryRAGService {
  if (!_expiryRAGService) {
    const { ragService } = require('../rag/rag.service');
    const { embeddingService } = require('../core/embedding.service');
    const { ruVectorService } = require('../core/ruvector.service');
    _expiryRAGService = new ExpiryRAGService(ragService, embeddingService, ruVectorService);
  }
  return _expiryRAGService;
}

export const expiryRAGService = {
  get instance() {
    return getExpiryRAGService();
  }
};
