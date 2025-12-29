/**
 * Pattern Routes
 * Endpoints for managing daily eating patterns
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { createPattern, PatternConfigs, PatternType } from '../models';
import { Pattern } from '../types/models';

const router = express.Router();
const { validate, patternSelectSchema, patternSwitchSchema } = require('../validators');
const { patternService } = require('../services/dataStore');

// All pattern routes require authentication
router.use(authenticate);

/**
 * @route GET /api/patterns
 * @desc Get all available pattern types with configurations
 * @access Private
 */
router.get('/', (_req: Request, res: Response) => {
  const patterns = Object.entries(PatternConfigs).map(([key, config]) => ({
    type: key,
    ...config
  }));

  res.json({
    patterns,
    count: patterns.length
  });
});

/**
 * @route GET /api/patterns/history
 * @desc Get user's pattern history
 * @access Private
 */
router.get('/history', (req: Request, res: Response) => {
  const { startDate, endDate, limit = '30' } = req.query;

  const patterns: Pattern[] = patternService.findByUser(req.user!.id, { startDate, endDate });

  res.json({
    patterns: patterns.slice(0, parseInt(limit as string)),
    count: patterns.length
  });
});

/**
 * @route POST /api/patterns/select
 * @desc Select a pattern for a specific day
 * @access Private
 */
router.post('/select', validate(patternSelectSchema), (req: Request, res: Response) => {
  const { patternType, date } = req.body;

  // Check if pattern already exists for this date
  const existing = patternService.findByUserAndDate(req.user!.id, date);
  if (existing) {
    throw new ApiError(409, 'Pattern already selected for this date', {
      existingPattern: existing.patternType,
      date
    });
  }

  const pattern = createPattern(req.user!.id, patternType as PatternType, date);
  patternService.create(pattern);

  res.status(201).json({
    message: 'Pattern selected successfully',
    pattern
  });
});

/**
 * @route GET /api/patterns/:id
 * @desc Get a specific pattern by ID
 * @access Private
 */
router.get('/:id', (req: Request, res: Response) => {
  const pattern: Pattern = patternService.findById(req.params.id);

  if (!pattern) {
    throw new ApiError(404, 'Pattern not found');
  }

  if (pattern.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ pattern });
});

/**
 * @route GET /api/patterns/:id/meals
 * @desc Get meal structure for a pattern
 * @access Private
 */
router.get('/:id/meals', (req: Request, res: Response) => {
  const pattern: Pattern = patternService.findById(req.params.id);

  if (!pattern) {
    throw new ApiError(404, 'Pattern not found');
  }

  if (pattern.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({
    patternType: pattern.patternType,
    date: pattern.date,
    meals: pattern.meals,
    summary: {
      totalCalories: pattern.config.totalCalories,
      totalProtein: pattern.config.totalProtein,
      mealCount: pattern.meals.length
    }
  });
});

/**
 * @route POST /api/patterns/switch
 * @desc Switch to a different pattern mid-day
 * @access Private
 */
router.post('/switch', validate(patternSwitchSchema), (req: Request, res: Response) => {
  const { currentPatternId, newPatternType, reason } = req.body;

  const currentPattern: Pattern = patternService.findById(currentPatternId);
  if (!currentPattern) {
    throw new ApiError(404, 'Current pattern not found');
  }

  if (currentPattern.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Get completed meals from current pattern
  const completedMeals = currentPattern.meals.filter(m =>
    m.status === 'completed' || m.status === 'partial'
  );

  // Calculate remaining calories/protein
  const consumedCalories = completedMeals.reduce((sum, m) =>
    sum + (m.actualCalories || m.calories), 0);
  const consumedProtein = completedMeals.reduce((sum, m) =>
    sum + (m.actualProtein || m.protein), 0);

  // Create new pattern
  const newConfig = PatternConfigs[newPatternType as PatternType];
  const remainingCalories = newConfig.totalCalories - consumedCalories;
  const remainingProtein = newConfig.totalProtein - consumedProtein;

  // Mark current pattern as switched
  patternService.update(currentPatternId, {
    status: 'switched',
    switchedTo: newPatternType,
    switchReason: reason,
    switchedAt: new Date().toISOString()
  });

  // Create adjusted new pattern
  const newPattern = createPattern(req.user!.id, newPatternType as PatternType, currentPattern.date);
  newPattern.adjustedFrom = currentPatternId;
  newPattern.adjustments = {
    consumedCalories,
    consumedProtein,
    remainingCalories,
    remainingProtein
  };

  patternService.create(newPattern);

  res.json({
    message: 'Pattern switched successfully',
    previousPattern: {
      id: currentPatternId,
      type: currentPattern.patternType,
      completedMeals: completedMeals.length
    },
    newPattern,
    adjustments: {
      consumedCalories,
      consumedProtein,
      remainingCalories,
      remainingProtein,
      recommendation: remainingCalories < 500
        ? 'Consider a light snack only'
        : 'Proceed with remaining meals'
    }
  });
});

/**
 * @route GET /api/patterns/today
 * @desc Get today's pattern (if selected)
 * @access Private
 */
router.get('/date/today', (req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const pattern: Pattern | null = patternService.findByUserAndDate(req.user!.id, today);

  if (!pattern) {
    res.json({
      message: 'No pattern selected for today',
      pattern: null,
      suggestions: Object.keys(PatternConfigs)
    });
    return;
  }

  res.json({ pattern });
});

/**
 * @route DELETE /api/patterns/:id
 * @desc Delete a pattern
 * @access Private
 */
router.delete('/:id', (req: Request, res: Response) => {
  const pattern: Pattern = patternService.findById(req.params.id);

  if (!pattern) {
    throw new ApiError(404, 'Pattern not found');
  }

  if (pattern.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Only allow deletion if no meals are logged
  const hasLoggedMeals = pattern.meals.some(m => m.status !== 'pending');
  if (hasLoggedMeals) {
    throw new ApiError(400, 'Cannot delete pattern with logged meals');
  }

  patternService.delete(req.params.id);

  res.json({
    message: 'Pattern deleted successfully',
    deletedId: req.params.id
  });
});

/**
 * @route GET /api/patterns/preferences
 * @desc Get user pattern preferences and usage statistics
 * @access Private
 */
router.get('/preferences', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const patterns: Pattern[] = patternService.findByUser(userId, {});

  // Calculate pattern usage statistics
  const patternCounts: Record<string, number> = {};
  const patternRatings: Record<string, number[]> = {};
  let defaultPattern: PatternType | null = null;

  patterns.forEach(p => {
    patternCounts[p.patternType] = (patternCounts[p.patternType] || 0) + 1;
    if (p.rating) {
      if (!patternRatings[p.patternType]) {
        patternRatings[p.patternType] = [];
      }
      patternRatings[p.patternType].push(p.rating);
    }
  });

  // Find most used pattern as default
  const mostUsed = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
  if (mostUsed) {
    defaultPattern = mostUsed[0] as PatternType;
  }

  // Calculate average ratings
  const avgRatings: Record<string, number> = {};
  Object.entries(patternRatings).forEach(([type, ratings]) => {
    avgRatings[type] = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  });

  res.json({
    preferences: {
      defaultPattern,
      patternUsage: patternCounts,
      averageRatings: avgRatings,
      totalPatternsUsed: patterns.length,
      preferredPatterns: Object.entries(avgRatings)
        .filter(([_, rating]) => rating >= 4)
        .map(([type]) => type)
    }
  });
});

/**
 * @route POST /api/patterns/preferences/default
 * @desc Set default pattern for user
 * @access Private
 */
router.post('/preferences/default', (req: Request, res: Response) => {
  const { patternType } = req.body;

  if (!patternType || !Object.values(PatternType).includes(patternType)) {
    throw new ApiError(400, 'Valid pattern type is required');
  }

  // Store in user preferences (placeholder - would use user service)
  res.json({
    message: 'Default pattern updated',
    defaultPattern: patternType
  });
});

/**
 * @route PUT /api/patterns/daily/:date/rating
 * @desc Rate a day's pattern performance
 * @access Private
 */
router.put('/daily/:date/rating', (req: Request, res: Response) => {
  const { date } = req.params;
  const { rating, notes } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5');
  }

  const pattern: Pattern | null = patternService.findByUserAndDate(req.user!.id, date);

  if (!pattern) {
    throw new ApiError(404, 'No pattern found for this date');
  }

  if (pattern.userId !== req.user!.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Update pattern with rating
  patternService.update(pattern.id, {
    rating,
    ratingNotes: notes,
    ratedAt: new Date().toISOString()
  });

  res.json({
    message: 'Pattern rated successfully',
    pattern: {
      id: pattern.id,
      date: pattern.date,
      patternType: pattern.patternType,
      rating,
      notes
    }
  });
});

/**
 * @route GET /api/patterns/statistics
 * @desc Get pattern usage statistics and insights
 * @access Private
 */
router.get('/statistics', (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const patterns: Pattern[] = patternService.findByUser(req.user!.id, { startDate, endDate });

  const stats = {
    totalPatterns: patterns.length,
    byType: {} as Record<string, number>,
    adherenceRate: 0,
    averageRating: 0,
    mostSuccessful: null as string | null,
    switchRate: 0,
    completionByType: {} as Record<string, { completed: number; total: number }>,
  };

  let totalRating = 0;
  let ratedCount = 0;
  let completedMeals = 0;
  let totalMeals = 0;
  let switchCount = 0;

  patterns.forEach(p => {
    // Count by type
    stats.byType[p.patternType] = (stats.byType[p.patternType] || 0) + 1;

    // Track ratings
    if (p.rating) {
      totalRating += p.rating;
      ratedCount++;
    }

    // Track completion
    const completed = p.meals.filter(m => m.status === 'completed').length;
    const total = p.meals.length;
    completedMeals += completed;
    totalMeals += total;

    if (!stats.completionByType[p.patternType]) {
      stats.completionByType[p.patternType] = { completed: 0, total: 0 };
    }
    stats.completionByType[p.patternType].completed += completed;
    stats.completionByType[p.patternType].total += total;

    // Track switches
    if (p.status === 'switched') {
      switchCount++;
    }
  });

  stats.averageRating = ratedCount > 0 ? totalRating / ratedCount : 0;
  stats.adherenceRate = totalMeals > 0 ? (completedMeals / totalMeals) * 100 : 0;
  stats.switchRate = patterns.length > 0 ? (switchCount / patterns.length) * 100 : 0;

  // Find most successful pattern (highest completion rate)
  let bestRate = 0;
  Object.entries(stats.completionByType).forEach(([type, data]) => {
    const rate = data.total > 0 ? (data.completed / data.total) : 0;
    if (rate > bestRate) {
      bestRate = rate;
      stats.mostSuccessful = type;
    }
  });

  res.json({
    statistics: {
      ...stats,
      adherenceRate: parseFloat(stats.adherenceRate.toFixed(1)),
      averageRating: parseFloat(stats.averageRating.toFixed(2)),
      switchRate: parseFloat(stats.switchRate.toFixed(1)),
      period: {
        startDate: startDate || 'all time',
        endDate: endDate || 'now'
      }
    }
  });
});

export default router;
