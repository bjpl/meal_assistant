import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import {
  setOnlineStatus,
  setSyncing,
  setLastSyncTime,
  addPendingOperation,
  removePendingOperation,
  incrementRetryCount,
  addSyncError,
} from '../store/slices/syncSlice';

const MAX_RETRY_COUNT = 3;
const SYNC_INTERVAL = 30000; // 30 seconds

// Types
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'meal' | 'inventory' | 'shopping' | 'weight';
  data: any;
  timestamp: string;
  retryCount: number;
}

// API base URL - would come from environment
const API_BASE_URL = 'https://api.mealassistant.app/v1';

// Network status listener
let unsubscribeNetInfo: (() => void) | null = null;

export const initializeNetworkListener = () => {
  unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    const isOnline = state.isConnected && state.isInternetReachable;
    store.dispatch(setOnlineStatus(isOnline ?? false));

    // Trigger sync when coming back online
    if (isOnline) {
      syncPendingOperations();
    }
  });
};

export const cleanupNetworkListener = () => {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
};

// Queue an operation for sync
export const queueOperation = (
  type: SyncOperation['type'],
  entity: SyncOperation['entity'],
  data: any
) => {
  const operation: SyncOperation = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    entity,
    data,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  store.dispatch(addPendingOperation(operation));

  // Try to sync immediately if online
  const state = store.getState();
  if (state.sync.isOnline) {
    syncOperation(operation);
  }
};

// Sync a single operation
const syncOperation = async (operation: SyncOperation): Promise<boolean> => {
  try {
    const endpoint = getEndpoint(operation);
    const method = getMethod(operation.type);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add auth token here
        // 'Authorization': `Bearer ${getAuthToken()}`
      },
      body: operation.type !== 'delete' ? JSON.stringify(operation.data) : undefined,
    });

    if (response.ok) {
      store.dispatch(removePendingOperation(operation.id));
      return true;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Sync operation failed:', error);

    if (operation.retryCount < MAX_RETRY_COUNT) {
      store.dispatch(incrementRetryCount(operation.id));
    } else {
      store.dispatch(
        addSyncError({
          operationId: operation.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }

    return false;
  }
};

// Sync all pending operations
export const syncPendingOperations = async () => {
  const state = store.getState();

  if (!state.sync.isOnline || state.sync.isSyncing) {
    return;
  }

  const pendingOps = state.sync.pendingOperations.filter(
    (op) => op.retryCount < MAX_RETRY_COUNT
  );

  if (pendingOps.length === 0) {
    return;
  }

  store.dispatch(setSyncing(true));

  try {
    // Process operations in order
    for (const operation of pendingOps) {
      await syncOperation(operation);
    }

    store.dispatch(setLastSyncTime(new Date().toISOString()));
  } finally {
    store.dispatch(setSyncing(false));
  }
};

// Get API endpoint for operation
const getEndpoint = (operation: SyncOperation): string => {
  const entityEndpoints: Record<SyncOperation['entity'], string> = {
    meal: '/meals',
    inventory: '/inventory',
    shopping: '/shopping-lists',
    weight: '/weight-entries',
  };

  const base = entityEndpoints[operation.entity];

  switch (operation.type) {
    case 'create':
      return base;
    case 'update':
    case 'delete':
      return `${base}/${operation.data.id}`;
    default:
      return base;
  }
};

// Get HTTP method for operation type
const getMethod = (type: SyncOperation['type']): string => {
  switch (type) {
    case 'create':
      return 'POST';
    case 'update':
      return 'PUT';
    case 'delete':
      return 'DELETE';
    default:
      return 'POST';
  }
};

// Start periodic sync
let syncInterval: NodeJS.Timeout | null = null;

export const startPeriodicSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncInterval = setInterval(() => {
    syncPendingOperations();
  }, SYNC_INTERVAL);
};

export const stopPeriodicSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
};

// Manual full sync (pull + push)
export const performFullSync = async () => {
  const state = store.getState();

  if (!state.sync.isOnline) {
    throw new Error('Cannot sync while offline');
  }

  store.dispatch(setSyncing(true));

  try {
    // Push pending changes first
    await syncPendingOperations();

    // Then pull latest data from server
    // This would update local Redux state with server data
    // Implementation depends on your API design

    store.dispatch(setLastSyncTime(new Date().toISOString()));
  } finally {
    store.dispatch(setSyncing(false));
  }
};

// Export sync service
export const SyncService = {
  initialize: initializeNetworkListener,
  cleanup: cleanupNetworkListener,
  queueOperation,
  syncPending: syncPendingOperations,
  startPeriodicSync,
  stopPeriodicSync,
  performFullSync,
};
