/**
 * Price Intelligence Service
 * Week 7-8: Historical price analysis and trend calculation
 *
 * Key features:
 * - Price capture from receipts, ads, and manual entry
 * - Data quality status tracking (insufficient/emerging/reliable/mature)
 * - 30/60/90-day rolling averages
 * - Trend detection (rising/falling/stable)
 * - Price prediction for mature datasets (20+ points)
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Data quality thresholds
 */
export const DATA_QUALITY_THRESHOLDS = {
  INSUFFICIENT: 5,   // < 5 data points
  EMERGING: 10,      // 5-10 data points
  RELIABLE: 20,      // 10-20 data points
  MATURE: 20         // 20+ data points (enables predictions)
} as const;

/**
 * Trend detection thresholds
 */
export const TREND_THRESHOLDS = {
  RISING: 0.05,      // 5% increase over period
  FALLING: -0.05,    // 5% decrease over period
  VOLATILE: 0.15     // 15% standard deviation threshold
} as const;

/**
 * Data quality status
 */
export type DataQualityStatus = 'insufficient' | 'emerging' | 'reliable' | 'mature';

/**
 * Trend types
 */
export type TrendType = 'insufficient_data' | 'rising' | 'falling' | 'stable' | 'volatile';

/**
 * Price sources
 */
export type PriceSource = 'ad' | 'receipt' | 'manual' | 'api';

/**
 * Price capture options
 */
export interface CapturePriceOptions {
  quantity?: number;
  unit?: string;
  isDeal?: boolean;
  originalPrice?: number | null;
  sourceReferenceId?: string | null;
  capturedBy?: string | null;
  recordedDate?: string;
  notes?: string | null;
}

/**
 * Price record
 */
export interface PriceRecord {
  id: string;
  componentId: string;
  storeId: string | null;
  price: number;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  recordedDate: string;
  isSalePrice: boolean;
  isDeal: boolean;
  originalPrice: number | null;
  savingsAmount: number | null;
  dealSource: PriceSource;
  sourceReferenceId: string | null;
  capturedBy: string | null;
  dataQualityStatus: DataQualityStatus;
  notes: string | null;
  createdAt: string;
}

/**
 * Data quality status response
 */
export interface DataQualityStatusResponse {
  componentId: string;
  storeId: string | null;
  count: number;
  status: DataQualityStatus;
  needsMore: number;
  message: string;
  canPredict: boolean;
  hasTrends: boolean;
}

/**
 * Price trend
 */
export interface PriceTrend {
  id: string;
  componentId: string;
  storeId: string | null;
  trendType: TrendType;
  trendStrength: number;
  avg7Day: number | null;
  avg30Day: number | null;
  avg60Day: number | null;
  avg90Day: number | null;
  historicalLow: number;
  historicalLowDate: string | undefined;
  historicalHigh: number;
  historicalHighDate: string | undefined;
  currentPercentile: number;
  priceStdDev: number;
  dataPointsCount: number;
  dataQualityStatus: DataQualityStatus;
  predictedNextPrice: number | undefined;
  predictionConfidence: number | undefined;
  predictedLowDate: string | null | undefined;
  lastUpdated: string;
}

/**
 * Price prediction
 */
export interface PricePrediction {
  predictedPrice: number;
  confidence: number;
  daysAhead: number;
  slope: number;
  trend: 'rising' | 'falling' | 'stable';
  predictedLowDate: string | null;
  dataPointsUsed: number;
}

/**
 * Price prediction error
 */
export interface PricePredictionError {
  error: string;
  message: string;
}

/**
 * Price history response
 */
export interface PriceHistoryResponse {
  componentId: string;
  storeId: string | null;
  prices: PriceRecord[];
  trend: PriceTrend | undefined;
  count: number;
}

/**
 * Store comparison
 */
export interface StoreComparison {
  storeId: string | null;
  latestPrice: number;
  pricePerUnit: number;
  recordedDate: string;
  avg30Day: number | undefined;
  historicalLow: number | undefined;
  trendType: TrendType | undefined;
  dataQuality: DataQualityStatus;
  priceCount: number;
}

/**
 * Price comparison recommendation
 */
export interface PriceComparisonRecommendation {
  bestStore: string | null;
  bestPrice: number;
  worstPrice: number;
  potentialSavings: number;
  savingsPercent: number;
  message: string;
}

/**
 * Price comparison response
 */
export interface PriceComparisonResponse {
  componentId: string;
  storeCount: number;
  comparisons: StoreComparison[];
  recommendation: PriceComparisonRecommendation | null;
}

/**
 * Trending prices response
 */
export interface TrendingPricesResponse {
  trends: PriceTrend[];
  count: number;
  rising: number;
  falling: number;
  volatile: number;
}

/**
 * Price drop alert
 */
export interface PriceDropAlert {
  componentId: string;
  storeId: string | null;
  currentAvg: number;
  previousAvg: number;
  dropPercent: number;
  historicalLow: number;
  isNearHistoricalLow: boolean;
  recommendation: 'excellent_time_to_buy' | 'good_time_to_buy';
}

/**
 * Price drop alerts response
 */
export interface PriceDropAlertsResponse {
  alerts: PriceDropAlert[];
  count: number;
}

/**
 * Price alert
 */
export interface PriceAlert {
  id: string;
  componentId: string;
  storeId: string | null;
  isActive: boolean;
  alertType: 'target_price' | 'price_drop';
  targetPrice?: number;
  percentageDrop?: number;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

/**
 * Alert trigger
 */
export interface AlertTrigger {
  alertId: string;
  componentId: string;
  storeId: string | null;
  price: number;
  triggeredAt: string;
}

/**
 * Price stats response
 */
export interface PriceStatsResponse {
  totalPricePoints: number;
  componentsTracked: number;
  storesTracked: number;
  datasets: {
    mature: number;
    reliable: number;
    emerging: number;
    insufficient: number;
    total: number;
  };
  trends: {
    rising: number;
    falling: number;
    stable: number;
    volatile: number;
  };
  predictionsAvailable: number;
}

/**
 * Capture price result
 */
export interface CapturePriceResult {
  price: PriceRecord;
  dataQuality: DataQualityStatusResponse;
  trendsUpdated: boolean;
}

/**
 * In-memory storage for price intelligence data
 * In production, replace with database operations
 */
const priceStore: {
  prices: Map<string, PriceRecord[]>;
  trends: Map<string, PriceTrend>;
  alerts: Map<string, PriceAlert>;
  dealCycles: Map<string, unknown>;
} = {
  prices: new Map(),
  trends: new Map(),
  alerts: new Map(),
  dealCycles: new Map()
};

export class PriceIntelligenceService {
  /**
   * Capture a new price point
   */
  async capturePrice(
    componentId: string,
    storeId: string | null,
    price: number,
    source: PriceSource,
    options: CapturePriceOptions = {}
  ): Promise<CapturePriceResult> {
    const {
      quantity = 1,
      unit = 'count',
      isDeal = false,
      originalPrice = null,
      sourceReferenceId = null,
      capturedBy = null,
      recordedDate = new Date().toISOString().split('T')[0],
      notes = null
    } = options;

    // Calculate price per unit
    const pricePerUnit = quantity > 0 ? price / quantity : price;

    // Calculate savings if this is a deal
    let savingsAmount: number | null = null;
    if (isDeal && originalPrice && originalPrice > price) {
      savingsAmount = originalPrice - price;
    }

    // Get current data quality status
    const dataQuality = await this.getDataQualityStatus(componentId, storeId);

    const priceRecord: PriceRecord = {
      id: uuidv4(),
      componentId,
      storeId,
      price,
      quantity,
      unit,
      pricePerUnit,
      recordedDate,
      isSalePrice: isDeal,
      isDeal,
      originalPrice,
      savingsAmount,
      dealSource: source,
      sourceReferenceId,
      capturedBy,
      dataQualityStatus: dataQuality.status,
      notes,
      createdAt: new Date().toISOString()
    };

    // Store the price
    const key = `${componentId}-${storeId || 'all'}`;
    if (!priceStore.prices.has(key)) {
      priceStore.prices.set(key, []);
    }
    priceStore.prices.get(key)!.push(priceRecord);

    // Recalculate trends if we have reliable+ data
    const newQuality = await this.getDataQualityStatus(componentId, storeId);
    if (newQuality.count >= DATA_QUALITY_THRESHOLDS.EMERGING) {
      await this.calculateTrends(componentId, storeId);
    }

    // Check for price alerts
    await this.checkPriceAlerts(componentId, storeId, price);

    return {
      price: priceRecord,
      dataQuality: newQuality,
      trendsUpdated: newQuality.count >= DATA_QUALITY_THRESHOLDS.EMERGING
    };
  }

  /**
   * Get data quality status for a component/store combination
   */
  async getDataQualityStatus(componentId: string, storeId: string | null): Promise<DataQualityStatusResponse> {
    const key = `${componentId}-${storeId || 'all'}`;
    const prices = priceStore.prices.get(key) || [];
    const count = prices.length;

    let status: DataQualityStatus;
    let message: string;
    let needsMore: number;

    if (count < DATA_QUALITY_THRESHOLDS.INSUFFICIENT) {
      status = 'insufficient';
      needsMore = DATA_QUALITY_THRESHOLDS.INSUFFICIENT - count;
      message = `Need ${needsMore} more price point${needsMore > 1 ? 's' : ''} for emerging quality`;
    } else if (count < DATA_QUALITY_THRESHOLDS.EMERGING) {
      status = 'emerging';
      needsMore = DATA_QUALITY_THRESHOLDS.RELIABLE - count;
      message = `Need ${needsMore} more price point${needsMore > 1 ? 's' : ''} for reliable quality`;
    } else if (count < DATA_QUALITY_THRESHOLDS.MATURE) {
      status = 'reliable';
      needsMore = DATA_QUALITY_THRESHOLDS.MATURE - count;
      message = `Need ${needsMore} more price point${needsMore > 1 ? 's' : ''} for predictions`;
    } else {
      status = 'mature';
      needsMore = 0;
      message = 'Full price intelligence available including predictions';
    }

    return {
      componentId,
      storeId,
      count,
      status,
      needsMore,
      message,
      canPredict: count >= DATA_QUALITY_THRESHOLDS.MATURE,
      hasTrends: count >= DATA_QUALITY_THRESHOLDS.EMERGING
    };
  }

  /**
   * Calculate price trends for a component/store combination
   */
  async calculateTrends(componentId: string, storeId: string | null): Promise<PriceTrend> {
    const key = `${componentId}-${storeId || 'all'}`;
    const prices = priceStore.prices.get(key) || [];

    if (prices.length < DATA_QUALITY_THRESHOLDS.INSUFFICIENT) {
      return {
        id: uuidv4(),
        componentId,
        storeId,
        trendType: 'insufficient_data',
        trendStrength: 0,
        avg7Day: null,
        avg30Day: null,
        avg60Day: null,
        avg90Day: null,
        historicalLow: 0,
        historicalLowDate: undefined,
        historicalHigh: 0,
        historicalHighDate: undefined,
        currentPercentile: 0,
        priceStdDev: 0,
        dataPointsCount: prices.length,
        dataQualityStatus: 'insufficient',
        predictedNextPrice: undefined,
        predictionConfidence: undefined,
        predictedLowDate: undefined,
        lastUpdated: new Date().toISOString()
      };
    }

    // Sort by date descending
    const sortedPrices = [...prices].sort((a, b) =>
      new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()
    );

    const now = new Date();

    // Calculate rolling averages
    const avg7Day = this.calculateAverage(sortedPrices, now, 7);
    const avg30Day = this.calculateAverage(sortedPrices, now, 30);
    const avg60Day = this.calculateAverage(sortedPrices, now, 60);
    const avg90Day = this.calculateAverage(sortedPrices, now, 90);

    // Find historical extremes
    const allPrices = sortedPrices.map(p => p.pricePerUnit || p.price);
    const historicalLow = Math.min(...allPrices);
    const historicalHigh = Math.max(...allPrices);

    const lowRecord = sortedPrices.find(p => (p.pricePerUnit || p.price) === historicalLow);
    const highRecord = sortedPrices.find(p => (p.pricePerUnit || p.price) === historicalHigh);

    // Calculate standard deviation
    const stdDev = this.calculateStdDev(allPrices);

    // Determine trend type
    let trendType: TrendType = 'stable';
    let trendStrength = 0;

    if (avg30Day && avg60Day) {
      const change = (avg30Day - avg60Day) / avg60Day;

      if (stdDev / avg30Day > TREND_THRESHOLDS.VOLATILE) {
        trendType = 'volatile';
        trendStrength = Math.min(100, (stdDev / avg30Day) * 100);
      } else if (change > TREND_THRESHOLDS.RISING) {
        trendType = 'rising';
        trendStrength = Math.min(100, change * 100);
      } else if (change < TREND_THRESHOLDS.FALLING) {
        trendType = 'falling';
        trendStrength = Math.min(100, Math.abs(change) * 100);
      } else {
        trendType = 'stable';
        trendStrength = 100 - Math.min(100, Math.abs(change) * 200);
      }
    }

    // Calculate current percentile
    const latestPrice = sortedPrices[0]?.pricePerUnit || sortedPrices[0]?.price;
    let currentPercentile = 50;
    if (latestPrice && historicalLow !== historicalHigh) {
      currentPercentile = ((latestPrice - historicalLow) / (historicalHigh - historicalLow)) * 100;
    }

    // Prediction (only for mature datasets)
    let prediction: PricePrediction | PricePredictionError | null = null;
    if (prices.length >= DATA_QUALITY_THRESHOLDS.MATURE) {
      prediction = await this.predictFuturePrice(componentId, storeId);
    }

    const dataQualityStatus: DataQualityStatus =
      prices.length >= DATA_QUALITY_THRESHOLDS.MATURE ? 'mature' :
      prices.length >= DATA_QUALITY_THRESHOLDS.RELIABLE ? 'reliable' :
      prices.length >= DATA_QUALITY_THRESHOLDS.EMERGING ? 'emerging' : 'insufficient';

    const trend: PriceTrend = {
      id: uuidv4(),
      componentId,
      storeId,
      trendType,
      trendStrength: Math.round(trendStrength * 100) / 100,
      avg7Day: avg7Day ? Math.round(avg7Day * 100) / 100 : null,
      avg30Day: avg30Day ? Math.round(avg30Day * 100) / 100 : null,
      avg60Day: avg60Day ? Math.round(avg60Day * 100) / 100 : null,
      avg90Day: avg90Day ? Math.round(avg90Day * 100) / 100 : null,
      historicalLow: Math.round(historicalLow * 100) / 100,
      historicalLowDate: lowRecord?.recordedDate,
      historicalHigh: Math.round(historicalHigh * 100) / 100,
      historicalHighDate: highRecord?.recordedDate,
      currentPercentile: Math.round(currentPercentile * 100) / 100,
      priceStdDev: Math.round(stdDev * 10000) / 10000,
      dataPointsCount: prices.length,
      dataQualityStatus,
      predictedNextPrice: prediction && 'predictedPrice' in prediction ? prediction.predictedPrice : undefined,
      predictionConfidence: prediction && 'confidence' in prediction ? prediction.confidence : undefined,
      predictedLowDate: prediction && 'predictedLowDate' in prediction ? prediction.predictedLowDate : undefined,
      lastUpdated: new Date().toISOString()
    };

    // Store the trend
    priceStore.trends.set(key, trend);

    return trend;
  }

  /**
   * Calculate average price over a time period
   */
  private calculateAverage(prices: PriceRecord[], now: Date, days: number): number | null {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const relevantPrices = prices.filter(p => new Date(p.recordedDate) >= cutoff);

    if (relevantPrices.length === 0) return null;

    const sum = relevantPrices.reduce((acc, p) => acc + (p.pricePerUnit || p.price), 0);
    return sum / relevantPrices.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;

    return Math.sqrt(variance);
  }

  /**
   * Predict future price using linear regression
   * Only available for mature datasets (20+ data points)
   */
  async predictFuturePrice(componentId: string, storeId: string | null): Promise<PricePrediction | PricePredictionError> {
    const key = `${componentId}-${storeId || 'all'}`;
    const prices = priceStore.prices.get(key) || [];

    if (prices.length < DATA_QUALITY_THRESHOLDS.MATURE) {
      return {
        error: 'insufficient_data',
        message: `Need at least ${DATA_QUALITY_THRESHOLDS.MATURE} data points for prediction. Currently have ${prices.length}.`
      };
    }

    // Sort by date ascending for regression
    const sortedPrices = [...prices].sort((a, b) =>
      new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime()
    );

    // Convert dates to numeric values (days since first record)
    const firstDate = new Date(sortedPrices[0].recordedDate);
    const dataPoints = sortedPrices.map(p => ({
      x: Math.floor((new Date(p.recordedDate).getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)),
      y: p.pricePerUnit || p.price
    }));

    // Simple linear regression
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((a, p) => a + p.x, 0);
    const sumY = dataPoints.reduce((a, p) => a + p.y, 0);
    const sumXY = dataPoints.reduce((a, p) => a + p.x * p.y, 0);
    const sumX2 = dataPoints.reduce((a, p) => a + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict 30 days into the future
    const lastX = dataPoints[dataPoints.length - 1].x;
    const futureX = lastX + 30;
    const predictedPrice = intercept + slope * futureX;

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssTotal = dataPoints.reduce((a, p) => a + Math.pow(p.y - meanY, 2), 0);
    const ssResidual = dataPoints.reduce((a, p) => {
      const predicted = intercept + slope * p.x;
      return a + Math.pow(p.y - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));

    // Predict next low date based on historical patterns
    const deals = sortedPrices.filter(p => p.isDeal || p.isSalePrice);
    let predictedLowDate: string | null = null;

    if (deals.length >= 3) {
      // Calculate average days between deals
      const dealDates = deals.map(d => new Date(d.recordedDate).getTime());
      let totalGap = 0;
      for (let i = 1; i < dealDates.length; i++) {
        totalGap += dealDates[i] - dealDates[i - 1];
      }
      const avgGap = totalGap / (dealDates.length - 1);
      const lastDealDate = new Date(Math.max(...dealDates));
      predictedLowDate = new Date(lastDealDate.getTime() + avgGap).toISOString().split('T')[0];
    }

    return {
      predictedPrice: Math.max(0, Math.round(predictedPrice * 100) / 100),
      confidence: Math.round(confidence * 100) / 100,
      daysAhead: 30,
      slope: Math.round(slope * 10000) / 10000,
      trend: slope > 0.001 ? 'rising' : slope < -0.001 ? 'falling' : 'stable',
      predictedLowDate,
      dataPointsUsed: n
    };
  }

  /**
   * Get price history for a component
   */
  async getPriceHistory(componentId: string, options: {
    storeId?: string | null;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): Promise<PriceHistoryResponse> {
    const { storeId, startDate, endDate, limit = 100 } = options;

    const key = `${componentId}-${storeId || 'all'}`;
    let prices = priceStore.prices.get(key) || [];

    // If no store specified, get all prices for the component
    if (!storeId) {
      prices = [];
      for (const [k, v] of priceStore.prices.entries()) {
        if (k.startsWith(componentId)) {
          prices.push(...v);
        }
      }
    }

    // Filter by date range
    if (startDate) {
      prices = prices.filter(p => p.recordedDate >= startDate);
    }
    if (endDate) {
      prices = prices.filter(p => p.recordedDate <= endDate);
    }

    // Sort by date descending
    prices = prices.sort((a, b) =>
      new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()
    ).slice(0, limit);

    // Get trend data
    const trend = priceStore.trends.get(key);

    return {
      componentId,
      storeId: storeId || null,
      prices,
      trend,
      count: prices.length
    };
  }

  /**
   * Compare prices across stores for a component
   */
  async comparePricesAcrossStores(componentId: string): Promise<PriceComparisonResponse> {
    const storeComparisons: StoreComparison[] = [];

    for (const [key, prices] of priceStore.prices.entries()) {
      if (key.startsWith(componentId)) {
        const storeId = key.split('-')[1];
        const trend = priceStore.trends.get(key);

        if (prices.length > 0) {
          // Get latest price
          const sortedPrices = [...prices].sort((a, b) =>
            new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime()
          );
          const latestPrice = sortedPrices[0];

          storeComparisons.push({
            storeId: storeId === 'all' ? null : storeId,
            latestPrice: latestPrice.price,
            pricePerUnit: latestPrice.pricePerUnit,
            recordedDate: latestPrice.recordedDate,
            avg30Day: trend?.avg30Day ?? undefined,
            historicalLow: trend?.historicalLow,
            trendType: trend?.trendType,
            dataQuality: trend?.dataQualityStatus || 'insufficient',
            priceCount: prices.length
          });
        }
      }
    }

    // Sort by latest price ascending (cheapest first)
    storeComparisons.sort((a, b) => a.latestPrice - b.latestPrice);

    // Add recommendation
    let recommendation: PriceComparisonRecommendation | null = null;
    if (storeComparisons.length >= 2) {
      const cheapest = storeComparisons[0];
      const expensive = storeComparisons[storeComparisons.length - 1];
      const savings = expensive.latestPrice - cheapest.latestPrice;
      const savingsPercent = (savings / expensive.latestPrice) * 100;

      recommendation = {
        bestStore: cheapest.storeId,
        bestPrice: cheapest.latestPrice,
        worstPrice: expensive.latestPrice,
        potentialSavings: Math.round(savings * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
        message: `Shop at ${cheapest.storeId || 'the cheapest store'} to save $${Math.round(savings * 100) / 100} (${Math.round(savingsPercent)}%)`
      };
    }

    return {
      componentId,
      storeCount: storeComparisons.length,
      comparisons: storeComparisons,
      recommendation
    };
  }

  /**
   * Get trending prices (rising or falling significantly)
   */
  async getTrendingPrices(options: {
    trendType?: TrendType;
    minStrength?: number;
    limit?: number;
  } = {}): Promise<TrendingPricesResponse> {
    const { trendType, minStrength = 10, limit = 20 } = options;

    let trends = Array.from(priceStore.trends.values());

    // Filter by trend type
    if (trendType) {
      trends = trends.filter(t => t.trendType === trendType);
    } else {
      // Exclude stable and insufficient data by default
      trends = trends.filter(t =>
        t.trendType !== 'stable' &&
        t.trendType !== 'insufficient_data'
      );
    }

    // Filter by minimum strength
    trends = trends.filter(t => t.trendStrength >= minStrength);

    // Sort by strength descending
    trends = trends.sort((a, b) => b.trendStrength - a.trendStrength);

    return {
      trends: trends.slice(0, limit),
      count: trends.length,
      rising: trends.filter(t => t.trendType === 'rising').length,
      falling: trends.filter(t => t.trendType === 'falling').length,
      volatile: trends.filter(t => t.trendType === 'volatile').length
    };
  }

  /**
   * Get price drop alerts (items that dropped >20%)
   */
  async getPriceDropAlerts(_userId: string): Promise<PriceDropAlertsResponse> {
    const alerts: PriceDropAlert[] = [];

    for (const [_key, trend] of priceStore.trends.entries()) {
      if (trend.avg7Day && trend.avg30Day) {
        const dropPercent = ((trend.avg30Day - trend.avg7Day) / trend.avg30Day) * 100;

        if (dropPercent >= 20) {
          alerts.push({
            componentId: trend.componentId,
            storeId: trend.storeId,
            currentAvg: trend.avg7Day,
            previousAvg: trend.avg30Day,
            dropPercent: Math.round(dropPercent * 10) / 10,
            historicalLow: trend.historicalLow,
            isNearHistoricalLow: trend.avg7Day <= trend.historicalLow * 1.1,
            recommendation: dropPercent >= 30 ? 'excellent_time_to_buy' : 'good_time_to_buy'
          });
        }
      }
    }

    // Sort by drop percent descending
    alerts.sort((a, b) => b.dropPercent - a.dropPercent);

    return {
      alerts,
      count: alerts.length
    };
  }

  /**
   * Check and trigger price alerts for a user
   */
  private async checkPriceAlerts(componentId: string, storeId: string | null, price: number): Promise<AlertTrigger[]> {
    const alertsToTrigger: AlertTrigger[] = [];

    for (const [_id, alert] of priceStore.alerts.entries()) {
      if (alert.componentId !== componentId) continue;
      if (alert.storeId && alert.storeId !== storeId) continue;
      if (!alert.isActive) continue;

      let shouldTrigger = false;

      switch (alert.alertType) {
        case 'target_price':
          if (alert.targetPrice && price <= alert.targetPrice) shouldTrigger = true;
          break;
        case 'price_drop':
          const _key = `${componentId}-${storeId || 'all'}`;
          const trend = priceStore.trends.get(_key);
          if (trend?.avg30Day && alert.percentageDrop) {
            const dropPercent = ((trend.avg30Day - price) / trend.avg30Day) * 100;
            if (dropPercent >= alert.percentageDrop) shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        alertsToTrigger.push({
          alertId: alert.id,
          componentId,
          storeId,
          price,
          triggeredAt: new Date().toISOString()
        });

        // Update alert
        alert.lastTriggeredAt = new Date().toISOString();
        alert.triggerCount++;
      }
    }

    return alertsToTrigger;
  }

  /**
   * Get overall price tracking statistics
   */
  async getPriceStats(_userId: string): Promise<PriceStatsResponse> {
    let totalPrices = 0;
    const totalComponents = new Set<string>();
    const totalStores = new Set<string>();
    let matureDatasets = 0;
    let reliableDatasets = 0;
    let emergingDatasets = 0;
    let insufficientDatasets = 0;

    for (const [key, prices] of priceStore.prices.entries()) {
      const [componentId, storeId] = key.split('-');
      totalPrices += prices.length;
      totalComponents.add(componentId);
      if (storeId && storeId !== 'all') totalStores.add(storeId);

      if (prices.length >= DATA_QUALITY_THRESHOLDS.MATURE) matureDatasets++;
      else if (prices.length >= DATA_QUALITY_THRESHOLDS.RELIABLE) reliableDatasets++;
      else if (prices.length >= DATA_QUALITY_THRESHOLDS.EMERGING) emergingDatasets++;
      else insufficientDatasets++;
    }

    const trends = Array.from(priceStore.trends.values());

    return {
      totalPricePoints: totalPrices,
      componentsTracked: totalComponents.size,
      storesTracked: totalStores.size,
      datasets: {
        mature: matureDatasets,
        reliable: reliableDatasets,
        emerging: emergingDatasets,
        insufficient: insufficientDatasets,
        total: matureDatasets + reliableDatasets + emergingDatasets + insufficientDatasets
      },
      trends: {
        rising: trends.filter(t => t.trendType === 'rising').length,
        falling: trends.filter(t => t.trendType === 'falling').length,
        stable: trends.filter(t => t.trendType === 'stable').length,
        volatile: trends.filter(t => t.trendType === 'volatile').length
      },
      predictionsAvailable: matureDatasets
    };
  }
}

// Export singleton instance
export const priceIntelligenceService = new PriceIntelligenceService();
