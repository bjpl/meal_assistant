import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { RootState, AppDispatch } from '../store';
import { setSelectedPattern, setPatternForDate } from '../store/slices/patternsSlice';
import { addMealLog, addWeightEntry } from '../store/slices/mealsSlice';
import { addItem, updateQuantity, consumeItem } from '../store/slices/inventorySlice';
import { toggleItemChecked, setListStatus } from '../store/slices/shoppingSlice';
import { setPreferences } from '../store/slices/userSlice';
import { MealLog, InventoryItem, WeightEntry, PatternId, UserPreferences } from '../types';

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);

// Pattern hooks
export const usePatterns = () => {
  const dispatch = useAppDispatch();
  const { patterns, selectedPattern, weeklySchedule, patternStats } = useAppSelector(
    (state) => state.patterns
  );

  const selectPattern = useCallback(
    (patternId: PatternId) => {
      dispatch(setSelectedPattern(patternId));
    },
    [dispatch]
  );

  const schedulePattern = useCallback(
    (date: string, patternId: PatternId) => {
      dispatch(setPatternForDate({ date, patternId }));
    },
    [dispatch]
  );

  const getPatternForDate = useCallback(
    (date: string) => {
      return weeklySchedule[date] || selectedPattern;
    },
    [weeklySchedule, selectedPattern]
  );

  const currentPattern = patterns.find((p) => p.id === selectedPattern);

  return {
    patterns,
    selectedPattern,
    currentPattern,
    weeklySchedule,
    patternStats,
    selectPattern,
    schedulePattern,
    getPatternForDate,
  };
};

// Meals hooks
export const useMeals = () => {
  const dispatch = useAppDispatch();
  const { mealLogs, dailyStats, weightEntries, pendingUploads } = useAppSelector(
    (state) => state.meals
  );

  const logMeal = useCallback(
    (meal: MealLog) => {
      dispatch(addMealLog(meal));
    },
    [dispatch]
  );

  const logWeight = useCallback(
    (entry: WeightEntry) => {
      dispatch(addWeightEntry(entry));
    },
    [dispatch]
  );

  const getMealsForDate = useCallback(
    (date: string) => {
      return mealLogs.filter((m) => m.date === date);
    },
    [mealLogs]
  );

  const getStatsForDate = useCallback(
    (date: string) => {
      return dailyStats.find((s) => s.date === date);
    },
    [dailyStats]
  );

  const getTodayCalories = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = mealLogs.filter((m) => m.date === today);
    return todayMeals.reduce(
      (sum, m) => sum + m.components.reduce((s, c) => s + c.calories, 0),
      0
    );
  }, [mealLogs]);

  const getTodayProtein = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = mealLogs.filter((m) => m.date === today);
    return todayMeals.reduce(
      (sum, m) => sum + m.components.reduce((s, c) => s + c.protein, 0),
      0
    );
  }, [mealLogs]);

  return {
    mealLogs,
    dailyStats,
    weightEntries,
    pendingUploads,
    logMeal,
    logWeight,
    getMealsForDate,
    getStatsForDate,
    getTodayCalories,
    getTodayProtein,
  };
};

// Inventory hooks
export const useInventory = () => {
  const dispatch = useAppDispatch();
  const { items, lastUpdated } = useAppSelector((state) => state.inventory);

  const addInventoryItem = useCallback(
    (item: InventoryItem) => {
      dispatch(addItem(item));
    },
    [dispatch]
  );

  const updateItemQuantity = useCallback(
    (id: string, quantity: number) => {
      dispatch(updateQuantity({ id, quantity }));
    },
    [dispatch]
  );

  const useItem = useCallback(
    (id: string, amount: number) => {
      dispatch(consumeItem({ id, amount }));
    },
    [dispatch]
  );

  const getExpiringItems = useCallback(
    (daysAhead: number = 3) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + daysAhead);
      return items.filter((item) => {
        if (!item.expiryDate) return false;
        return new Date(item.expiryDate) <= cutoff;
      });
    },
    [items]
  );

  const getItemsByLocation = useCallback(
    (location: InventoryItem['location']) => {
      return items.filter((item) => item.location === location);
    },
    [items]
  );

  return {
    items,
    lastUpdated,
    addInventoryItem,
    updateItemQuantity,
    useItem,
    getExpiringItems,
    getItemsByLocation,
  };
};

// Shopping hooks
export const useShopping = () => {
  const dispatch = useAppDispatch();
  const { currentList, pastLists, favoriteStores, priceHistory } = useAppSelector(
    (state) => state.shopping
  );

  const toggleItem = useCallback(
    (itemId: string) => {
      dispatch(toggleItemChecked(itemId));
    },
    [dispatch]
  );

  const startShopping = useCallback(() => {
    dispatch(setListStatus('shopping'));
  }, [dispatch]);

  const getProgress = useCallback(() => {
    if (!currentList) return 0;
    const checked = currentList.items.filter((i) => i.checked).length;
    return (checked / currentList.items.length) * 100;
  }, [currentList]);

  const getDeals = useCallback(() => {
    if (!currentList) return [];
    return currentList.items.filter((i) => i.deal);
  }, [currentList]);

  return {
    currentList,
    pastLists,
    favoriteStores,
    priceHistory,
    toggleItem,
    startShopping,
    getProgress,
    getDeals,
  };
};

// User preferences hooks
export const useUserPreferences = () => {
  const dispatch = useAppDispatch();
  const { preferences, profile, onboardingComplete } = useAppSelector(
    (state) => state.user
  );

  const updatePreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      dispatch(setPreferences(updates));
    },
    [dispatch]
  );

  const calorieDeficit = profile.startWeight > profile.targetWeight ? 500 : 0;
  const bmr = 10 * (profile.startWeight * 0.453592) + 6.25 * (profile.height * 2.54) - 5 * profile.age + 5;
  const tdee = bmr * 1.5; // Moderate activity

  return {
    preferences,
    profile,
    onboardingComplete,
    updatePreferences,
    calorieDeficit,
    estimatedTDEE: Math.round(tdee),
  };
};

// Sync status hooks
export const useSyncStatus = () => {
  const { isOnline, isSyncing, lastSyncTime, pendingOperations, syncErrors } =
    useAppSelector((state) => state.sync);

  const hasPendingChanges = pendingOperations.length > 0;
  const hasErrors = syncErrors.length > 0;

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    pendingOperations,
    syncErrors,
    hasPendingChanges,
    hasErrors,
  };
};
