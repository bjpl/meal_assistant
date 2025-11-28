/**
 * Database Services Index
 * Exports all database service modules
 */

const userService = require('./userService');
const patternService = require('./patternService');

// Feature flag to switch between mock and real database
const USE_DATABASE = process.env.USE_DATABASE === 'true';

// Export appropriate services based on feature flag
if (USE_DATABASE) {
  module.exports = {
    userService,
    patternService,
    // Add other database services as they are implemented
  };
} else {
  // Fall back to in-memory mock services
  const mockServices = require('../../services/dataStore');
  module.exports = {
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
}
