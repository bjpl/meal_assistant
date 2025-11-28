/**
 * Hydration & Caffeine Routes
 * Week 1-2 Option B Implementation
 *
 * Endpoints for tracking water intake, caffeine consumption, and hydration goals
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  validate,
  hydrationLogSchema,
  caffeineLogSchema,
  hydrationGoalsUpdateSchema,
  hydrationTrendsQuerySchema
} = require('../validators');
const { hydrationService, caffeineService, userService } = require('../services/dataStore');
const { ApiError } = require('../middleware/errorHandler');

// All hydration routes require authentication
router.use(authenticate);

// =============================================================================
// CAFFEINE ENDPOINTS (must be defined BEFORE generic /:id route)
// =============================================================================

/**
 * @route POST /api/hydration/caffeine/log
 * @desc Log caffeinated beverage intake
 * @access Private
 *
 * Body:
 *   - beverage_type: 'coffee' | 'tea' | 'soda' | 'energy_drink' | 'other' (required)
 *   - volume_oz: number (required, 1-64)
 *   - caffeine_mg: number (optional, auto-calculated if not provided)
 *     * coffee: 95mg per 8oz
 *     * tea: 47mg per 8oz
 *     * soda: 30mg per 8oz
 *     * energy_drink: 80mg per 8oz
 *   - timestamp: ISO date string (optional)
 *   - notes: string (optional)
 */
router.post('/caffeine/log', validate(caffeineLogSchema), (req, res) => {
  const entry = caffeineService.log(req.user.id, req.body);
  const progress = caffeineService.getTodayProgress(req.user.id);

  // Check if user is approaching or over limit
  let warning = null;
  if (progress.over_limit) {
    warning = {
      type: 'over_limit',
      message: `You have exceeded your daily caffeine limit of ${progress.limit_mg}mg`
    };
  } else if (progress.percentage >= 80) {
    warning = {
      type: 'approaching_limit',
      message: `You are at ${progress.percentage}% of your daily caffeine limit`
    };
  }

  res.status(201).json({
    message: 'Caffeine logged successfully',
    entry: {
      id: entry.id,
      beverage_type: entry.beverageType,
      volume_oz: entry.volumeOz,
      caffeine_mg: entry.caffeineMg,
      logged_at: entry.loggedAt,
      notes: entry.notes
    },
    daily_progress: progress,
    warning
  });
});

/**
 * @route GET /api/hydration/caffeine/today
 * @desc Get today's caffeine consumption
 * @access Private
 *
 * Returns:
 *   - total_mg: number
 *   - limit_mg: number (default 400)
 *   - percentage: number (0-100)
 *   - remaining_mg: number
 *   - over_limit: boolean
 *   - entries: array of today's caffeine logs
 */
router.get('/caffeine/today', (req, res) => {
  const progress = caffeineService.getTodayProgress(req.user.id);

  res.json({
    date: new Date().toISOString().split('T')[0],
    ...progress,
    entries: progress.entries.map(e => ({
      id: e.id,
      beverage_type: e.beverageType,
      volume_oz: e.volumeOz,
      caffeine_mg: e.caffeineMg,
      logged_at: e.loggedAt,
      notes: e.notes
    })),
    recommendation: progress.over_limit
      ? 'Consider reducing caffeine intake for the rest of the day'
      : progress.percentage >= 80
        ? 'You are approaching your daily caffeine limit'
        : null
  });
});

/**
 * @route DELETE /api/hydration/caffeine/:id
 * @desc Delete a caffeine log entry
 * @access Private
 */
router.delete('/caffeine/:id', (req, res) => {
  const entry = caffeineService.findById(req.params.id);

  if (!entry) {
    throw new ApiError(404, 'Caffeine log not found');
  }

  if (entry.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  caffeineService.delete(req.params.id);

  res.json({
    message: 'Caffeine log deleted',
    id: req.params.id
  });
});

// =============================================================================
// HYDRATION ENDPOINTS
// =============================================================================

/**
 * @route POST /api/hydration/log
 * @desc Log water or non-caffeinated beverage intake
 * @access Private
 *
 * Body:
 *   - amount_oz: number (required, 1-128)
 *   - beverage_type: 'water' | 'tea' | 'other' (default: 'water')
 *   - timestamp: ISO date string (optional, defaults to now)
 *   - notes: string (optional)
 *
 * Returns: logged entry + daily progress
 */
router.post('/log', validate(hydrationLogSchema), (req, res) => {
  const entry = hydrationService.log(req.user.id, req.body);
  const progress = hydrationService.getTodayProgress(req.user.id);

  res.status(201).json({
    message: 'Hydration logged successfully',
    entry: {
      id: entry.id,
      amount_oz: entry.amountOz,
      beverage_type: entry.beverageType,
      logged_at: entry.loggedAt,
      notes: entry.notes
    },
    daily_progress: progress
  });
});

/**
 * @route GET /api/hydration/today
 * @desc Get today's hydration progress
 * @access Private
 *
 * Returns:
 *   - total_oz: number
 *   - goal_oz: number
 *   - percentage: number (0-100)
 *   - remaining: number
 *   - entries: array of today's hydration logs
 */
router.get('/today', (req, res) => {
  const progress = hydrationService.getTodayProgress(req.user.id);

  res.json({
    date: new Date().toISOString().split('T')[0],
    ...progress,
    entries: progress.entries.map(e => ({
      id: e.id,
      amount_oz: e.amountOz,
      beverage_type: e.beverageType,
      logged_at: e.loggedAt,
      notes: e.notes
    }))
  });
});

/**
 * @route GET /api/hydration/goals
 * @desc Get personalized hydration goals
 * @access Private
 *
 * Returns:
 *   - daily_water_oz: calculated target (weight_lbs / 2, min 64)
 *   - daily_caffeine_limit_mg: max caffeine (default 400)
 *   - personalized_formula_enabled: boolean
 *   - calculation: explanation of how goal was calculated
 */
router.get('/goals', async (req, res) => {
  const goals = hydrationService.getGoals(req.user.id);

  // Get full user profile from dataStore
  const fullUser = await userService.findById(req.user.id);

  // Brandon's specific calculation: 250 lbs / 2 = 125 oz
  const weightLbs = fullUser?.profile?.weight || 250;
  const calculatedOz = Math.max(64, Math.round(weightLbs / 2));

  res.json({
    daily_water_oz: goals.dailyWaterOz,
    daily_caffeine_limit_mg: goals.dailyCaffeineLimitMg,
    personalized_formula_enabled: goals.personalizedFormulaEnabled,
    calculation: {
      formula: 'body_weight_lbs / 2',
      weight_lbs: weightLbs,
      calculated_oz: calculatedOz,
      minimum_oz: 64,
      final_target_oz: goals.dailyWaterOz,
      note: goals.personalizedFormulaEnabled
        ? `Based on your weight of ${weightLbs} lbs: ${calculatedOz} oz/day`
        : 'Using custom goal (personalized formula disabled)'
    }
  });
});

/**
 * @route PUT /api/hydration/goals
 * @desc Update hydration goals
 * @access Private
 *
 * Body:
 *   - daily_water_oz: number (optional, 32-256)
 *   - daily_caffeine_limit_mg: number (optional, 0-600)
 *   - personalized_formula_enabled: boolean (optional)
 */
router.put('/goals', validate(hydrationGoalsUpdateSchema), (req, res) => {
  const updates = {};

  if (req.body.daily_water_oz !== undefined) {
    updates.dailyWaterOz = req.body.daily_water_oz;
  }
  if (req.body.daily_caffeine_limit_mg !== undefined) {
    updates.dailyCaffeineLimitMg = req.body.daily_caffeine_limit_mg;
  }
  if (req.body.personalized_formula_enabled !== undefined) {
    updates.personalizedFormulaEnabled = req.body.personalized_formula_enabled;
  }

  const updated = hydrationService.updateGoals(req.user.id, updates);

  res.json({
    message: 'Goals updated successfully',
    goals: {
      daily_water_oz: updated.dailyWaterOz,
      daily_caffeine_limit_mg: updated.dailyCaffeineLimitMg,
      personalized_formula_enabled: updated.personalizedFormulaEnabled
    }
  });
});

/**
 * @route GET /api/hydration/trends
 * @desc Get weekly/monthly hydration trends
 * @access Private
 *
 * Query params:
 *   - period: 'week' | 'month' | 'all' (default: 'week')
 *   - start_date: YYYY-MM-DD (optional)
 *   - end_date: YYYY-MM-DD (optional)
 *
 * Returns:
 *   - weekly: array of daily data
 *   - avg_daily_oz: average consumption
 *   - adherence_rate: percentage of days meeting goal
 *   - hourly_patterns: consumption by hour
 */
router.get('/trends', validate(hydrationTrendsQuerySchema, 'query'), (req, res) => {
  const trends = hydrationService.getTrends(req.user.id, req.query);
  const goals = hydrationService.getGoals(req.user.id);

  res.json({
    period: req.query.period || 'week',
    goal_oz: goals.dailyWaterOz,
    ...trends,
    correlations: {
      note: 'Hydration patterns can affect meal adherence and energy levels'
    }
  });
});

/**
 * @route DELETE /api/hydration/:id
 * @desc Delete a hydration log entry
 * @access Private
 * NOTE: This must be defined LAST to avoid matching /caffeine/* routes
 */
router.delete('/:id', (req, res, next) => {
  try {
    const entry = hydrationService.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Hydration log not found'
      });
    }

    if (entry.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    hydrationService.delete(req.params.id);

    res.json({
      message: 'Hydration log deleted',
      id: req.params.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
