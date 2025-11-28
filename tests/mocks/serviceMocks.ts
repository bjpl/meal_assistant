/**
 * Service Mocks
 * Mock implementations for unit and integration testing
 */

import { jest } from '@jest/globals';

// Type definitions for mocks
interface HttpResponse {
  data: Record<string, unknown>;
  status: number;
}

interface MockDocument {
  id?: string;
  [key: string]: unknown;
}

interface TimelineTask {
  id: string;
  name: string;
  duration: number;
  dependencies: string[];
  startTime: Date | null;
}

// Mock HTTP client
export const createMockHttpClient = () => ({
  get: jest.fn<() => Promise<HttpResponse>>().mockResolvedValue({ data: {}, status: 200 }),
  post: jest.fn<() => Promise<HttpResponse>>().mockResolvedValue({ data: {}, status: 201 }),
  put: jest.fn<() => Promise<HttpResponse>>().mockResolvedValue({ data: {}, status: 200 }),
  delete: jest.fn<() => Promise<HttpResponse>>().mockResolvedValue({ data: {}, status: 204 }),
  setHeader: jest.fn<(name: string, value: string) => void>(),
  setBaseUrl: jest.fn<(url: string) => void>()
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
  const store = new Map<string, unknown>();

  return {
    get: jest.fn<(key: string) => unknown>().mockImplementation((key: string) => store.get(key)),
    set: jest.fn<(key: string, value: unknown) => boolean>().mockImplementation((key: string, value: unknown) => {
      store.set(key, value);
      return true;
    }),
    remove: jest.fn<(key: string) => boolean>().mockImplementation((key: string) => store.delete(key)),
    clear: jest.fn<() => void>().mockImplementation(() => store.clear()),
    keys: jest.fn<() => string[]>().mockImplementation(() => Array.from(store.keys())),
    has: jest.fn<(key: string) => boolean>().mockImplementation((key: string) => store.has(key))
  };
};

// Mock Notification Service
interface MockNotification {
  id: string;
  sentAt?: Date;
  scheduledFor?: Date;
  [key: string]: unknown;
}

export const createMockNotificationService = () => {
  const notifications: MockNotification[] = [];
  const scheduled: MockNotification[] = [];

  return {
    send: jest.fn<(notification: Record<string, unknown>) => Promise<boolean>>().mockImplementation((notification: Record<string, unknown>) => {
      notifications.push({ ...notification, sentAt: new Date(), id: `notif-${Date.now()}` });
      return Promise.resolve(true);
    }),
    schedule: jest.fn<(notification: Record<string, unknown>, time: Date) => Promise<string>>().mockImplementation((notification: Record<string, unknown>, time: Date) => {
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
  track: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  identify: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  page: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  flush: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getEvents: jest.fn<() => unknown[]>().mockReturnValue([])
});

// Mock Image Processing Service
interface MockImage {
  size: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export const createMockImageService = () => ({
  compress: jest.fn<(image: MockImage, quality: number) => Promise<MockImage>>().mockImplementation(async (image: MockImage, quality: number) => ({
    ...image,
    compressed: true,
    quality,
    size: Math.round(image.size * quality)
  })),
  resize: jest.fn<(image: MockImage, width: number, height: number) => Promise<MockImage>>().mockImplementation(async (image: MockImage, width: number, height: number) => ({
    ...image,
    width,
    height
  })),
  extractText: jest.fn<() => Promise<{ text: string; confidence: number }>>().mockResolvedValue({
    text: 'Mocked extracted text',
    confidence: 0.95
  }),
  scanBarcode: jest.fn<() => Promise<{ code: string; format: string }>>().mockResolvedValue({
    code: '012345678901',
    format: 'UPC-A'
  })
});

// Mock Timer/Scheduler
interface TimerEntry {
  callback: () => void;
  delay: number;
  recurring: boolean;
}

export const createMockTimer = () => {
  const timers: Map<string, TimerEntry> = new Map();

  return {
    setTimeout: jest.fn<(callback: () => void, delay: number) => string>().mockImplementation((callback: () => void, delay: number) => {
      const id = `timer-${Date.now()}`;
      timers.set(id, { callback, delay, recurring: false });
      return id;
    }),
    setInterval: jest.fn<(callback: () => void, delay: number) => string>().mockImplementation((callback: () => void, delay: number) => {
      const id = `interval-${Date.now()}`;
      timers.set(id, { callback, delay, recurring: true });
      return id;
    }),
    clear: jest.fn<(id: string) => boolean>().mockImplementation((id: string) => timers.delete(id)),
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
