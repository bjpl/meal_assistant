import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import reducers
import patternsReducer from './slices/patternsSlice';
import mealsReducer from './slices/mealsSlice';
import inventoryReducer from './slices/inventorySlice';
import prepReducer from './slices/prepSlice';
import shoppingReducer from './slices/shoppingSlice';
import userReducer from './slices/userSlice';
import syncReducer from './slices/syncSlice';
import hydrationReducer from './slices/hydrationSlice';
import analyticsReducer from './slices/analyticsSlice';
import eventsReducer from './slices/eventsSlice';
import onboardingReducer from './slices/onboardingSlice';
import priceReducer from './slices/priceSlice';
import optimizationReducer from './slices/optimizationSlice';

// Persist configuration
const persistConfig = {
  key: 'meal-assistant-root',
  version: 1,
  storage: AsyncStorage,
  whitelist: ['patterns', 'meals', 'inventory', 'shopping', 'user', 'hydration', 'analytics', 'events', 'onboarding', 'price', 'optimization'], // Persist these reducers
  blacklist: ['sync'], // Don't persist sync state
};

// Combine all reducers
const rootReducer = combineReducers({
  patterns: patternsReducer,
  meals: mealsReducer,
  inventory: inventoryReducer,
  prep: prepReducer,
  shopping: shoppingReducer,
  user: userReducer,
  sync: syncReducer,
  hydration: hydrationReducer,
  analytics: analyticsReducer,
  events: eventsReducer,
  onboarding: onboardingReducer,
  price: priceReducer,
  optimization: optimizationReducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Create persistor
export const persistor = persistStore(store);

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
