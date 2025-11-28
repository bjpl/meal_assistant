/**
 * Service Mocks
 * Mock implementations for unit and integration testing
 */

import { jest } from '@jest/globals';

// Mock HTTP client
export const createMockHttpClient = () => ({
  get: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  post: jest.fn().mockResolvedValue({ data: {}, status: 201 }),
  put: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
  delete: jest.fn().mockResolvedValue({ data: {}, status: 204 }),
  setHeader: jest.fn(),
  setBaseUrl: jest.fn()
});

// Mock Database
export const createMockDatabase = () => {
  const collections = new Map<string, Map<string, any>>();

  return {
    collection(name: string) {
      if (!collections.has(name)) {
        collections.set(name, new Map());
      }
      const col = collections.get(name)!;

      return {
        insert: jest.fn().mockImplementation(async (doc) => {
          const id = doc.id || `${name}-${Date.now()}`;
          col.set(id, { ...doc, id });
          return { ...doc, id };
        }),
        find: jest.fn().mockImplementation(async (query) => {
          const results = Array.from(col.values());
          if (query) {
            return results.filter(doc => {
              return Object.entries(query).every(([key, value]) => doc[key] === value);
            });
          }
          return results;
        }),
        findOne: jest.fn().mockImplementation(async (query) => {
          if (typeof query === 'string') {
            return col.get(query);
          }
          const results = Array.from(col.values());
          return results.find(doc =>
            Object.entries(query).every(([key, value]) => doc[key] === value)
          );
        }),
        update: jest.fn().mockImplementation(async (id, updates) => {
          const doc = col.get(id);
          if (doc) {
            const updated = { ...doc, ...updates };
            col.set(id, updated);
            return updated;
          }
          return null;
        }),
        delete: jest.fn().mockImplementation(async (id) => {
          return col.delete(id);
        }),
        count: jest.fn().mockImplementation(async () => col.size),
        clear: jest.fn().mockImplementation(async () => col.clear())
      };
    },
    transaction: jest.fn().mockImplementation(async (fn) => {
      return await fn();
    }),
    close: jest.fn().mockResolvedValue(undefined)
  };
};

// Mock Storage
export const createMockStorage = () => {
  const store = new Map<string, any>();

  return {
    get: jest.fn().mockImplementation((key: string) => store.get(key)),
    set: jest.fn().mockImplementation((key: string, value: any) => {
      store.set(key, value);
      return true;
    }),
    remove: jest.fn().mockImplementation((key: string) => store.delete(key)),
    clear: jest.fn().mockImplementation(() => store.clear()),
    keys: jest.fn().mockImplementation(() => Array.from(store.keys())),
    has: jest.fn().mockImplementation((key: string) => store.has(key))
  };
};

// Mock Notification Service
export const createMockNotificationService = () => {
  const notifications: any[] = [];
  const scheduled: any[] = [];

  return {
    send: jest.fn().mockImplementation((notification) => {
      notifications.push({ ...notification, sentAt: new Date(), id: `notif-${Date.now()}` });
      return Promise.resolve(true);
    }),
    schedule: jest.fn().mockImplementation((notification, time) => {
      const id = `scheduled-${Date.now()}`;
      scheduled.push({ ...notification, scheduledFor: time, id });
      return Promise.resolve(id);
    }),
    cancel: jest.fn().mockImplementation((id) => {
      const index = scheduled.findIndex(n => n.id === id);
      if (index >= 0) {
        scheduled.splice(index, 1);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }),
    getScheduled: jest.fn().mockImplementation(() => [...scheduled]),
    getSent: jest.fn().mockImplementation(() => [...notifications]),
    clearAll: jest.fn().mockImplementation(() => {
      notifications.length = 0;
      scheduled.length = 0;
    })
  };
};

// Mock Analytics Service
export const createMockAnalyticsService = () => ({
  track: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(undefined),
  page: jest.fn().mockResolvedValue(undefined),
  flush: jest.fn().mockResolvedValue(undefined),
  getEvents: jest.fn().mockReturnValue([])
});

// Mock Image Processing Service
export const createMockImageService = () => ({
  compress: jest.fn().mockImplementation(async (image, quality) => ({
    ...image,
    compressed: true,
    quality,
    size: Math.round(image.size * quality)
  })),
  resize: jest.fn().mockImplementation(async (image, width, height) => ({
    ...image,
    width,
    height
  })),
  extractText: jest.fn().mockResolvedValue({
    text: 'Mocked extracted text',
    confidence: 0.95
  }),
  scanBarcode: jest.fn().mockResolvedValue({
    code: '012345678901',
    format: 'UPC-A'
  })
});

// Mock Timer/Scheduler
export const createMockTimer = () => {
  const timers: Map<string, { callback: () => void; delay: number; recurring: boolean }> = new Map();

  return {
    setTimeout: jest.fn().mockImplementation((callback, delay) => {
      const id = `timer-${Date.now()}`;
      timers.set(id, { callback, delay, recurring: false });
      return id;
    }),
    setInterval: jest.fn().mockImplementation((callback, delay) => {
      const id = `interval-${Date.now()}`;
      timers.set(id, { callback, delay, recurring: true });
      return id;
    }),
    clear: jest.fn().mockImplementation((id) => timers.delete(id)),
    clearAll: jest.fn().mockImplementation(() => timers.clear()),
    executeTimer: (id: string) => {
      const timer = timers.get(id);
      if (timer) {
        timer.callback();
        if (!timer.recurring) {
          timers.delete(id);
        }
      }
    },
    executeAll: () => {
      timers.forEach((timer, id) => {
        timer.callback();
        if (!timer.recurring) {
          timers.delete(id);
        }
      });
    }
  };
};

// Mock API Response Factories
export const mockResponses = {
  success: <T>(data: T) => ({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString()
  }),

  error: (message: string, code: string = 'ERROR') => ({
    success: false,
    data: null,
    error: { message, code },
    timestamp: new Date().toISOString()
  }),

  paginated: <T>(items: T[], page: number, pageSize: number, total: number) => ({
    success: true,
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString()
  })
};

// Mock Error Classes
export class MockNetworkError extends Error {
  constructor(message: string = 'Network error') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class MockValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

export class MockAuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

// Export factory function for complete mock context
export const createMockContext = () => ({
  http: createMockHttpClient(),
  db: createMockDatabase(),
  storage: createMockStorage(),
  notifications: createMockNotificationService(),
  analytics: createMockAnalyticsService(),
  images: createMockImageService(),
  timer: createMockTimer()
});

export default {
  createMockHttpClient,
  createMockDatabase,
  createMockStorage,
  createMockNotificationService,
  createMockAnalyticsService,
  createMockImageService,
  createMockTimer,
  createMockContext,
  mockResponses,
  MockNetworkError,
  MockValidationError,
  MockAuthError
};
