/**
 * Learning Services Index
 * Exports all learning-related services for the RuVector integration
 */

// Feedback service
export {
  FeedbackService,
  getFeedbackService,
  feedbackService
} from './feedback.service';

export type {
  FeedbackConfig
} from './feedback.service';

// Re-export learning types
export type {
  FeedbackEntry,
  FeedbackType,
  FeedbackStats,
  LearningEvent,
  UserPreferences,
  PreferenceWeight,
  LearningMetrics,
  TrainingConfig,
  TrainingResult
} from '../types/learning.types';
