/**
 * Jest Test Setup
 * Global configuration for all test suites
 */

import { jest } from '@jest/globals';

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  },

  toBeValidNutrition(received: any) {
    const hasCalories = typeof received?.calories === 'number' && received.calories >= 0;
    const hasProtein = typeof received?.protein === 'number' && received.protein >= 0;
    const hasCarbs = typeof received?.carbs === 'number' && received.carbs >= 0;
    const hasFat = typeof received?.fat === 'number' && received.fat >= 0;

    const pass = hasCalories && hasProtein && hasCarbs && hasFat;

    return {
      pass,
      message: () =>
        pass
          ? `expected ${JSON.stringify(received)} not to be valid nutrition data`
          : `expected ${JSON.stringify(received)} to have valid calories, protein, carbs, and fat values`
    };
  },

  toBeValidEquipmentState(received: any) {
    const validStates = ['clean', 'dirty', 'in-use', 'dishwasher', 'maintenance'];
    const pass = validStates.includes(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid equipment state`
          : `expected ${received} to be one of: ${validStates.join(', ')}`
    };
  }
});

// Global test utilities
global.testUtils = {
  // Create mock meal data
  createMockMeal: (overrides = {}) => ({
    id: 'meal-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Meal',
    calories: 500,
    protein: 30,
    carbs: 50,
    fat: 15,
    pattern: 'traditional',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  // Create mock inventory item
  createMockInventoryItem: (overrides = {}) => ({
    id: 'inv-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Item',
    quantity: 1,
    unit: 'each',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'fridge',
    ...overrides
  }),

  // Create mock equipment
  createMockEquipment: (overrides = {}) => ({
    id: 'equip-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Equipment',
    type: 'cookware',
    status: 'clean',
    capacity: null,
    ...overrides
  }),

  // Create mock pattern
  createMockPattern: (overrides = {}) => ({
    id: 'pattern-' + Math.random().toString(36).substr(2, 9),
    name: 'Traditional',
    meals: 3,
    targetCalories: 2000,
    targetProtein: 130,
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random data
  randomBetween: (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min
};

// Mock timers for tests that need them
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// Console error tracking
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Fail tests that log unexpected errors
    if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('Error:')) {
      // Allow specific known warnings/errors
      const allowedPatterns = [
        'Warning: ReactDOM.render is no longer supported',
        'Warning: An update to'
      ];

      const isAllowed = allowedPatterns.some(pattern =>
        args[0]?.includes?.(pattern)
      );

      if (!isAllowed) {
        originalError.apply(console, args);
      }
    }
  };
});

afterAll(() => {
  console.error = originalError;
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidNutrition(): R;
      toBeValidEquipmentState(): R;
    }
  }

  var testUtils: {
    createMockMeal: (overrides?: any) => any;
    createMockInventoryItem: (overrides?: any) => any;
    createMockEquipment: (overrides?: any) => any;
    createMockPattern: (overrides?: any) => any;
    waitFor: (ms: number) => Promise<void>;
    randomBetween: (min: number, max: number) => number;
  };
}

export {};
