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

const { v4: uuidv4 } = require('uuid');

/**
 * Data quality thresholds
 */
const DATA_QUALITY_THRESHOLDS = {
  INSUFFICIENT: 5,   // < 5 data points
  EMERGING: 10,      // 5-10 data points
  RELIABLE: 20,      // 10-20 data points
  MATURE: 20         // 20+ data points (enables predictions)
};

/**
 * Trend detection thresholds
 */
const TREND_THRESHOLDS = {
  RISING: 0.05,      // 5% increase over period
  FALLING: -0.05,    // 5% decrease over period
  VOLATILE: 0.15     // 15% standard deviation threshold
};

/**
 * In-memory storage for price intelligence data
 * In production, replace with database operations
 */
const priceStore = {
  prices: new Map(),       // component_prices
  trends: new Map(),       // price_trends
  alerts: new Map(),       // price_alerts
  dealCycles: new Map()    // deal_cycles
};

class PriceIntelligenceService {
  /**
   * Capture a new price point
   * @param {string} componentId - Component being priced
   * @param {string} storeId - Store where price was found
   * @param {number} price - Price value
   * @param {string} source - Source of price (ad/receipt/manual/api)
   * @param {Object} options - Additional options
   * @returns {Object} Created price record with quality status
   */
  async capturePrice(componentId, storeId, price, source, options = {}) {
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
    let savingsAmount = null;
    if (isDeal && originalPrice && originalPrice > price) {
      savingsAmount = originalPrice - price;
    }

    // Get current data quality status
    const dataQuality = await this.getDataQualityStatus(componentId, storeId);

    const priceRecord = {
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
    priceStore.prices.get(key).push(priceRecord);

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
   * @param {string} componentId
   * @param {string} storeId
   * @returns {Object} Quality status with count and message
   */
  async getDataQualityStatus(componentId, storeId) {
    const key = `${componentId}-${storeId || 'all'}`;
    const prices = priceStore.prices.get(key) || [];
    const count = prices.length;

    let status, message, needsMore;

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
   * @param {string} componentId
   * @param {string} storeId
   * @returns {Object} Calculated trends
   */
  async calculateTrends(componentId, storeId) {
    const key = `${componentId}-${storeId || 'all'}`;
    const prices = priceStore.prices.get(key) || [];

    if (prices.length < DATA_QUALITY_THRESHOLDS.INSUFFICIENT) {
      return {
        trendType: 'insufficient_data',
        message: 'Not enough data points for trend analysis'
      };
    }

    // Sort by date descending
    const sortedPrices = [...prices].sort((a, b) =>
      new Date(b.recordedDate) - new Date(a.recordedDate)
    );

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

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
    let trendType = 'stable';
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
    let prediction = null;
    if (prices.length >= DATA_QUALITY_THRESHOLDS.MATURE) {
      prediction = await this.predictFuturePrice(componentId, storeId);
    }

    const trend = {
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
      dataQualityStatus: prices.length >= DATA_QUALITY_THRESHOLDS.MATURE ? 'mature' :
                          prices.length >= DATA_QUALITY_THRESHOLDS.RELIABLE ? 'reliable' :
                          prices.length >= DATA_QUALITY_THRESHOLDS.EMERGING ? 'emerging' : 'insufficient',
      predictedNextPrice: prediction?.predictedPrice,
      predictionConfidence: prediction?.confidence,
      predictedLowDate: prediction?.predictedLowDate,
      lastUpdated: new Date().toISOString()
    };

    // Store the trend
    priceStore.trends.set(key, trend);

    return trend;
  }

  /**
   * Calculate average price over a time period
   * @private
   */
  calculateAverage(prices, now, days) {
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
    const relevantPrices = prices.filter(p => new Date(p.recordedDate) >= cutoff);

    if (relevantPrices.length === 0) return null;

    const sum = relevantPrices.reduce((acc, p) => acc + (p.pricePerUnit || p.price), 0);
    return sum / relevantPrices.length;
  }

  /**
   * Calculate standard deviation
   * @private
   */
  calculateStdDev(prices) {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;

    return Math.sqrt(variance);
  }

  /**
   * Predict future price using linear regression
   * Only available for mature datasets (20+ data points)
   * @param {string} componentId
   * @param {string} storeId
   * @returns {Object} Prediction with confidence interval
   */
  async predictFuturePrice(componentId, storeId) {
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
      new Date(a.recordedDate) - new Date(b.recordedDate)
    );

    // Convert dates to numeric values (days since first record)
    const firstDate = new Date(sortedPrices[0].recordedDate);
    const dataPoints = sortedPrices.map(p => ({
      x: Math.floor((new Date(p.recordedDate) - firstDate) / (24 * 60 * 60 * 1000)),
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
    let predictedLowDate = null;

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
      slope: Math.round(slope * 10000) / 10000, // Price change per day
      trend: slope > 0.001 ? 'rising' : slope < -0.001 ? 'falling' : 'stable',
      predictedLowDate,
      dataPointsUsed: n
    };
  }

  /**
   * Get price history for a component
   * @param {string} componentId
   * @param {Object} options - Filter options
   * @returns {Array} Price history with trends
   */
  async getPriceHistory(componentId, options = {}) {
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
      new Date(b.recordedDate) - new Date(a.recordedDate)
    ).slice(0, limit);

    // Get trend data
    const trend = priceStore.trends.get(key);

    return {
      componentId,
      storeId,
      prices,
      trend,
      count: prices.length
    };
  }

  /**
   * Compare prices across stores for a component
   * @param {string} componentId
   * @returns {Object} Store comparison with recommendations
   */
  async comparePricesAcrossStores(componentId) {
    const storeComparisons = [];

    for (const [key, prices] of priceStore.prices.entries()) {
      if (key.startsWith(componentId)) {
        const storeId = key.split('-')[1];
        const trend = priceStore.trends.get(key);

        if (prices.length > 0) {
          // Get latest price
          const sortedPrices = [...prices].sort((a, b) =>
            new Date(b.recordedDate) - new Date(a.recordedDate)
          );
          const latestPrice = sortedPrices[0];

          storeComparisons.push({
            storeId: storeId === 'all' ? null : storeId,
            latestPrice: latestPrice.price,
            pricePerUnit: latestPrice.pricePerUnit,
            recordedDate: latestPrice.recordedDate,
            avg30Day: trend?.avg30Day,
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
    let recommendation = null;
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
   * @param {Object} options - Filter options
   * @returns {Array} Trending items
   */
  async getTrendingPrices(options = {}) {
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
   * @param {string} userId
   * @returns {Array} Price drop alerts
   */
  async getPriceDropAlerts(userId) {
    const alerts = [];

    for (const [key, trend] of priceStore.trends.entries()) {
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
   * @private
   */
  async checkPriceAlerts(componentId, storeId, price) {
    const alertsToTrigger = [];

    for (const [id, alert] of priceStore.alerts.entries()) {
      if (alert.componentId !== componentId) continue;
      if (alert.storeId && alert.storeId !== storeId) continue;
      if (!alert.isActive) continue;

      let shouldTrigger = false;

      switch (alert.alertType) {
        case 'target_price':
          if (price <= alert.targetPrice) shouldTrigger = true;
          break;
        case 'price_drop':
          const key = `${componentId}-${storeId || 'all'}`;
          const trend = priceStore.trends.get(key);
          if (trend?.avg30Day) {
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
   * @param {string} userId
   * @returns {Object} Statistics summary
   */
  async getPriceStats(userId) {
    let totalPrices = 0;
    let totalComponents = new Set();
    let totalStores = new Set();
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
const priceIntelligenceService = new PriceIntelligenceService();

module.exports = {
  PriceIntelligenceService,
  priceIntelligenceService,
  DATA_QUALITY_THRESHOLDS,
  TREND_THRESHOLDS
};
