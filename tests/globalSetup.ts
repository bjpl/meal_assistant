/**
 * Global Setup for Jest Tests
 * Runs once before all test suites
 */

export default async function globalSetup(): Promise<void> {
  console.log('\n========================================');
  console.log('  Meal Assistant Test Suite Starting');
  console.log('========================================\n');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.DATABASE_URL = 'sqlite::memory:';

  // Initialize test database if needed
  // await initTestDatabase();

  // Store start time for test duration tracking
  (global as any).__TEST_START_TIME__ = Date.now();

  console.log('Global setup complete.\n');
}
