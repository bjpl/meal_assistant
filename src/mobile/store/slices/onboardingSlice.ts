import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PatternId } from '../../types';
import {
  OnboardingState,
  OnboardingStep,
  UserProfile,
  MealTimePreferences,
  PreferredStore,
  WeekPlan,
  DEFAULT_PROFILE,
  DEFAULT_MEAL_TIMES,
  DEFAULT_STORES,
  ACTIVITY_MULTIPLIERS,
} from '../../types/onboarding.types';

// Calculate BMR using Mifflin-St Jeor equation
const calculateBMR = (weight: number, height: number, age: number, gender: 'male' | 'female'): number => {
  // Weight in lbs, height in inches - convert to metric
  const weightKg = weight * 0.453592;
  const heightCm = height * 2.54;

  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
};

// Calculate daily calorie target based on goals
const calculateDailyCalories = (profile: UserProfile): number => {
  const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];

  // Calculate deficit based on target weight loss rate
  const weightToLose = profile.weight - profile.targetWeight;
  const targetDate = new Date(profile.targetDate);
  const today = new Date();
  const weeksToGoal = Math.max(1, (targetDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weeklyLoss = weightToLose / weeksToGoal;

  // 1 lb = 3500 calories, safe range 0.5-2 lbs/week
  const safeWeeklyLoss = Math.min(2, Math.max(0.5, weeklyLoss));
  const dailyDeficit = (safeWeeklyLoss * 3500) / 7;

  // Minimum 1200 calories for safety
  return Math.max(1200, Math.round(tdee - dailyDeficit));
};

// Calculate protein target (0.7-1g per lb of target body weight)
const calculateDailyProtein = (targetWeight: number): number => {
  return Math.round(targetWeight * 0.8); // 0.8g per lb is a good middle ground
};

const initialState: OnboardingState = {
  completed: false,
  currentStep: 'welcome',
  stepsCompleted: [],
  profile: DEFAULT_PROFILE,
  selectedPattern: 'A',
  mealTimes: DEFAULT_MEAL_TIMES,
  preferredStores: DEFAULT_STORES,
  tutorialsSeen: [],
  calculatedTargets: {
    dailyCalories: 1800,
    dailyProtein: 135,
    weeklyWeightLoss: 1,
  },
  firstWeekPlan: null,
  quickStartUsed: false,
  startedAt: null,
  completedAt: null,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    // Start onboarding
    startOnboarding: (state) => {
      state.startedAt = new Date().toISOString();
      state.currentStep = 'welcome';
    },

    // Navigation
    setCurrentStep: (state, action: PayloadAction<OnboardingStep>) => {
      state.currentStep = action.payload;
    },

    completeStep: (state, action: PayloadAction<OnboardingStep>) => {
      if (!state.stepsCompleted.includes(action.payload)) {
        state.stepsCompleted.push(action.payload);
      }
    },

    goToNextStep: (state) => {
      const steps: OnboardingStep[] = ['welcome', 'profile', 'patterns', 'schedule', 'stores', 'firstWeek'];
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex < steps.length - 1) {
        if (!state.stepsCompleted.includes(state.currentStep)) {
          state.stepsCompleted.push(state.currentStep);
        }
        state.currentStep = steps[currentIndex + 1];
      }
    },

    goToPreviousStep: (state) => {
      const steps: OnboardingStep[] = ['welcome', 'profile', 'patterns', 'schedule', 'stores', 'firstWeek'];
      const currentIndex = steps.indexOf(state.currentStep);
      if (currentIndex > 0) {
        state.currentStep = steps[currentIndex - 1];
      }
    },

    // Profile
    updateProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      state.profile = { ...state.profile, ...action.payload };

      // Recalculate targets
      state.calculatedTargets.dailyCalories = calculateDailyCalories(state.profile);
      state.calculatedTargets.dailyProtein = calculateDailyProtein(state.profile.targetWeight);

      // Calculate weekly weight loss rate
      const weightToLose = state.profile.weight - state.profile.targetWeight;
      const targetDate = new Date(state.profile.targetDate);
      const today = new Date();
      const weeksToGoal = Math.max(1, (targetDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
      state.calculatedTargets.weeklyWeightLoss = Math.min(2, Math.max(0.5, weightToLose / weeksToGoal));
    },

    // Pattern selection
    setSelectedPattern: (state, action: PayloadAction<PatternId>) => {
      state.selectedPattern = action.payload;
    },

    // Meal times
    updateMealTimes: (state, action: PayloadAction<Partial<MealTimePreferences>>) => {
      state.mealTimes = { ...state.mealTimes, ...action.payload };
    },

    // Stores
    togglePreferredStore: (state, action: PayloadAction<string>) => {
      const store = state.preferredStores.find(s => s.id === action.payload);
      if (store) {
        store.isPreferred = !store.isPreferred;
      }
    },

    setStoreRating: (state, action: PayloadAction<{ storeId: string; rating: number }>) => {
      const store = state.preferredStores.find(s => s.id === action.payload.storeId);
      if (store) {
        store.rating = action.payload.rating;
      }
    },

    addCustomStore: (state, action: PayloadAction<PreferredStore>) => {
      state.preferredStores.push(action.payload);
    },

    // First week plan
    setFirstWeekPlan: (state, action: PayloadAction<WeekPlan>) => {
      state.firstWeekPlan = action.payload;
    },

    // Tutorial tracking
    markTutorialSeen: (state, action: PayloadAction<string>) => {
      if (!state.tutorialsSeen.includes(action.payload)) {
        state.tutorialsSeen.push(action.payload);
      }
    },

    resetTutorials: (state) => {
      state.tutorialsSeen = [];
    },

    // Quick start
    useQuickStart: (state) => {
      state.quickStartUsed = true;
      state.profile = {
        ...DEFAULT_PROFILE,
        name: 'Friend',
      };
      state.selectedPattern = 'A'; // Traditional
      state.mealTimes = DEFAULT_MEAL_TIMES;
      state.calculatedTargets = {
        dailyCalories: 1800,
        dailyProtein: 135,
        weeklyWeightLoss: 1,
      };
    },

    // Complete onboarding
    completeOnboarding: (state) => {
      state.completed = true;
      state.completedAt = new Date().toISOString();
      if (!state.stepsCompleted.includes('firstWeek')) {
        state.stepsCompleted.push('firstWeek');
      }
    },

    // Reset
    resetOnboarding: (state) => {
      return { ...initialState };
    },

    // Skip to main app (for existing users)
    skipOnboarding: (state) => {
      state.completed = true;
      state.quickStartUsed = true;
      state.completedAt = new Date().toISOString();
    },
  },
});

export const {
  startOnboarding,
  setCurrentStep,
  completeStep,
  goToNextStep,
  goToPreviousStep,
  updateProfile,
  setSelectedPattern,
  updateMealTimes,
  togglePreferredStore,
  setStoreRating,
  addCustomStore,
  setFirstWeekPlan,
  markTutorialSeen,
  resetTutorials,
  useQuickStart,
  completeOnboarding,
  resetOnboarding,
  skipOnboarding,
} = onboardingSlice.actions;

// Selectors
export const selectOnboarding = (state: { onboarding: OnboardingState }) => state.onboarding;
export const selectIsOnboardingComplete = (state: { onboarding: OnboardingState }) => state.onboarding.completed;
export const selectCurrentStep = (state: { onboarding: OnboardingState }) => state.onboarding.currentStep;
export const selectProfile = (state: { onboarding: OnboardingState }) => state.onboarding.profile;
export const selectCalculatedTargets = (state: { onboarding: OnboardingState }) => state.onboarding.calculatedTargets;
export const selectTutorialsSeen = (state: { onboarding: OnboardingState }) => state.onboarding.tutorialsSeen;
export const selectOnboardingProgress = (state: { onboarding: OnboardingState }) => {
  const totalSteps = 6;
  return (state.onboarding.stepsCompleted.length / totalSteps) * 100;
};

export default onboardingSlice.reducer;
