/**
 * Meal Routes
 * Endpoints for logging and managing individual meals
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate, mealLogSchema, mealSubstituteSchema } = require('../validators');
const { mealService, patternService, inventoryService } = require('../services/dataStore');
const { ApiError } = require('../middleware/errorHandler');

// All meal routes require authentication
router.use(authenticate);

/**
 * @route GET /api/meals/today
 * @desc Get all meals for today
 * @access Private
 */
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const pattern = patternService.findByUserAndDate(req.user.id, today);

  if (!pattern) {
    return res.json({
      message: 'No pattern selected for today',
      meals: [],
      patternRequired: true
    });
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

  // Add status indicators
  const mealsWithStatus = pattern.meals.map(meal => {
    const mealTime = meal.time;
    let timeStatus = 'upcoming';

    if (meal.status !== 'pending') {
      timeStatus = 'logged';
    } else if (currentTime > mealTime) {
      timeStatus = 'overdue';
    } else {
      // Check if within 30 min window
      const [mealHour, mealMin] = mealTime.split(':').map(Number);
      const mealMinutes = mealHour * 60 + mealMin;
      const nowMinutes = currentHour * 60 + currentMinutes;

      if (nowMinutes >= mealMinutes - 30 && nowMinutes <= mealMinutes + 30) {
        timeStatus = 'current';
      }
    }

    return {
      ...meal,
      timeStatus
    };
  });

  res.json({
    date: today,
    patternType: pattern.patternType,
    meals: mealsWithStatus,
    summary: {
      total: pattern.meals.length,
      completed: pattern.meals.filter(m => m.status === 'completed').length,
      pending: pattern.meals.filter(m => m.status === 'pending').length,
      skipped: pattern.meals.filter(m => m.status === 'skipped').length
    }
  });
});

/**
 * @route GET /api/meals/:id
 * @desc Get a specific meal by ID
 * @access Private
 */
router.get('/:id', (req, res) => {
  const meal = mealService.findById(req.params.id);

  if (!meal) {
    throw new ApiError(404, 'Meal not found');
  }

  if (meal.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  res.json({ meal });
});

/**
 * @route POST /api/meals/log
 * @desc Log a meal with details
 * @access Private
 */
router.post('/log', validate(mealLogSchema), (req, res) => {
  const { mealId, status, actualCalories, actualProtein, rating, notes, photoUrl, substitutions } = req.body;

  const meal = mealService.findById(mealId);
  if (!meal) {
    throw new ApiError(404, 'Meal not found');
  }

  if (meal.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (meal.status !== 'pending') {
    throw new ApiError(400, 'Meal already logged', {
      currentStatus: meal.status,
      loggedAt: meal.logged
    });
  }

  const updates = {
    status,
    actualCalories: actualCalories || meal.calories,
    actualProtein: actualProtein || meal.protein,
    rating,
    notes,
    photoUrl,
    substitutions: substitutions || []
  };

  const updatedMeal = mealService.update(mealId, updates);

  // Calculate variance from target
  const calorieVariance = updatedMeal.actualCalories - meal.calories;
  const proteinVariance = updatedMeal.actualProtein - meal.protein;

  res.json({
    message: 'Meal logged successfully',
    meal: updatedMeal,
    analysis: {
      calorieVariance,
      proteinVariance,
      onTarget: Math.abs(calorieVariance) <= 100 && Math.abs(proteinVariance) <= 10
    }
  });
});

/**
 * @route PUT /api/meals/:id/substitute
 * @desc Add ingredient substitution to a meal
 * @access Private
 */
router.put('/:id/substitute', validate(mealSubstituteSchema), (req, res) => {
  const { ingredientName, substituteName, reason, calorieAdjustment, proteinAdjustment } = req.body;

  const meal = mealService.findById(req.params.id);
  if (!meal) {
    throw new ApiError(404, 'Meal not found');
  }

  if (meal.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  const substitution = {
    original: ingredientName,
    replacement: substituteName,
    reason,
    calorieAdjustment: calorieAdjustment || 0,
    proteinAdjustment: proteinAdjustment || 0,
    timestamp: new Date().toISOString()
  };

  const currentSubstitutions = meal.substitutions || [];
  const updatedMeal = mealService.update(req.params.id, {
    substitutions: [...currentSubstitutions, substitution],
    calories: meal.calories + (calorieAdjustment || 0),
    protein: meal.protein + (proteinAdjustment || 0)
  });

  res.json({
    message: 'Substitution recorded',
    meal: updatedMeal,
    substitution
  });
});

/**
 * @route GET /api/meals/:id/suggestions
 * @desc Get meal component suggestions based on inventory
 * @access Private
 */
router.get('/:id/suggestions', (req, res) => {
  const meal = mealService.findById(req.params.id);
  if (!meal) {
    throw new ApiError(404, 'Meal not found');
  }

  if (meal.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  // Get user's current inventory
  const inventory = inventoryService.findByUser(req.user.id);

  // Get items expiring soon that could be used
  const expiringItems = inventoryService.findExpiring(req.user.id, 48);

  // Categorize available ingredients
  const available = {
    proteins: inventory.filter(i => i.category === 'protein' && i.quantity > 0),
    carbohydrates: inventory.filter(i => i.category === 'carbohydrate' && i.quantity > 0),
    vegetables: inventory.filter(i => i.category === 'vegetable' && i.quantity > 0),
    fruits: inventory.filter(i => i.category === 'fruit' && i.quantity > 0),
    fats: inventory.filter(i => i.category === 'fat' || i.category === 'dairy').filter(i => i.quantity > 0)
  };

  res.json({
    meal: {
      id: meal.id,
      name: meal.name,
      targetCalories: meal.calories,
      targetProtein: meal.protein
    },
    suggestions: {
      useFirst: expiringItems.map(i => ({
        ...i,
        urgency: 'expiring soon'
      })),
      available
    }
  });
});

/**
 * @route POST /api/meals/:id/skip
 * @desc Mark a meal as skipped
 * @access Private
 */
router.post('/:id/skip', (req, res) => {
  const { reason } = req.body;

  const meal = mealService.findById(req.params.id);
  if (!meal) {
    throw new ApiError(404, 'Meal not found');
  }

  if (meal.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  if (meal.status !== 'pending') {
    throw new ApiError(400, 'Meal already logged');
  }

  const updatedMeal = mealService.update(req.params.id, {
    status: 'skipped',
    notes: reason || 'Meal skipped',
    actualCalories: 0,
    actualProtein: 0
  });

  res.json({
    message: 'Meal marked as skipped',
    meal: updatedMeal,
    impact: {
      missedCalories: meal.calories,
      missedProtein: meal.protein,
      recommendation: 'Consider redistributing to remaining meals'
    }
  });
});

module.exports = router;
