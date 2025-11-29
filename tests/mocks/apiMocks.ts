/**
 * Mock setup for API service tests
 */

// Mock AsyncStorage
const mockAsyncStorage = {
  storage: new Map<string, string>(),

  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.storage.set(key, value);
    return Promise.resolve();
  }),

  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockAsyncStorage.storage.get(key) || null);
  }),

  removeItem: jest.fn((key: string) => {
    mockAsyncStorage.storage.delete(key);
    return Promise.resolve();
  }),

  clear: jest.fn(() => {
    mockAsyncStorage.storage.clear();
    return Promise.resolve();
  }),

  getAllKeys: jest.fn(() => {
    return Promise.resolve(Array.from(mockAsyncStorage.storage.keys()));
  }),

  multiGet: jest.fn((keys: string[]) => {
    return Promise.resolve(
      keys.map((key) => [key, mockAsyncStorage.storage.get(key) || null])
    );
  }),

  multiSet: jest.fn((keyValuePairs: [string, string][]) => {
    keyValuePairs.forEach(([key, value]) => {
      mockAsyncStorage.storage.set(key, value);
    });
    return Promise.resolve();
  }),

  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((key) => mockAsyncStorage.storage.delete(key));
    return Promise.resolve();
  }),

  // Helper to reset storage between tests
  _reset: () => {
    mockAsyncStorage.storage.clear();
    jest.clearAllMocks();
  },
};

// Mock fetch
export const mockFetch = jest.fn();

// Setup global mocks
export function setupApiMocks() {
  // Mock AsyncStorage
  jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

  // Mock global fetch
  global.fetch = mockFetch;

  // Mock setTimeout and clearTimeout for timeout tests
  jest.useFakeTimers();
}

// Reset all mocks
export function resetApiMocks() {
  mockAsyncStorage._reset();
  mockFetch.mockReset();
  jest.clearAllTimers();
}

// Helper to create a successful fetch response
export function createMockResponse<T>(
  data: T,
  options: { status?: number; ok?: boolean; headers?: Record<string, string> } = {}
) {
  const { status = 200, ok = true, headers = {} } = options;

  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    clone: () => createMockResponse(data, options),
  } as Response);
}

// Helper to create a failed fetch response
export function createMockErrorResponse(
  error: { error: string; code?: string; message?: string },
  status: number = 400
) {
  return createMockResponse(error, { status, ok: false });
}

// Helper to create a token response
export function createMockTokenResponse(tokens?: Partial<{
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  tokenType: string;
}>) {
  const now = new Date();
  const accessExpires = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
  const refreshExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return {
    accessToken: tokens?.accessToken || 'mock-access-token',
    refreshToken: tokens?.refreshToken || 'mock-refresh-token',
    accessExpiresAt: tokens?.accessExpiresAt || accessExpires.toISOString(),
    refreshExpiresAt: tokens?.refreshExpiresAt || refreshExpires.toISOString(),
    tokenType: tokens?.tokenType || 'Bearer',
  };
}

// Helper to simulate network delay
export function simulateNetworkDelay(ms: number = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to create abort error (timeout)
export function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

// Helper to create network error
export function createNetworkError() {
  return new Error('Network request failed');
}

// Export the mock AsyncStorage instance
export { mockAsyncStorage };

// Export storage keys for testing
export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@meal_assistant:access_token',
  REFRESH_TOKEN: '@meal_assistant:refresh_token',
  USER: '@meal_assistant:user',
  OFFLINE_QUEUE: '@meal_assistant:offline_queue',
  REQUEST_CACHE: '@meal_assistant:request_cache',
};
