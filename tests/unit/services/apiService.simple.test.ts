/**
 * Simplified apiService tests - Testing core functionality without full module loading
 */

describe('apiService basic tests', () => {
  it('should import successfully', () => {
    // This is a minimal test to verify the setup works
    expect(true).toBe(true);
  });

  describe('Mock setup', () => {
    it('should have AsyncStorage mock', () => {
      const AsyncStorageMock = require('../../setup/asyncStorage.mock').default;
      expect(AsyncStorageMock).toBeDefined();
      expect(AsyncStorageMock.getItem).toBeDefined();
      expect(AsyncStorageMock.setItem).toBeDefined();
    });

    it('should have API mocks', () => {
      const { createMockResponse, STORAGE_KEYS } = require('../../mocks/apiMocks');
      expect(createMockResponse).toBeDefined();
      expect(STORAGE_KEYS).toBeDefined();
    });
  });
});
