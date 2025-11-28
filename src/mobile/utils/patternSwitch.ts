/**
 * Pattern Switch Utilities
 * Handles recalculation logic for mid-day pattern switching
 */

import { MealPattern, PatternId } from '../types';
import { RecalculatedMeal, PatternSwitchPreviewData } from '../store/slices/patternsSlice';

// Daily nutrition targets from PRD
const DAILY_CALORIE_TARGET = { min: 1800, max: 2000 };
const DAILY_PROTEIN_TARGET = { min: 130, max: 145 };

// Parse time string like "7-8 AM" or "12-1 PM" to hour (24h format)
export const parseTimeToHour = (timeStr: string): number | null => {
  if (timeStr === 'Skip' || timeStr === 'Flexible') return null;

  // Handle ranges like "7-8 AM", "12-1 PM", "5-7 PM"
  const match = timeStr.match(/(\d+)(?:-\d+)?\s*(AM|PM)/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const period = match[2].toUpperCase();

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  return hour;
};

// Get current hour in 24h format
export const getCurrentHour = (): number => {
  return new Date().getHours();
};

// Determine which meals are remaining based on current time
export const getRemainingMeals = (
  pattern: MealPattern,
  currentHour: number
): Array<{ mealType: 'morning' | 'noon' | 'evening'; time: string; calories: number; protein: number }> => {
  const meals: Array<{ mealType: 'morning' | 'noon' | 'evening'; time: string; calories: number; protein: number }> = [];

  const mealTypes: Array<'morning' | 'noon' | 'evening'> = ['morning', 'noon', 'evening'];

  mealTypes.forEach(mealType => {
    const meal = pattern.meals[mealType];
    const mealHour = parseTimeToHour(meal.time);

    // Include meal if:
    // 1. It's a "Flexible" meal (can be eaten anytime)
    // 2. It's scheduled after current hour
    // 3. Skip meals are excluded
    if (meal.time === 'Skip') return;

    if (meal.time === 'Flexible' || (mealHour !== null && mealHour > currentHour)) {
      meals.push({
        mealType,
        time: meal.time,
        calories: meal.calories,
        protein: meal.protein,
      });
    }
  });

  return meals;
};

// Calculate recalculated meals after switch
export const calculateRecalculatedMeals = (
  currentPattern: MealPattern,
  newPattern: MealPattern,
  currentHour: number,
  caloriesConsumed: number,
  proteinConsumed: number
): RecalculatedMeal[] => {
  const recalculatedMeals: RecalculatedMeal[] = [];
  const mealTypes: Array<'morning' | 'noon' | 'evening'> = ['morning', 'noon', 'evening'];

  // Calculate remaining targets
  const remainingCalorieTarget = Math.max(0, DAILY_CALORIE_TARGET.min - caloriesConsumed);
  const remainingProteinTarget = Math.max(0, DAILY_PROTEIN_TARGET.min - proteinConsumed);

  // Get remaining meals from new pattern
  const remainingMealsInNewPattern = getRemainingMeals(newPattern, currentHour);
  const totalRemainingMeals = remainingMealsInNewPattern.length;

  mealTypes.forEach(mealType => {
    const currentMeal = currentPattern.meals[mealType];
    const newMeal = newPattern.meals[mealType];
    const mealHour = parseTimeToHour(newMeal.time);

    const isRemaining = newMeal.time === 'Flexible' ||
      (mealHour !== null && mealHour > currentHour) ||
      newMeal.time !== 'Skip';

    // Calculate adjusted calories/protein for remaining meals
    let newCalories = newMeal.calories;
    let newProtein = newMeal.protein;

    // If this is a remaining meal and we need to redistribute
    if (isRemaining && totalRemainingMeals > 0 && newMeal.time !== 'Skip') {
      // Keep original pattern values but flag for display
      newCalories = newMeal.calories;
      newProtein = newMeal.protein;
    }

    recalculatedMeals.push({
      mealType,
      originalCalories: currentMeal.calories,
      newCalories,
      originalProtein: currentMeal.protein,
      newProtein,
      time: newMeal.time,
      isRemaining: isRemaining && newMeal.time !== 'Skip' && (
        newMeal.time === 'Flexible' ||
        (mealHour !== null && mealHour > currentHour)
      ),
    });
  });

  return recalculatedMeals;
};

// Generate warnings for pattern switch
export const generateSwitchWarnings = (
  caloriesConsumed: number,
  proteinConsumed: number,
  remainingMealsCount: number,
  newPattern: MealPattern,
  inventorySufficient: boolean
): string[] => {
  const warnings: string[] = [];

  // Calculate percentages
  const caloriePercentage = (caloriesConsumed / DAILY_CALORIE_TARGET.min) * 100;
  const proteinPercentage = (proteinConsumed / DAILY_PROTEIN_TARGET.min) * 100;

  // Warning: More than 50% calories consumed
  if (caloriePercentage > 50) {
    warnings.push('You have consumed over 50% of daily calories. Options may be limited.');
  }

  // Warning: More than 75% calories consumed
  if (caloriePercentage > 75) {
    warnings.push('Limited calorie budget remaining. Consider lighter meals.');
  }

  // Warning: No remaining meals
  if (remainingMealsCount === 0) {
    warnings.push('No scheduled meals remaining today in the new pattern.');
  }

  // Warning: Insufficient inventory
  if (!inventorySufficient) {
    warnings.push('Some ingredients may be missing. Check inventory.');
  }

  // Warning: Protein target at risk
  const remainingProtein = DAILY_PROTEIN_TARGET.min - proteinConsumed;
  if (remainingProtein > 70 && remainingMealsCount < 2) {
    warnings.push('May not reach protein target with remaining meals.');
  }

  return warnings;
};

// Create preview data for pattern switch
export const createSwitchPreview = (
  currentPattern: MealPattern,
  newPattern: MealPattern,
  caloriesConsumed: number,
  proteinConsumed: number,
  inventorySufficient: boolean = true,
  missingIngredients: string[] = []
): PatternSwitchPreviewData => {
  const currentHour = getCurrentHour();
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const remainingMeals = calculateRecalculatedMeals(
    currentPattern,
    newPattern,
    currentHour,
    caloriesConsumed,
    proteinConsumed
  );

  const remainingMealsCount = remainingMeals.filter(m => m.isRemaining).length;

  const warnings = generateSwitchWarnings(
    caloriesConsumed,
    proteinConsumed,
    remainingMealsCount,
    newPattern,
    inventorySufficient
  );

  return {
    currentPattern,
    newPattern,
    currentTime,
    caloriesConsumed,
    proteinConsumed,
    remainingMeals,
    warnings,
    inventorySufficient,
    missingIngredients,
  };
};

// Calculate remaining calories for the day
export const calculateRemainingCalories = (
  consumed: number,
  target: number = DAILY_CALORIE_TARGET.min
): number => {
  return Math.max(0, target - consumed);
};

// Calculate remaining protein for the day
export const calculateRemainingProtein = (
  consumed: number,
  target: number = DAILY_PROTEIN_TARGET.min
): number => {
  return Math.max(0, target - consumed);
};

// Format time for display
export const formatTimeForDisplay = (hour: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
};

// Check if switching is advisable based on time and consumption
export const isSwitchAdvisable = (
  caloriesConsumed: number,
  proteinConsumed: number,
  remainingMealsCount: number
): { advisable: boolean; reason?: string } => {
  const caloriePercentage = (caloriesConsumed / DAILY_CALORIE_TARGET.min) * 100;

  if (remainingMealsCount === 0) {
    return {
      advisable: false,
      reason: 'No meals remaining in the day to switch to.',
    };
  }

  if (caloriePercentage > 85) {
    return {
      advisable: false,
      reason: 'Very limited calorie budget remaining.',
    };
  }

  return { advisable: true };
};
