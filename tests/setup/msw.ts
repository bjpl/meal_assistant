/**
 * MSW Setup for Jest Tests
 *
 * This file configures MSW (Mock Service Worker) to intercept
 * HTTP requests during test execution.
 *
 * Import this file in your Jest setup:
 * - jest.config.js: setupFilesAfterEnv: ['<rootDir>/tests/setup/msw.ts']
 * - Or in individual test files if needed
 */

import { server } from '../mocks/server';

/**
 * Establish API mocking before all tests
 */
beforeAll(() => {
  // Enable request interception
  server.listen({
    // Log warnings when requests are made without matching handlers
    onUnhandledRequest: 'warn',
  });
});

/**
 * Reset handlers after each test to ensure test isolation
 * This prevents handlers from one test affecting another
 */
afterEach(() => {
  server.resetHandlers();
});

/**
 * Clean up after all tests are done
 */
afterAll(() => {
  server.close();
});

/**
 * Suppress console errors from MSW in tests (optional)
 * Uncomment if you want cleaner test output
 */
// beforeAll(() => {
//   // Store original console.error
//   const originalError = console.error;
//
//   // Filter out MSW-related errors
//   jest.spyOn(console, 'error').mockImplementation((...args) => {
//     const message = args[0]?.toString() || '';
//
//     // Suppress MSW warnings but show other errors
//     if (
//       message.includes('[MSW]') ||
//       message.includes('Request handler')
//     ) {
//       return;
//     }
//
//     originalError.call(console, ...args);
//   });
// });
//
// afterAll(() => {
//   jest.restoreAllMocks();
// });
