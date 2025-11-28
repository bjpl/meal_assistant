import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  LayoutRectangle,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../utils/theme';
import { Store, OptimizedItem } from '../../types/optimization.types';
import { DraggableItem } from './DraggableItem';

// ============================================
// Types
// ============================================
export interface StoreColumnProps {
  store: Store;
  items: OptimizedItem[];
  total: number;
  savings: number;
  isDropTarget: boolean;
  onDragStart: (itemId: string, storeId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (itemId: string, storeId: string) => void;
  onScorePress: (item: OptimizedItem) => void;
  onLayoutCapture: (storeId: string, layout: LayoutRectangle) => void;
  draggedItemId: string | null;
}

// ============================================
// Helper Functions
// ============================================
const formatCurrency = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

const getPriceLevelIndicator = (level: 1 | 2 | 3): string => {
  return '$'.repeat(level);
};

// ============================================
// Component
// ============================================
export const StoreColumn: React.FC<StoreColumnProps> = ({
  store,
  items,
  total,
  savings,
  isDropTarget,
  onDragStart,
  onDragMove,
  onDragEnd,
  onScorePress,
  onLayoutCapture,
  draggedItemId,
}) => {
  const dropZoneOpacity = useRef(new Animated.Value(0)).current;
  const columnRef = useRef<View>(null);

  // Animate drop zone when it's a target
  useEffect(() => {
    Animated.timing(dropZoneOpacity, {
      toValue: isDropTarget ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isDropTarget]);

  // Capture layout for drop zone detection
  const handleLayout = useCallback(() => {
    columnRef.current?.measure((x, y, width, height, pageX, pageY) => {
      onLayoutCapture(store.id, { x: pageX, y: pageY, width, height });
    });
  }, [store.id, onLayoutCapture]);

  return (
    <View
      ref={columnRef}
      style={[
        styles.container,
        isDropTarget && styles.containerDropTarget,
      ]}
      onLayout={handleLayout}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={styles.priceLevel}>
            {getPriceLevelIndicator(store.priceLevel)}
          </Text>
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.itemCount}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.storeDistance}>
            {store.distance.toFixed(1)} mi
          </Text>
        </View>
      </View>

      {/* Total */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      {/* Drop Zone Indicator */}
      <Animated.View
        style={[
          styles.dropZone,
          { opacity: dropZoneOpacity },
        ]}
        pointerEvents="none"
      >
        <View style={styles.dropZoneInner}>
          <Text style={styles.dropZoneText}>Drop here</Text>
        </View>
      </Animated.View>

      {/* Items List */}
      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Drag items here
            </Text>
          </View>
        ) : (
          items.map(item => (
            <DraggableItem
              key={item.id}
              item={item}
              storeId={store.id}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onScorePress={onScorePress}
              isDragging={draggedItemId === item.id}
              isOtherDragging={draggedItemId !== null && draggedItemId !== item.id}
            />
          ))
        )}
      </ScrollView>

      {/* Footer - Savings */}
      {savings > 0 && (
        <View style={styles.footer}>
          <View style={styles.savingsContainer}>
            <Text style={styles.savingsLabel}>Savings</Text>
            <Text style={styles.savingsValue}>
              {formatCurrency(savings)}
            </Text>
          </View>
        </View>
      )}

      {/* Store Info */}
      <View style={styles.storeInfo}>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingStar}>*</Text>
          <Text style={styles.ratingValue}>{store.rating.toFixed(1)}</Text>
        </View>
        <Text style={styles.estimatedTime}>
          ~{store.estimatedTime} min
        </Text>
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    width: 200,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    marginRight: spacing.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    maxHeight: 400,
  },
  containerDropTarget: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light + '20',
  },
  header: {
    backgroundColor: colors.primary.main,
    padding: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeName: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.primary.contrast,
    flex: 1,
  },
  priceLevel: {
    ...typography.caption,
    color: colors.primary.contrast,
    opacity: 0.9,
    marginLeft: spacing.xs,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  itemCount: {
    ...typography.caption,
    color: colors.primary.contrast,
    opacity: 0.9,
  },
  storeDistance: {
    ...typography.caption,
    color: colors.primary.contrast,
    opacity: 0.9,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  totalLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  totalValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  dropZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary.main + '40',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneInner: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  dropZoneText: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.primary.contrast,
  },
  itemsList: {
    flex: 1,
    padding: spacing.sm,
  },
  itemsContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    minHeight: 100,
  },
  emptyStateText: {
    ...typography.body2,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    padding: spacing.sm,
    backgroundColor: colors.success + '15',
  },
  savingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsLabel: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '500',
  },
  savingsValue: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.success,
  },
  storeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    color: colors.warning,
    fontSize: 14,
    marginRight: 2,
  },
  ratingValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
  estimatedTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});

export default StoreColumn;
