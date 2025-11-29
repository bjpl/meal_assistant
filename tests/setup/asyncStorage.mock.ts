/**
 * AsyncStorage mock for Jest tests
 */

const mockStorage = new Map<string, string>();

const AsyncStorageMock = {
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockStorage.get(key) || null);
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    mockStorage.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => {
    return Promise.resolve(Array.from(mockStorage.keys()));
  }),
  multiGet: jest.fn((keys: string[]) => {
    return Promise.resolve(
      keys.map((key) => [key, mockStorage.get(key) || null])
    );
  }),
  multiSet: jest.fn((keyValuePairs: [string, string][]) => {
    keyValuePairs.forEach(([key, value]) => {
      mockStorage.set(key, value);
    });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((key) => mockStorage.delete(key));
    return Promise.resolve();
  }),
};

export { mockStorage, AsyncStorageMock };
export default AsyncStorageMock;
