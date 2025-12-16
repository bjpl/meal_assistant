// Mock store for testing
// Export individual mock functions so tests can access and configure them

// Create mock functions that are properly tracked
const mockDispatch = jest.fn();
const mockGetState = jest.fn(() => ({
  sync: {
    isOnline: true,
    isSyncing: false,
    pendingOperations: [],
    lastSyncTime: null,
    errors: [],
  },
  auth: {
    isAuthenticated: true,
    token: 'mock-token',
    user: { id: '1', name: 'Test User' },
  },
}));

const mockStore = {
  dispatch: mockDispatch,
  getState: mockGetState,
  subscribe: jest.fn(() => jest.fn()),
  replaceReducer: jest.fn(),
};

// ESM-compatible exports
module.exports = {
  __esModule: true,
  store: mockStore,
  // Export mock functions at module level for tests to access
  __mockDispatch: mockDispatch,
  __mockGetState: mockGetState,
  default: mockStore,
  persistor: {
    purge: jest.fn(),
    flush: jest.fn(),
    pause: jest.fn(),
    persist: jest.fn(),
  },
};
