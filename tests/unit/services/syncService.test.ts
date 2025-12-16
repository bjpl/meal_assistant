import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setOnlineStatus,
  setSyncing,
  setLastSyncTime,
  addPendingOperation,
  removePendingOperation,
  incrementRetryCount,
  addSyncError,
} from '../../../src/mobile/store/slices/syncSlice';
import {
  initializeNetworkListener,
  cleanupNetworkListener,
  queueOperation,
  syncPendingOperations,
  startPeriodicSync,
  stopPeriodicSync,
  performFullSync,
  SyncService,
  __setStore,
  __getStore,
} from '../../../src/mobile/services/syncService';

// Mock dependencies
jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage');

// Create mock store for testing
const mockDispatch = jest.fn();
const mockGetState = jest.fn(() => ({
  sync: {
    isOnline: true,
    isSyncing: false,
    pendingOperations: [],
    lastSyncTime: null,
    errors: [],
  },
}));

const mockStore = {
  dispatch: mockDispatch,
  getState: mockGetState,
};

// Mock fetch
global.fetch = jest.fn();

// Constants
const MAX_RETRY_COUNT = 3;
const SYNC_INTERVAL = 30000;

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Inject the mock store BEFORE any operations
    __setStore(mockStore);

    // Reset store mock to default state
    mockGetState.mockReturnValue({
      sync: {
        isOnline: true,
        isSyncing: false,
        pendingOperations: [],
        lastSyncTime: null,
        errors: [],
      },
    });

    // Clean up any lingering network listeners from previous tests
    cleanupNetworkListener();
    stopPeriodicSync();
  });

  afterEach(() => {
    cleanupNetworkListener();
    stopPeriodicSync();
    // Reset to default store
    __setStore(null);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Network Listener', () => {
    describe('initializeNetworkListener', () => {
      it('should register network event listener', () => {
        const mockUnsubscribe = jest.fn();
        (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);

        initializeNetworkListener();

        expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
        expect(NetInfo.addEventListener).toHaveBeenCalledWith(expect.any(Function));
      });

      it('should dispatch online status when connected', () => {
        let listener: ((state: any) => void) | null = null;
        (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
          listener = cb;
          return jest.fn();
        });

        initializeNetworkListener();

        // Simulate online state
        listener!({ isConnected: true, isInternetReachable: true });

        expect(mockDispatch).toHaveBeenCalledWith(setOnlineStatus(true));
      });

      it('should dispatch offline status when disconnected', () => {
        let listener: ((state: any) => void) | null = null;
        (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
          listener = cb;
          return jest.fn();
        });

        initializeNetworkListener();

        // Simulate offline state
        listener!({ isConnected: false, isInternetReachable: false });

        expect(mockDispatch).toHaveBeenCalledWith(setOnlineStatus(false));
      });

      it('should handle null isConnected value', () => {
        let listener: ((state: any) => void) | null = null;
        (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
          listener = cb;
          return jest.fn();
        });

        initializeNetworkListener();

        // Simulate null state
        listener!({ isConnected: null, isInternetReachable: null });

        expect(mockDispatch).toHaveBeenCalledWith(setOnlineStatus(false));
      });

      it('should trigger sync when coming back online', () => {
        let listener: ((state: any) => void) | null = null;
        (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
          listener = cb;
          return jest.fn();
        });

        mockGetState.mockReturnValue({
          sync: {
            isOnline: false,
            isSyncing: false,
            pendingOperations: [],
          },
        });

        initializeNetworkListener();

        // Simulate coming online
        listener!({ isConnected: true, isInternetReachable: true });

        // Note: syncPendingOperations is called but won't execute due to empty queue
        expect(mockGetState).toHaveBeenCalled();
      });
    });

    describe('cleanupNetworkListener', () => {
      it('should unsubscribe from network events', () => {
        const mockUnsubscribe = jest.fn();
        (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);

        initializeNetworkListener();
        cleanupNetworkListener();

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      });

      it('should handle cleanup when not initialized', () => {
        expect(() => cleanupNetworkListener()).not.toThrow();
      });

      it('should allow multiple cleanups safely', () => {
        const mockUnsubscribe = jest.fn();
        (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);

        initializeNetworkListener();
        cleanupNetworkListener();
        cleanupNetworkListener();

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Queue Operations', () => {
    describe('queueOperation', () => {
      it('should create and queue a meal create operation', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        const data = { name: 'Test Meal', calories: 500 };
        queueOperation('create', 'meal', data);

        expect(mockDispatch).toHaveBeenCalledWith(
          addPendingOperation(
            expect.objectContaining({
              type: 'create',
              entity: 'meal',
              data,
              retryCount: 0,
              id: expect.any(String),
              timestamp: expect.any(String),
            })
          )
        );
      });

      it('should create and queue an inventory update operation', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        const data = { id: '123', quantity: 10 };
        queueOperation('update', 'inventory', data);

        expect(mockDispatch).toHaveBeenCalledWith(
          addPendingOperation(
            expect.objectContaining({
              type: 'update',
              entity: 'inventory',
              data,
            })
          )
        );
      });

      it('should create and queue a shopping delete operation', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        const data = { id: '456' };
        queueOperation('delete', 'shopping', data);

        expect(mockDispatch).toHaveBeenCalledWith(
          addPendingOperation(
            expect.objectContaining({
              type: 'delete',
              entity: 'shopping',
              data,
            })
          )
        );
      });

      it('should create and queue a weight entry operation', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        const data = { weight: 75.5, date: '2025-11-28' };
        queueOperation('create', 'weight', data);

        expect(mockDispatch).toHaveBeenCalledWith(
          addPendingOperation(
            expect.objectContaining({
              entity: 'weight',
              data,
            })
          )
        );
      });

      it('should generate unique operation IDs', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        const calls: any[] = [];
        mockDispatch.mockImplementation((action) => {
          if (action.type === addPendingOperation.type) {
            calls.push(action.payload);
          }
        });

        queueOperation('create', 'meal', { name: 'Meal 1' });
        queueOperation('create', 'meal', { name: 'Meal 2' });

        expect(calls[0].id).not.toBe(calls[1].id);
      });

      it('should set timestamp in ISO format', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        queueOperation('create', 'meal', { name: 'Test' });

        const call = mockDispatch.mock.calls.find(
          (call) => call[0].type === addPendingOperation.type
        );
        const timestamp = call[0].payload.timestamp;

        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('should attempt sync immediately when online', async () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: true },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
        });

        queueOperation('create', 'meal', { name: 'Test' });

        // Wait for async operations
        await Promise.resolve();

        expect(global.fetch).toHaveBeenCalled();
      });

      it('should not attempt sync when offline', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        queueOperation('create', 'meal', { name: 'Test' });

        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe('Sync Operations', () => {
    describe('syncPendingOperations', () => {
      it('should not sync when offline', async () => {
        mockGetState.mockReturnValue({
          sync: {
            isOnline: false,
            isSyncing: false,
            pendingOperations: [
              {
                id: '1',
                type: 'create',
                entity: 'meal',
                data: { name: 'Test' },
                timestamp: new Date().toISOString(),
                retryCount: 0,
              },
            ],
          },
        });

        await syncPendingOperations();

        expect(mockDispatch).not.toHaveBeenCalledWith(setSyncing(true));
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should not sync when already syncing', async () => {
        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: true,
            pendingOperations: [
              {
                id: '1',
                type: 'create',
                entity: 'meal',
                data: { name: 'Test' },
                timestamp: new Date().toISOString(),
                retryCount: 0,
              },
            ],
          },
        });

        await syncPendingOperations();

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should not sync when no pending operations', async () => {
        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: false,
            pendingOperations: [],
          },
        });

        await syncPendingOperations();

        expect(mockDispatch).not.toHaveBeenCalledWith(setSyncing(true));
      });

      it('should skip operations exceeding max retry count', async () => {
        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: false,
            pendingOperations: [
              {
                id: '1',
                type: 'create',
                entity: 'meal',
                data: { name: 'Test' },
                timestamp: new Date().toISOString(),
                retryCount: MAX_RETRY_COUNT + 1, // Exceeded max retries (4 > 3)
              },
            ],
          },
        });

        await syncPendingOperations();

        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should sync pending operations successfully', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test Meal' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: false,
            pendingOperations: [operation],
          },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
        });

        await syncPendingOperations();

        expect(mockDispatch).toHaveBeenCalledWith(setSyncing(true));
        expect(global.fetch).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(removePendingOperation('1'));
        expect(mockDispatch).toHaveBeenCalledWith(
          setLastSyncTime(expect.any(String))
        );
        expect(mockDispatch).toHaveBeenCalledWith(setSyncing(false));
      });

      it('should process multiple operations in order', async () => {
        const operations = [
          {
            id: '1',
            type: 'create' as const,
            entity: 'meal' as const,
            data: { name: 'Meal 1' },
            timestamp: new Date().toISOString(),
            retryCount: 0,
          },
          {
            id: '2',
            type: 'update' as const,
            entity: 'inventory' as const,
            data: { id: '123', quantity: 5 },
            timestamp: new Date().toISOString(),
            retryCount: 0,
          },
        ];

        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: false,
            pendingOperations: operations,
          },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
        });

        await syncPendingOperations();

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(mockDispatch).toHaveBeenCalledWith(removePendingOperation('1'));
        expect(mockDispatch).toHaveBeenCalledWith(removePendingOperation('2'));
      });

      it('should set syncing to false even on error', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: false,
            pendingOperations: [operation],
          },
        });

        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        await syncPendingOperations();

        expect(mockDispatch).toHaveBeenCalledWith(setSyncing(false));
      });
    });

    describe('Sync Operation (Internal)', () => {
      it('should successfully sync create operation', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test Meal' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
        });

        await syncPendingOperations();

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.mealassistant.app/v1/meals',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(operation.data),
          })
        );
      });

      it('should successfully sync update operation', async () => {
        const operation = {
          id: '1',
          type: 'update' as const,
          entity: 'inventory' as const,
          data: { id: '123', quantity: 10 },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
        });

        await syncPendingOperations();

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.mealassistant.app/v1/inventory/123',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(operation.data),
          })
        );
      });

      it('should successfully sync delete operation without body', async () => {
        const operation = {
          id: '1',
          type: 'delete' as const,
          entity: 'shopping' as const,
          data: { id: '456' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 204,
        });

        await syncPendingOperations();

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.mealassistant.app/v1/shopping-lists/456',
          expect.objectContaining({
            method: 'DELETE',
            body: undefined,
          })
        );
      });

      it('should increment retry count on failure when below max', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: 1,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        await syncPendingOperations();

        expect(mockDispatch).toHaveBeenCalledWith(incrementRetryCount('1'));
      });

      it('should add sync error when max retries exceeded', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: MAX_RETRY_COUNT,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        await syncPendingOperations();

        expect(mockDispatch).toHaveBeenCalledWith(
          addSyncError({
            operationId: '1',
            error: 'Network error',
          })
        );
      });

      it('should handle HTTP error responses', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await syncPendingOperations();

        expect(mockDispatch).toHaveBeenCalledWith(incrementRetryCount('1'));
      });

      it('should handle non-Error exceptions', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: MAX_RETRY_COUNT,
        };

        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockRejectedValue('String error');

        await syncPendingOperations();

        expect(mockDispatch).toHaveBeenCalledWith(
          addSyncError({
            operationId: '1',
            error: 'Unknown error',
          })
        );
      });
    });
  });

  describe('Endpoint Resolution', () => {
    it('should resolve meal endpoints correctly', async () => {
      const operations = [
        {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
        {
          id: '2',
          type: 'update' as const,
          entity: 'meal' as const,
          data: { id: '123', name: 'Updated' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
        {
          id: '3',
          type: 'delete' as const,
          entity: 'meal' as const,
          data: { id: '456' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
      ];

      for (const operation of operations) {
        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
        });

        (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

        await syncPendingOperations();
      }

      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toBe('https://api.mealassistant.app/v1/meals');
      expect(calls[1][0]).toBe('https://api.mealassistant.app/v1/meals/123');
      expect(calls[2][0]).toBe('https://api.mealassistant.app/v1/meals/456');
    });

    it('should resolve inventory endpoints correctly', async () => {
      const operation = {
        id: '1',
        type: 'create' as const,
        entity: 'inventory' as const,
        data: { name: 'Test' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      mockGetState.mockReturnValue({
        sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
      });

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await syncPendingOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mealassistant.app/v1/inventory',
        expect.any(Object)
      );
    });

    it('should resolve shopping endpoints correctly', async () => {
      const operation = {
        id: '1',
        type: 'update' as const,
        entity: 'shopping' as const,
        data: { id: '789', name: 'Test' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      mockGetState.mockReturnValue({
        sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
      });

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await syncPendingOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mealassistant.app/v1/shopping-lists/789',
        expect.any(Object)
      );
    });

    it('should resolve weight endpoints correctly', async () => {
      const operation = {
        id: '1',
        type: 'delete' as const,
        entity: 'weight' as const,
        data: { id: '101' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      mockGetState.mockReturnValue({
        sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
      });

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await syncPendingOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mealassistant.app/v1/weight-entries/101',
        expect.any(Object)
      );
    });
  });

  describe('HTTP Method Resolution', () => {
    it('should use POST for create operations', async () => {
      const operation = {
        id: '1',
        type: 'create' as const,
        entity: 'meal' as const,
        data: { name: 'Test' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      mockGetState.mockReturnValue({
        sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
      });

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await syncPendingOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should use PUT for update operations', async () => {
      const operation = {
        id: '1',
        type: 'update' as const,
        entity: 'meal' as const,
        data: { id: '123', name: 'Test' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      mockGetState.mockReturnValue({
        sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
      });

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await syncPendingOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should use DELETE for delete operations', async () => {
      const operation = {
        id: '1',
        type: 'delete' as const,
        entity: 'meal' as const,
        data: { id: '123' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      mockGetState.mockReturnValue({
        sync: { isOnline: true, isSyncing: false, pendingOperations: [operation] },
      });

      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await syncPendingOperations();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Periodic Sync', () => {
    let setIntervalSpy: jest.SpyInstance;
    let clearIntervalSpy: jest.SpyInstance;

    beforeEach(() => {
      setIntervalSpy = jest.spyOn(global, 'setInterval');
      clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    });

    afterEach(() => {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    describe('startPeriodicSync', () => {
      it('should start periodic sync interval', () => {
        startPeriodicSync();

        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), SYNC_INTERVAL);
      });

      it('should clear existing interval before starting new one', () => {
        startPeriodicSync();

        // Get the interval ID returned from the first call
        const firstIntervalId = setIntervalSpy.mock.results[0]?.value;

        startPeriodicSync();

        // clearInterval should have been called with the first interval
        expect(clearIntervalSpy).toHaveBeenCalled();
      });

      it('should trigger sync on interval', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [] },
        });

        startPeriodicSync();

        jest.advanceTimersByTime(SYNC_INTERVAL);

        expect(mockGetState).toHaveBeenCalled();
      });

      it('should continue periodic sync across multiple intervals', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [] },
        });

        startPeriodicSync();

        jest.advanceTimersByTime(SYNC_INTERVAL);
        jest.advanceTimersByTime(SYNC_INTERVAL);
        jest.advanceTimersByTime(SYNC_INTERVAL);

        // getState is called once per interval
        expect(mockGetState.mock.calls.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('stopPeriodicSync', () => {
      it('should stop periodic sync', () => {
        startPeriodicSync();

        stopPeriodicSync();

        expect(clearIntervalSpy).toHaveBeenCalled();
      });

      it('should handle stop when not started', () => {
        expect(() => stopPeriodicSync()).not.toThrow();
      });

      it('should prevent further syncs after stopping', () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: true, isSyncing: false, pendingOperations: [] },
        });

        startPeriodicSync();
        stopPeriodicSync();

        const callsBefore = mockGetState.mock.calls.length;
        jest.advanceTimersByTime(SYNC_INTERVAL);
        const callsAfter = mockGetState.mock.calls.length;

        expect(callsAfter).toBe(callsBefore);
      });

      it('should allow restart after stop', () => {
        startPeriodicSync();
        stopPeriodicSync();

        setIntervalSpy.mockClear();
        startPeriodicSync();

        expect(setIntervalSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Full Sync', () => {
    describe('performFullSync', () => {
      it('should throw error when offline', async () => {
        mockGetState.mockReturnValue({
          sync: { isOnline: false },
        });

        await expect(performFullSync()).rejects.toThrow('Cannot sync while offline');
      });

      it('should perform full sync when online', async () => {
        mockGetState.mockReturnValue({
          sync: {
            isOnline: true,
            isSyncing: false,
            pendingOperations: [],
          },
        });

        await performFullSync();

        expect(mockDispatch).toHaveBeenCalledWith(setSyncing(true));
        expect(mockDispatch).toHaveBeenCalledWith(
          setLastSyncTime(expect.any(String))
        );
        expect(mockDispatch).toHaveBeenCalledWith(setSyncing(false));
      });

      it('should sync pending operations first', async () => {
        const operation = {
          id: '1',
          type: 'create' as const,
          entity: 'meal' as const,
          data: { name: 'Test' },
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        let callCount = 0;
        mockGetState.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return { sync: { isOnline: true, isSyncing: false, pendingOperations: [] } };
          }
          return {
            sync: {
              isOnline: true,
              isSyncing: false,
              pendingOperations: callCount === 2 ? [operation] : [],
            },
          };
        });

        (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

        await performFullSync();

        expect(global.fetch).toHaveBeenCalled();
      });

      it('should set syncing to false even on error', async () => {
        let callCount = 0;
        mockGetState.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return { sync: { isOnline: true } };
          }
          throw new Error('Test error');
        });

        await expect(performFullSync()).rejects.toThrow();

        expect(mockDispatch).toHaveBeenCalledWith(setSyncing(false));
      });
    });
  });

  describe('SyncService Export', () => {
    it('should export initialize method', () => {
      expect(SyncService.initialize).toBe(initializeNetworkListener);
    });

    it('should export cleanup method', () => {
      expect(SyncService.cleanup).toBe(cleanupNetworkListener);
    });

    it('should export queueOperation method', () => {
      expect(SyncService.queueOperation).toBe(queueOperation);
    });

    it('should export syncPending method', () => {
      expect(SyncService.syncPending).toBe(syncPendingOperations);
    });

    it('should export startPeriodicSync method', () => {
      expect(SyncService.startPeriodicSync).toBe(startPeriodicSync);
    });

    it('should export stopPeriodicSync method', () => {
      expect(SyncService.stopPeriodicSync).toBe(stopPeriodicSync);
    });

    it('should export performFullSync method', () => {
      expect(SyncService.performFullSync).toBe(performFullSync);
    });
  });
});
