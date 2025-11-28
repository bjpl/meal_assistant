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

const { v4: uuidv4 } = require('uuid');
const { priceIntelligenceService, DATA_QUALITY_THRESHOLDS } = require('./priceIntelligence');

/**
 * Quality score thresholds
 * Based on comparison to historical averages
 */
const QUALITY_THRESHOLDS = {
  EXCELLENT: -0.20,  // 20%+ below average
  GOOD: -0.10,       // 10-20% below average
  AVERAGE: 0.05,     // Within 5% of average
  POOR: 0.15,        // 5-15% above average
  FAKE: 0.30         // 30%+ above "regular" price
};

/**
 * Stock-up factors
 */
const STOCK_UP_FACTORS = {
  MIN_QUALITY_SCORE: 7,           // Minimum score to recommend stock-up
  MAX_STORAGE_WEEKS: 12,          // Maximum weeks to store
  DEFAULT_WEEKLY_USAGE: 1,        // Default units per week if unknown
  EXCELLENT_MULTIPLIER: 3,        // Multiply recommended qty for excellent deals
  GOOD_MULTIPLIER: 2              // Multiply recommended qty for good deals
};

/**
 * In-memory storage for deal quality data
 */
const dealStore = {
  qualityScores: new Map(),
  dealCycles: new Map(),
  flaggedDeals: new Map()
};

class DealQualityService {
  /**
   * Assess the quality of a deal
   * @param {number} dealPrice - The deal price
   * @param {string} componentId - Component being assessed
   * @param {string} storeId - Store offering the deal
   * @param {Object} options - Additional options
   * @returns {Object} Deal quality assessment
   */
  async assessDeal(dealPrice, componentId, storeId, options = {}) {
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

    const qualityAssessment = {
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
   * @private
   */
  calculateComparisons(dealPrice, trend) {
    const comparisons = {
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
    // Weights: 30% vs 30-day, 25% vs 90-day, 25% vs historical low, 20% vs 7-day
    const weights = { vs7Day: 0.20, vs30Day: 0.30, vs90Day: 0.25, vsHistoricalLow: 0.25 };
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [key, weight] of Object.entries(weights)) {
      if (comparisons[key] !== null) {
        weightedSum += comparisons[key] * weight;
        totalWeight += weight;
      }
    }

    comparisons.weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Round all values
    for (const key of Object.keys(comparisons)) {
      if (comparisons[key] !== null && typeof comparisons[key] === 'number') {
        comparisons[key] = Math.round(comparisons[key] * 10000) / 10000;
      }
    }

    return comparisons;
  }

  /**
   * Calculate quality score (1-10)
   * @private
   */
  calculateQualityScore(comparisons) {
    const score = comparisons.weightedScore;

    // Score mapping based on percentage below/above average
    // Negative score = below average = better deal
    if (score <= -0.30) return 10;        // 30%+ below average - exceptional
    if (score <= -0.25) return 9;         // 25-30% below - excellent
    if (score <= -0.20) return 9;         // 20-25% below - excellent
    if (score <= -0.15) return 8;         // 15-20% below - very good
    if (score <= -0.10) return 8;         // 10-15% below - very good
    if (score <= -0.05) return 7;         // 5-10% below - good
    if (score <= 0) return 6;             // 0-5% below - slightly good
    if (score <= 0.05) return 5;          // 0-5% above - average
    if (score <= 0.10) return 4;          // 5-10% above - poor
    if (score <= 0.20) return 3;          // 10-20% above - bad deal
    if (score <= 0.30) return 2;          // 20-30% above - likely fake deal
    return 1;                              // 30%+ above - definitely fake deal
  }

  /**
   * Determine assessment category
   * @private
   */
  determineAssessment(qualityScore, comparisons) {
    let category, description, emoji;

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

    // Additional context based on comparisons
    let insights = [];

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
   * @private
   */
  async calculateStockUpRecommendation(dealPrice, componentId, storeId, qualityScore, assessment, options) {
    const {
      storageDays = 90,           // Default 3 months storage
      weeklyUsage = 1,            // Default 1 unit per week
      unit = 'count',
      maxBudget = null
    } = options;

    // Don't recommend stock-up for poor/fake deals
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

    // Calculate how many weeks worth to buy
    const storageWeeks = Math.min(
      Math.floor(storageDays / 7),
      STOCK_UP_FACTORS.MAX_STORAGE_WEEKS
    );

    // Base quantity = weeks of storage * weekly usage
    let recommendedQty = storageWeeks * weeklyUsage;

    // Multiply based on deal quality
    if (assessment.category === 'excellent') {
      recommendedQty = Math.ceil(recommendedQty * STOCK_UP_FACTORS.EXCELLENT_MULTIPLIER);
    } else if (assessment.category === 'good') {
      recommendedQty = Math.ceil(recommendedQty * STOCK_UP_FACTORS.GOOD_MULTIPLIER);
    }

    // Cap by budget if specified
    if (maxBudget && dealPrice > 0) {
      const budgetQty = Math.floor(maxBudget / dealPrice);
      recommendedQty = Math.min(recommendedQty, budgetQty);
    }

    // Generate reason
    let reason;
    if (assessment.category === 'excellent') {
      reason = `Exceptional deal - stock up for ${storageWeeks} weeks. Price is ${Math.abs(Math.round(assessment.insights[0]?.split('%')[0] || 20))}% below average.`;
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
        Math.round((recommendedQty * dealPrice * 0.15) * 100) / 100 : 0 // Estimated 15% savings
    };
  }

  /**
   * Predict next sale date based on historical patterns
   * @param {string} componentId
   * @param {string} storeId
   * @returns {Object} Sale prediction
   */
  async predictNextSale(componentId, storeId) {
    const key = `${componentId}-${storeId || 'all'}`;
    let cycle = dealStore.dealCycles.get(key);

    // Get historical deal data
    const history = await priceIntelligenceService.getPriceHistory(componentId, { storeId });
    const deals = history.prices.filter(p => p.isDeal || p.isSalePrice);

    if (deals.length < 3) {
      return {
        daysUntil: null,
        date: null,
        confidence: 0,
        message: 'Not enough deal history to predict next sale'
      };
    }

    // Sort by date ascending
    const sortedDeals = [...deals].sort((a, b) =>
      new Date(a.recordedDate) - new Date(b.recordedDate)
    );

    // Calculate average days between sales
    const gaps = [];
    for (let i = 1; i < sortedDeals.length; i++) {
      const gap = Math.floor(
        (new Date(sortedDeals[i].recordedDate) - new Date(sortedDeals[i-1].recordedDate)) /
        (24 * 60 * 60 * 1000)
      );
      gaps.push(gap);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);

    // Calculate standard deviation for confidence
    const variance = gaps.reduce((acc, g) => acc + Math.pow(g - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, Math.min(100, 100 - (stdDev / avgGap * 100)));

    // Predict next sale
    const lastDeal = sortedDeals[sortedDeals.length - 1];
    const daysSinceLastDeal = Math.floor(
      (new Date() - new Date(lastDeal.recordedDate)) / (24 * 60 * 60 * 1000)
    );

    const daysUntil = Math.max(0, Math.round(avgGap - daysSinceLastDeal));
    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + daysUntil);

    // Store cycle data
    const cycleData = {
      componentId,
      storeId,
      avgDaysBetweenSales: Math.round(avgGap * 10) / 10,
      minDaysBetweenSales: minGap,
      maxDaysBetweenSales: maxGap,
      saleFrequencyPerMonth: Math.round((30 / avgGap) * 10) / 10,
      lastSaleDate: lastDeal.recordedDate,
      nextPredictedSaleStart: predictedDate.toISOString().split('T')[0],
      predictionConfidence: Math.round(confidence),
      dealCount: deals.length,
      lastUpdated: new Date().toISOString()
    };
    dealStore.dealCycles.set(key, cycleData);

    return {
      daysUntil,
      date: predictedDate.toISOString().split('T')[0],
      confidence: Math.round(confidence),
      avgDaysBetweenSales: Math.round(avgGap),
      saleFrequencyPerMonth: cycleData.saleFrequencyPerMonth,
      lastSaleDate: lastDeal.recordedDate,
      message: daysUntil <= 7 ?
        'Sale expected within a week - consider waiting' :
        daysUntil <= 14 ?
        'Sale may be coming in the next two weeks' :
        'No imminent sale predicted based on historical patterns'
    };
  }

  /**
   * Flag potentially fake deals
   * @param {string} adId - Weekly ad ID
   * @returns {Array} Flagged deals
   */
  async flagFakeDeals(adId) {
    const flaggedDeals = [];

    // Get all quality assessments for this ad
    for (const [id, assessment] of dealStore.qualityScores.entries()) {
      if (assessment.adDealId === adId &&
          (assessment.assessment === 'fake_deal' || assessment.assessment === 'poor')) {
        flaggedDeals.push({
          assessmentId: id,
          componentId: assessment.componentId,
          dealPrice: assessment.dealPrice,
          assessment: assessment.assessment,
          qualityScore: assessment.qualityScore,
          vs30DayAvg: assessment.vs30DayAvg,
          reason: assessment.assessment === 'fake_deal' ?
            `Price is ${Math.round(assessment.vs30DayAvg * 100)}% ABOVE 30-day average - this is not a deal` :
            `Price is only slightly below or at normal levels`,
          recommendation: 'Skip this deal and wait for a genuine sale'
        });
      }
    }

    // Store flagged deals
    if (flaggedDeals.length > 0) {
      dealStore.flaggedDeals.set(adId, flaggedDeals);
    }

    return {
      adId,
      flaggedCount: flaggedDeals.length,
      flaggedDeals,
      summary: flaggedDeals.length > 0 ?
        `Found ${flaggedDeals.length} suspicious deal(s) in this ad` :
        'No fake deals detected'
    };
  }

  /**
   * Get stock-up recommendation for a specific deal
   * @param {string} dealId - Deal quality assessment ID
   * @returns {Object} Stock-up recommendation
   */
  async getStockUpRecommendation(dealId) {
    const assessment = dealStore.qualityScores.get(dealId);

    if (!assessment) {
      return { error: 'Deal assessment not found' };
    }

    return {
      dealId,
      componentId: assessment.componentId,
      dealPrice: assessment.dealPrice,
      qualityScore: assessment.qualityScore,
      assessment: assessment.assessment,
      stockUpRecommended: assessment.stockUpRecommended,
      recommendedQuantity: assessment.recommendedQuantity,
      reason: assessment.stockUpReason,
      storageDays: assessment.storageDays,
      weeklyUsage: assessment.typicalWeeklyUsage,
      unit: assessment.usageUnit,
      nextSaleDate: assessment.nextPredictedSaleDate,
      daysUntilNextSale: assessment.predictedDaysUntilNextSale,
      advice: this.generateStockUpAdvice(assessment)
    };
  }

  /**
   * Generate stock-up advice text
   * @private
   */
  generateStockUpAdvice(assessment) {
    if (!assessment.stockUpRecommended) {
      return 'No stock-up recommended at this price point.';
    }

    const qty = assessment.recommendedQuantity;
    const weeks = Math.round(assessment.storageDays / 7);
    const nextSale = assessment.predictedDaysUntilNextSale;

    let advice = `Buy ${qty} units to cover ${weeks} weeks of usage.`;

    if (assessment.assessment === 'excellent') {
      advice += ' This is an exceptional deal - maximize your purchase within storage limits.';
    } else if (assessment.assessment === 'good') {
      advice += ' Good opportunity to stock up at below-average prices.';
    }

    if (nextSale && nextSale > 30) {
      advice += ` Next sale is predicted in ${nextSale} days, so this is a good time to buy.`;
    } else if (nextSale && nextSale <= 14) {
      advice += ` Note: Another sale may come in ${nextSale} days, so consider splitting your purchase.`;
    }

    return advice;
  }

  /**
   * Generate analysis notes
   * @private
   */
  generateAnalysisNotes(comparisons, assessment, trend) {
    const notes = [];

    // Price position analysis
    if (comparisons.vsHistoricalLow !== null) {
      if (comparisons.vsHistoricalLow <= 0) {
        notes.push('Price matches or beats the historical low');
      } else if (comparisons.vsHistoricalLow <= 0.10) {
        notes.push(`Price is within 10% of historical low ($${trend.historicalLow})`);
      }
    }

    // Trend context
    if (trend.trendType === 'falling') {
      notes.push('Prices have been trending downward recently');
    } else if (trend.trendType === 'rising') {
      notes.push('Prices have been trending upward - this deal may be timely');
    }

    // Comparison context
    if (comparisons.vs30Day !== null && comparisons.vs30Day < -0.10) {
      notes.push(`${Math.round(Math.abs(comparisons.vs30Day * 100))}% below 30-day average`);
    }

    // Assessment insight
    notes.push(assessment.description);

    return notes.join('. ');
  }

  /**
   * Create assessment for insufficient data scenarios
   * @private
   */
  createInsufficientDataAssessment(dealPrice, componentId, storeId, adDealId) {
    return {
      id: uuidv4(),
      adDealId,
      componentId,
      storeId,
      dealPrice,
      qualityScore: 5, // Default to average when unknown
      assessment: 'insufficient_data',
      stockUpRecommended: false,
      recommendedQuantity: 0,
      stockUpReason: 'Not enough price history to make a recommendation',
      analysisNotes: 'We need at least 5 price data points to assess deal quality. Continue capturing prices to enable full analysis.',
      assessedAt: new Date().toISOString(),
      message: 'Capture more prices for this item to enable deal quality assessment'
    };
  }
}

// Export singleton instance
const dealQualityService = new DealQualityService();

module.exports = {
  DealQualityService,
  dealQualityService,
  QUALITY_THRESHOLDS,
  STOCK_UP_FACTORS
};
