/**
 * Analytics Routes
 * Endpoints for pattern analysis, weight tracking, and adherence metrics
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate, analyticsQuerySchema } = require('../validators');
const { analyticsService, patternService } = require('../services/dataStore');
const { PatternType } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

// All analytics routes require authentication
router.use(authenticate);

/**
 * @route GET /api/analytics/patterns
 * @desc Get pattern effectiveness analytics
 * @access Private
 */
router.get('/patterns', validate(analyticsQuerySchema, 'query'), (req, res) => {
  const { startDate, endDate, patternType, granularity } = req.query;

  const stats = analyticsService.getPatternStats(req.user.id, { startDate, endDate });

  // Filter by pattern type if specified
  let filteredStats = stats;
  if (patternType) {
    filteredStats = { [patternType]: stats[patternType] };
  }

  // Calculate overall metrics
  const overall = {
    totalDays: Object.values(filteredStats).reduce((sum, s) => sum + (s?.count || 0), 0),
    completedDays: Object.values(filteredStats).reduce((sum, s) => sum + (s?.completed || 0), 0),
    avgAdherence: 0,
    avgRating: 0
  };

  const adherenceValues = Object.values(filteredStats).filter(s => s?.adherenceRate).map(s => s.adherenceRate);
  const ratingValues = Object.values(filteredStats).filter(s => s?.avgRating).map(s => s.avgRating);

  if (adherenceValues.length > 0) {
    overall.avgAdherence = adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length;
  }
  if (ratingValues.length > 0) {
    overall.avgRating = ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length;
  }

  // Rank patterns by effectiveness
  const rankings = Object.entries(filteredStats)
    .filter(([_, s]) => s && s.count > 0)
    .map(([type, s]) => ({
      patternType: type,
      score: (s.adherenceRate * 0.6) + ((s.avgRating / 5) * 0.4),
      adherenceRate: s.adherenceRate,
      avgRating: s.avgRating,
      timesUsed: s.count
    }))
    .sort((a, b) => b.score - a.score);

  res.json({
    stats: filteredStats,
    overall,
    rankings,
    recommendations: generatePatternRecommendations(filteredStats, rankings),
    period: {
      startDate: startDate || 'all time',
      endDate: endDate || 'present',
      granularity
    }
  });
});

/**
 * @route GET /api/analytics/weight
 * @desc Get weight trend data
 * @access Private
 */
router.get('/weight', validate(analyticsQuerySchema, 'query'), (req, res) => {
  const { startDate, endDate, granularity } = req.query;

  const weightData = analyticsService.getWeightTrend(req.user.id, { startDate, endDate });

  // Calculate projections
  const weeklyChange = weightData.weeklyChange || 0;
  const weeksToGoal = weightData.target && weightData.current
    ? Math.abs((weightData.current - weightData.target) / weeklyChange)
    : null;

  res.json({
    current: weightData.current,
    target: weightData.target,
    trend: weightData.trend,
    weeklyChange,
    projection: {
      weeksToGoal: weeksToGoal ? Math.ceil(weeksToGoal) : null,
      estimatedGoalDate: weeksToGoal
        ? new Date(Date.now() + weeksToGoal * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null
    },
    dataPoints: weightData.dataPoints,
    insights: generateWeightInsights(weightData)
  });
});

/**
 * @route GET /api/analytics/adherence
 * @desc Get pattern adherence rates
 * @access Private
 */
router.get('/adherence', validate(analyticsQuerySchema, 'query'), (req, res) => {
  const { startDate, endDate, patternType, granularity } = req.query;

  const adherenceStats = analyticsService.getAdherenceStats(req.user.id, { startDate, endDate });

  // Get detailed pattern adherence
  const patterns = patternService.findByUser(req.user.id, { startDate, endDate });

  // Calculate adherence by day of week
  const byDayOfWeek = calculateAdherenceByDayOfWeek(patterns);

  // Calculate adherence by meal
  const byMeal = calculateAdherenceByMeal(patterns);

  // Calculate streaks
  const streaks = calculateStreaks(patterns);

  res.json({
    overall: adherenceStats,
    byDayOfWeek,
    byMeal,
    streaks,
    insights: generateAdherenceInsights(adherenceStats, byDayOfWeek, streaks)
  });
});

/**
 * @route GET /api/analytics/summary
 * @desc Get overall analytics summary
 * @access Private
 */
router.get('/summary', (req, res) => {
  const { days = 30 } = req.query;

  const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const patternStats = analyticsService.getPatternStats(req.user.id, { startDate });
  const adherenceStats = analyticsService.getAdherenceStats(req.user.id, { startDate });
  const weightData = analyticsService.getWeightTrend(req.user.id, { startDate });

  // Most used pattern
  let mostUsedPattern = null;
  let maxCount = 0;
  for (const [type, stats] of Object.entries(patternStats)) {
    if (stats.count > maxCount) {
      maxCount = stats.count;
      mostUsedPattern = type;
    }
  }

  res.json({
    period: {
      days: parseInt(days),
      startDate,
      endDate: new Date().toISOString().split('T')[0]
    },
    summary: {
      totalMeals: adherenceStats.totalMeals,
      completedMeals: adherenceStats.completedMeals,
      adherenceRate: Math.round(adherenceStats.adherenceRate * 100),
      mostUsedPattern,
      weightChange: weightData.weeklyChange * (parseInt(days) / 7)
    },
    quickStats: {
      avgCaloriesPerDay: calculateAvgCalories(patternStats),
      avgProteinPerDay: calculateAvgProtein(patternStats),
      mealsSkipped: adherenceStats.skippedMeals,
      daysTracked: Object.values(patternStats).reduce((sum, s) => sum + (s?.count || 0), 0)
    }
  });
});

/**
 * @route GET /api/analytics/trends
 * @desc Get trend analysis over time
 * @access Private
 */
router.get('/trends', validate(analyticsQuerySchema, 'query'), (req, res) => {
  const { startDate, endDate, granularity = 'week' } = req.query;

  const patterns = patternService.findByUser(req.user.id, { startDate, endDate });

  // Group by time period
  const trends = calculateTrends(patterns, granularity);

  res.json({
    granularity,
    trends,
    analysis: {
      improving: trends.length > 1 && trends[trends.length - 1]?.adherence > trends[0]?.adherence,
      consistentPatterns: findConsistentPatterns(patterns),
      suggestions: generateTrendSuggestions(trends)
    }
  });
});

// Helper functions

function generatePatternRecommendations(stats, rankings) {
  const recommendations = [];

  if (rankings.length > 0) {
    const best = rankings[0];
    if (best.adherenceRate > 0.8) {
      recommendations.push({
        type: 'success',
        message: `${best.patternType} pattern is working well with ${Math.round(best.adherenceRate * 100)}% adherence`
      });
    }

    if (rankings.length > 1) {
      const worst = rankings[rankings.length - 1];
      if (worst.adherenceRate < 0.5) {
        recommendations.push({
          type: 'improvement',
          message: `Consider alternatives to ${worst.patternType} pattern (${Math.round(worst.adherenceRate * 100)}% adherence)`
        });
      }
    }
  }

  return recommendations;
}

function generateWeightInsights(weightData) {
  const insights = [];

  if (weightData.trend === 'decreasing' && weightData.weeklyChange < 0) {
    const weeklyLoss = Math.abs(weightData.weeklyChange);
    if (weeklyLoss >= 1 && weeklyLoss <= 2) {
      insights.push({
        type: 'success',
        message: 'Healthy weight loss rate of 1-2 lbs per week'
      });
    } else if (weeklyLoss > 2) {
      insights.push({
        type: 'warning',
        message: 'Weight loss may be too rapid. Consider increasing calories slightly.'
      });
    }
  }

  return insights;
}

function generateAdherenceInsights(stats, byDayOfWeek, streaks) {
  const insights = [];

  // Find best/worst days
  const sortedDays = Object.entries(byDayOfWeek)
    .sort((a, b) => b[1].adherence - a[1].adherence);

  if (sortedDays.length > 0) {
    const bestDay = sortedDays[0];
    const worstDay = sortedDays[sortedDays.length - 1];

    if (bestDay[1].adherence > worstDay[1].adherence + 0.2) {
      insights.push({
        type: 'pattern',
        message: `Adherence is highest on ${bestDay[0]} (${Math.round(bestDay[1].adherence * 100)}%) and lowest on ${worstDay[0]} (${Math.round(worstDay[1].adherence * 100)}%)`
      });
    }
  }

  if (streaks.current > 3) {
    insights.push({
      type: 'motivation',
      message: `Great job! You're on a ${streaks.current}-day streak!`
    });
  }

  return insights;
}

function calculateAdherenceByDayOfWeek(patterns) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const stats = {};

  for (const day of days) {
    stats[day] = { total: 0, completed: 0, adherence: 0 };
  }

  for (const pattern of patterns) {
    const date = new Date(pattern.date);
    const dayName = days[date.getDay()];

    pattern.meals.forEach(meal => {
      stats[dayName].total++;
      if (meal.status === 'completed') {
        stats[dayName].completed++;
      }
    });
  }

  for (const day of days) {
    if (stats[day].total > 0) {
      stats[day].adherence = stats[day].completed / stats[day].total;
    }
  }

  return stats;
}

function calculateAdherenceByMeal(patterns) {
  const mealStats = {};

  for (const pattern of patterns) {
    for (const meal of pattern.meals) {
      if (!mealStats[meal.name]) {
        mealStats[meal.name] = { total: 0, completed: 0, adherence: 0 };
      }

      mealStats[meal.name].total++;
      if (meal.status === 'completed') {
        mealStats[meal.name].completed++;
      }
    }
  }

  for (const name in mealStats) {
    if (mealStats[name].total > 0) {
      mealStats[name].adherence = mealStats[name].completed / mealStats[name].total;
    }
  }

  return mealStats;
}

function calculateStreaks(patterns) {
  const sortedPatterns = [...patterns].sort((a, b) => a.date.localeCompare(b.date));

  let current = 0;
  let longest = 0;
  let tempStreak = 0;

  for (const pattern of sortedPatterns) {
    const allComplete = pattern.meals.every(m => m.status === 'completed');

    if (allComplete) {
      tempStreak++;
      longest = Math.max(longest, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Check if streak is current
  if (sortedPatterns.length > 0) {
    const lastPattern = sortedPatterns[sortedPatterns.length - 1];
    const today = new Date().toISOString().split('T')[0];

    if (lastPattern.date === today ||
        new Date(lastPattern.date).getTime() === new Date(today).getTime() - 24 * 60 * 60 * 1000) {
      current = tempStreak;
    }
  }

  return { current, longest };
}

function calculateTrends(patterns, granularity) {
  // Group patterns by time period
  const groups = {};

  for (const pattern of patterns) {
    const date = new Date(pattern.date);
    let key;

    if (granularity === 'day') {
      key = pattern.date;
    } else if (granularity === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!groups[key]) {
      groups[key] = { total: 0, completed: 0, patterns: [] };
    }

    groups[key].patterns.push(pattern);
    pattern.meals.forEach(m => {
      groups[key].total++;
      if (m.status === 'completed') groups[key].completed++;
    });
  }

  return Object.entries(groups)
    .map(([period, data]) => ({
      period,
      adherence: data.total > 0 ? data.completed / data.total : 0,
      mealsCompleted: data.completed,
      mealsTotal: data.total,
      daysTracked: data.patterns.length
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function findConsistentPatterns(patterns) {
  const patternCounts = {};

  for (const pattern of patterns) {
    const key = pattern.patternType;
    if (!patternCounts[key]) {
      patternCounts[key] = 0;
    }
    patternCounts[key]++;
  }

  return Object.entries(patternCounts)
    .filter(([_, count]) => count >= 3)
    .map(([type, count]) => ({ type, count }));
}

function generateTrendSuggestions(trends) {
  const suggestions = [];

  if (trends.length >= 2) {
    const recent = trends.slice(-2);
    if (recent[1].adherence < recent[0].adherence) {
      suggestions.push('Adherence decreased recently. Consider simplifying meal prep.');
    }
    if (recent[1].adherence > recent[0].adherence) {
      suggestions.push('Great improvement! Keep up the momentum.');
    }
  }

  return suggestions;
}

function calculateAvgCalories(patternStats) {
  let totalCalories = 0;
  let days = 0;

  for (const stats of Object.values(patternStats)) {
    if (stats?.totalCalories) {
      totalCalories += stats.totalCalories;
      days += stats.completed || 0;
    }
  }

  return days > 0 ? Math.round(totalCalories / days) : 0;
}

function calculateAvgProtein(patternStats) {
  let totalProtein = 0;
  let days = 0;

  for (const stats of Object.values(patternStats)) {
    if (stats?.totalProtein) {
      totalProtein += stats.totalProtein;
      days += stats.completed || 0;
    }
  }

  return days > 0 ? Math.round(totalProtein / days) : 0;
}

module.exports = router;
