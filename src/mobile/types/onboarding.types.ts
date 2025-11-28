// Onboarding Types for Meal Assistant
import { PatternId } from './index';

// ============================================
// Onboarding State Types
// ============================================

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WorkSchedule = '9to5' | 'shift' | 'flexible' | 'remote';
export type WorkoutTiming = 'morning' | 'afternoon' | 'evening' | 'none';
export type OnboardingStep = 'welcome' | 'profile' | 'patterns' | 'schedule' | 'stores' | 'firstWeek';
export type Gender = 'male' | 'female';

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  weight: number; // lbs (imperial)
  height: number; // inches
  activityLevel: ActivityLevel;
  targetWeight: number;
  targetDate: string; // ISO date string
}

export interface MealTimePreferences {
  breakfast: string; // "07:30"
  lunch: string;
  dinner: string;
  workSchedule: WorkSchedule;
  workoutTiming: WorkoutTiming;
}

export interface PreferredStore {
  id: string;
  name: string;
  address?: string;
  distance?: number; // miles
  rating: number; // 1-5
  isPreferred: boolean;
}

export interface OnboardingState {
  completed: boolean;
  currentStep: OnboardingStep;
  stepsCompleted: OnboardingStep[];
  profile: UserProfile;
  selectedPattern: PatternId;
  mealTimes: MealTimePreferences;
  preferredStores: PreferredStore[];
  tutorialsSeen: string[];
  calculatedTargets: {
    dailyCalories: number;
    dailyProtein: number;
    weeklyWeightLoss: number; // lbs
  };
  firstWeekPlan: WeekPlan | null;
  quickStartUsed: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WeekPlan {
  weekOf: string;
  days: DayPlan[];
  totalCalories: number;
  estimatedGroceryCost: number;
}

export interface DayPlan {
  date: string;
  dayName: string;
  patternId: PatternId;
  meals: PlannedMeal[];
}

export interface PlannedMeal {
  type: 'morning' | 'noon' | 'evening';
  time: string;
  calories: number;
  protein: number;
  description: string;
}

// ============================================
// Tutorial Types
// ============================================

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string;
  position: 'top' | 'bottom' | 'center';
  highlightArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Tutorial {
  id: string;
  name: string;
  steps: TutorialStep[];
  feature: string;
}

// ============================================
// Activity Level Multipliers
// ============================================

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Light (exercise 1-3 days/week)',
  moderate: 'Moderate (exercise 3-5 days/week)',
  active: 'Active (exercise 6-7 days/week)',
  very_active: 'Very Active (hard exercise daily)',
};

export const WORK_SCHEDULE_LABELS: Record<WorkSchedule, string> = {
  '9to5': '9-5 Office',
  shift: 'Shift Work',
  flexible: 'Flexible Hours',
  remote: 'Work from Home',
};

export const WORKOUT_TIMING_LABELS: Record<WorkoutTiming, string> = {
  morning: 'Morning Workouts',
  afternoon: 'Afternoon Workouts',
  evening: 'Evening Workouts',
  none: 'No Regular Workouts',
};

// ============================================
// Default Values
// ============================================

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: 30,
  gender: 'male',
  weight: 180,
  height: 68, // 5'8"
  activityLevel: 'moderate',
  targetWeight: 165,
  targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
};

export const DEFAULT_MEAL_TIMES: MealTimePreferences = {
  breakfast: '07:30',
  lunch: '12:00',
  dinner: '18:30',
  workSchedule: '9to5',
  workoutTiming: 'none',
};

export const DEFAULT_STORES: PreferredStore[] = [
  { id: 'walmart', name: 'Walmart', rating: 3, isPreferred: false },
  { id: 'kroger', name: 'Kroger', rating: 3, isPreferred: false },
  { id: 'aldi', name: 'Aldi', rating: 3, isPreferred: false },
  { id: 'costco', name: 'Costco', rating: 3, isPreferred: false },
  { id: 'target', name: 'Target', rating: 3, isPreferred: false },
  { id: 'trader_joes', name: "Trader Joe's", rating: 3, isPreferred: false },
  { id: 'whole_foods', name: 'Whole Foods', rating: 3, isPreferred: false },
  { id: 'kyopo', name: 'Kyopo', rating: 3, isPreferred: false },
  { id: 'megamart', name: 'Megamart', rating: 3, isPreferred: false },
];
