import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  LayoutRectangle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { Store, OptimizedItem, DropZone } from '../../types/optimization.types';
import { StoreColumn } from './StoreColumn';

// ============================================
// Types
// ============================================
export interface StoreKanbanProps {
  stores: Store[];
  items: OptimizedItem[];
  storeAssignments: Record<string, string[]>;
  savings: Record<string, number>;
  onMoveItem: (itemId: string, fromStoreId: string, toStoreId: string) => void;
  onScorePress: (item: OptimizedItem) => void;
}

// ============================================
// Constants
// ============================================
const SCREEN_WIDTH = Dimensions.get('window').width;
const AUTO_SCROLL_THRESHOLD = 50;
const AUTO_SCROLL_SPEED = 10;

// ============================================
// Component
// ============================================
export const StoreKanban: React.FC<StoreKanbanProps> = ({
  stores,
  items,
  storeAssignments,
  savings,
  onMoveItem,
  onScorePress,
}) => {
  // State
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [sourceStoreId, setSourceStoreId] = useState<string | null>(null);
  const [targetStoreId, setTargetStoreId] = useState<string | null>(null);
  const [dropZones, setDropZones] = useState<Record<string, LayoutRectangle>>({});

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);
  const dragPosition = useRef({ x: 0, y: 0 });

  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
    };
  }, []);

  // Get items for a specific store
  const getStoreItems = useCallback(
    (storeId: string): OptimizedItem[] => {
      const itemIds = storeAssignments[storeId] || [];
      return items.filter(item => itemIds.includes(item.id));
    },
    [items, storeAssignments]
  );

  // Calculate store total
  const getStoreTotal = useCallback(
    (storeId: string): number => {
      const storeItems = getStoreItems(storeId);
      return storeItems.reduce((sum, item) => sum + item.price, 0);
    },
    [getStoreItems]
  );

  // Handle layout capture for drop zones
  const handleLayoutCapture = useCallback((storeId: string, layout: LayoutRectangle) => {
    setDropZones(prev => ({
      ...prev,
      [storeId]: layout,
    }));
  }, []);

  // Find target store based on position
  const findTargetStore = useCallback(
    (x: number, y: number): string | null => {
      for (const [storeId, zone] of Object.entries(dropZones)) {
        if (
          x >= zone.x &&
          x <= zone.x + zone.width &&
          y >= zone.y &&
          y <= zone.y + zone.height
        ) {
          return storeId;
        }
      }
      return null;
    },
    [dropZones]
  );

  // Auto-scroll logic
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
    }

    autoScrollInterval.current = setInterval(() => {
      const newOffset =
        direction === 'left'
          ? Math.max(0, scrollOffset.current - AUTO_SCROLL_SPEED)
          : scrollOffset.current + AUTO_SCROLL_SPEED;

      scrollViewRef.current?.scrollTo({ x: newOffset, animated: false });
      scrollOffset.current = newOffset;
    }, 16);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((itemId: string, storeId: string) => {
    setDraggedItemId(itemId);
    setSourceStoreId(storeId);
  }, []);

  const handleDragMove = useCallback(
    (x: number, y: number) => {
      dragPosition.current = { x, y };

      // Check for auto-scroll
      if (x < AUTO_SCROLL_THRESHOLD) {
        startAutoScroll('left');
      } else if (x > SCREEN_WIDTH - AUTO_SCROLL_THRESHOLD) {
        startAutoScroll('right');
      } else {
        stopAutoScroll();
      }

      // Find target store
      const target = findTargetStore(x, y);
      if (target !== targetStoreId && target !== sourceStoreId) {
        setTargetStoreId(target);
      } else if (target === sourceStoreId) {
        setTargetStoreId(null);
      }
    },
    [findTargetStore, startAutoScroll, stopAutoScroll, sourceStoreId, targetStoreId]
  );

  const handleDragEnd = useCallback(
    (itemId: string, originalStoreId: string) => {
      stopAutoScroll();

      // If dropped on a different store, move the item
      if (targetStoreId && targetStoreId !== originalStoreId) {
        onMoveItem(itemId, originalStoreId, targetStoreId);
      }

      // Reset state
      setDraggedItemId(null);
      setSourceStoreId(null);
      setTargetStoreId(null);
    },
    [targetStoreId, onMoveItem, stopAutoScroll]
  );

  // Track scroll position
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.x;
    },
    []
  );

  // Render empty state
  if (stores.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No stores available</Text>
        <Text style={styles.emptySubtext}>
          Add stores to start optimizing your shopping
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Store Assignments</Text>
        <Text style={styles.subtitle}>
          Drag items between stores to customize
        </Text>
      </View>

      {/* Kanban Board */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {stores.map(store => (
          <StoreColumn
            key={store.id}
            store={store}
            items={getStoreItems(store.id)}
            total={getStoreTotal(store.id)}
            savings={savings[store.id] || 0}
            isDropTarget={targetStoreId === store.id}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onScorePress={onScorePress}
            onLayoutCapture={handleLayoutCapture}
            draggedItemId={draggedItemId}
          />
        ))}
      </ScrollView>

      {/* Scroll Indicators */}
      {stores.length > 2 && (
        <View style={styles.scrollIndicators}>
          <View style={styles.scrollDot} />
          <View style={styles.scrollDot} />
          <View style={styles.scrollDot} />
        </View>
      )}
    </View>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
  },
  emptyText: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  scrollIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  scrollDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.disabled,
  },
});

export default StoreKanban;
