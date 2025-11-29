// Mock redux-persist for testing
module.exports = {
  persistStore: jest.fn(() => ({
    purge: jest.fn(),
    flush: jest.fn(),
    pause: jest.fn(),
    persist: jest.fn(),
  })),
  persistReducer: jest.fn((config, reducer) => reducer),
  FLUSH: 'persist/FLUSH',
  REHYDRATE: 'persist/REHYDRATE',
  PAUSE: 'persist/PAUSE',
  PERSIST: 'persist/PERSIST',
  PURGE: 'persist/PURGE',
  REGISTER: 'persist/REGISTER',
};
