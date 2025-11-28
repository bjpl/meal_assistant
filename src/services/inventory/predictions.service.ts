/**
 * Predictive Analytics Service
 * ML-based usage prediction, depletion forecasting, and shopping list optimization
 */

import {
  InventoryItem,
  UsagePrediction,
  ShoppingListItem
} from '../../types/inventory.types';
import { inventoryTrackingService } from './tracking.service';

/**
 * Simple Linear Regression implementation
 * Used for predicting usage rates and depletion dates
 */
class LinearRegression {
  private slope: number = 0;
  private intercept: number = 0;
  private rSquared: number = 0;

  /**
   * Fit the model to data points
   * @param x Independent variable (e.g., days)
   * @param y Dependent variable (e.g., quantity consumed)
   */
  public fit(x: number[], y: number[]): void {
    if (x.length !== y.length || x.length < 2) {
      this.slope = 0;
      this.intercept = y.length > 0 ? y[0] : 0;
      this.rSquared = 0;
      return;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    // Calculate slope and intercept
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      this.slope = 0;
      this.intercept = sumY / n;
    } else {
      this.slope = (n * sumXY - sumX * sumY) / denominator;
      this.intercept = (sumY - this.slope * sumX) / n;
    }

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTot = y.reduce((total, yi) => total + (yi - yMean) ** 2, 0);
    const ssRes = y.reduce((total, yi, i) => {
      const predicted = this.predict(x[i]);
      return total + (yi - predicted) ** 2;
    }, 0);

    this.rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  /**
   * Predict y value for given x
   */
  public predict(x: number): number {
    return this.slope * x + this.intercept;
  }

  /**
   * Get the slope (rate of change)
   */
  public getSlope(): number {
    return this.slope;
  }

  /**
   * Get confidence score (R-squared)
   */
  public getConfidence(): number {
    return Math.max(0, Math.min(1, this.rSquared));
  }
}

/**
 * Exponential Smoothing for short-term predictions
 */
class ExponentialSmoothing {
  private alpha: number;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha;
  }

  /**
   * Forecast next value based on historical data
   */
  public forecast(data: number[]): number {
    if (data.length === 0) return 0;
    if (data.length === 1) return data[0];

    let smoothed = data[0];
    for (let i = 1; i < data.length; i++) {
      smoothed = this.alpha * data[i] + (1 - this.alpha) * smoothed;
    }
    return smoothed;
  }
}

/**
 * PredictiveAnalyticsService class
 * Handles usage prediction and shopping list generation
 */
export class PredictiveAnalyticsService {
  private usageHistory: Map<string, { date: Date; quantity: number }[]> = new Map();
  private reorderLeadDays: number = 3; // Days before depletion to suggest reorder

  constructor() {
    this.loadUsageHistory();
    this.buildUsageHistory();
  }

  /**
   * Load usage history from storage
   */
  private loadUsageHistory(): void {
    try {
      const stored = localStorage.getItem('meal_assistant_usage_history');
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([itemId, history]) => {
          this.usageHistory.set(itemId, (history as { date: string; quantity: number }[]).map(h => ({
            date: new Date(h.date),
            quantity: h.quantity
          })));
        });
      }
    } catch (error) {
      console.error('Failed to load usage history:', error);
    }
  }

  /**
   * Save usage history to storage
   */
  private saveUsageHistory(): void {
    try {
      const data: Record<string, { date: string; quantity: number }[]> = {};
      this.usageHistory.forEach((history, itemId) => {
        data[itemId] = history.slice(-60).map(h => ({ // Keep last 60 data points
          date: h.date.toISOString(),
          quantity: h.quantity
        }));
      });
      localStorage.setItem('meal_assistant_usage_history', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save usage history:', error);
    }
  }

  /**
   * Build usage history from transactions
   */
  private buildUsageHistory(): void {
    const items = inventoryTrackingService.getItems();

    items.forEach(item => {
      const transactions = inventoryTrackingService.getItemTransactions(item.id);
      const usagePoints: { date: Date; quantity: number }[] = [];

      // Track cumulative usage from remove transactions
      transactions
        .filter(t => t.type === 'remove' || (t.type === 'adjust' && t.newQuantity < t.previousQuantity))
        .forEach(t => {
          usagePoints.push({
            date: new Date(t.timestamp),
            quantity: t.quantity
          });
        });

      if (usagePoints.length > 0) {
        const existing = this.usageHistory.get(item.id) || [];
        // Merge without duplicates (by date)
        const merged = [...existing];
        usagePoints.forEach(point => {
          if (!merged.some(m => m.date.getTime() === point.date.getTime())) {
            merged.push(point);
          }
        });
        this.usageHistory.set(item.id, merged.sort((a, b) => a.date.getTime() - b.date.getTime()));
      }
    });

    this.saveUsageHistory();
  }

  /**
   * Record usage event for an item
   */
  public recordUsage(itemId: string, quantity: number): void {
    const history = this.usageHistory.get(itemId) || [];
    history.push({ date: new Date(), quantity });
    this.usageHistory.set(itemId, history);
    this.saveUsageHistory();
  }

  /**
   * Predict usage for a specific item
   */
  public predictUsage(itemId: string): UsagePrediction | null {
    const item = inventoryTrackingService.getItem(itemId);
    if (!item) return null;

    const history = this.usageHistory.get(itemId) || [];

    let dailyUsageRate: number;
    let confidenceScore: number;

    if (history.length < 3) {
      // Not enough data - use default or item's stored rate
      dailyUsageRate = item.avgUsageRate || 0.1; // Default to slow consumption
      confidenceScore = 0.2; // Low confidence
    } else {
      // Use linear regression on cumulative usage
      const regression = new LinearRegression();
      const startDate = history[0].date.getTime();

      const x = history.map(h => (h.date.getTime() - startDate) / (1000 * 60 * 60 * 24));
      const y = history.map((_, i) =>
        history.slice(0, i + 1).reduce((sum, h) => sum + h.quantity, 0)
      );

      regression.fit(x, y);
      dailyUsageRate = Math.abs(regression.getSlope());
      confidenceScore = regression.getConfidence();

      // Also use exponential smoothing for recent trends
      const recentUsage = history.slice(-7).map(h => h.quantity);
      if (recentUsage.length > 0) {
        const smoother = new ExponentialSmoothing(0.3);
        const smoothedDailyUsage = smoother.forecast(recentUsage);

        // Blend regression and smoothing based on data availability
        const blendFactor = Math.min(1, history.length / 14);
        dailyUsageRate = dailyUsageRate * blendFactor + smoothedDailyUsage * (1 - blendFactor);
      }
    }

    // Ensure positive usage rate
    dailyUsageRate = Math.max(0.01, dailyUsageRate);

    // Calculate predictions
    const daysUntilDepletion = item.quantity / dailyUsageRate;
    const predictedDepletionDate = new Date();
    predictedDepletionDate.setDate(predictedDepletionDate.getDate() + Math.ceil(daysUntilDepletion));

    const suggestedReorderDate = new Date(predictedDepletionDate);
    suggestedReorderDate.setDate(suggestedReorderDate.getDate() - this.reorderLeadDays);

    // Calculate suggested reorder quantity based on weekly usage
    const weeklyUsageRate = dailyUsageRate * 7;
    const suggestedReorderQuantity = Math.ceil(weeklyUsageRate * 2); // 2 weeks supply

    return {
      itemId,
      currentQuantity: item.quantity,
      predictedDepletionDate,
      confidenceScore,
      dailyUsageRate,
      weeklyUsageRate,
      suggestedReorderDate,
      suggestedReorderQuantity,
      historicalDataPoints: history.length
    };
  }

  /**
   * Predict usage for all items
   */
  public predictAllUsage(): UsagePrediction[] {
    const items = inventoryTrackingService.getItems();
    return items
      .map(item => this.predictUsage(item.id))
      .filter((p): p is UsagePrediction => p !== null)
      .sort((a, b) =>
        a.predictedDepletionDate.getTime() - b.predictedDepletionDate.getTime()
      );
  }

  /**
   * Generate smart shopping list based on predictions
   */
  public generateShoppingList(): ShoppingListItem[] {
    const predictions = this.predictAllUsage();
    const items = inventoryTrackingService.getItems();
    const shoppingList: ShoppingListItem[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    predictions.forEach(prediction => {
      const item = items.find(i => i.id === prediction.itemId);
      if (!item) return;

      let priority: ShoppingListItem['priority'] = 'low';
      let reason: ShoppingListItem['reason'] = 'predicted_depletion';

      // Determine priority based on depletion timeline
      if (prediction.predictedDepletionDate <= now) {
        priority = 'urgent';
        reason = 'depleted';
      } else if (prediction.predictedDepletionDate <= new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)) {
        priority = 'high';
        reason = 'low_stock';
      } else if (prediction.predictedDepletionDate <= sevenDaysFromNow) {
        priority = 'medium';
      }

      // Check if item is expiring soon (different from depleting)
      const daysUntilExpiry = Math.floor(
        (item.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 2 && item.quantity > 0) {
        // Item expiring but still has quantity - might need replacement
        if (priority === 'low') {
          priority = 'medium';
          reason = 'expiring';
        }
      }

      // Only add if predicted to deplete within 2 weeks or already low
      if (priority !== 'low' || prediction.predictedDepletionDate <= new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)) {
        shoppingList.push({
          itemId: item.id,
          name: item.name,
          suggestedQuantity: prediction.suggestedReorderQuantity,
          unit: item.unit,
          priority,
          reason,
          estimatedCost: item.costPerUnit * prediction.suggestedReorderQuantity,
          addedAt: now
        });
      }
    });

    // Sort by priority (urgent first) then by name
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return shoppingList.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return priorityDiff !== 0 ? priorityDiff : a.name.localeCompare(b.name);
    });
  }

  /**
   * Optimize bulk buying recommendations
   */
  public getBulkBuyingRecommendations(): {
    item: InventoryItem;
    recommendation: string;
    potentialSavings: number;
    suggestedQuantity: number;
  }[] {
    const predictions = this.predictAllUsage();
    const items = inventoryTrackingService.getItems();
    const recommendations: {
      item: InventoryItem;
      recommendation: string;
      potentialSavings: number;
      suggestedQuantity: number;
    }[] = [];

    predictions.forEach(prediction => {
      const item = items.find(i => i.id === prediction.itemId);
      if (!item || prediction.confidenceScore < 0.5) return;

      // Calculate monthly usage
      const monthlyUsage = prediction.dailyUsageRate * 30;

      // Only recommend bulk buying for high-usage items with good confidence
      if (monthlyUsage > 10 && prediction.confidenceScore > 0.6) {
        // Assume 20% savings on bulk purchase
        const bulkQuantity = Math.ceil(monthlyUsage * 2); // 2 months supply
        const regularCost = bulkQuantity * item.costPerUnit;
        const bulkCost = regularCost * 0.8;
        const savings = regularCost - bulkCost;

        if (savings > 5) { // Only if savings > $5
          recommendations.push({
            item,
            recommendation: `Consider bulk buying ${bulkQuantity} ${item.unit} of ${item.name}`,
            potentialSavings: savings,
            suggestedQuantity: bulkQuantity
          });
        }
      }
    });

    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Get items that need to be added to shopping list soon
   */
  public getUpcomingDepletions(withinDays: number = 7): UsagePrediction[] {
    const predictions = this.predictAllUsage();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    return predictions.filter(p => p.predictedDepletionDate <= cutoff);
  }

  /**
   * Update item's average usage rate based on prediction
   */
  public updateItemUsageRate(itemId: string): void {
    const prediction = this.predictUsage(itemId);
    if (!prediction || prediction.confidenceScore < 0.3) return;

    inventoryTrackingService.updateItem(itemId, {
      avgUsageRate: prediction.dailyUsageRate
    });
  }

  /**
   * Get usage trend for an item
   */
  public getUsageTrend(itemId: string): {
    trend: 'increasing' | 'decreasing' | 'stable';
    percentageChange: number;
  } {
    const history = this.usageHistory.get(itemId) || [];

    if (history.length < 7) {
      return { trend: 'stable', percentageChange: 0 };
    }

    // Compare recent week to previous week
    const lastWeek = history.slice(-7).reduce((sum, h) => sum + h.quantity, 0);
    const previousWeek = history.slice(-14, -7).reduce((sum, h) => sum + h.quantity, 0);

    if (previousWeek === 0) {
      return { trend: 'stable', percentageChange: 0 };
    }

    const percentageChange = ((lastWeek - previousWeek) / previousWeek) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (percentageChange > 15) {
      trend = 'increasing';
    } else if (percentageChange < -15) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { trend, percentageChange };
  }

  /**
   * Get prediction accuracy statistics
   */
  public getPredictionStats(): {
    averageConfidence: number;
    itemsWithPredictions: number;
    highConfidenceItems: number;
    lowConfidenceItems: number;
  } {
    const predictions = this.predictAllUsage();

    if (predictions.length === 0) {
      return {
        averageConfidence: 0,
        itemsWithPredictions: 0,
        highConfidenceItems: 0,
        lowConfidenceItems: 0
      };
    }

    const totalConfidence = predictions.reduce((sum, p) => sum + p.confidenceScore, 0);
    const highConfidence = predictions.filter(p => p.confidenceScore >= 0.7).length;
    const lowConfidence = predictions.filter(p => p.confidenceScore < 0.3).length;

    return {
      averageConfidence: totalConfidence / predictions.length,
      itemsWithPredictions: predictions.length,
      highConfidenceItems: highConfidence,
      lowConfidenceItems: lowConfidence
    };
  }

  /**
   * Clear prediction data (for testing)
   */
  public clearPredictionData(): void {
    this.usageHistory.clear();
    localStorage.removeItem('meal_assistant_usage_history');
  }

  /**
   * Set reorder lead time
   */
  public setReorderLeadDays(days: number): void {
    this.reorderLeadDays = Math.max(1, Math.min(14, days));
  }
}

// Export singleton instance
export const predictiveAnalyticsService = new PredictiveAnalyticsService();
