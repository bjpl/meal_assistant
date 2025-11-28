import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'meal' | 'inventory' | 'shopping' | 'weight';
  data: any;
  timestamp: string;
  retryCount: number;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingOperations: SyncOperation[];
  syncErrors: { operationId: string; error: string; timestamp: string }[];
}

const initialState: SyncState = {
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null,
  pendingOperations: [],
  syncErrors: [],
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setLastSyncTime: (state, action: PayloadAction<string>) => {
      state.lastSyncTime = action.payload;
    },
    addPendingOperation: (state, action: PayloadAction<SyncOperation>) => {
      state.pendingOperations.push(action.payload);
    },
    removePendingOperation: (state, action: PayloadAction<string>) => {
      state.pendingOperations = state.pendingOperations.filter(
        (op) => op.id !== action.payload
      );
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const operation = state.pendingOperations.find(
        (op) => op.id === action.payload
      );
      if (operation) {
        operation.retryCount += 1;
      }
    },
    addSyncError: (
      state,
      action: PayloadAction<{ operationId: string; error: string }>
    ) => {
      state.syncErrors.push({
        operationId: action.payload.operationId,
        error: action.payload.error,
        timestamp: new Date().toISOString(),
      });
      // Keep only last 50 errors
      if (state.syncErrors.length > 50) {
        state.syncErrors = state.syncErrors.slice(-50);
      }
    },
    clearSyncErrors: (state) => {
      state.syncErrors = [];
    },
    clearPendingOperations: (state) => {
      state.pendingOperations = [];
    },
  },
});

export const {
  setOnlineStatus,
  setSyncing,
  setLastSyncTime,
  addPendingOperation,
  removePendingOperation,
  incrementRetryCount,
  addSyncError,
  clearSyncErrors,
  clearPendingOperations,
} = syncSlice.actions;

export default syncSlice.reducer;
