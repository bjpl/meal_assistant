import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../utils/theme';
import { OptimizedItem, StoreItemScore } from '../../types/optimization.types';

// ============================================
// Types
// ============================================
export interface DraggableItemProps {
  item: OptimizedItem;
  storeId: string;
  onDragStart: (itemId: string, storeId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (itemId: string, storeId: string) => void;
  onScorePress: (item: OptimizedItem) => void;
  isDragging: boolean;
  isOtherDragging: boolean;
}

// ============================================
// Helper Functions
// ============================================
const getScoreColor = (score: number): string => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.primary.main;
  if (score >= 40) return colors.warning;
  return colors.error;
};

const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};

// ============================================
// Component
// ============================================
export const DraggableItem: React.FC<DraggableItemProps> = ({
  item,
  storeId,
  onDragStart,
  onDragMove,
  onDragEnd,
  onScorePress,
  isDragging,
  isOtherDragging,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Get the item's score for current store
  const currentScore = item.storeScores instanceof Map
    ? item.storeScores.get(storeId)
    : (item.storeScores as Record<string, StoreItemScore>)?.[storeId];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate if moved more than 5 pixels
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });

        // Animate scale up
        Animated.spring(scale, {
          toValue: 1.05,
          useNativeDriver: true,
        }).start();

        onDragStart(item.id, storeId);
      },
      onPanResponderMove: (event, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        onDragMove(gestureState.moveX, gestureState.moveY);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();

        // Animate back to original position
        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 5,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();

        onDragEnd(item.id, storeId);
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();

        onDragEnd(item.id, storeId);
      },
    })
  ).current;

  const handleScorePress = useCallback(() => {
    onScorePress(item);
  }, [item, onScorePress]);

  // Calculate animated styles
  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale },
    ],
    opacity: isOtherDragging ? 0.7 : 1,
  };

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        isDragging && styles.dragging,
        item.manuallyAssigned && styles.manuallyAssigned,
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.content}>
        {/* Item Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemQuantity}>
            {item.quantity} {item.unit}
          </Text>
        </View>

        {/* Price */}
        <Text style={styles.price}>
          {formatPrice(item.price)}
        </Text>

        {/* Score Badge */}
        <TouchableOpacity
          style={[
            styles.scoreBadge,
            { backgroundColor: getScoreColor(item.bestScore) },
          ]}
          onPress={handleScorePress}
          activeOpacity={0.7}
        >
          <Text style={styles.scoreText}>
            {Math.round(item.bestScore)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Assignment Indicator */}
      {item.manuallyAssigned && (
        <View style={styles.manualIndicator}>
          <Text style={styles.manualIndicatorText}>Manual</Text>
        </View>
      )}

      {/* Drag Handle */}
      <View style={styles.dragHandle}>
        <View style={styles.dragHandleDot} />
        <View style={styles.dragHandleDot} />
        <View style={styles.dragHandleDot} />
      </View>
    </Animated.View>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dragging: {
    ...shadows.lg,
    borderColor: colors.primary.main,
    zIndex: 1000,
  },
  manuallyAssigned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary.main,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    ...typography.body2,
    fontWeight: '500',
    color: colors.text.primary,
  },
  itemQuantity: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  price: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  scoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  manualIndicator: {
    position: 'absolute',
    top: -8,
    right: spacing.sm,
    backgroundColor: colors.secondary.main,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  manualIndicatorText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.secondary.contrast,
  },
  dragHandle: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -12,
    width: 12,
    height: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  dragHandleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.disabled,
  },
});

export default DraggableItem;
