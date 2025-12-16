/**
 * Analytics Routes
 * Endpoints for meal tracking analytics and insights
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import analyticsService from '../database/services/analyticsService';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard analytics summary
 * @access Private
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [patternStats, adherenceStats, weightTrend, todayNutrition] = await Promise.all([
    analyticsService.getPatternStats(req.user!.id, { startDate: weekAgo }),
    analyticsService.getAdherenceStats(req.user!.id, { startDate: weekAgo }),
    analyticsService.getWeightTrend(req.user!.id),
    analyticsService.getNutritionSummary(req.user!.id, today)
  ]);

  res.json({
    period: {
      start: weekAgo,
      end: today
    },
    patterns: patternStats,
    adherence: adherenceStats,
    weight: weightTrend,
    todayNutrition,
    insights: generateInsights(patternStats, adherenceStats, weightTrend)
  });
});

/**
 * @route GET /api/analytics/patterns
 * @desc Get pattern usage statistics
 * @access Private
 */
router.get('/patterns', async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const stats = await analyticsService.getPatternStats(req.user!.id, {
    startDate: startDate as string,
    endDate: endDate as string
  });

  // Calculate most successful pattern
  let bestPattern = null;
  let bestAdherence = 0;

  for (const [code, data] of Object.entries(stats)) {
    const patternData = data as any;
    if (patternData.adherenceRate > bestAdherence) {
      bestAdherence = patternData.adherenceRate;
      bestPattern = code;
    }
  }

  res.json({
    patterns: stats,
    recommendation: {
      bestPattern,
      reason: bestPattern ? `Highest adherence rate at ${Math.round(bestAdherence * 100)}%` : null
    }
  });
});

/**
 * @route GET /api/analytics/adherence
 * @desc Get meal adherence statistics
 * @access Private
 */
router.get('/adherence', async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;

  const stats = await analyticsService.getAdherenceStats(req.user!.id, {
    startDate: startDate as string,
    endDate: endDate as string
  });

  res.json({
    stats,
    interpretation: interpretAdherence(stats.adherenceRate)
  });
});

/**
 * @route GET /api/analytics/nutrition
 * @desc Get nutrition summary for a date
 * @access Private
 */
router.get('/nutrition', async (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

  const summary = await analyticsService.getNutritionSummary(req.user!.id, date);

  // Get user's targets (would come from user profile)
  const targets = {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 65
  };

  res.json({
    date,
    nutrition: summary,
    targets,
    progress: {
      calories: Math.round((summary.calories / targets.calories) * 100),
      protein: Math.round((summary.protein / targets.protein) * 100),
      carbs: Math.round((summary.carbs / targets.carbs) * 100),
      fat: Math.round((summary.fat / targets.fat) * 100)
    }
  });
});

/**
 * @route GET /api/analytics/weight
 * @desc Get weight trend data
 * @access Private
 */
router.get('/weight', async (req: Request, res: Response) => {
  const trend = await analyticsService.getWeightTrend(req.user!.id);

  res.json({
    ...trend,
    recommendation: getWeightRecommendation(trend)
  });
});

/**
 * @route GET /api/analytics/trends
 * @desc Get weekly nutrition trends
 * @access Private
 */
router.get('/trends', async (req: Request, res: Response) => {
  const weeks = parseInt(req.query.weeks as string) || 4;

  const trends = await analyticsService.getWeeklyTrends(req.user!.id, weeks);

  // Calculate average trends
  const avgCalories = trends.length > 0
    ? Math.round(trends.reduce((sum, t) => sum + t.avgCalories, 0) / trends.length)
    : 0;
  const avgAdherence = trends.length > 0
    ? trends.reduce((sum, t) => sum + t.adherenceRate, 0) / trends.length
    : 0;

  res.json({
    weeks: trends,
    summary: {
      avgCaloriesPerDay: avgCalories,
      avgAdherenceRate: Math.round(avgAdherence * 100),
      trend: calculateTrend(trends)
    }
  });
});

/**
 * @route GET /api/analytics/insights
 * @desc Get AI-generated insights
 * @access Private
 */
router.get('/insights', async (req: Request, res: Response) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [patternStats, adherenceStats, weightTrend, weeklyTrends] = await Promise.all([
    analyticsService.getPatternStats(req.user!.id, { startDate: weekAgo }),
    analyticsService.getAdherenceStats(req.user!.id, { startDate: weekAgo }),
    analyticsService.getWeightTrend(req.user!.id),
    analyticsService.getWeeklyTrends(req.user!.id, 4)
  ]);

  const insights = generateDetailedInsights(patternStats, adherenceStats, weightTrend, weeklyTrends);

  res.json({
    insights,
    generatedAt: new Date().toISOString()
  });
});

// Helper functions
function generateInsights(patternStats: any, adherenceStats: any, weightTrend: any): string[] {
  const insights: string[] = [];

  // Adherence insight
  if (adherenceStats.adherenceRate >= 0.8) {
    insights.push('Great job! You\'re maintaining excellent meal adherence.');
  } else if (adherenceStats.adherenceRate >= 0.6) {
    insights.push('Good progress on meal adherence. Try to reduce skipped meals.');
  } else {
    insights.push('Consider simplifying your meal plan to improve adherence.');
  }

  // Weight insight
  if (weightTrend.trend === 'decreasing' && weightTrend.target && weightTrend.current > weightTrend.target) {
    insights.push('You\'re making progress toward your weight goal!');
  } else if (weightTrend.trend === 'increasing') {
    insights.push('Weight trending up - review your calorie targets.');
  }

  // Pattern insight
  const patternCodes = Object.keys(patternStats);
  if (patternCodes.length > 3) {
    insights.push('You\'re experimenting with many patterns. Consider focusing on 2-3 that work best.');
  }

  return insights;
}

function interpretAdherence(rate: number): string {
  if (rate >= 0.9) return 'Excellent adherence - you\'re crushing it!';
  if (rate >= 0.75) return 'Good adherence - keep up the momentum.';
  if (rate >= 0.5) return 'Moderate adherence - room for improvement.';
  return 'Low adherence - consider adjusting your meal plan complexity.';
}

function getWeightRecommendation(trend: any): string {
  if (!trend.target) return 'Set a target weight to get personalized recommendations.';

  const diff = trend.current - trend.target;

  if (Math.abs(diff) < 1) return 'You\'re at or near your target weight!';
  if (diff > 0 && trend.trend === 'decreasing') return 'On track - continue your current approach.';
  if (diff > 0 && trend.trend !== 'decreasing') return 'Consider reducing daily calories by 200-300.';
  if (diff < 0 && trend.trend === 'increasing') return 'Good progress toward your goal.';

  return 'Maintain consistent eating patterns for best results.';
}

function calculateTrend(trends: any[]): string {
  if (trends.length < 2) return 'stable';

  const recent = trends[0]?.avgCalories || 0;
  const older = trends[trends.length - 1]?.avgCalories || 0;
  const diff = recent - older;

  if (diff > 100) return 'increasing';
  if (diff < -100) return 'decreasing';
  return 'stable';
}

function generateDetailedInsights(
  patternStats: any,
  adherenceStats: any,
  _weightTrend: any,
  weeklyTrends: any[]
): any[] {
  const insights: any[] = [];

  // Pattern variety insight
  const patternCount = Object.keys(patternStats).length;
  insights.push({
    category: 'patterns',
    title: 'Pattern Usage',
    message: patternCount === 0
      ? 'Start using eating patterns to get personalized insights.'
      : `You've used ${patternCount} different eating pattern${patternCount > 1 ? 's' : ''}.`,
    actionable: patternCount > 4 ? 'Consider focusing on your top 2-3 most successful patterns.' : null
  });

  // Adherence insight
  insights.push({
    category: 'adherence',
    title: 'Meal Adherence',
    message: `${Math.round(adherenceStats.adherenceRate * 100)}% of meals completed.`,
    actionable: adherenceStats.skippedMeals > 3
      ? 'You skipped several meals this week. Need simpler options?'
      : null
  });

  // Consistency insight
  if (weeklyTrends.length >= 2) {
    const variance = calculateVariance(weeklyTrends.map(t => t.avgCalories));
    insights.push({
      category: 'consistency',
      title: 'Calorie Consistency',
      message: variance < 150
        ? 'Very consistent calorie intake - great discipline!'
        : 'Calorie intake varies significantly week to week.',
      actionable: variance >= 150 ? 'Try to maintain more consistent portions.' : null
    });
  }

  return insights;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
}

export default router;
