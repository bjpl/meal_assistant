/**
 * RAG (Retrieval-Augmented Generation) Service
 * Implements retrieval-augmented generation for meal recommendations
 */

import { RuVectorService } from '../core/ruvector.service';
import { EmbeddingService } from '../core/embedding.service';
import {
  RAGContext,
  RAGRequest,
  RAGResponse,
  RAGSource,
  RecommendationRequest,
  MealRecommendation,
  IngredientRecommendation
} from '../types/rag.types';
import {
  SearchResult,
  VectorError,
  VectorErrorType
} from '../types';
import { COLLECTION_NAMES } from '../types/collections.types';

/**
 * RAG Service
 */
export class RAGService {
  private maxContextLength: number = 4000;
  private defaultTopK: number = 5;

  constructor(
    private vectorService: RuVectorService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Query using RAG pipeline
   * @param question User question
   * @param context Optional context
   */
  public async query(
    question: string,
    context?: Partial<RAGRequest>
  ): Promise<RAGResponse> {
    try {
      // Step 1: Retrieve relevant documents
      const retrievedDocs = await this.retrieve(
        question,
        context?.collections || [COLLECTION_NAMES.MEAL_PATTERNS, COLLECTION_NAMES.INGREDIENTS],
        context?.topK || this.defaultTopK
      );

      // Step 2: Build context
      const ragContext = this.buildContext(question, retrievedDocs);

      // Step 3: Generate response (placeholder - would call LLM)
      const answer = this.generateAnswer(question, ragContext);

      // Step 4: Build sources
      const sources = this.buildSources(retrievedDocs);

      return {
        answer,
        sources,
        confidence: this.calculateConfidence(retrievedDocs),
        context: ragContext,
        metadata: {
          tokensUsed: 0, // Would be populated by actual LLM call
          generationTime: 0,
          model: 'placeholder'
        }
      };
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `RAG query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get meal recommendations based on inventory
   * @param request Recommendation request
   */
  public async recommendMeals(
    request: RecommendationRequest
  ): Promise<MealRecommendation[]> {
    try {
      const { context, topK = 5 } = request;

      // Build query from context
      const query = this.buildRecommendationQuery(context);

      // Retrieve relevant meals
      const embedding = await this.embeddingService.embed(query, {
        normalize: true
      });

      const results = await this.vectorService.search(
        COLLECTION_NAMES.MEAL_PATTERNS,
        {
          vector: embedding,
          topK: topK * 2 // Get more for filtering
        }
      );

      // Score and filter recommendations
      const recommendations = this.scoreRecommendations(results, context);

      return recommendations.slice(0, topK);
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Recommendation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get ingredient recommendations
   * @param request Recommendation request
   */
  public async recommendIngredients(
    request: RecommendationRequest
  ): Promise<IngredientRecommendation[]> {
    try {
      const { context, topK = 5 } = request;

      const query = `ingredients that pair with ${context.availableIngredients?.join(', ') || 'common ingredients'}`;

      const embedding = await this.embeddingService.embed(query, {
        normalize: true
      });

      const results = await this.vectorService.search(
        COLLECTION_NAMES.INGREDIENTS,
        {
          vector: embedding,
          topK: topK * 2
        }
      );

      // Filter out already available ingredients
      const available = new Set(context.availableIngredients?.map(i => i.toLowerCase()) || []);
      const filtered = results.filter(r => {
        const doc = r.document as any;
        return !available.has(doc.name.toLowerCase());
      });

      return filtered.slice(0, topK).map(result => {
        const doc = result.document as any;
        return {
          ingredient: doc.name,
          score: result.score,
          reason: `Pairs well with your available ingredients`,
          potentialUses: [`Can be used in ${doc.category} dishes`],
          pairsWithAvailable: context.availableIngredients || []
        };
      });
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Ingredient recommendation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve relevant documents
   * @private
   */
  private async retrieve(
    query: string,
    collections: string[],
    topK: number
  ): Promise<SearchResult[]> {
    const embedding = await this.embeddingService.embed(query, {
      normalize: true
    });

    const allResults: SearchResult[] = [];

    for (const collection of collections) {
      const results = await this.vectorService.search(collection, {
        vector: embedding,
        topK: Math.ceil(topK / collections.length),
        threshold: 0.3
      });
      allResults.push(...results);
    }

    // Sort by relevance and take top K
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK);
  }

  /**
   * Build context from retrieved documents
   * @private
   */
  private buildContext(
    query: string,
    documents: SearchResult[]
  ): RAGContext {
    const docTexts = documents.map(doc => {
      const meta = doc.document as any;
      return `${meta.name || meta.ingredient || 'Item'}: ${meta.description || JSON.stringify(meta)}`;
    });

    const contextText = docTexts.join('\n\n').slice(0, this.maxContextLength);

    return {
      documents,
      query,
      contextText,
      retrievalMetadata: {
        totalRetrieved: documents.length,
        avgRelevance: documents.reduce((sum, d) => sum + d.score, 0) / documents.length,
        retrievalTime: 0
      }
    };
  }

  /**
   * Generate answer (placeholder)
   * @private
   */
  private generateAnswer(question: string, context: RAGContext): string {
    // This is a placeholder. In production, this would call an LLM
    return `Based on ${context.documents.length} relevant documents, here's information about: ${question}. ${context.contextText.slice(0, 200)}...`;
  }

  /**
   * Build sources from documents
   * @private
   */
  private buildSources(documents: SearchResult[]): RAGSource[] {
    return documents.map(doc => {
      const meta = doc.document as any;
      return {
        id: doc.id,
        type: this.inferSourceType(meta),
        excerpt: this.extractExcerpt(meta),
        relevance: doc.score,
        metadata: meta
      };
    });
  }

  /**
   * Infer source type from metadata
   * @private
   */
  private inferSourceType(metadata: any): RAGSource['type'] {
    if (metadata.patternId) return 'meal_pattern';
    if (metadata.ingredientId) return 'ingredient';
    if (metadata.stepId) return 'recipe_step';
    if (metadata.logId) return 'meal_log';
    return 'technique';
  }

  /**
   * Extract excerpt from metadata
   * @private
   */
  private extractExcerpt(metadata: any): string {
    return metadata.description || metadata.instruction || metadata.name || 'No excerpt available';
  }

  /**
   * Calculate confidence score
   * @private
   */
  private calculateConfidence(documents: SearchResult[]): number {
    if (documents.length === 0) return 0;
    const avgScore = documents.reduce((sum, d) => sum + d.score, 0) / documents.length;
    return Math.min(avgScore, 0.95);
  }

  /**
   * Build recommendation query from context
   * @private
   */
  private buildRecommendationQuery(context: RecommendationRequest['context']): string {
    const parts: string[] = [];

    if (context.availableIngredients?.length) {
      parts.push(`meals with ${context.availableIngredients.join(', ')}`);
    }

    if (context.cuisines?.length) {
      parts.push(`${context.cuisines.join(' or ')} cuisine`);
    }

    if (context.dietaryRestrictions?.length) {
      parts.push(`${context.dietaryRestrictions.join(', ')} friendly`);
    }

    if (context.timeConstraint) {
      parts.push(`ready in ${context.timeConstraint} minutes`);
    }

    return parts.join(', ') || 'meal recommendations';
  }

  /**
   * Score recommendations based on context
   * @private
   */
  private scoreRecommendations(
    results: SearchResult[],
    context: RecommendationRequest['context']
  ): MealRecommendation[] {
    return results.map(result => {
      const meal = result.document as any;
      const reasons: string[] = [];
      let score = result.score;

      // Boost score based on available ingredients
      if (context.availableIngredients) {
        const matched = meal.ingredients?.filter((ing: string) =>
          context.availableIngredients?.some(avail =>
            ing.toLowerCase().includes(avail.toLowerCase())
          )
        ).length || 0;

        if (matched > 0) {
          score += matched * 0.05;
          reasons.push(`Uses ${matched} of your available ingredients`);
        }
      }

      // Check time constraints
      if (context.timeConstraint) {
        const totalTime = (meal.prepTime || 0) + (meal.cookTime || 0);
        if (totalTime <= context.timeConstraint) {
          reasons.push(`Can be ready in ${totalTime} minutes`);
        }
      }

      // Check dietary restrictions
      if (context.dietaryRestrictions) {
        const matches = context.dietaryRestrictions.filter(diet =>
          meal.dietary?.includes(diet)
        );
        if (matches.length > 0) {
          reasons.push(`Meets ${matches.join(', ')} requirements`);
        }
      }

      return {
        patternId: meal.patternId,
        name: meal.name,
        score: Math.min(score, 1),
        reasons,
        ingredients: meal.ingredients?.map((ing: string) => ({
          name: ing,
          available: context.availableIngredients?.includes(ing) || false,
          substitutable: false
        })) || [],
        totalTime: (meal.prepTime || 0) + (meal.cookTime || 0),
        difficulty: meal.difficulty || 'medium',
        nutrition: meal.nutrition
      };
    }).sort((a, b) => b.score - a.score);
  }
}

// Export singleton instance
export const ragService = new RAGService(
  require('../core/ruvector.service').ruVectorService,
  require('../core/embedding.service').embeddingService
);
