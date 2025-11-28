import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../utils/theme';
import { OptimizedItem, StoreItemScore, Store } from '../../types/optimization.types';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { ProgressBar } from '../base/ProgressBar';

// ============================================
// Types
// ============================================
export interface ItemScoreCardProps {
  visible: boolean;
  item: OptimizedItem | null;
  stores: Store[];
  currentWeights: {
    price: number;
    distance: number;
    quality: number;
    time: number;
  };
  onClose: () => void;
  onSelectStore: (itemId: string, storeId: string) => void;
}

interface ScoreBreakdownProps {
  label: string;
  score: number;
  weight: number;
  color: string;
  detail: string;
}

interface StoreOptionProps {
  store: Store;
  score: StoreItemScore;
  isSelected: boolean;
  weights: { price: number; distance: number; quality: number; time: number };
  onSelect: () => void;
}

// ============================================
// Constants
// ============================================
const SCORE_COLORS = {
  price: '#4CAF50',
  distance: '#2196F3',
  quality: '#FF9800',
  time: '#9C27B0',
};

// ============================================
// Helper Functions
// ============================================
const getScoreDescription = (type: string, score: number): string => {
  const threshold = { excellent: 80, good: 60, fair: 40 };

  const descriptors: Record<string, Record<string, string>> = {
    price: {
      excellent: 'Excellent price',
      good: 'Good value',
      fair: 'Average price',
      poor: 'Above average',
    },
    distance: {
      excellent: 'Very close',
      good: 'Nearby',
      fair: 'Moderate distance',
      poor: 'Further away',
    },
    quality: {
      excellent: 'Top quality',
      good: 'Good quality',
      fair: 'Average quality',
      poor: 'Lower quality',
    },
    time: {
      excellent: 'Quick trip',
      good: 'Fast shopping',
      fair: 'Average time',
      poor: 'Longer trip',
    },
  };

  const category = score >= threshold.excellent
    ? 'excellent'
    : score >= threshold.good
    ? 'good'
    : score >= threshold.fair
    ? 'fair'
    : 'poor';

  return descriptors[type]?.[category] || '';
};

const calculateWeightedScore = (
  scores: StoreItemScore,
  weights: { price: number; distance: number; quality: number; time: number }
): number => {
  const total = weights.price + weights.distance + weights.quality + weights.time;
  if (total === 0) return 0;

  return (
    (scores.priceScore * weights.price +
     scores.distanceScore * weights.distance +
     scores.qualityScore * weights.quality +
     scores.timeScore * weights.time) / total
  );
};

// ============================================
// Sub-Components
// ============================================
const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({
  label,
  score,
  weight,
  color,
  detail,
}) => (
  <View style={styles.breakdownRow}>
    <View style={styles.breakdownHeader}>
      <View style={styles.breakdownLabelContainer}>
        <View style={[styles.colorDot, { backgroundColor: color }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
      </View>
      <Text style={styles.breakdownWeight}>
        {weight}% weight
      </Text>
    </View>
    <ProgressBar
      progress={score}
      max={100}
      color={color}
      height={8}
      showLabel={false}
    />
    <View style={styles.breakdownFooter}>
      <Text style={styles.breakdownDetail}>{detail}</Text>
      <Text style={[styles.breakdownScore, { color }]}>
        {Math.round(score)}/100
      </Text>
    </View>
  </View>
);

const StoreOption: React.FC<StoreOptionProps> = ({
  store,
  score,
  isSelected,
  weights,
  onSelect,
}) => {
  const weightedScore = calculateWeightedScore(score, weights);

  return (
    <TouchableOpacity
      style={[
        styles.storeOption,
        isSelected && styles.storeOptionSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.storeOptionHeader}>
        <Text style={styles.storeOptionName}>{store.name}</Text>
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Current</Text>
          </View>
        )}
      </View>

      <View style={styles.storeOptionDetails}>
        <Text style={styles.storeOptionPrice}>
          ${score.price.toFixed(2)}
        </Text>
        <Text style={styles.storeOptionDistance}>
          {store.distance.toFixed(1)} mi
        </Text>
        <View style={styles.storeOptionScoreContainer}>
          <Text style={[
            styles.storeOptionScore,
            { color: weightedScore >= 70 ? colors.success : colors.warning },
          ]}>
            {Math.round(weightedScore)}
          </Text>
        </View>
      </View>

      {!isSelected && (
        <Text style={styles.selectText}>Tap to assign here</Text>
      )}
    </TouchableOpacity>
  );
};

// ============================================
// Main Component
// ============================================
export const ItemScoreCard: React.FC<ItemScoreCardProps> = ({
  visible,
  item,
  stores,
  currentWeights,
  onClose,
  onSelectStore,
}) => {
  if (!item) return null;

  // Get current store's scores
  const currentScores = item.storeScores instanceof Map
    ? item.storeScores.get(item.assignedStoreId)
    : (item.storeScores as Record<string, StoreItemScore>)?.[item.assignedStoreId];

  // Get all store scores sorted by weighted score
  const storeScoresList = stores
    .map(store => {
      const scores = item.storeScores instanceof Map
        ? item.storeScores.get(store.id)
        : (item.storeScores as Record<string, StoreItemScore>)?.[store.id];

      if (!scores) return null;

      return {
        store,
        scores,
        weightedScore: calculateWeightedScore(scores, currentWeights),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.weightedScore || 0) - (a?.weightedScore || 0)) as Array<{
      store: Store;
      scores: StoreItemScore;
      weightedScore: number;
    }>;

  const handleStoreSelect = useCallback(
    (storeId: string) => {
      onSelectStore(item.id, storeId);
      onClose();
    },
    [item.id, onSelectStore, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.modalSubtitle}>
                {item.quantity} {item.unit} - Score Breakdown
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Assignment */}
            <Card variant="filled" padding="medium" style={styles.currentCard}>
              <View style={styles.currentHeader}>
                <Text style={styles.currentLabel}>Currently assigned to</Text>
                <View style={styles.currentScoreContainer}>
                  <Text style={styles.currentScore}>
                    {Math.round(item.bestScore)}
                  </Text>
                  <Text style={styles.currentScoreLabel}>/100</Text>
                </View>
              </View>
              <Text style={styles.currentStore}>{item.assignedStoreName}</Text>
              <Text style={styles.currentPrice}>
                ${item.price.toFixed(2)}
              </Text>
            </Card>

            {/* Score Breakdown */}
            {currentScores && (
              <View style={styles.breakdownContainer}>
                <Text style={styles.sectionTitle}>Score Breakdown</Text>

                <ScoreBreakdown
                  label="Price"
                  score={currentScores.priceScore}
                  weight={currentWeights.price}
                  color={SCORE_COLORS.price}
                  detail={getScoreDescription('price', currentScores.priceScore)}
                />

                <ScoreBreakdown
                  label="Distance"
                  score={currentScores.distanceScore}
                  weight={currentWeights.distance}
                  color={SCORE_COLORS.distance}
                  detail={getScoreDescription('distance', currentScores.distanceScore)}
                />

                <ScoreBreakdown
                  label="Quality"
                  score={currentScores.qualityScore}
                  weight={currentWeights.quality}
                  color={SCORE_COLORS.quality}
                  detail={getScoreDescription('quality', currentScores.qualityScore)}
                />

                <ScoreBreakdown
                  label="Time"
                  score={currentScores.timeScore}
                  weight={currentWeights.time}
                  color={SCORE_COLORS.time}
                  detail={getScoreDescription('time', currentScores.timeScore)}
                />
              </View>
            )}

            {/* Why This Store */}
            <View style={styles.whyContainer}>
              <Text style={styles.sectionTitle}>Why this store?</Text>
              <Text style={styles.whyText}>
                Based on your priorities ({currentWeights.price}% price,{' '}
                {currentWeights.distance}% distance, {currentWeights.quality}% quality,{' '}
                {currentWeights.time}% time), {item.assignedStoreName} offers the best
                combination for this item.
              </Text>
            </View>

            {/* Alternative Stores */}
            <View style={styles.alternativesContainer}>
              <Text style={styles.sectionTitle}>All Store Options</Text>
              {storeScoresList.map(({ store, scores, weightedScore }) => (
                <StoreOption
                  key={store.id}
                  store={store}
                  score={scores}
                  isSelected={store.id === item.assignedStoreId}
                  weights={currentWeights}
                  onSelect={() => handleStoreSelect(store.id)}
                />
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              title="Done"
              onPress={onClose}
              variant="primary"
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalHeaderText: {
    flex: 1,
    marginRight: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  currentCard: {
    margin: spacing.md,
  },
  currentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  currentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  currentScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentScore: {
    ...typography.h2,
    color: colors.primary.main,
  },
  currentScoreLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  currentStore: {
    ...typography.h3,
    color: colors.text.primary,
  },
  currentPrice: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  breakdownContainer: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    marginBottom: spacing.md,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  breakdownLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  breakdownLabel: {
    ...typography.body2,
    fontWeight: '500',
    color: colors.text.primary,
  },
  breakdownWeight: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  breakdownFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  breakdownDetail: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  breakdownScore: {
    ...typography.caption,
    fontWeight: '700',
  },
  whyContainer: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  whyText: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  alternativesContainer: {
    padding: spacing.md,
  },
  storeOption: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  storeOptionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main + '10',
  },
  storeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  storeOptionName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  selectedBadge: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  selectedBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary.contrast,
    fontSize: 10,
  },
  storeOptionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeOptionPrice: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  storeOptionDistance: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  storeOptionScoreContainer: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  storeOptionScore: {
    ...typography.body2,
    fontWeight: '700',
  },
  selectText: {
    ...typography.caption,
    color: colors.primary.main,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});

export default ItemScoreCard;
