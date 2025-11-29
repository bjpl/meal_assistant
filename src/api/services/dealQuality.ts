/**
 * Deal Quality Service
 * Week 7-8: Deal assessment and fake deal detection
 *
 * Key features:
 * - Quality scoring (1-10 scale)
 * - Deal assessment categories (excellent/good/average/poor/fake)
 * - Stock-up recommendations
 * - Deal cycle prediction
 * - Fake deal detection
 */

import { v4 as uuidv4 } from 'uuid';
import { priceIntelligenceService, DATA_QUALITY_THRESHOLDS } from './priceIntelligence';

/**
 * Quality score thresholds
 * Based on comparison to historical averages
 */
export const QUALITY_THRESHOLDS = {
  EXCELLENT: -0.20,  // 20%+ below average
  GOOD: -0.10,       // 10-20% below average
  AVERAGE: 0.05,     // Within 5% of average
  POOR: 0.15,        // 5-15% above average
  FAKE: 0.30         // 30%+ above "regular" price
} as const;

/**
 * Stock-up factors
 */
export const STOCK_UP_FACTORS = {
  MIN_QUALITY_SCORE: 7,           // Minimum score to recommend stock-up
  MAX_STORAGE_WEEKS: 12,          // Maximum weeks to store
  DEFAULT_WEEKLY_USAGE: 1,        // Default units per week if unknown
  EXCELLENT_MULTIPLIER: 3,        // Multiply recommended qty for excellent deals
  GOOD_MULTIPLIER: 2              // Multiply recommended qty for good deals
} as const;

interface Comparisons {
  vs7Day: number | null;
  vs30Day: number | null;
  vs60Day: number | null;
  vs90Day: number | null;
  vsHistoricalLow: number | null;
  vsHistoricalHigh: number | null;
  weightedScore: number;
}

interface AssessmentResult {
  category: string;
  description: string;
  emoji: string;
  insights: string[];
  qualityScore: number;
}

interface StockUpRecommendation {
  recommended: boolean;
  quantity: number;
  reason: string;
  storageDays: number;
  weeklyUsage: number;
  unit: string;
  estimatedSavings?: number;
}

interface SalePrediction {
  daysUntil: number | null;
  date: string | null;
  confidence: number;
  avgDaysBetweenSales?: number;
  saleFrequencyPerMonth?: number;
  lastSaleDate?: string;
  message: string;
}

interface DealQualityAssessment {
  id: string;
  adDealId: string | null;
  componentId: string;
  storeId: string;
  userId: string | null;
  dealPrice: number;
  regularPrice: number | null;
  qualityScore: number;
  assessment: string;
  vs7DayAvg: number | null;
  vs30DayAvg: number | null;
  vs60DayAvg: number | null;
  vs90DayAvg: number | null;
  vsHistoricalLow: number | null;
  vsHistoricalHigh: number | null;
  stockUpRecommended: boolean;
  recommendedQuantity: number;
  stockUpReason: string;
  storageDays: number;
  typicalWeeklyUsage: number;
  usageUnit: string;
  predictedDaysUntilNextSale: number | null;
  nextPredictedSaleDate: string | null;
  predictionConfidence: number;
  analysisNotes: string;
  assessedAt: string;
  createdAt: string;
}

interface AssessDealOptions {
  adDealId?: string | null;
  regularPrice?: number | null;
  userId?: string | null;
  storageDays?: number;
  weeklyUsage?: number;
  unit?: string;
  maxBudget?: number | null;
}

/**
 * In-memory storage for deal quality data
 */
const dealStore: {
  qualityScores: Map<string, DealQualityAssessment>;
  dealCycles: Map<string, any>;
  flaggedDeals: Map<string, any[]>;
} = {
  qualityScores: new Map(),
  dealCycles: new Map(),
  flaggedDeals: new Map()
};

export class DealQualityService {
  /**
   * Assess the quality of a deal
   */
  async assessDeal(
    dealPrice: number,
    componentId: string,
    storeId: string,
    options: AssessDealOptions = {}
  ): Promise<DealQualityAssessment> {
    const {
      adDealId = null,
      regularPrice = null,
      userId = null
    } = options;

    // Get price history and trends
    const history = await priceIntelligenceService.getPriceHistory(componentId, { storeId });
    const trend = history.trend;

    // Check if we have enough data
    if (!trend || trend.dataPointsCount < DATA_QUALITY_THRESHOLDS.EMERGING) {
      return this.createInsufficientDataAssessment(dealPrice, componentId, storeId, adDealId);
    }

    // Calculate comparison percentages
    const comparisons = this.calculateComparisons(dealPrice, trend);

    // Calculate quality score (1-10)
    const qualityScore = this.calculateQualityScore(comparisons);

    // Determine assessment category
    const assessment = this.determineAssessment(qualityScore, comparisons);

    // Calculate stock-up recommendation
    const stockUpRecommendation = await this.calculateStockUpRecommendation(
      dealPrice,
      componentId,
      storeId,
      qualityScore,
      assessment,
      options
    );

    // Predict next sale
    const salePrediction = await this.predictNextSale(componentId, storeId);

    // Generate analysis notes
    const analysisNotes = this.generateAnalysisNotes(comparisons, assessment, trend);

    const qualityAssessment: DealQualityAssessment = {
      id: uuidv4(),
      adDealId,
      componentId,
      storeId,
      userId,
      dealPrice,
      regularPrice,
      qualityScore,
      assessment: assessment.category,
      vs7DayAvg: comparisons.vs7Day,
      vs30DayAvg: comparisons.vs30Day,
      vs60DayAvg: comparisons.vs60Day,
      vs90DayAvg: comparisons.vs90Day,
      vsHistoricalLow: comparisons.vsHistoricalLow,
      vsHistoricalHigh: comparisons.vsHistoricalHigh,
      stockUpRecommended: stockUpRecommendation.recommended,
      recommendedQuantity: stockUpRecommendation.quantity,
      stockUpReason: stockUpRecommendation.reason,
      storageDays: stockUpRecommendation.storageDays,
      typicalWeeklyUsage: stockUpRecommendation.weeklyUsage,
      usageUnit: stockUpRecommendation.unit,
      predictedDaysUntilNextSale: salePrediction.daysUntil,
      nextPredictedSaleDate: salePrediction.date,
      predictionConfidence: salePrediction.confidence,
      analysisNotes,
      assessedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // Store the assessment
    dealStore.qualityScores.set(qualityAssessment.id, qualityAssessment);

    return qualityAssessment;
  }

  /**
   * Calculate comparison percentages against benchmarks
   */
  private calculateComparisons(dealPrice: number, trend: any): Comparisons {
    const comparisons: Comparisons = {
      vs7Day: null,
      vs30Day: null,
      vs60Day: null,
      vs90Day: null,
      vsHistoricalLow: null,
      vsHistoricalHigh: null,
      weightedScore: 0
    };

    // Calculate percentage differences
    if (trend.avg7Day) {
      comparisons.vs7Day = (dealPrice - trend.avg7Day) / trend.avg7Day;
    }
    if (trend.avg30Day) {
      comparisons.vs30Day = (dealPrice - trend.avg30Day) / trend.avg30Day;
    }
    if (trend.avg60Day) {
      comparisons.vs60Day = (dealPrice - trend.avg60Day) / trend.avg60Day;
    }
    if (trend.avg90Day) {
      comparisons.vs90Day = (dealPrice - trend.avg90Day) / trend.avg90Day;
    }
    if (trend.historicalLow) {
      comparisons.vsHistoricalLow = (dealPrice - trend.historicalLow) / trend.historicalLow;
    }
    if (trend.historicalHigh) {
      comparisons.vsHistoricalHigh = (dealPrice - trend.historicalHigh) / trend.historicalHigh;
    }

    // Calculate weighted score (used for quality assessment)
    const weights = { vs7Day: 0.20, vs30Day: 0.30, vs90Day: 0.25, vsHistoricalLow: 0.25 };
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const compKey = key as keyof typeof weights;
      if (comparisons[compKey] !== null) {
        weightedSum += comparisons[compKey]! * weight;
        totalWeight += weight;
      }
    }

    comparisons.weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Round all values
    for (const key of Object.keys(comparisons)) {
      const k = key as keyof Comparisons;
      if (comparisons[k] !== null && typeof comparisons[k] === 'number') {
        comparisons[k] = Math.round(comparisons[k] as number * 10000) / 10000 as any;
      }
    }

    return comparisons;
  }

  /**
   * Calculate quality score (1-10)
   */
  private calculateQualityScore(comparisons: Comparisons): number {
    const score = comparisons.weightedScore;

    if (score <= -0.30) return 10;
    if (score <= -0.25) return 9;
    if (score <= -0.20) return 9;
    if (score <= -0.15) return 8;
    if (score <= -0.10) return 8;
    if (score <= -0.05) return 7;
    if (score <= 0) return 6;
    if (score <= 0.05) return 5;
    if (score <= 0.10) return 4;
    if (score <= 0.20) return 3;
    if (score <= 0.30) return 2;
    return 1;
  }

  /**
   * Determine assessment category
   */
  private determineAssessment(qualityScore: number, comparisons: Comparisons): AssessmentResult {
    let category: string, description: string, emoji: string;

    if (qualityScore >= 9) {
      category = 'excellent';
      description = 'Exceptional deal - significantly below historical averages';
      emoji = '🌟';
    } else if (qualityScore >= 7) {
      category = 'good';
      description = 'Good deal - noticeably below average prices';
      emoji = '✅';
    } else if (qualityScore >= 5) {
      category = 'average';
      description = 'Fair price - close to typical market prices';
      emoji = '➡️';
    } else if (qualityScore >= 3) {
      category = 'poor';
      description = 'Not a real deal - price is at or above average';
      emoji = '⚠️';
    } else {
      category = 'fake_deal';
      description = 'Fake deal alert - price is significantly above historical averages';
      emoji = '🚨';
    }

    const insights: string[] = [];

    if (comparisons.vsHistoricalLow !== null) {
      if (comparisons.vsHistoricalLow <= 0.05) {
        insights.push('Near or at historical low price');
      } else if (comparisons.vsHistoricalLow <= 0.20) {
        insights.push('Within 20% of historical low');
      }
    }

    if (comparisons.vs30Day !== null && comparisons.vs30Day < -0.15) {
      insights.push('Significant recent price drop');
    }

    return {
      category,
      description,
      emoji,
      insights,
      qualityScore
    };
  }

  /**
   * Calculate stock-up recommendation
   */
  private async calculateStockUpRecommendation(
    dealPrice: number,
    _componentId: string,
    _storeId: string,
    qualityScore: number,
    assessment: AssessmentResult,
    options: AssessDealOptions
  ): Promise<StockUpRecommendation> {
    const {
      storageDays = 90,
      weeklyUsage = 1,
      unit = 'count',
      maxBudget = null
    } = options;

    if (qualityScore < STOCK_UP_FACTORS.MIN_QUALITY_SCORE) {
      return {
        recommended: false,
        quantity: 0,
        reason: 'Deal quality too low to recommend stock-up',
        storageDays,
        weeklyUsage,
        unit
      };
    }

    const storageWeeks = Math.min(
      Math.floor(storageDays / 7),
      STOCK_UP_FACTORS.MAX_STORAGE_WEEKS
    );

    let recommendedQty = storageWeeks * weeklyUsage;

    if (assessment.category === 'excellent') {
      recommendedQty = Math.ceil(recommendedQty * STOCK_UP_FACTORS.EXCELLENT_MULTIPLIER);
    } else if (assessment.category === 'good') {
      recommendedQty = Math.ceil(recommendedQty * STOCK_UP_FACTORS.GOOD_MULTIPLIER);
    }

    if (maxBudget && dealPrice > 0) {
      const budgetQty = Math.floor(maxBudget / dealPrice);
      recommendedQty = Math.min(recommendedQty, budgetQty);
    }

    let reason: string;
    if (assessment.category === 'excellent') {
      reason = `Exceptional deal - stock up for ${storageWeeks} weeks.`;
    } else if (assessment.category === 'good') {
      reason = `Good deal - consider buying extra. Price is below recent averages.`;
    } else {
      reason = `Decent deal - buy normal quantity plus a small buffer.`;
    }

    return {
      recommended: recommendedQty > weeklyUsage,
      quantity: recommendedQty,
      reason,
      storageDays,
      weeklyUsage,
      unit,
      estimatedSavings: recommendedQty > 0 ?
        Math.round((recommendedQty * dealPrice * 0.15) * 100) / 100 : 0
    };
  }

  /**
   * Predict next sale date based on historical patterns
   */
  async predictNextSale(componentId: string, storeId: string): Promise<SalePrediction> {
    const history = await priceIntelligenceService.getPriceHistory(componentId, { storeId });
    const deals = history.prices.filter((p: any) => p.isDeal || p.isSalePrice);

    if (deals.length < 3) {
      return {
        daysUntil: null,
        date: null,
        confidence: 0,
        message: 'Not enough deal history to predict next sale'
      };
    }

    const sortedDeals = [...deals].sort((a: any, b: any) =>
      new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime()
    );

    const gaps: number[] = [];
    for (let i = 1; i < sortedDeals.length; i++) {
      const gap = Math.floor(
        (new Date(sortedDeals[i].recordedDate).getTime() - new Date(sortedDeals[i-1].recordedDate).getTime()) /
        (24 * 60 * 60 * 1000)
      );
      gaps.push(gap);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((acc, g) => acc + Math.pow(g - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, Math.min(100, 100 - (stdDev / avgGap * 100)));

    const lastDeal = sortedDeals[sortedDeals.length - 1];
    const daysSinceLastDeal = Math.floor(
      (new Date().getTime() - new Date(lastDeal.recordedDate).getTime()) / (24 * 60 * 60 * 1000)
    );

    const daysUntil = Math.max(0, Math.round(avgGap - daysSinceLastDeal));
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysUntil);

    return {
      daysUntil,
      date: predictedDate.toISOString().split('T')[0],
      confidence: Math.round(confidence),
      avgDaysBetweenSales: Math.round(avgGap),
      message: daysUntil <= 7 ?
        'Sale expected within a week - consider waiting' :
        daysUntil <= 14 ?
        'Sale may be coming in the next two weeks' :
        'No imminent sale predicted based on historical patterns'
    };
  }

  /**
   * Generate analysis notes
   */
  private generateAnalysisNotes(comparisons: Comparisons, assessment: AssessmentResult, trend: any): string {
    const notes: string[] = [];

    if (comparisons.vsHistoricalLow !== null) {
      if (comparisons.vsHistoricalLow <= 0) {
        notes.push('Price matches or beats the historical low');
      } else if (comparisons.vsHistoricalLow <= 0.10) {
        notes.push(`Price is within 10% of historical low ($${trend.historicalLow})`);
      }
    }

    if (trend.trendType === 'falling') {
      notes.push('Prices have been trending downward recently');
    } else if (trend.trendType === 'rising') {
      notes.push('Prices have been trending upward - this deal may be timely');
    }

    if (comparisons.vs30Day !== null && comparisons.vs30Day < -0.10) {
      notes.push(`${Math.round(Math.abs(comparisons.vs30Day * 100))}% below 30-day average`);
    }

    notes.push(assessment.description);

    return notes.join('. ');
  }

  /**
   * Create assessment for insufficient data scenarios
   */
  private createInsufficientDataAssessment(
    dealPrice: number,
    componentId: string,
    storeId: string,
    adDealId: string | null
  ): DealQualityAssessment {
    return {
      id: uuidv4(),
      adDealId,
      componentId,
      storeId,
      userId: null,
      dealPrice,
      regularPrice: null,
      qualityScore: 5,
      assessment: 'insufficient_data',
      vs7DayAvg: null,
      vs30DayAvg: null,
      vs60DayAvg: null,
      vs90DayAvg: null,
      vsHistoricalLow: null,
      vsHistoricalHigh: null,
      stockUpRecommended: false,
      recommendedQuantity: 0,
      stockUpReason: 'Not enough price history to make a recommendation',
      storageDays: 90,
      typicalWeeklyUsage: 1,
      usageUnit: 'count',
      predictedDaysUntilNextSale: null,
      nextPredictedSaleDate: null,
      predictionConfidence: 0,
      analysisNotes: 'We need at least 5 price data points to assess deal quality.',
      assessedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const dealQualityService = new DealQualityService();
