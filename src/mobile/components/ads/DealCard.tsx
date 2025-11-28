import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ViewStyle,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { colors, spacing, borderRadius, typography, shadows } from '../../utils/theme';
import { AdDeal } from '../../types/ads.types';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { DealMatchBadge } from './DealMatchBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export interface DealCardProps {
  deal: AdDeal;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: (corrections: { productName?: string; price?: number; unit?: string }) => void;
  onSwipe?: (direction: 'left' | 'right') => void;
  enableSwipe?: boolean;
  style?: ViewStyle;
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  onConfirm,
  onReject,
  onEdit,
  onSwipe,
  enableSwipe = true,
  style,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(deal.productName);
  const [editedPrice, setEditedPrice] = useState(deal.price.toString());
  const [editedUnit, setEditedUnit] = useState(deal.unit || '');

  const position = React.useRef(new Animated.ValueXY()).current;
  const rotation = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const confirmOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const rejectOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enableSwipe && !isEditing,
      onMoveShouldSetPanResponder: (_, gesture) =>
        enableSwipe && !isEditing && Math.abs(gesture.dx) > 5,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.1 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          // Swipe right - confirm
          Animated.spring(position, {
            toValue: { x: SCREEN_WIDTH + 100, y: 0 },
            useNativeDriver: true,
          }).start(() => {
            onSwipe?.('right');
            onConfirm();
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left - reject
          Animated.spring(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
            useNativeDriver: true,
          }).start(() => {
            onSwipe?.('left');
            onReject();
          });
        } else {
          // Return to center
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 5,
          }).start();
        }
      },
    })
  ).current;

  const handleSaveEdit = () => {
    onEdit({
      productName: editedName !== deal.productName ? editedName : undefined,
      price: parseFloat(editedPrice) !== deal.price ? parseFloat(editedPrice) : undefined,
      unit: editedUnit !== deal.unit ? editedUnit : undefined,
    });
    setIsEditing(false);
  };

  const renderEditMode = () => (
    <View style={styles.editContainer}>
      <Text style={styles.editLabel}>Product Name</Text>
      <TextInput
        style={styles.editInput}
        value={editedName}
        onChangeText={setEditedName}
        placeholder="Product name"
        placeholderTextColor={colors.text.disabled}
      />

      <View style={styles.editRow}>
        <View style={styles.editField}>
          <Text style={styles.editLabel}>Price</Text>
          <TextInput
            style={styles.editInput}
            value={editedPrice}
            onChangeText={setEditedPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.text.disabled}
          />
        </View>
        <View style={styles.editField}>
          <Text style={styles.editLabel}>Unit</Text>
          <TextInput
            style={styles.editInput}
            value={editedUnit}
            onChangeText={setEditedUnit}
            placeholder="lb, oz, each"
            placeholderTextColor={colors.text.disabled}
          />
        </View>
      </View>

      <View style={styles.editActions}>
        <Button
          title="Cancel"
          onPress={() => setIsEditing(false)}
          variant="outline"
          style={styles.editButton}
        />
        <Button
          title="Save"
          onPress={handleSaveEdit}
          variant="primary"
          style={styles.editButton}
        />
      </View>
    </View>
  );

  const savings = deal.originalPrice
    ? deal.originalPrice - deal.price
    : undefined;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate: rotation },
          ],
        },
        style,
      ]}
      {...panResponder.panHandlers}
    >
      {/* Swipe indicators */}
      {enableSwipe && (
        <>
          <Animated.View style={[styles.swipeIndicator, styles.confirmIndicator, { opacity: confirmOpacity }]}>
            <Text style={styles.swipeIndicatorText}>{'\u2713'} CONFIRM</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeIndicator, styles.rejectIndicator, { opacity: rejectOpacity }]}>
            <Text style={styles.swipeIndicatorText}>{'\u2717'} REJECT</Text>
          </Animated.View>
        </>
      )}

      <Card variant="elevated" style={styles.card}>
        {/* Header with confidence */}
        <View style={styles.header}>
          <ConfidenceIndicator
            confidence={deal.confidence}
            level={deal.confidenceLevel}
            showPercentage
            showLabel
          />
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editTrigger}>
            <Text style={styles.editTriggerText}>{'\u270E'} Edit</Text>
          </TouchableOpacity>
        </View>

        {isEditing ? (
          renderEditMode()
        ) : (
          <>
            {/* Ad image snippet */}
            {deal.imageSnippetUri && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: deal.imageSnippetUri }}
                  style={styles.adImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Deal details */}
            <View style={styles.details}>
              <Text style={styles.productName}>{deal.productName}</Text>

              <View style={styles.priceRow}>
                <Text style={styles.price}>${deal.price.toFixed(2)}</Text>
                {deal.unit && <Text style={styles.unit}>/ {deal.unit}</Text>}
                {deal.originalPrice && (
                  <Text style={styles.originalPrice}>
                    ${deal.originalPrice.toFixed(2)}
                  </Text>
                )}
              </View>

              {deal.savingsClaim && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>{deal.savingsClaim}</Text>
                </View>
              )}

              {/* Match status */}
              <DealMatchBadge
                isMatched={!!deal.matchedShoppingListItemId}
                matchedItemName={deal.matchedShoppingListItemName}
                savingsAmount={savings}
                style={styles.matchBadge}
              />
            </View>

            {/* Action buttons (for non-swipe mode) */}
            {!enableSwipe && (
              <View style={styles.actions}>
                <Button
                  title="Reject"
                  onPress={onReject}
                  variant="outline"
                  style={[styles.actionButton, styles.rejectButton]}
                />
                <Button
                  title="Confirm"
                  onPress={onConfirm}
                  variant="primary"
                  style={styles.actionButton}
                />
              </View>
            )}
          </>
        )}

        {/* Swipe hint */}
        {enableSwipe && !isEditing && (
          <Text style={styles.swipeHint}>
            {'\u2190'} Swipe left to reject | Swipe right to confirm {'\u2192'}
          </Text>
        )}
      </Card>
    </Animated.View>
  );
};

// Stack of cards for review
export const DealCardStack: React.FC<{
  deals: AdDeal[];
  currentIndex: number;
  onConfirm: (dealId: string) => void;
  onReject: (dealId: string) => void;
  onEdit: (dealId: string, corrections: any) => void;
}> = ({ deals, currentIndex, onConfirm, onReject, onEdit }) => {
  return (
    <View style={styles.stackContainer}>
      {deals
        .slice(currentIndex, currentIndex + 3)
        .reverse()
        .map((deal, index) => {
          const isTop = index === Math.min(2, deals.length - currentIndex - 1);
          const stackIndex = Math.min(2, deals.length - currentIndex - 1) - index;

          return (
            <View
              key={deal.id}
              style={[
                styles.stackCard,
                {
                  top: stackIndex * 8,
                  transform: [{ scale: 1 - stackIndex * 0.05 }],
                  zIndex: 3 - stackIndex,
                },
              ]}
            >
              <DealCard
                deal={deal}
                onConfirm={() => onConfirm(deal.id)}
                onReject={() => onReject(deal.id)}
                onEdit={(corrections) => onEdit(deal.id, corrections)}
                enableSwipe={isTop}
              />
            </View>
          );
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH - spacing.md * 2,
    maxWidth: 400,
    padding: spacing.md,
  },
  swipeIndicator: {
    position: 'absolute',
    top: 50,
    zIndex: 10,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 3,
  },
  confirmIndicator: {
    right: 20,
    backgroundColor: colors.success + '20',
    borderColor: colors.success,
    transform: [{ rotate: '15deg' }],
  },
  rejectIndicator: {
    left: 20,
    backgroundColor: colors.error + '20',
    borderColor: colors.error,
    transform: [{ rotate: '-15deg' }],
  },
  swipeIndicatorText: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.success,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  editTrigger: {
    padding: spacing.xs,
  },
  editTriggerText: {
    ...typography.body2,
    color: colors.primary.main,
  },
  imageContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  adImage: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.sm,
  },
  details: {
    marginBottom: spacing.md,
  },
  productName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  price: {
    ...typography.h2,
    color: colors.primary.main,
    fontWeight: '700',
  },
  unit: {
    ...typography.body1,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  originalPrice: {
    ...typography.body1,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
    marginLeft: spacing.sm,
  },
  savingsBadge: {
    backgroundColor: colors.success + '20',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  savingsText: {
    ...typography.body2,
    color: colors.success,
    fontWeight: '600',
  },
  matchBadge: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  rejectButton: {
    borderColor: colors.error,
  },
  swipeHint: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  editContainer: {
    paddingTop: spacing.sm,
  },
  editLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  editInput: {
    ...typography.body1,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editField: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    minWidth: 80,
  },
  stackContainer: {
    height: 500,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackCard: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
  },
});
