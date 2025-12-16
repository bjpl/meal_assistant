/**
 * Hydration Routes
 * Endpoints for tracking water and fluid intake
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import hydrationService from '../database/services/hydrationService';

const router = Router();

// All hydration routes require authentication
router.use(authenticate);

/**
 * @route GET /api/hydration/today
 * @desc Get today's hydration summary
 * @access Private
 */
router.get('/today', async (req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const progress = await hydrationService.getTodayProgress(req.user!.id);

  // Convert oz to ml for consistency
  const totalMl = Math.round(progress.total_oz * 29.5735);
  const goalMl = Math.round(progress.goal_oz * 29.5735);

  res.json({
    date: today,
    intake: {
      totalMl,
      totalOz: Math.round(totalMl / 29.5735),
      glasses: Math.round(totalMl / 250) // 250ml glasses
    },
    goal: {
      goalMl,
      goalOz: Math.round(goalMl / 29.5735),
      glasses: Math.round(goalMl / 250)
    },
    progress: {
      percentage: progress.percentage,
      remaining: Math.round(progress.remaining * 29.5735),
      onTrack: isOnTrack(totalMl, goalMl)
    },
    entries: progress.entries || [],
    reminder: getHydrationReminder(totalMl, goalMl)
  });
});

/**
 * @route POST /api/hydration/log
 * @desc Log water/fluid intake
 * @access Private
 */
router.post('/log', async (req: Request, res: Response) => {
  const { amountMl, amountOz, type, notes } = req.body;

  // Convert oz to ml if needed
  const ml = amountMl || (amountOz ? Math.round(amountOz * 29.5735) : null);

  if (!ml || ml <= 0) {
    res.status(400).json({ error: 'Valid amount is required (amountMl or amountOz)' });
    return;
  }

  // Convert ml to oz for service
  const oz = Math.round(ml / 29.5735 * 10) / 10;

  const entry = await hydrationService.log(req.user!.id, {
    amount_oz: oz,
    beverage_type: type || 'water',
    notes
  });

  // Get updated daily total
  const progress = await hydrationService.getTodayProgress(req.user!.id);
  const goalMl = Math.round(progress.goal_oz * 29.5735);
  const totalMl = Math.round(progress.total_oz * 29.5735);

  res.status(201).json({
    message: 'Hydration logged',
    entry,
    dailyTotal: {
      totalMl,
      percentage: progress.percentage
    },
    achievement: checkHydrationAchievement(totalMl, goalMl)
  });
});

/**
 * @route POST /api/hydration/quick
 * @desc Quick log common amounts
 * @access Private
 */
router.post('/quick/:preset', async (req: Request, res: Response) => {
  const presets: Record<string, number> = {
    'glass': 250,      // 8oz glass
    'bottle': 500,     // Small bottle
    'large-bottle': 750, // Large bottle
    'cup': 200,        // Coffee cup size
    'sip': 50          // Small sip
  };

  const ml = presets[req.params.preset];

  if (!ml) {
    res.status(400).json({
      error: 'Invalid preset',
      validPresets: Object.keys(presets)
    });
    return;
  }

  const oz = Math.round(ml / 29.5735 * 10) / 10;

  const entry = await hydrationService.log(req.user!.id, {
    amount_oz: oz,
    beverage_type: 'water',
    notes: `Quick log: ${req.params.preset}`
  });

  const progress = await hydrationService.getTodayProgress(req.user!.id);

  res.status(201).json({
    message: `Logged ${ml}ml (${req.params.preset})`,
    entry,
    dailyTotal: Math.round(progress.total_oz * 29.5735),
    progress: progress.percentage
  });
});

/**
 * @route GET /api/hydration/history
 * @desc Get hydration history
 * @access Private
 */
router.get('/history', async (req: Request, res: Response) => {
  const trends = await hydrationService.getTrends(req.user!.id);
  const goals = await hydrationService.getGoals(req.user!.id);
  const goalOz = goals.dailyWaterOz;

  // Convert weekly data to history format
  const history = trends.weekly.map((d: any) => ({
    date: d.date,
    totalMl: Math.round(d.total_oz * 29.5735),
    totalOz: d.total_oz
  }));

  const daysMetGoal = trends.weekly.filter((d: any) => d.total_oz >= goalOz).length;

  res.json({
    history,
    summary: {
      daysTracked: history.length,
      daysMetGoal,
      averageIntake: trends.avg_daily_oz ? Math.round(trends.avg_daily_oz * 29.5735) : 0,
      adherenceRate: trends.adherence_rate
    }
  });
});

/**
 * @route PUT /api/hydration/goal
 * @desc Update daily hydration goal
 * @access Private
 */
router.put('/goal', async (req: Request, res: Response) => {
  const { goalMl: inputGoalMl, goalOz } = req.body;

  const ml = inputGoalMl || (goalOz ? Math.round(goalOz * 29.5735) : null);

  if (!ml || ml < 500 || ml > 10000) {
    res.status(400).json({
      error: 'Goal must be between 500ml and 10000ml'
    });
    return;
  }

  const oz = Math.round(ml / 29.5735);
  const updated = await hydrationService.updateGoals(req.user!.id, { daily_water_oz: oz });

  const updatedGoalMl = Math.round(updated.dailyWaterOz * 29.5735);
  res.json({
    message: 'Hydration goal updated',
    goal: {
      dailyGoalMl: updatedGoalMl,
      dailyGoalOz: updated.dailyWaterOz,
      glasses: Math.round(updatedGoalMl / 250)
    }
  });
});

/**
 * @route GET /api/hydration/recommendations
 * @desc Get personalized hydration recommendations
 * @access Private
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  const goals = await hydrationService.getGoals(req.user!.id);
  const trends = await hydrationService.getTrends(req.user!.id);

  const avgIntake = trends.avg_daily_oz ? Math.round(trends.avg_daily_oz * 29.5735) : 0;
  const goalMl = Math.round(goals.dailyWaterOz * 29.5735);

  res.json({
    currentGoal: goalMl,
    averageIntake: avgIntake,
    recommendations: generateHydrationRecommendations(avgIntake, goalMl, trends.weekly || [])
  });
});

// Helper functions
function isOnTrack(current: number, goal: number): boolean {
  const now = new Date();
  const hoursIntoDaу = now.getHours() + now.getMinutes() / 60;
  const expectedProgress = (hoursIntoDaу / 16) * goal; // Assume 16 waking hours
  return current >= expectedProgress * 0.8; // Within 80% of expected
}

function getHydrationReminder(current: number, goal: number): string | null {
  const remaining = goal - current;
  const now = new Date();
  const hour = now.getHours();

  if (remaining <= 0) return null;
  if (hour < 10) return 'Start your day with a glass of water!';
  if (hour < 14 && current < goal * 0.4) return 'Drink more water before lunch.';
  if (hour < 18 && current < goal * 0.7) return 'Afternoon reminder: stay hydrated!';
  if (hour >= 18 && remaining > 500) return `You have ${remaining}ml left to reach your goal.`;

  return null;
}

function checkHydrationAchievement(total: number, goal: number): string | null {
  if (total >= goal && total - 250 < goal) {
    return 'Congratulations! You reached your daily hydration goal!';
  }
  if (total >= goal / 2 && total - 250 < goal / 2) {
    return 'Halfway there! Keep drinking.';
  }
  return null;
}

function generateHydrationRecommendations(avg: number, goal: number, history: any[]): string[] {
  const recommendations: string[] = [];

  if (avg < goal * 0.5) {
    recommendations.push('Your average intake is well below your goal. Try setting hourly reminders.');
  } else if (avg < goal * 0.8) {
    recommendations.push('You\'re close to your goal. Try drinking a glass before each meal.');
  } else if (avg >= goal) {
    recommendations.push('Great job meeting your hydration goals!');
  }

  // Check for consistency
  if (history.length > 0) {
    const variance = calculateVariance(history.map(d => d.totalMl));
    if (variance > 500) {
      recommendations.push('Your hydration varies a lot day to day. Try to be more consistent.');
    }
  }

  // General tips
  recommendations.push('Keep a water bottle at your desk for easy access.');

  return recommendations;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
}

export default router;
