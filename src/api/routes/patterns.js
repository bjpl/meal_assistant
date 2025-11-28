/**
 * Pattern Routes
 * Endpoints for managing daily eating patterns
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate, patternSelectSchema, patternSwitchSchema } = require('../validators');
const { patternService } = require('../services/dataStore');
const { createPattern, PatternConfigs, PatternType } = require('../models');
const { ApiError } = require('../middleware/errorHandler');

// All pattern routes require authentication
router.use(authenticate);

/**
 * @route GET /api/patterns
 * @desc Get all available pattern types with configurations
 * @access Private
 */
router.get('/', (req, res) => {
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
router.get('/history', (req, res) => {
  const { startDate, endDate, limit = 30 } = req.query;

  const patterns = patternService.findByUser(req.user.id, { startDate, endDate });

  res.json({
    patterns: patterns.slice(0, parseInt(limit)),
    count: patterns.length
  });
});

/**
 * @route POST /api/patterns/select
 * @desc Select a pattern for a specific day
 * @access Private
 */
router.post('/select', validate(patternSelectSchema), (req, res) => {
  const { patternType, date } = req.body;

  // Check if pattern already exists for this date
  const existing = patternService.findByUserAndDate(req.user.id, date);
  if (existing) {
    throw new ApiError(409, 'Pattern already selected for this date', {
      existingPattern: existing.patternType,
      date
    });
  }

  const pattern = createPattern(req.user.id, patternType, date);
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
router.get('/:id', (req, res) => {
  const pattern = patternService.findById(req.params.id);

  if (!pattern) {
    throw new ApiError(404, 'Pattern not found');
  }

  if (pattern.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ pattern });
});

/**
 * @route GET /api/patterns/:id/meals
 * @desc Get meal structure for a pattern
 * @access Private
 */
router.get('/:id/meals', (req, res) => {
  const pattern = patternService.findById(req.params.id);

  if (!pattern) {
    throw new ApiError(404, 'Pattern not found');
  }

  if (pattern.userId !== req.user.id) {
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
router.post('/switch', validate(patternSwitchSchema), (req, res) => {
  const { currentPatternId, newPatternType, reason } = req.body;

  const currentPattern = patternService.findById(currentPatternId);
  if (!currentPattern) {
    throw new ApiError(404, 'Current pattern not found');
  }

  if (currentPattern.userId !== req.user.id) {
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
  const newConfig = PatternConfigs[newPatternType];
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
  const newPattern = createPattern(req.user.id, newPatternType, currentPattern.date);
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
router.get('/date/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const pattern = patternService.findByUserAndDate(req.user.id, today);

  if (!pattern) {
    return res.json({
      message: 'No pattern selected for today',
      pattern: null,
      suggestions: Object.keys(PatternConfigs)
    });
  }

  res.json({ pattern });
});

/**
 * @route DELETE /api/patterns/:id
 * @desc Delete a pattern
 * @access Private
 */
router.delete('/:id', (req, res) => {
  const pattern = patternService.findById(req.params.id);

  if (!pattern) {
    throw new ApiError(404, 'Pattern not found');
  }

  if (pattern.userId !== req.user.id) {
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

module.exports = router;
