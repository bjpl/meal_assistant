/**
 * Database Services Index
 * Exports all database service modules
 */

import userService from './userService';
import patternService from './patternService';
import mealService from './mealService';
import inventoryService from './inventoryService';
import prepService from './prepService';
import shoppingService from './shoppingService';
import analyticsService from './analyticsService';
import hydrationService from './hydrationService';

// Feature flag to switch between mock and real database
const USE_DATABASE = process.env.USE_DATABASE === 'true';

// Export appropriate services based on feature flag
if (USE_DATABASE) {
  export {
    userService,
    patternService,
    mealService,
    inventoryService,
    prepService,
    shoppingService,
    analyticsService,
    hydrationService
  };
} else {
  // Fall back to in-memory mock services
  const mockServices = require('../../services/dataStore');
  export const {
    userService: mockUserService,
    patternService: mockPatternService,
    mealService: mockMealService,
    inventoryService: mockInventoryService,
    prepService: mockPrepService,
    shoppingService: mockShoppingService,
    equipmentService,
    analyticsService: mockAnalyticsService,
    hydrationService: mockHydrationService,
    caffeineService,
    clearAll
  } = mockServices;
}
