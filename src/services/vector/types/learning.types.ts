/**
 * ML Learning Types
 * Type definitions for continuous learning and personalization
 */

/**
 * Feedback type categories
 */
export type FeedbackType =
  | 'meal_rating'
  | 'recipe_rating'
  | 'ingredient_rating'
  | 'recommendation_click'
  | 'recommendation_skip'
  | 'substitution_used'
  | 'substitution_rejected'
  | 'search_click'
  | 'meal_prepared';

/**
 * Feedback entry for learning
 */
export interface FeedbackEntry {
  /** Entry ID */
  id: string;
  /** User ID */
  userId: string;
  /** Feedback type */
  type: FeedbackType;
  /** Target item ID */
  itemId: string;
  /** Rating (1-5) */
  rating: number;
  /** Context when feedback was given */
  context?: Record<string, unknown>;
  /** Optional comment */
  comment?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Feedback statistics
 */
export interface FeedbackStats {
  /** Total feedback count */
  totalCount: number;
  /** Positive feedback count (rating >= 4) */
  positiveCount: number;
  /** Negative feedback count (rating <= 2) */
  negativeCount: number;
  /** Average rating */
  averageRating: number;
  /** Count by type */
  byType: Record<string, number>;
}

/**
 * Learning event record
 */
export interface LearningEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: 'batch_processed' | 'model_updated' | 'preferences_calculated';
  /** Timestamp */
  timestamp: Date;
  /** Number of feedback items processed */
  feedbackCount: number;
  /** Metrics from the learning event */
  metrics?: Record<string, number>;
}

/**
 * User preferences for recommendations
 */
export interface UserPreferences {
  /** User ID */
  userId: string;
  /** Ingredient weights */
  ingredients: Record<string, PreferenceWeight>;
  /** Cuisine weights */
  cuisines: Record<string, PreferenceWeight>;
  /** Meal type weights */
  mealTypes: Record<string, PreferenceWeight>;
  /** Dietary restrictions */
  dietaryRestrictions: string[];
  /** Last updated */
  updatedAt: Date;
}

/**
 * Preference weight for an item
 */
export interface PreferenceWeight {
  /** Positive interaction count */
  positive: number;
  /** Negative interaction count */
  negative: number;
  /** Total interaction count */
  total: number;
}

/**
 * Learning metrics summary
 */
export interface LearningMetrics {
  /** Total feedback processed */
  totalFeedback: number;
  /** Model accuracy */
  accuracy?: number;
  /** Average satisfaction score */
  avgSatisfaction: number;
  /** Learning rate */
  learningRate: number;
  /** Last training time */
  lastTrainingTime: Date;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  /** Enable training */
  enabled: boolean;
  /** Batch size */
  batchSize: number;
  /** Learning rate */
  learningRate: number;
  /** Update frequency in minutes */
  updateFrequency: number;
  /** Minimum feedback before training */
  minFeedbackCount: number;
}

/**
 * Training result
 */
export interface TrainingResult {
  /** Success status */
  success: boolean;
  /** Samples processed */
  samplesProcessed: number;
  /** Training duration in ms */
  duration: number;
  /** Resulting metrics */
  metrics?: LearningMetrics;
  /** Error message if failed */
  error?: string;
}

/**
 * User feedback event
 */
export interface FeedbackEvent {
  /** Event ID */
  id: string;

  /** Event type */
  type: FeedbackEventType;

  /** User ID */
  userId: string;

  /** Target entity (meal, ingredient, recommendation) */
  targetId: string;

  /** Target type */
  targetType: 'meal' | 'ingredient' | 'recommendation' | 'substitution';

  /** Feedback value */
  value: FeedbackValue;

  /** Context when feedback was given */
  context?: Record<string, unknown>;

  /** Timestamp */
  timestamp: Date;

  /** Additional notes */
  notes?: string;
}

/**
 * Feedback event types
 */
export type FeedbackEventType =
  | 'rating'
  | 'click'
  | 'view'
  | 'prepare'
  | 'skip'
  | 'like'
  | 'dislike'
  | 'save'
  | 'share';

/**
 * Feedback value
 */
export interface FeedbackValue {
  /** Explicit rating (1-5 stars) */
  rating?: number;

  /** Implicit signal strength (0-1) */
  implicitScore?: number;

  /** Binary preference */
  preference?: 'positive' | 'negative' | 'neutral';

  /** Engagement time (seconds) */
  engagementTime?: number;
}

/**
 * User preference profile
 */
export interface UserPreferenceProfile {
  /** User ID */
  userId: string;

  /** Ingredient preferences */
  ingredients: {
    liked: string[];
    disliked: string[];
    neutral: string[];
  };

  /** Cuisine preferences */
  cuisines: {
    preferred: string[];
    avoided: string[];
  };

  /** Meal type preferences */
  mealTypes: Record<string, number>; // Type -> preference score

  /** Dietary restrictions */
  dietary: string[];

  /** Skill level */
  skillLevel: 'beginner' | 'intermediate' | 'advanced';

  /** Time constraints */
  typicalPrepTime: number;

  /** Cost sensitivity */
  costSensitivity: 'low' | 'medium' | 'high';

  /** Novelty vs. familiarity preference */
  noveltyPreference: number; // 0 (familiar) to 1 (novel)

  /** Learned patterns */
  patterns: {
    frequentMeals: Array<{ mealId: string; frequency: number }>;
    ingredientCombinations: Array<{ ingredients: string[]; frequency: number }>;
    timePreferences: Array<{ mealType: string; typicalTime: string }>;
  };

  /** Last updated */
  updatedAt: Date;
}

/**
 * Training batch for model updates
 */
export interface TrainingBatch {
  /** Batch ID */
  id: string;

  /** Training examples */
  examples: TrainingExample[];

  /** Batch size */
  size: number;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Single training example
 */
export interface TrainingExample {
  /** Input features */
  input: Record<string, unknown>;

  /** Expected output */
  target: Record<string, unknown>;

  /** Example weight */
  weight: number;

  /** Source of example */
  source: 'explicit_feedback' | 'implicit_signal' | 'synthetic';
}

/**
 * Model performance metrics
 */
export interface ModelMetrics {
  /** Model version */
  version: string;

  /** Accuracy metrics */
  accuracy: number;

  /** Precision */
  precision: number;

  /** Recall */
  recall: number;

  /** F1 score */
  f1Score: number;

  /** Mean average precision */
  map: number;

  /** Normalized discounted cumulative gain */
  ndcg: number;

  /** Custom metrics */
  custom?: Record<string, number>;

  /** Evaluation timestamp */
  evaluatedAt: Date;
}

/**
 * A/B test configuration
 */
export interface ABTestConfig {
  /** Test ID */
  id: string;

  /** Test name */
  name: string;

  /** Variants */
  variants: Array<{
    id: string;
    name: string;
    weight: number;
    config: Record<string, unknown>;
  }>;

  /** Success metric */
  successMetric: string;

  /** Minimum sample size */
  minSampleSize: number;

  /** Start date */
  startDate: Date;

  /** End date */
  endDate?: Date;

  /** Status */
  status: 'draft' | 'running' | 'paused' | 'completed';
}

/**
 * Personalization strategy
 */
export interface PersonalizationStrategy {
  /** Strategy name */
  name: string;

  /** Weight for collaborative filtering */
  collaborativeWeight: number;

  /** Weight for content-based filtering */
  contentWeight: number;

  /** Weight for knowledge graph */
  graphWeight: number;

  /** Exploration vs. exploitation parameter */
  explorationRate: number;

  /** Diversity promotion factor */
  diversityFactor: number;

  /** Recency bias */
  recencyBias: number;
}

/**
 * Learning rate schedule
 */
export interface LearningRateSchedule {
  /** Schedule type */
  type: 'constant' | 'step' | 'exponential' | 'cosine';

  /** Initial learning rate */
  initialLR: number;

  /** Parameters specific to schedule type */
  params?: Record<string, number>;
}

/**
 * Model checkpoint
 */
export interface ModelCheckpoint {
  /** Checkpoint ID */
  id: string;

  /** Model version */
  version: string;

  /** Checkpoint path */
  path: string;

  /** Performance metrics at checkpoint */
  metrics: ModelMetrics;

  /** Training step */
  step: number;

  /** Timestamp */
  createdAt: Date;

  /** Is best checkpoint */
  isBest: boolean;
}

/**
 * Feature importance scores
 */
export interface FeatureImportance {
  /** Feature name */
  feature: string;

  /** Importance score */
  importance: number;

  /** Standard deviation (if available) */
  std?: number;
}

/**
 * Prediction explanation
 */
export interface PredictionExplanation {
  /** Prediction ID */
  predictionId: string;

  /** Top contributing features */
  topFeatures: Array<{
    feature: string;
    contribution: number;
    value: unknown;
  }>;

  /** Similar training examples */
  similarExamples: Array<{
    exampleId: string;
    similarity: number;
  }>;

  /** Confidence intervals */
  confidence: {
    lower: number;
    upper: number;
  };
}
