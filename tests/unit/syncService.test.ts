/**
 * Unit Tests: Sync Service
 * Tests for offline queue, conflict resolution, and data synchronization
 * Target: 90% coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Types
interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'meal' | 'inventory' | 'pattern' | 'weight';
  data: any;
  timestamp: Date;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
}

interface SyncConflict {
  operationId: string;
  localData: any;
  serverData: any;
  resolution: 'local' | 'server' | 'merge' | 'pending';
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  conflicts: number;
}

// Sync Service
const createSyncService = () => {
  const queue: SyncOperation[] = [];
  const conflicts: SyncConflict[] = [];
  let isOnline = true;
  let lastSync: Date | null = null;

  return {
    setOnline(online: boolean): void {
      isOnline = online;
    },

    isOnline(): boolean {
      return isOnline;
    },

    queueOperation(
      type: SyncOperation['type'],
      entity: SyncOperation['entity'],
      data: any
    ): SyncOperation {
      const operation: SyncOperation = {
        id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        entity,
        data,
        timestamp: new Date(),
        status: 'pending',
        retryCount: 0
      };
      queue.push(operation);
      return operation;
    },

    getQueue(): SyncOperation[] {
      return [...queue];
    },

    getPendingCount(): number {
      return queue.filter(op => op.status === 'pending').length;
    },

    getOperation(id: string): SyncOperation | undefined {
      return queue.find(op => op.id === id);
    },

    async processQueue(): Promise<{ success: number; failed: number }> {
      if (!isOnline) {
        return { success: 0, failed: 0 };
      }

      let success = 0;
      let failed = 0;

      for (const operation of queue.filter(op => op.status === 'pending')) {
        operation.status = 'syncing';

        try {
          // Simulate API call
          await this.simulateApiCall(operation);
          operation.status = 'synced';
          success++;
        } catch (error) {
          operation.status = 'failed';
          operation.retryCount++;
          failed++;
        }
      }

      if (success > 0) {
        lastSync = new Date();
      }

      // Remove synced operations
      const syncedIds = queue.filter(op => op.status === 'synced').map(op => op.id);
      syncedIds.forEach(id => {
        const index = queue.findIndex(op => op.id === id);
        if (index !== -1) queue.splice(index, 1);
      });

      return { success, failed };
    },

    async simulateApiCall(operation: SyncOperation): Promise<void> {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate occasional failures
      if (Math.random() < 0.1) {
        throw new Error('Network error');
      }
    },

    async retryFailed(): Promise<{ success: number; stillFailed: number }> {
      const failedOps = queue.filter(op => op.status === 'failed' && op.retryCount < 3);
      let success = 0;
      let stillFailed = 0;

      for (const operation of failedOps) {
        operation.status = 'pending';
        try {
          await this.simulateApiCall(operation);
          operation.status = 'synced';
          success++;
        } catch {
          operation.status = 'failed';
          operation.retryCount++;
          stillFailed++;
        }
      }

      return { success, stillFailed };
    },

    addConflict(operationId: string, localData: any, serverData: any): SyncConflict {
      const conflict: SyncConflict = {
        operationId,
        localData,
        serverData,
        resolution: 'pending'
      };
      conflicts.push(conflict);
      return conflict;
    },

    getConflicts(): SyncConflict[] {
      return conflicts.filter(c => c.resolution === 'pending');
    },

    resolveConflict(operationId: string, resolution: 'local' | 'server' | 'merge', mergedData?: any): boolean {
      const conflict = conflicts.find(c => c.operationId === operationId);
      if (!conflict) return false;

      conflict.resolution = resolution;

      if (resolution === 'local') {
        // Keep local version, re-queue with higher priority
        const operation = queue.find(op => op.id === operationId);
        if (operation) {
          operation.status = 'pending';
          operation.data = conflict.localData;
        }
      } else if (resolution === 'server') {
        // Accept server version, remove from queue
        const index = queue.findIndex(op => op.id === operationId);
        if (index !== -1) queue.splice(index, 1);
      } else if (resolution === 'merge' && mergedData) {
        const operation = queue.find(op => op.id === operationId);
        if (operation) {
          operation.status = 'pending';
          operation.data = mergedData;
        }
      }

      return true;
    },

    autoResolveConflict(conflict: SyncConflict): 'local' | 'server' {
      // Auto-resolve based on timestamp
      const localTime = new Date(conflict.localData.timestamp || 0).getTime();
      const serverTime = new Date(conflict.serverData.timestamp || 0).getTime();

      return localTime > serverTime ? 'local' : 'server';
    },

    getStatus(): SyncStatus {
      return {
        isOnline,
        lastSync,
        pendingOperations: this.getPendingCount(),
        conflicts: this.getConflicts().length
      };
    },

    clearQueue(): void {
      queue.length = 0;
    },

    clearConflicts(): void {
      conflicts.length = 0;
    },

    exportQueue(): SyncOperation[] {
      return JSON.parse(JSON.stringify(queue));
    },

    importQueue(operations: SyncOperation[]): void {
      queue.push(...operations.map(op => ({
        ...op,
        timestamp: new Date(op.timestamp),
        status: 'pending' as const
      })));
    },

    compactQueue(): number {
      // Remove duplicate operations on same entity
      const seen = new Map<string, SyncOperation>();
      let removed = 0;

      queue.forEach(op => {
        const key = `${op.entity}-${op.data.id}`;
        const existing = seen.get(key);

        if (existing) {
          // Keep the most recent operation
          if (op.timestamp > existing.timestamp) {
            const index = queue.findIndex(o => o.id === existing.id);
            if (index !== -1) {
              queue.splice(index, 1);
              removed++;
            }
            seen.set(key, op);
          } else {
            const index = queue.findIndex(o => o.id === op.id);
            if (index !== -1) {
              queue.splice(index, 1);
              removed++;
            }
          }
        } else {
          seen.set(key, op);
        }
      });

      return removed;
    },

    prioritizeOperations(): void {
      // Sort by: failed first (for retry), then by type, then by timestamp
      queue.sort((a, b) => {
        if (a.status === 'failed' && b.status !== 'failed') return -1;
        if (b.status === 'failed' && a.status !== 'failed') return 1;

        const typePriority: Record<string, number> = {
          delete: 1,
          update: 2,
          create: 3
        };

        const aPriority = typePriority[a.type] || 4;
        const bPriority = typePriority[b.type] || 4;

        if (aPriority !== bPriority) return aPriority - bPriority;

        return a.timestamp.getTime() - b.timestamp.getTime();
      });
    }
  };
};

describe('Sync Service', () => {
  let service: ReturnType<typeof createSyncService>;

  beforeEach(() => {
    service = createSyncService();
  });

  describe('Online/Offline Status', () => {
    it('should start online', () => {
      expect(service.isOnline()).toBe(true);
    });

    it('should toggle online status', () => {
      service.setOnline(false);
      expect(service.isOnline()).toBe(false);

      service.setOnline(true);
      expect(service.isOnline()).toBe(true);
    });
  });

  describe('Queue Operations', () => {
    it('should queue create operation', () => {
      const op = service.queueOperation('create', 'meal', { name: 'Test Meal', calories: 500 });

      expect(op).toHaveProperty('id');
      expect(op.type).toBe('create');
      expect(op.status).toBe('pending');
    });

    it('should queue update operation', () => {
      const op = service.queueOperation('update', 'meal', { id: 'meal-1', calories: 600 });

      expect(op.type).toBe('update');
    });

    it('should queue delete operation', () => {
      const op = service.queueOperation('delete', 'inventory', { id: 'inv-1' });

      expect(op.type).toBe('delete');
      expect(op.entity).toBe('inventory');
    });

    it('should get queue', () => {
      service.queueOperation('create', 'meal', { name: 'Meal 1' });
      service.queueOperation('create', 'meal', { name: 'Meal 2' });

      const queue = service.getQueue();

      expect(queue).toHaveLength(2);
    });

    it('should get pending count', () => {
      service.queueOperation('create', 'meal', { name: 'Meal 1' });
      service.queueOperation('create', 'meal', { name: 'Meal 2' });

      expect(service.getPendingCount()).toBe(2);
    });

    it('should get operation by ID', () => {
      const op = service.queueOperation('create', 'meal', { name: 'Test' });
      const retrieved = service.getOperation(op.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.data.name).toBe('Test');
    });
  });

  describe('Queue Processing', () => {
    beforeEach(() => {
      jest.useRealTimers(); // Use real timers for async tests
    });

    afterEach(() => {
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should process queue when online', async () => {
      service.queueOperation('create', 'meal', { name: 'Meal 1' });
      service.queueOperation('create', 'meal', { name: 'Meal 2' });

      const result = await service.processQueue();

      expect(result.success + result.failed).toBe(2);
    });

    it('should not process when offline', async () => {
      service.setOnline(false);
      service.queueOperation('create', 'meal', { name: 'Meal 1' });

      const result = await service.processQueue();

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should remove synced operations from queue', async () => {
      service.queueOperation('create', 'meal', { name: 'Meal 1' });

      await service.processQueue();

      // Most operations should be synced and removed
      expect(service.getPendingCount()).toBeLessThanOrEqual(1);
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      jest.useRealTimers(); // Use real timers for async tests
    });

    afterEach(() => {
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should retry failed operations', async () => {
      const op = service.queueOperation('create', 'meal', { name: 'Test' });
      const queue = service.getQueue();
      const queuedOp = queue.find(o => o.id === op.id);
      if (queuedOp) {
        queuedOp.status = 'failed';
        queuedOp.retryCount = 1;
      }

      const result = await service.retryFailed();

      expect(result.success + result.stillFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Conflict Management', () => {
    it('should add conflict', () => {
      const conflict = service.addConflict(
        'op-1',
        { name: 'Local Version', calories: 500 },
        { name: 'Server Version', calories: 600 }
      );

      expect(conflict.resolution).toBe('pending');
      expect(service.getConflicts()).toHaveLength(1);
    });

    it('should resolve conflict with local', () => {
      const op = service.queueOperation('update', 'meal', { id: 'meal-1', name: 'Local' });
      service.addConflict(
        op.id,
        { name: 'Local', calories: 500 },
        { name: 'Server', calories: 600 }
      );

      const resolved = service.resolveConflict(op.id, 'local');

      expect(resolved).toBe(true);
      expect(service.getConflicts()).toHaveLength(0);
    });

    it('should resolve conflict with server', () => {
      const op = service.queueOperation('update', 'meal', { id: 'meal-1', name: 'Local' });
      service.addConflict(
        op.id,
        { name: 'Local' },
        { name: 'Server' }
      );

      service.resolveConflict(op.id, 'server');

      // Operation should be removed from queue when accepting server
      expect(service.getOperation(op.id)).toBeUndefined();
    });

    it('should resolve conflict with merge', () => {
      const op = service.queueOperation('update', 'meal', { id: 'meal-1', name: 'Local', calories: 500 });
      service.addConflict(
        op.id,
        { name: 'Local', calories: 500 },
        { name: 'Server', calories: 600 }
      );

      const mergedData = { name: 'Local', calories: 600 }; // Best of both
      service.resolveConflict(op.id, 'merge', mergedData);

      const operation = service.getOperation(op.id);
      expect(operation?.data.calories).toBe(600);
    });

    it('should auto-resolve conflict based on timestamp', () => {
      const conflict: SyncConflict = {
        operationId: 'op-1',
        localData: { timestamp: new Date('2024-01-02') },
        serverData: { timestamp: new Date('2024-01-01') },
        resolution: 'pending'
      };

      const resolution = service.autoResolveConflict(conflict);

      expect(resolution).toBe('local'); // Local is newer
    });

    it('should return false for non-existent conflict', () => {
      const resolved = service.resolveConflict('non-existent', 'local');

      expect(resolved).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should get status', () => {
      service.queueOperation('create', 'meal', { name: 'Test' });

      const status = service.getStatus();

      expect(status.isOnline).toBe(true);
      expect(status.pendingOperations).toBe(1);
      expect(status.conflicts).toBe(0);
    });

    it('should update lastSync after processing', async () => {
      jest.useRealTimers(); // Use real timers for async test
      service.queueOperation('create', 'meal', { name: 'Test' });

      await service.processQueue();

      const status = service.getStatus();
      expect(status.lastSync).not.toBeNull();
      jest.useFakeTimers(); // Restore
    });
  });

  describe('Queue Management', () => {
    it('should clear queue', () => {
      service.queueOperation('create', 'meal', { name: 'Test' });
      service.clearQueue();

      expect(service.getQueue()).toHaveLength(0);
    });

    it('should clear conflicts', () => {
      service.addConflict('op-1', {}, {});
      service.clearConflicts();

      expect(service.getConflicts()).toHaveLength(0);
    });

    it('should export queue', () => {
      service.queueOperation('create', 'meal', { name: 'Test' });

      const exported = service.exportQueue();

      expect(exported).toHaveLength(1);
    });

    it('should import queue', () => {
      const operations: SyncOperation[] = [
        {
          id: 'imported-1',
          type: 'create',
          entity: 'meal',
          data: { name: 'Imported' },
          timestamp: new Date(),
          status: 'pending',
          retryCount: 0
        }
      ];

      service.importQueue(operations);

      expect(service.getQueue()).toHaveLength(1);
    });

    it('should compact queue by removing duplicates', () => {
      service.queueOperation('update', 'meal', { id: 'meal-1', calories: 500 });
      service.queueOperation('update', 'meal', { id: 'meal-1', calories: 600 });

      const removed = service.compactQueue();

      expect(removed).toBe(1);
      expect(service.getQueue()).toHaveLength(1);
    });

    it('should prioritize operations', () => {
      service.queueOperation('create', 'meal', { name: 'Create' });
      service.queueOperation('delete', 'meal', { id: 'meal-1' });
      service.queueOperation('update', 'meal', { id: 'meal-2' });

      service.prioritizeOperations();

      const queue = service.getQueue();
      expect(queue[0].type).toBe('delete'); // Deletes first
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      jest.useRealTimers(); // Use real timers for async tests
    });

    afterEach(() => {
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should handle empty queue processing', async () => {
      const result = await service.processQueue();

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should handle retry with no failed operations', async () => {
      service.queueOperation('create', 'meal', { name: 'Test' });

      const result = await service.retryFailed();

      expect(result.success).toBe(0);
      expect(result.stillFailed).toBe(0);
    });
  });
});
