// Week 7-8: Price Intelligence and Pattern Analytics Types

import { PatternId } from './index';

// ============================================
// Price Intelligence Types
// ============================================

export type DataQualityLevel = 'insufficient' | 'emerging' | 'reliable' | 'mature';

export interface PricePoint {
  id: string;
  itemName: string;
  price: number;
  store: string;
  date: string;
  isOnSale: boolean;
  unitPrice?: number;
  unit?: string;
}

export interface PriceHistory {
  itemName: string;
  points: PricePoint[];
  qualityLevel: DataQualityLevel;
  pointsNeeded: number;
  averagePrice: number;
  historicalLow: number;
  historicalHigh: number;
  currentPrice: number;
  predictedPrice?: number;
  priceDropAlert: boolean;
  dropPercentage?: number;
}

export interface CrossStorePrice {
  store: string;
  currentPrice: number;
  averagePrice: number;
  lastUpdated: string;
  isLowestPrice: boolean;
  savingsVsAverage: number;
}

// ============================================
// Deal Quality Types
// ============================================

export type DealAssessment = 'excellent' | 'good' | 'average' | 'poor' | 'fake';

export interface DealQualityScore {
  score: number; // 1-10
  assessment: DealAssessment;
  vs30DayAvg: number; // percentage
  vs90DayAvg: number; // percentage
  vsHistoricalLow: number; // percentage
  trueSavings: number; // percentage
  isFakeDeal: boolean;
  warnings: string[];
}

export interface StockUpRecommendation {
  itemName: string;
  recommendedQuantity: number;
  maxQuantity: number;
  reasonForLimit: 'storage' | 'expiration' | 'consumption' | 'deal_quality';
  estimatedSavings: number;
  nextSalePrediction?: string;
  daysUntilNextSale?: number;
  consumptionRatePerDay: number;
  expirationDays: number;
}

// ============================================
// Pattern Analytics Types
// ============================================

export interface PatternEffectivenessMetrics {
  patternId: PatternId;
  patternName: string;
  successRate: number; // percentage
  weightChangeAvg: number; // lbs per week
  energyLevelAvg: number; // 0-100
  satisfactionScore: number; // 1-5
  adherenceRate: number; // percentage
  totalDaysUsed: number;
  currentStreak: number;
}

export type ContextType = 'dayOfWeek' | 'weather' | 'stressLevel' | 'scheduleType';

export interface ContextCorrelation {
  contextType: ContextType;
  contextValue: string;
  bestPattern: PatternId;
  successRate: number;
  sampleSize: number;
}

export interface DayOfWeekCorrelation {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  bestPattern: PatternId;
  successRate: number;
}

export interface WeatherCorrelation {
  weather: 'sunny' | 'cloudy' | 'rainy' | 'cold' | 'hot';
  bestPattern: PatternId;
  successRate: number;
}

export interface StressCorrelation {
  level: 'low' | 'medium' | 'high';
  bestPattern: PatternId;
  successRate: number;
}

export interface ScheduleCorrelation {
  type: 'work' | 'wfh' | 'weekend' | 'travel' | 'social';
  bestPattern: PatternId;
  successRate: number;
}

export interface PatternRecommendation {
  recommendedPattern: PatternId;
  patternName: string;
  confidence: number; // 0-100
  reasoning: string[];
  contextFactors: string[];
  fatigueWarning: boolean;
  consecutiveDays: number;
  alternativePatterns: PatternId[];
}

// ============================================
// Social Event Types
// ============================================

export type EventMealType = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'snack' | 'drinks';
export type CalorieEstimate = 'light' | 'medium' | 'heavy' | 'unknown';

export interface SocialEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  mealType: EventMealType;
  estimatedCalories: number;
  calorieEstimateType: CalorieEstimate;
  restaurant?: string;
  menuUrl?: string;
  nutritionAvailable: boolean;
  notes?: string;
}

export interface CalorieBankingStrategy {
  eventId: string;
  eventCalories: number;
  dailyBudget: number;
  allocatedToEvent: number;
  otherMeals: BankedMeal[];
  totalReduction: number;
  remainingForEvent: number;
  isAchievable: boolean;
  warnings: string[];
}

export interface BankedMeal {
  mealType: 'morning' | 'noon' | 'evening';
  originalCalories: number;
  reducedCalories: number;
  reductionPercent: number;
  suggestedMeal?: string;
}

export interface RecoveryPlan {
  eventId: string;
  nextDayPattern: PatternId;
  patternName: string;
  suggestedMeals: RecoveryMeal[];
  noWeighFor: number; // hours
  damageControlTips: string[];
  hydrationGoal: number; // oz
  activitySuggestion?: string;
}

export interface RecoveryMeal {
  mealType: 'morning' | 'noon' | 'evening';
  calories: number;
  protein: number;
  description: string;
  emphasis: 'protein' | 'fiber' | 'hydration' | 'light';
}

// ============================================
// Calorie Estimate Constants
// ============================================

export const CALORIE_ESTIMATES: Record<EventMealType, Record<CalorieEstimate, number>> = {
  breakfast: { light: 400, medium: 600, heavy: 900, unknown: 600 },
  brunch: { light: 500, medium: 800, heavy: 1200, unknown: 800 },
  lunch: { light: 500, medium: 800, heavy: 1100, unknown: 750 },
  dinner: { light: 600, medium: 1000, heavy: 1500, unknown: 1000 },
  snack: { light: 150, medium: 300, heavy: 500, unknown: 300 },
  drinks: { light: 200, medium: 400, heavy: 800, unknown: 400 },
};

export const MEAL_TYPE_LABELS: Record<EventMealType, string> = {
  breakfast: 'Breakfast',
  brunch: 'Brunch',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drinks: 'Drinks/Happy Hour',
};

export const DATA_QUALITY_THRESHOLDS = {
  insufficient: 5,  // < 5 points
  emerging: 10,     // 5-9 points
  reliable: 20,     // 10-19 points
  mature: 20,       // 20+ points
};
