/**
 * Feedback Learning Service
 * Collects user feedback and uses it to improve recommendations
 */

import { RuVectorService } from '../core/ruvector.service';
import { EmbeddingService } from '../core/embedding.service';
import {
  FeedbackEntry,
  FeedbackType,
  FeedbackStats,
  LearningEvent,
  UserPreferences,
  PreferenceWeight
} from '../types/learning.types';
import { VectorError, VectorErrorType } from '../types';

/**
 * Feedback collection configuration
 */
export interface FeedbackConfig {
  /** Enable automatic learning from feedback */
  autoLearnEnabled: boolean;
  /** Minimum feedback count before learning */
  minFeedbackCount: number;
  /** Learning batch size */
  batchSize: number;
  /** Decay factor for old feedback */
  decayFactor: number;
  /** Retention period in days */
  retentionDays: number;
}

/**
 * Default feedback configuration
 */
const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  autoLearnEnabled: true,
  minFeedbackCount: 10,
  batchSize: 32,
  decayFactor: 0.95,
  retentionDays: 90
};

/**
 * Feedback collection name
 */
const FEEDBACK_COLLECTION = 'user_feedback';
const PREFERENCES_COLLECTION = 'user_preferences';

/**
 * Feedback Learning Service
 */
export class FeedbackService {
  private config: FeedbackConfig;
  private feedbackBuffer: FeedbackEntry[] = [];
  private learningEvents: LearningEvent[] = [];

  constructor(
    private vectorService: RuVectorService,
    private embeddingService: EmbeddingService,
    config?: Partial<FeedbackConfig>
  ) {
    this.config = { ...DEFAULT_FEEDBACK_CONFIG, ...config };
  }

  /**
   * Initialize feedback collections
   */
  public async initialize(): Promise<void> {
    try {
      await this.vectorService.createCollection(FEEDBACK_COLLECTION, 384);
      await this.vectorService.createCollection(PREFERENCES_COLLECTION, 384);
      console.log('[Feedback] Initialized feedback collections');
    } catch (error) {
      console.warn('[Feedback] Collections may already exist:', error);
    }
  }

  /**
   * Record user feedback
   * @param feedback Feedback entry
   */
  public async recordFeedback(feedback: Omit<FeedbackEntry, 'id' | 'timestamp'>): Promise<string> {
    const entry: FeedbackEntry = {
      ...feedback,
      id: this.generateId(),
      timestamp: new Date()
    };

    // Add to buffer
    this.feedbackBuffer.push(entry);

    // Store in vector database for learning
    try {
      const embedding = await this.embeddingService.embed(
        this.feedbackToText(entry),
        { normalize: true }
      );

      await this.vectorService.upsert(FEEDBACK_COLLECTION, {
        id: entry.id,
        embedding,
        metadata: entry,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Check if we should trigger learning
      if (this.config.autoLearnEnabled && this.feedbackBuffer.length >= this.config.minFeedbackCount) {
        await this.processLearningBatch();
      }

      return entry.id;
    } catch (error) {
      throw new VectorError(
        VectorErrorType.UPSERT_FAILED,
        `Failed to record feedback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Record positive feedback (liked/used)
   */
  public async recordPositive(
    userId: string,
    itemType: FeedbackType,
    itemId: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    return this.recordFeedback({
      userId,
      type: itemType,
      itemId,
      rating: 5,
      context
    });
  }

  /**
   * Record negative feedback (disliked/skipped)
   */
  public async recordNegative(
    userId: string,
    itemType: FeedbackType,
    itemId: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    return this.recordFeedback({
      userId,
      type: itemType,
      itemId,
      rating: 1,
      context
    });
  }

  /**
   * Record explicit rating
   */
  public async recordRating(
    userId: string,
    itemType: FeedbackType,
    itemId: string,
    rating: number,
    comment?: string
  ): Promise<string> {
    return this.recordFeedback({
      userId,
      type: itemType,
      itemId,
      rating: Math.max(1, Math.min(5, rating)),
      comment
    });
  }

  /**
   * Get user preferences based on feedback history
   * @param userId User ID
   */
  public async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      // Retrieve stored preferences
      const stored = await this.vectorService.get<UserPreferences>(
        PREFERENCES_COLLECTION,
        `prefs_${userId}`
      );

      if (stored) {
        return stored.metadata as UserPreferences;
      }

      // Calculate from feedback if no stored preferences
      return this.calculatePreferences(userId);
    } catch (error) {
      console.error('[Feedback] Failed to get preferences:', error);
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Calculate preferences from feedback history
   * @private
   */
  private async calculatePreferences(userId: string): Promise<UserPreferences> {
    const userFeedback = this.feedbackBuffer.filter(f => f.userId === userId);

    // Initialize weights
    const ingredientWeights: Record<string, PreferenceWeight> = {};
    const cuisineWeights: Record<string, PreferenceWeight> = {};
    const mealTypeWeights: Record<string, PreferenceWeight> = {};

    // Process feedback
    for (const feedback of userFeedback) {
      const weight = (feedback.rating - 3) / 2; // Normalize to -1 to 1
      const context = feedback.context as Record<string, any> || {};

      // Update ingredient preferences
      if (context.ingredients) {
        for (const ing of context.ingredients as string[]) {
          if (!ingredientWeights[ing]) {
            ingredientWeights[ing] = { positive: 0, negative: 0, total: 0 };
          }
          ingredientWeights[ing].total++;
          if (weight > 0) ingredientWeights[ing].positive += weight;
          else ingredientWeights[ing].negative += Math.abs(weight);
        }
      }

      // Update cuisine preferences
      if (context.cuisine) {
        const cuisine = context.cuisine as string;
        if (!cuisineWeights[cuisine]) {
          cuisineWeights[cuisine] = { positive: 0, negative: 0, total: 0 };
        }
        cuisineWeights[cuisine].total++;
        if (weight > 0) cuisineWeights[cuisine].positive += weight;
        else cuisineWeights[cuisine].negative += Math.abs(weight);
      }

      // Update meal type preferences
      if (context.mealType) {
        const mealType = context.mealType as string;
        if (!mealTypeWeights[mealType]) {
          mealTypeWeights[mealType] = { positive: 0, negative: 0, total: 0 };
        }
        mealTypeWeights[mealType].total++;
        if (weight > 0) mealTypeWeights[mealType].positive += weight;
        else mealTypeWeights[mealType].negative += Math.abs(weight);
      }
    }

    return {
      userId,
      ingredients: ingredientWeights,
      cuisines: cuisineWeights,
      mealTypes: mealTypeWeights,
      dietaryRestrictions: [],
      updatedAt: new Date()
    };
  }

  /**
   * Get default preferences
   * @private
   */
  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      ingredients: {},
      cuisines: {},
      mealTypes: {},
      dietaryRestrictions: [],
      updatedAt: new Date()
    };
  }

  /**
   * Update user preferences
   * @param userId User ID
   * @param updates Preference updates
   */
  public async updatePreferences(
    userId: string,
    updates: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>
  ): Promise<void> {
    try {
      const current = await this.getUserPreferences(userId);
      const updated: UserPreferences = {
        ...current,
        ...updates,
        updatedAt: new Date()
      };

      // Create embedding for preferences
      const embedding = await this.embeddingService.embed(
        this.preferencesToText(updated),
        { normalize: true }
      );

      await this.vectorService.upsert(PREFERENCES_COLLECTION, {
        id: `prefs_${userId}`,
        embedding,
        metadata: updated,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      throw new VectorError(
        VectorErrorType.UPSERT_FAILED,
        `Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get feedback statistics
   * @param userId Optional user ID filter
   */
  public getFeedbackStats(userId?: string): FeedbackStats {
    const filtered = userId
      ? this.feedbackBuffer.filter(f => f.userId === userId)
      : this.feedbackBuffer;

    if (filtered.length === 0) {
      return {
        totalCount: 0,
        positiveCount: 0,
        negativeCount: 0,
        averageRating: 0,
        byType: {}
      };
    }

    const byType: Record<string, number> = {};
    let positiveCount = 0;
    let negativeCount = 0;
    let totalRating = 0;

    for (const feedback of filtered) {
      byType[feedback.type] = (byType[feedback.type] || 0) + 1;
      if (feedback.rating >= 4) positiveCount++;
      else if (feedback.rating <= 2) negativeCount++;
      totalRating += feedback.rating;
    }

    return {
      totalCount: filtered.length,
      positiveCount,
      negativeCount,
      averageRating: totalRating / filtered.length,
      byType
    };
  }

  /**
   * Process learning batch
   * @private
   */
  private async processLearningBatch(): Promise<void> {
    if (this.feedbackBuffer.length < this.config.batchSize) {
      return;
    }

    const batch = this.feedbackBuffer.splice(0, this.config.batchSize);
    const event: LearningEvent = {
      id: this.generateId(),
      type: 'batch_processed',
      timestamp: new Date(),
      feedbackCount: batch.length,
      metrics: {
        avgRating: batch.reduce((sum, f) => sum + f.rating, 0) / batch.length
      }
    };

    this.learningEvents.push(event);
    console.log(`[Feedback] Processed learning batch of ${batch.length} items`);
  }

  /**
   * Get recent learning events
   * @param limit Maximum number of events
   */
  public getLearningEvents(limit: number = 10): LearningEvent[] {
    return this.learningEvents.slice(-limit);
  }

  /**
   * Apply preference boost to search results
   * @param results Search results
   * @param userId User ID
   */
  public async applyPreferenceBoost<T>(
    results: Array<{ id: string; score: number; document: T }>,
    userId: string
  ): Promise<Array<{ id: string; score: number; document: T; boosted: boolean }>> {
    const prefs = await this.getUserPreferences(userId);

    return results.map(result => {
      let boost = 0;
      const doc = result.document as any;

      // Apply ingredient preference boost
      if (doc.ingredients && prefs.ingredients) {
        for (const ing of doc.ingredients) {
          const weight = prefs.ingredients[ing];
          if (weight) {
            boost += (weight.positive - weight.negative) * 0.1;
          }
        }
      }

      // Apply cuisine preference boost
      if (doc.cuisine && prefs.cuisines) {
        const weight = prefs.cuisines[doc.cuisine];
        if (weight) {
          boost += (weight.positive - weight.negative) * 0.15;
        }
      }

      // Apply meal type preference boost
      if (doc.mealType && prefs.mealTypes) {
        const weight = prefs.mealTypes[doc.mealType];
        if (weight) {
          boost += (weight.positive - weight.negative) * 0.1;
        }
      }

      return {
        ...result,
        score: Math.min(1, result.score + boost),
        boosted: boost !== 0
      };
    });
  }

  /**
   * Convert feedback to text for embedding
   * @private
   */
  private feedbackToText(feedback: FeedbackEntry): string {
    const parts = [
      `${feedback.type} feedback`,
      `rating: ${feedback.rating}`,
      feedback.comment || ''
    ];

    if (feedback.context) {
      parts.push(JSON.stringify(feedback.context));
    }

    return parts.join(' ');
  }

  /**
   * Convert preferences to text for embedding
   * @private
   */
  private preferencesToText(prefs: UserPreferences): string {
    const parts: string[] = [];

    // Add liked ingredients
    const likedIngs = Object.entries(prefs.ingredients)
      .filter(([_, w]) => w.positive > w.negative)
      .map(([ing]) => ing);
    if (likedIngs.length > 0) {
      parts.push(`likes ${likedIngs.join(', ')}`);
    }

    // Add liked cuisines
    const likedCuisines = Object.entries(prefs.cuisines)
      .filter(([_, w]) => w.positive > w.negative)
      .map(([cuisine]) => cuisine);
    if (likedCuisines.length > 0) {
      parts.push(`prefers ${likedCuisines.join(', ')} cuisine`);
    }

    // Add dietary restrictions
    if (prefs.dietaryRestrictions.length > 0) {
      parts.push(`dietary: ${prefs.dietaryRestrictions.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Generate unique ID
   * @private
   */
  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old feedback (retention management)
   */
  public async cleanupOldFeedback(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);

    const beforeCount = this.feedbackBuffer.length;
    this.feedbackBuffer = this.feedbackBuffer.filter(f => f.timestamp >= cutoff);

    const removed = beforeCount - this.feedbackBuffer.length;
    console.log(`[Feedback] Cleaned up ${removed} old feedback entries`);

    return removed;
  }
}

// Export singleton (lazy initialization)
let _feedbackService: FeedbackService | null = null;

export function getFeedbackService(): FeedbackService {
  if (!_feedbackService) {
    const { ruVectorService } = require('../core/ruvector.service');
    const { embeddingService } = require('../core/embedding.service');
    _feedbackService = new FeedbackService(ruVectorService, embeddingService);
  }
  return _feedbackService;
}

export const feedbackService = {
  get instance() {
    return getFeedbackService();
  }
};
