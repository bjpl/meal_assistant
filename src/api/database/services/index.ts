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
export default USE_DATABASE ? {
  userService,
  patternService,
  mealService,
  inventoryService,
  prepService,
  shoppingService,
  analyticsService,
  hydrationService
} : (() => {
  // Fall back to in-memory mock services
  const mockServices = require('../../services/dataStore');
  return {
    userService: mockServices.userService,
    patternService: mockServices.patternService,
    mealService: mockServices.mealService,
    inventoryService: mockServices.inventoryService,
    prepService: mockServices.prepService,
    shoppingService: mockServices.shoppingService,
    equipmentService: mockServices.equipmentService,
    analyticsService: mockServices.analyticsService,
    hydrationService: mockServices.hydrationService,
    caffeineService: mockServices.caffeineService,
    clearAll: mockServices.clearAll
  };
})();

// Named exports for backward compatibility
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
