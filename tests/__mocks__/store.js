// Mock store for testing
const mockStore = {
  dispatch: jest.fn(),
  getState: jest.fn(() => ({
    sync: {
      isOnline: true,
      isSyncing: false,
      pendingOperations: [],
      lastSyncTime: null,
      errors: [],
    },
  })),
  subscribe: jest.fn(() => jest.fn()),
  replaceReducer: jest.fn(),
};

module.exports = {
  store: mockStore,
  persistor: {
    purge: jest.fn(),
    flush: jest.fn(),
    pause: jest.fn(),
    persist: jest.fn(),
  },
};
