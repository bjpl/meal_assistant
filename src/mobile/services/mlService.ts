/**
 * ML Service for Mobile App
 * Handles all communication with the ML prediction API
 * Features: pattern recommendations, weight predictions, deal matching
 */

import { ApiResponse } from './apiService';
import { PatternId } from '../types';
import { PatternRecommendation } from '../types/analytics.types';

// Configuration
const ML_SERVICE_URL = process.env.EXPO_PUBLIC_ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_ML_TIMEOUT || '10000', 10);

// Types
export interface PatternRecommendRequest {
  dayType: 'weekday' | 'weekend' | 'wfh' | 'holiday';
  weather: 'sunny' | 'cloudy' | 'rainy' | 'cold' | 'hot';
  stressLevel: 1 | 2 | 3 | 4;
  activityLevel: 'low' | 'moderate' | 'high';
  hasMorningWorkout: boolean;
  hasEveningSocial: boolean;
  prevPattern?: PatternId;
  prevAdherence?: number;
  prevEnergy?: number;
  topK?: number;
}

export interface PatternRecommendResponse {
  recommendations: Array<{
    pattern: PatternId;
    probability: number;
    reasoning: string[];
    rank: number;
  }>;
  contextFactors: string[];
  fatigueWarning: boolean;
  consecutiveDays: number;
}

export interface WeightPredictRequest {
  weightEntries: Array<{
    date: string;
    weightLbs: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
  }>;
  patternLogs?: Array<{
    date: string;
    pattern: PatternId;
    adherenceScore: number;
    calorieVariance: number;
  }>;
  daysAhead?: number;
  assumedAdherence?: number;
}

export interface WeightPredictResponse {
  predictions: Array<{
    date: string;
    predictedWeight: number;
    confidence: number;
    lowerBound: number;
    upperBound: number;
  }>;
  trend: 'losing' | 'gaining' | 'maintaining';
  projectedChange: number;
}

export interface DealMatchRequest {
  dealText: string;
  categories?: string[];
}

export interface DealMatchResponse {
  matches: Array<{
    productName: string;
    originalPrice: number;
    salePrice: number;
    percentOff: number;
    category: string;
    confidence: number;
  }>;
  rawDeals: Array<{
    text: string;
    type: string;
    confidence: number;
  }>;
}

// Logger
const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ML] ${message}`, data || '');
    }
  },
  error: (message: string, error?: unknown) => {
    console.error(`[ML Error] ${message}`, error || '');
  },
};

/**
 * Make a request to the ML service
 */
async function mlRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ML_TIMEOUT);

  try {
    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `ML service error: ${response.status}`,
        code: `ML_${response.status}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('ML request timeout', { endpoint });
      return { error: 'ML service timeout', code: 'ML_TIMEOUT' };
    }

    logger.error('ML request failed', { endpoint, error });
    return {
      error: 'ML service unavailable',
      code: 'ML_UNAVAILABLE',
    };
  }
}

/**
 * Check if ML service is available
 */
export async function checkMLHealth(): Promise<boolean> {
  try {
    const response = await mlRequest<{ status: string }>('/health');
    return !response.error;
  } catch {
    return false;
  }
}

/**
 * Get pattern recommendation based on context
 */
export async function getPatternRecommendation(
  request: PatternRecommendRequest
): Promise<ApiResponse<PatternRecommendResponse>> {
  logger.debug('Requesting pattern recommendation', request);

  const response = await mlRequest<PatternRecommendResponse>('/pattern/recommend', {
    method: 'POST',
    body: JSON.stringify({
      day_type: request.dayType,
      weather: request.weather,
      stress_level: request.stressLevel,
      activity_level: request.activityLevel,
      has_morning_workout: request.hasMorningWorkout,
      has_evening_social: request.hasEveningSocial,
      prev_pattern: request.prevPattern,
      prev_adherence: request.prevAdherence ?? 0.8,
      prev_energy: request.prevEnergy ?? 3,
      top_k: request.topK ?? 3,
    }),
  });

  if (response.error) {
    // Return fallback recommendation when ML service is unavailable
    logger.debug('Using fallback recommendation');
    return {
      data: getFallbackRecommendation(request),
    };
  }

  return response;
}

/**
 * Get weight prediction
 */
export async function getWeightPrediction(
  request: WeightPredictRequest
): Promise<ApiResponse<WeightPredictResponse>> {
  logger.debug('Requesting weight prediction', { entries: request.weightEntries.length });

  const response = await mlRequest<WeightPredictResponse>('/weight/predict', {
    method: 'POST',
    body: JSON.stringify({
      weight_entries: request.weightEntries.map((e) => ({
        date: e.date,
        weight_lbs: e.weightLbs,
        time_of_day: e.timeOfDay,
      })),
      pattern_logs: request.patternLogs?.map((p) => ({
        date: p.date,
        pattern: p.pattern,
        adherence_score: p.adherenceScore,
        calorie_variance: p.calorieVariance,
      })),
      days_ahead: request.daysAhead ?? 30,
      assumed_adherence: request.assumedAdherence ?? 0.85,
    }),
  });

  return response;
}

/**
 * Match deals from ad text
 */
export async function matchDeals(
  request: DealMatchRequest
): Promise<ApiResponse<DealMatchResponse>> {
  logger.debug('Requesting deal matching', { textLength: request.dealText.length });

  const response = await mlRequest<DealMatchResponse>('/deals/match', {
    method: 'POST',
    body: JSON.stringify({
      deal_text: request.dealText,
      categories: request.categories,
    }),
  });

  return response;
}

/**
 * Fallback recommendation when ML service is unavailable
 * Uses simple heuristics based on context
 */
function getFallbackRecommendation(request: PatternRecommendRequest): PatternRecommendResponse {
  let recommendedPattern: PatternId = 'A';
  const reasoning: string[] = [];
  const contextFactors: string[] = [];

  // Day type factor
  contextFactors.push(
    request.dayType === 'weekday' ? 'Work day' :
    request.dayType === 'weekend' ? 'Weekend' :
    request.dayType === 'wfh' ? 'Work from home' : 'Holiday'
  );

  // Determine pattern based on simple rules
  if (request.hasMorningWorkout) {
    recommendedPattern = 'B'; // Reversed - bigger breakfast
    reasoning.push('Morning workout benefits from early nutrition');
    contextFactors.push('Morning workout');
  } else if (request.hasEveningSocial) {
    recommendedPattern = 'C'; // Fasting - light during day
    reasoning.push('Evening social event allows for lighter daytime eating');
    contextFactors.push('Evening social event');
  } else if (request.dayType === 'wfh') {
    recommendedPattern = 'C'; // Fasting works well at home
    reasoning.push('Work from home suits intermittent fasting schedule');
  } else if (request.stressLevel >= 3) {
    recommendedPattern = 'D'; // Grazing for high stress
    reasoning.push('Higher stress days benefit from smaller, frequent meals');
    contextFactors.push('High stress');
  } else {
    recommendedPattern = 'A'; // Traditional default
    reasoning.push('Traditional pattern provides consistent energy');
  }

  // Weather factor
  contextFactors.push(`${request.weather.charAt(0).toUpperCase() + request.weather.slice(1)} weather`);

  // Activity level factor
  contextFactors.push(`${request.activityLevel.charAt(0).toUpperCase() + request.activityLevel.slice(1)} activity`);

  return {
    recommendations: [
      {
        pattern: recommendedPattern,
        probability: 0.75,
        reasoning,
        rank: 1,
      },
      {
        pattern: recommendedPattern === 'A' ? 'C' : 'A',
        probability: 0.15,
        reasoning: ['Alternative based on general effectiveness'],
        rank: 2,
      },
      {
        pattern: 'D',
        probability: 0.10,
        reasoning: ['Grazing option for flexibility'],
        rank: 3,
      },
    ],
    contextFactors,
    fatigueWarning: false,
    consecutiveDays: 0,
  };
}

/**
 * Transform ML response to frontend PatternRecommendation format
 */
export function transformToPatternRecommendation(
  response: PatternRecommendResponse,
  patternNames: Record<PatternId, string>
): PatternRecommendation {
  const topRec = response.recommendations[0];

  return {
    recommendedPattern: topRec.pattern,
    patternName: patternNames[topRec.pattern] || `Pattern ${topRec.pattern}`,
    confidence: Math.round(topRec.probability * 100),
    reasoning: topRec.reasoning,
    contextFactors: response.contextFactors,
    fatigueWarning: response.fatigueWarning,
    consecutiveDays: response.consecutiveDays,
    alternativePatterns: response.recommendations
      .slice(1)
      .map((r) => r.pattern),
  };
}

export default {
  checkMLHealth,
  getPatternRecommendation,
  getWeightPrediction,
  matchDeals,
  transformToPatternRecommendation,
};
