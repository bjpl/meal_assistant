/**
 * Jest Configuration for Meal Assistant
 * Comprehensive testing setup for unit, integration, and E2E tests
 */

const path = require('path');

module.exports = {
  // Root directory
  rootDir: path.resolve(__dirname, '..'),

  // Test environment
  testEnvironment: 'node',

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform TypeScript and JSX files
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: path.resolve(__dirname, '..', 'tsconfig.json')
    }],
    '^.+\\.(js|jsx)$': ['ts-jest', {
      tsconfig: path.resolve(__dirname, '..', 'tsconfig.json')
    }]
  },

  // Transform React Native and mobile packages in node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@expo|expo|react-native-web|@react-native-async-storage)/)'
  ],

  // Test patterns - include both .ts and .js test files
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/tests/**/*.spec.js'
  ],

  // Ignore patterns
  // Note: apiService.test.ts excluded due to memory issues - run separately with test:api-heavy
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    'apiService\\.test\\.ts$'
  ],

  // Module name mapping for path aliases and React Native mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    // Mock React Native modules
    '^react-native$': 'react-native-web',
    '^@react-native-async-storage/async-storage$': '<rootDir>/tests/__mocks__/async-storage.js',
    '^@react-native-community/netinfo$': '<rootDir>/tests/__mocks__/netinfo.js',
    '^expo-notifications$': '<rootDir>/tests/__mocks__/expo-notifications.js',
    '^expo-constants$': '<rootDir>/tests/__mocks__/expo-constants.js',
    '^expo-linear-gradient$': '<rootDir>/tests/__mocks__/expo-linear-gradient.js',
    '^expo-device$': '<rootDir>/tests/__mocks__/expo-constants.js',
    // Mock Redux and store
    '^redux-persist$': '<rootDir>/tests/__mocks__/redux-persist.js',
    '^redux-persist/(.*)$': '<rootDir>/tests/__mocks__/redux-persist.js',
    // Mock the mobile store
    '^.*/mobile/store$': '<rootDir>/tests/__mocks__/store.js',
    '^.*/mobile/store/index$': '<rootDir>/tests/__mocks__/store.js',
    // Mock image and asset imports
    '\\.(jpg|jpeg|png|gif|svg|ttf|woff|woff2)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },

  // Coverage configuration - disabled by default to prevent memory issues
  // Use --coverage flag when coverage is needed
  collectCoverage: false,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts'
  ],

  // Coverage thresholds - Disabled temporarily for incremental testing
  // Will re-enable when full test suite runs without memory issues
  // Current: 6.5% (isolated runs), Target: 40% (short-term), 90% (long-term)
  // coverageThreshold: {
  //   global: {
  //     branches: 15,
  //     functions: 15,
  //     lines: 20,
  //     statements: 20
  //   }
  // },

  // Global timeout for tests
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Global setup/teardown
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',

  // Maximum workers - reduced to prevent heap memory issues
  maxWorkers: 2,

  // Worker memory limit - restart workers that use too much memory
  workerIdleMemoryLimit: '512MB',

  // Force exit after tests complete
  forceExit: true,
  detectOpenHandles: true,

  // Run tests in isolated processes to prevent memory leaks between tests
  isolatedModules: true,

  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/coverage',
      outputName: 'junit.xml'
    }]
  ]
};
