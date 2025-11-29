import { configureStore } from '@reduxjs/toolkit';
import onboardingReducer, {
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
  selectOnboarding,
  selectIsOnboardingComplete,
  selectCurrentStep,
  selectProfile,
  selectCalculatedTargets,
  selectTutorialsSeen,
  selectOnboardingProgress,
} from '../../../src/mobile/store/slices/onboardingSlice';
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
} from '../../../src/mobile/types/onboarding.types';
import { PatternId } from '../../../src/mobile/types';

describe('onboardingSlice', () => {
  // =============================================================================
  // Test Fixtures
  // =============================================================================

  const createTestStore = (initialState?: Partial<OnboardingState>) => {
    return configureStore({
      reducer: {
        onboarding: onboardingReducer,
      },
      preloadedState: initialState
        ? {
            onboarding: {
              ...getInitialState(),
              ...initialState,
            },
          }
        : undefined,
    });
  };

  const getInitialState = (): OnboardingState => ({
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
  });

  const mockMaleProfile: UserProfile = {
    name: 'John Doe',
    age: 30,
    gender: 'male',
    weight: 200,
    height: 72, // 6'0"
    activityLevel: 'moderate',
    targetWeight: 180,
    targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
  };

  const mockFemaleProfile: UserProfile = {
    name: 'Jane Smith',
    age: 28,
    gender: 'female',
    weight: 160,
    height: 65, // 5'5"
    activityLevel: 'light',
    targetWeight: 140,
    targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
  };

  const mockWeekPlan: WeekPlan = {
    weekOf: '2025-01-27',
    days: [
      {
        date: '2025-01-27',
        dayName: 'Monday',
        patternId: 'A',
        meals: [
          {
            type: 'morning',
            time: '07:30',
            calories: 400,
            protein: 35,
            description: 'Oatmeal with berries',
          },
          {
            type: 'noon',
            time: '12:00',
            calories: 850,
            protein: 60,
            description: 'Grilled chicken salad',
          },
          {
            type: 'evening',
            time: '18:30',
            calories: 550,
            protein: 40,
            description: 'Salmon with vegetables',
          },
        ],
      },
    ],
    totalCalories: 12600,
    estimatedGroceryCost: 85.5,
  };

  const mockCustomStore: PreferredStore = {
    id: 'custom-1',
    name: 'Local Farmers Market',
    address: '123 Main St',
    distance: 2.5,
    rating: 5,
    isPreferred: true,
  };

  // =============================================================================
  // Initial State Tests
  // =============================================================================

  describe('Initial State', () => {
    it('should have correct initial state structure', () => {
      const store = createTestStore();
      const state = store.getState().onboarding;

      expect(state).toEqual({
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
      });
    });

    it('should have correct default profile values', () => {
      const store = createTestStore();
      const { profile } = store.getState().onboarding;

      expect(profile.name).toBe('');
      expect(profile.age).toBe(30);
      expect(profile.gender).toBe('male');
      expect(profile.weight).toBe(180);
      expect(profile.height).toBe(68);
      expect(profile.activityLevel).toBe('moderate');
      expect(profile.targetWeight).toBe(165);
    });

    it('should have correct default meal times', () => {
      const store = createTestStore();
      const { mealTimes } = store.getState().onboarding;

      expect(mealTimes.breakfast).toBe('07:30');
      expect(mealTimes.lunch).toBe('12:00');
      expect(mealTimes.dinner).toBe('18:30');
      expect(mealTimes.workSchedule).toBe('9to5');
      expect(mealTimes.workoutTiming).toBe('none');
    });

    it('should have default stores array', () => {
      const store = createTestStore();
      const { preferredStores } = store.getState().onboarding;

      expect(preferredStores).toHaveLength(9);
      expect(preferredStores.every((store) => !store.isPreferred)).toBe(true);
      expect(preferredStores.every((store) => store.rating === 3)).toBe(true);
    });
  });

  // =============================================================================
  // Onboarding Lifecycle Tests
  // =============================================================================

  describe('Onboarding Lifecycle', () => {
    it('should start onboarding with timestamp', () => {
      const store = createTestStore();
      const beforeTime = new Date().toISOString();

      store.dispatch(startOnboarding());
      const state = store.getState().onboarding;

      expect(state.startedAt).toBeTruthy();
      expect(state.currentStep).toBe('welcome');
      expect(new Date(state.startedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });

    it('should complete onboarding with timestamp', () => {
      const store = createTestStore();
      const beforeTime = new Date().toISOString();

      store.dispatch(completeOnboarding());
      const state = store.getState().onboarding;

      expect(state.completed).toBe(true);
      expect(state.completedAt).toBeTruthy();
      expect(state.stepsCompleted).toContain('firstWeek');
      expect(new Date(state.completedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });

    it('should skip onboarding for existing users', () => {
      const store = createTestStore();

      store.dispatch(skipOnboarding());
      const state = store.getState().onboarding;

      expect(state.completed).toBe(true);
      expect(state.quickStartUsed).toBe(true);
      expect(state.completedAt).toBeTruthy();
    });

    it('should reset onboarding to initial state', () => {
      const store = createTestStore({
        completed: true,
        currentStep: 'firstWeek',
        stepsCompleted: ['welcome', 'profile', 'patterns'],
        tutorialsSeen: ['tutorial-1'],
      });

      store.dispatch(resetOnboarding());
      const state = store.getState().onboarding;

      expect(state).toEqual(getInitialState());
    });
  });

  // =============================================================================
  // Step Navigation Tests
  // =============================================================================

  describe('Step Navigation', () => {
    const steps: OnboardingStep[] = ['welcome', 'profile', 'patterns', 'schedule', 'stores', 'firstWeek'];

    it('should set current step directly', () => {
      const store = createTestStore();

      store.dispatch(setCurrentStep('profile'));
      expect(store.getState().onboarding.currentStep).toBe('profile');

      store.dispatch(setCurrentStep('stores'));
      expect(store.getState().onboarding.currentStep).toBe('stores');
    });

    it('should move to next step and mark current as completed', () => {
      const store = createTestStore();

      store.dispatch(goToNextStep());
      let state = store.getState().onboarding;

      expect(state.currentStep).toBe('profile');
      expect(state.stepsCompleted).toContain('welcome');

      store.dispatch(goToNextStep());
      state = store.getState().onboarding;

      expect(state.currentStep).toBe('patterns');
      expect(state.stepsCompleted).toContain('profile');
    });

    it('should not go beyond last step', () => {
      const store = createTestStore({ currentStep: 'firstWeek' });

      store.dispatch(goToNextStep());
      const state = store.getState().onboarding;

      expect(state.currentStep).toBe('firstWeek');
    });

    it('should move to previous step', () => {
      const store = createTestStore({ currentStep: 'patterns' });

      store.dispatch(goToPreviousStep());
      expect(store.getState().onboarding.currentStep).toBe('profile');

      store.dispatch(goToPreviousStep());
      expect(store.getState().onboarding.currentStep).toBe('welcome');
    });

    it('should not go before first step', () => {
      const store = createTestStore({ currentStep: 'welcome' });

      store.dispatch(goToPreviousStep());
      expect(store.getState().onboarding.currentStep).toBe('welcome');
    });

    it('should complete individual steps', () => {
      const store = createTestStore();

      store.dispatch(completeStep('welcome'));
      expect(store.getState().onboarding.stepsCompleted).toContain('welcome');

      store.dispatch(completeStep('profile'));
      expect(store.getState().onboarding.stepsCompleted).toContain('profile');
      expect(store.getState().onboarding.stepsCompleted).toHaveLength(2);
    });

    it('should not duplicate completed steps', () => {
      const store = createTestStore();

      store.dispatch(completeStep('welcome'));
      store.dispatch(completeStep('welcome'));
      store.dispatch(completeStep('welcome'));

      expect(store.getState().onboarding.stepsCompleted).toEqual(['welcome']);
    });

    it('should navigate through all steps sequentially', () => {
      const store = createTestStore();

      for (let i = 0; i < steps.length - 1; i++) {
        expect(store.getState().onboarding.currentStep).toBe(steps[i]);
        store.dispatch(goToNextStep());
      }

      expect(store.getState().onboarding.currentStep).toBe('firstWeek');
      expect(store.getState().onboarding.stepsCompleted).toHaveLength(5);
    });
  });

  // =============================================================================
  // Profile Update Tests
  // =============================================================================

  describe('Profile Updates', () => {
    it('should update profile name', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ name: 'John Doe' }));
      expect(store.getState().onboarding.profile.name).toBe('John Doe');
    });

    it('should update profile age', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ age: 35 }));
      expect(store.getState().onboarding.profile.age).toBe(35);
    });

    it('should update profile weight and recalculate targets', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ weight: 200 }));
      const state = store.getState().onboarding;

      expect(state.profile.weight).toBe(200);
      expect(state.calculatedTargets.dailyCalories).toBeGreaterThan(1800);
    });

    it('should update activity level and recalculate calories', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ activityLevel: 'very_active' }));
      const state = store.getState().onboarding;

      expect(state.profile.activityLevel).toBe('very_active');
      expect(state.calculatedTargets.dailyCalories).toBeGreaterThan(1800);
    });

    it('should update target weight and recalculate protein', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ targetWeight: 150 }));
      const state = store.getState().onboarding;

      expect(state.profile.targetWeight).toBe(150);
      expect(state.calculatedTargets.dailyProtein).toBe(Math.round(150 * 0.8));
    });

    it('should handle complete profile update', () => {
      const store = createTestStore();

      store.dispatch(updateProfile(mockMaleProfile));
      const { profile } = store.getState().onboarding;

      expect(profile.name).toBe(mockMaleProfile.name);
      expect(profile.age).toBe(mockMaleProfile.age);
      expect(profile.gender).toBe(mockMaleProfile.gender);
      expect(profile.weight).toBe(mockMaleProfile.weight);
      expect(profile.height).toBe(mockMaleProfile.height);
    });

    it('should handle partial profile updates', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ name: 'Test' }));
      store.dispatch(updateProfile({ age: 25 }));
      store.dispatch(updateProfile({ weight: 170 }));

      const { profile } = store.getState().onboarding;
      expect(profile.name).toBe('Test');
      expect(profile.age).toBe(25);
      expect(profile.weight).toBe(170);
    });
  });

  // =============================================================================
  // BMR and Calorie Calculation Tests
  // =============================================================================

  describe('BMR and Calorie Calculations', () => {
    it('should calculate higher BMR for males than females with same stats', () => {
      const store1 = createTestStore();
      const store2 = createTestStore();

      const baseProfile = {
        weight: 180,
        height: 68,
        age: 30,
        targetWeight: 165,
        activityLevel: 'moderate' as const,
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };

      store1.dispatch(updateProfile({ ...baseProfile, gender: 'male' }));
      store2.dispatch(updateProfile({ ...baseProfile, gender: 'female' }));

      const maleCalories = store1.getState().onboarding.calculatedTargets.dailyCalories;
      const femaleCalories = store2.getState().onboarding.calculatedTargets.dailyCalories;

      expect(maleCalories).toBeGreaterThan(femaleCalories);
    });

    it('should calculate higher calories for higher activity levels', () => {
      const store = createTestStore();
      const results: number[] = [];

      const activityLevels: Array<keyof typeof ACTIVITY_MULTIPLIERS> = [
        'sedentary',
        'light',
        'moderate',
        'active',
        'very_active',
      ];

      activityLevels.forEach((level) => {
        store.dispatch(updateProfile({ activityLevel: level }));
        results.push(store.getState().onboarding.calculatedTargets.dailyCalories);
      });

      // Each level should have higher calories than previous
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThan(results[i - 1]);
      }
    });

    it('should enforce minimum 1200 calorie floor', () => {
      const store = createTestStore();

      // Extreme case: very low weight, sedentary, aggressive goal
      store.dispatch(
        updateProfile({
          weight: 100,
          height: 60,
          age: 50,
          gender: 'female',
          activityLevel: 'sedentary',
          targetWeight: 90,
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
        })
      );

      const { dailyCalories } = store.getState().onboarding.calculatedTargets;
      expect(dailyCalories).toBeGreaterThanOrEqual(1200);
    });

    it('should calculate protein based on target weight (0.8g per lb)', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ targetWeight: 150 }));
      expect(store.getState().onboarding.calculatedTargets.dailyProtein).toBe(120); // 150 * 0.8

      store.dispatch(updateProfile({ targetWeight: 200 }));
      expect(store.getState().onboarding.calculatedTargets.dailyProtein).toBe(160); // 200 * 0.8
    });

    it('should calculate safe weekly weight loss (0.5-2 lbs/week)', () => {
      const store = createTestStore();

      // Aggressive timeline - should cap at 2 lbs/week
      store.dispatch(
        updateProfile({
          weight: 200,
          targetWeight: 150,
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
        })
      );

      let state = store.getState().onboarding;
      expect(state.calculatedTargets.weeklyWeightLoss).toBeLessThanOrEqual(2);

      // Very slow timeline - should stay above 0.5 lbs/week
      store.dispatch(
        updateProfile({
          weight: 200,
          targetWeight: 198,
          targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        })
      );

      state = store.getState().onboarding;
      expect(state.calculatedTargets.weeklyWeightLoss).toBeGreaterThanOrEqual(0.5);
    });

    it('should recalculate all targets when profile changes', () => {
      const store = createTestStore();

      const initialTargets = store.getState().onboarding.calculatedTargets;

      store.dispatch(
        updateProfile({
          weight: 220,
          height: 74,
          age: 25,
          gender: 'male',
          activityLevel: 'very_active',
          targetWeight: 190,
        })
      );

      const newTargets = store.getState().onboarding.calculatedTargets;

      expect(newTargets.dailyCalories).not.toBe(initialTargets.dailyCalories);
      expect(newTargets.dailyProtein).not.toBe(initialTargets.dailyProtein);
      expect(newTargets.weeklyWeightLoss).toBeDefined();
    });
  });

  // =============================================================================
  // Pattern Selection Tests
  // =============================================================================

  describe('Pattern Selection', () => {
    const patterns: PatternId[] = ['A', 'B', 'C', 'D', 'E'];

    patterns.forEach((pattern) => {
      it(`should select pattern ${pattern}`, () => {
        const store = createTestStore();

        store.dispatch(setSelectedPattern(pattern));
        expect(store.getState().onboarding.selectedPattern).toBe(pattern);
      });
    });

    it('should change patterns multiple times', () => {
      const store = createTestStore();

      store.dispatch(setSelectedPattern('B'));
      expect(store.getState().onboarding.selectedPattern).toBe('B');

      store.dispatch(setSelectedPattern('C'));
      expect(store.getState().onboarding.selectedPattern).toBe('C');

      store.dispatch(setSelectedPattern('A'));
      expect(store.getState().onboarding.selectedPattern).toBe('A');
    });

    it('should default to pattern A', () => {
      const store = createTestStore();
      expect(store.getState().onboarding.selectedPattern).toBe('A');
    });
  });

  // =============================================================================
  // Meal Time Preferences Tests
  // =============================================================================

  describe('Meal Time Preferences', () => {
    it('should update breakfast time', () => {
      const store = createTestStore();

      store.dispatch(updateMealTimes({ breakfast: '06:00' }));
      expect(store.getState().onboarding.mealTimes.breakfast).toBe('06:00');
    });

    it('should update lunch time', () => {
      const store = createTestStore();

      store.dispatch(updateMealTimes({ lunch: '13:00' }));
      expect(store.getState().onboarding.mealTimes.lunch).toBe('13:00');
    });

    it('should update dinner time', () => {
      const store = createTestStore();

      store.dispatch(updateMealTimes({ dinner: '19:00' }));
      expect(store.getState().onboarding.mealTimes.dinner).toBe('19:00');
    });

    it('should update work schedule', () => {
      const store = createTestStore();

      store.dispatch(updateMealTimes({ workSchedule: 'shift' }));
      expect(store.getState().onboarding.mealTimes.workSchedule).toBe('shift');
    });

    it('should update workout timing', () => {
      const store = createTestStore();

      store.dispatch(updateMealTimes({ workoutTiming: 'morning' }));
      expect(store.getState().onboarding.mealTimes.workoutTiming).toBe('morning');
    });

    it('should handle multiple meal time updates', () => {
      const store = createTestStore();

      store.dispatch(
        updateMealTimes({
          breakfast: '05:30',
          lunch: '11:30',
          dinner: '17:00',
        })
      );

      const { mealTimes } = store.getState().onboarding;
      expect(mealTimes.breakfast).toBe('05:30');
      expect(mealTimes.lunch).toBe('11:30');
      expect(mealTimes.dinner).toBe('17:00');
    });

    it('should update complete meal time preferences', () => {
      const store = createTestStore();

      const newMealTimes: MealTimePreferences = {
        breakfast: '06:00',
        lunch: '12:30',
        dinner: '18:00',
        workSchedule: 'flexible',
        workoutTiming: 'evening',
      };

      store.dispatch(updateMealTimes(newMealTimes));
      expect(store.getState().onboarding.mealTimes).toEqual(newMealTimes);
    });
  });

  // =============================================================================
  // Store Preferences Tests
  // =============================================================================

  describe('Store Preferences', () => {
    it('should toggle store preference on', () => {
      const store = createTestStore();

      store.dispatch(togglePreferredStore('walmart'));
      const walmart = store.getState().onboarding.preferredStores.find((s) => s.id === 'walmart');

      expect(walmart?.isPreferred).toBe(true);
    });

    it('should toggle store preference off', () => {
      const store = createTestStore();

      store.dispatch(togglePreferredStore('walmart'));
      store.dispatch(togglePreferredStore('walmart'));

      const walmart = store.getState().onboarding.preferredStores.find((s) => s.id === 'walmart');
      expect(walmart?.isPreferred).toBe(false);
    });

    it('should set store rating', () => {
      const store = createTestStore();

      store.dispatch(setStoreRating({ storeId: 'walmart', rating: 5 }));
      const walmart = store.getState().onboarding.preferredStores.find((s) => s.id === 'walmart');

      expect(walmart?.rating).toBe(5);
    });

    it('should update existing store rating', () => {
      const store = createTestStore();

      store.dispatch(setStoreRating({ storeId: 'kroger', rating: 4 }));
      store.dispatch(setStoreRating({ storeId: 'kroger', rating: 5 }));

      const kroger = store.getState().onboarding.preferredStores.find((s) => s.id === 'kroger');
      expect(kroger?.rating).toBe(5);
    });

    it('should add custom store', () => {
      const store = createTestStore();

      store.dispatch(addCustomStore(mockCustomStore));
      const stores = store.getState().onboarding.preferredStores;

      expect(stores).toHaveLength(10); // 9 default + 1 custom
      expect(stores.find((s) => s.id === 'custom-1')).toEqual(mockCustomStore);
    });

    it('should add multiple custom stores', () => {
      const store = createTestStore();

      const store1: PreferredStore = {
        id: 'custom-1',
        name: 'Store 1',
        rating: 4,
        isPreferred: true,
      };

      const store2: PreferredStore = {
        id: 'custom-2',
        name: 'Store 2',
        rating: 5,
        isPreferred: false,
      };

      store.dispatch(addCustomStore(store1));
      store.dispatch(addCustomStore(store2));

      const stores = store.getState().onboarding.preferredStores;
      expect(stores).toHaveLength(11);
    });

    it('should handle multiple store operations', () => {
      const store = createTestStore();

      store.dispatch(togglePreferredStore('walmart'));
      store.dispatch(setStoreRating({ storeId: 'walmart', rating: 5 }));
      store.dispatch(togglePreferredStore('kroger'));
      store.dispatch(setStoreRating({ storeId: 'kroger', rating: 4 }));

      const stores = store.getState().onboarding.preferredStores;
      const walmart = stores.find((s) => s.id === 'walmart');
      const kroger = stores.find((s) => s.id === 'kroger');

      expect(walmart?.isPreferred).toBe(true);
      expect(walmart?.rating).toBe(5);
      expect(kroger?.isPreferred).toBe(true);
      expect(kroger?.rating).toBe(4);
    });
  });

  // =============================================================================
  // Tutorial Tracking Tests
  // =============================================================================

  describe('Tutorial Tracking', () => {
    it('should mark tutorial as seen', () => {
      const store = createTestStore();

      store.dispatch(markTutorialSeen('tutorial-1'));
      expect(store.getState().onboarding.tutorialsSeen).toContain('tutorial-1');
    });

    it('should mark multiple tutorials as seen', () => {
      const store = createTestStore();

      store.dispatch(markTutorialSeen('tutorial-1'));
      store.dispatch(markTutorialSeen('tutorial-2'));
      store.dispatch(markTutorialSeen('tutorial-3'));

      expect(store.getState().onboarding.tutorialsSeen).toEqual([
        'tutorial-1',
        'tutorial-2',
        'tutorial-3',
      ]);
    });

    it('should not duplicate tutorial entries', () => {
      const store = createTestStore();

      store.dispatch(markTutorialSeen('tutorial-1'));
      store.dispatch(markTutorialSeen('tutorial-1'));
      store.dispatch(markTutorialSeen('tutorial-1'));

      expect(store.getState().onboarding.tutorialsSeen).toEqual(['tutorial-1']);
    });

    it('should reset tutorials', () => {
      const store = createTestStore({
        tutorialsSeen: ['tutorial-1', 'tutorial-2', 'tutorial-3'],
      });

      store.dispatch(resetTutorials());
      expect(store.getState().onboarding.tutorialsSeen).toEqual([]);
    });
  });

  // =============================================================================
  // Quick Start Tests
  // =============================================================================

  describe('Quick Start', () => {
    it('should set quick start profile', () => {
      const store = createTestStore();

      store.dispatch(useQuickStart());
      const { profile, quickStartUsed } = store.getState().onboarding;

      expect(quickStartUsed).toBe(true);
      expect(profile.name).toBe('Friend');
    });

    it('should set default pattern A for quick start', () => {
      const store = createTestStore({ selectedPattern: 'C' });

      store.dispatch(useQuickStart());
      expect(store.getState().onboarding.selectedPattern).toBe('A');
    });

    it('should set default meal times for quick start', () => {
      const store = createTestStore();

      store.dispatch(useQuickStart());
      const { mealTimes } = store.getState().onboarding;

      expect(mealTimes).toEqual(DEFAULT_MEAL_TIMES);
    });

    it('should set default calorie targets for quick start', () => {
      const store = createTestStore();

      store.dispatch(useQuickStart());
      const { calculatedTargets } = store.getState().onboarding;

      expect(calculatedTargets.dailyCalories).toBe(1800);
      expect(calculatedTargets.dailyProtein).toBe(135);
      expect(calculatedTargets.weeklyWeightLoss).toBe(1);
    });
  });

  // =============================================================================
  // First Week Plan Tests
  // =============================================================================

  describe('First Week Plan', () => {
    it('should set first week plan', () => {
      const store = createTestStore();

      store.dispatch(setFirstWeekPlan(mockWeekPlan));
      expect(store.getState().onboarding.firstWeekPlan).toEqual(mockWeekPlan);
    });

    it('should update first week plan', () => {
      const store = createTestStore({ firstWeekPlan: mockWeekPlan });

      const updatedPlan: WeekPlan = {
        ...mockWeekPlan,
        totalCalories: 13000,
        estimatedGroceryCost: 95.0,
      };

      store.dispatch(setFirstWeekPlan(updatedPlan));
      const { firstWeekPlan } = store.getState().onboarding;

      expect(firstWeekPlan?.totalCalories).toBe(13000);
      expect(firstWeekPlan?.estimatedGroceryCost).toBe(95.0);
    });

    it('should have null first week plan initially', () => {
      const store = createTestStore();
      expect(store.getState().onboarding.firstWeekPlan).toBeNull();
    });
  });

  // =============================================================================
  // Complete Onboarding Flow Tests
  // =============================================================================

  describe('Complete Onboarding Flow', () => {
    it('should complete full onboarding flow', () => {
      const store = createTestStore();

      // Start
      store.dispatch(startOnboarding());
      store.dispatch(completeStep('welcome'));

      // Profile
      store.dispatch(goToNextStep());
      store.dispatch(updateProfile(mockMaleProfile));
      store.dispatch(completeStep('profile'));

      // Pattern
      store.dispatch(goToNextStep());
      store.dispatch(setSelectedPattern('B'));
      store.dispatch(completeStep('patterns'));

      // Schedule
      store.dispatch(goToNextStep());
      store.dispatch(
        updateMealTimes({
          breakfast: '06:00',
          lunch: '12:30',
          dinner: '18:00',
          workSchedule: 'flexible',
        })
      );
      store.dispatch(completeStep('schedule'));

      // Stores
      store.dispatch(goToNextStep());
      store.dispatch(togglePreferredStore('walmart'));
      store.dispatch(togglePreferredStore('kroger'));
      store.dispatch(completeStep('stores'));

      // First Week
      store.dispatch(goToNextStep());
      store.dispatch(setFirstWeekPlan(mockWeekPlan));

      // Complete
      store.dispatch(completeOnboarding());

      const state = store.getState().onboarding;
      expect(state.completed).toBe(true);
      expect(state.stepsCompleted).toHaveLength(6);
      expect(state.currentStep).toBe('firstWeek');
    });

    it('should track onboarding progress correctly', () => {
      const store = createTestStore();

      expect(selectOnboardingProgress(store.getState())).toBe(0);

      store.dispatch(completeStep('welcome'));
      expect(selectOnboardingProgress(store.getState())).toBeCloseTo(16.67, 1);

      store.dispatch(completeStep('profile'));
      expect(selectOnboardingProgress(store.getState())).toBeCloseTo(33.33, 1);

      store.dispatch(completeStep('patterns'));
      expect(selectOnboardingProgress(store.getState())).toBe(50);

      store.dispatch(completeStep('schedule'));
      expect(selectOnboardingProgress(store.getState())).toBeCloseTo(66.67, 1);

      store.dispatch(completeStep('stores'));
      expect(selectOnboardingProgress(store.getState())).toBeCloseTo(83.33, 1);

      store.dispatch(completeStep('firstWeek'));
      expect(selectOnboardingProgress(store.getState())).toBe(100);
    });
  });

  // =============================================================================
  // Selector Tests
  // =============================================================================

  describe('Selectors', () => {
    it('should select onboarding state', () => {
      const store = createTestStore();
      const state = selectOnboarding(store.getState());

      expect(state).toBeDefined();
      expect(state.completed).toBe(false);
    });

    it('should select completion status', () => {
      const store = createTestStore();

      expect(selectIsOnboardingComplete(store.getState())).toBe(false);

      store.dispatch(completeOnboarding());
      expect(selectIsOnboardingComplete(store.getState())).toBe(true);
    });

    it('should select current step', () => {
      const store = createTestStore();

      expect(selectCurrentStep(store.getState())).toBe('welcome');

      store.dispatch(setCurrentStep('profile'));
      expect(selectCurrentStep(store.getState())).toBe('profile');
    });

    it('should select profile', () => {
      const store = createTestStore();

      store.dispatch(updateProfile(mockMaleProfile));
      const profile = selectProfile(store.getState());

      expect(profile).toEqual(mockMaleProfile);
    });

    it('should select calculated targets', () => {
      const store = createTestStore();

      store.dispatch(updateProfile(mockMaleProfile));
      const targets = selectCalculatedTargets(store.getState());

      expect(targets.dailyCalories).toBeGreaterThan(0);
      expect(targets.dailyProtein).toBeGreaterThan(0);
      expect(targets.weeklyWeightLoss).toBeGreaterThan(0);
    });

    it('should select tutorials seen', () => {
      const store = createTestStore();

      store.dispatch(markTutorialSeen('tutorial-1'));
      store.dispatch(markTutorialSeen('tutorial-2'));

      const tutorials = selectTutorialsSeen(store.getState());
      expect(tutorials).toEqual(['tutorial-1', 'tutorial-2']);
    });
  });

  // =============================================================================
  // Edge Cases and Validation Tests
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle zero weight target', () => {
      const store = createTestStore();

      store.dispatch(updateProfile({ targetWeight: 0 }));
      const { calculatedTargets } = store.getState().onboarding;

      expect(calculatedTargets.dailyProtein).toBe(0);
    });

    it('should handle very high activity level and weight', () => {
      const store = createTestStore();

      store.dispatch(
        updateProfile({
          weight: 300,
          height: 78,
          age: 25,
          gender: 'male',
          activityLevel: 'very_active',
        })
      );

      const { calculatedTargets } = store.getState().onboarding;
      expect(calculatedTargets.dailyCalories).toBeGreaterThan(2000);
    });

    it('should handle minimum age and weight', () => {
      const store = createTestStore();

      store.dispatch(
        updateProfile({
          age: 18,
          weight: 100,
          height: 60,
          gender: 'female',
          activityLevel: 'sedentary',
        })
      );

      const { calculatedTargets } = store.getState().onboarding;
      expect(calculatedTargets.dailyCalories).toBeGreaterThanOrEqual(1200);
    });

    it('should handle invalid store ID gracefully', () => {
      const store = createTestStore();

      store.dispatch(togglePreferredStore('invalid-store-id'));
      const stores = store.getState().onboarding.preferredStores;

      expect(stores.every((s) => !s.isPreferred)).toBe(true);
    });

    it('should maintain state consistency after reset', () => {
      const store = createTestStore();

      // Make changes
      store.dispatch(updateProfile({ name: 'Test' }));
      store.dispatch(setSelectedPattern('C'));
      store.dispatch(markTutorialSeen('tutorial-1'));

      // Reset
      store.dispatch(resetOnboarding());

      const state = store.getState().onboarding;
      expect(state.profile.name).toBe('');
      expect(state.selectedPattern).toBe('A');
      expect(state.tutorialsSeen).toEqual([]);
    });
  });
});
