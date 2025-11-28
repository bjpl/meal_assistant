import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { StockUpRecommendation as StockUpRecommendationType } from '../../types/analytics.types';

interface StockUpRecommendationProps {
  recommendation: StockUpRecommendationType;
  currentPrice: number;
  averagePrice: number;
  onAddToCart?: (quantity: number) => void;
  onDismiss?: () => void;
}

const LIMIT_ICONS: Record<string, string> = {
  storage: '\u{1F4E6}',
  expiration: '\u23F0',
  consumption: '\u{1F37D}',
  deal_quality: '\u{1F4B0}',
};

const LIMIT_LABELS: Record<string, string> = {
  storage: 'Storage capacity',
  expiration: 'Shelf life limit',
  consumption: 'Based on your usage',
  deal_quality: 'Deal quality limit',
};

export const StockUpRecommendationCard: React.FC<StockUpRecommendationProps> = ({
  recommendation,
  currentPrice,
  averagePrice,
  onAddToCart,
  onDismiss,
}) => {
  const {
    itemName,
    recommendedQuantity,
    maxQuantity,
    reasonForLimit,
    estimatedSavings,
    nextSalePrediction,
    daysUntilNextSale,
    consumptionRatePerDay,
    expirationDays,
  } = recommendation;

  const totalCost = recommendedQuantity * currentPrice;
  const regularCost = recommendedQuantity * averagePrice;
  const actualSavings = regularCost - totalCost;

  // Calculate how long the stock will last
  const daysSupply = Math.floor(recommendedQuantity / consumptionRatePerDay);

  return (
    <Card variant="elevated" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>{'\u{1F6D2}'}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>Stock Up Recommendation</Text>
          <Text style={styles.itemName}>{itemName}</Text>
        </View>
        {onDismiss && (
          <Button
            title="\u2715"
            variant="ghost"
            size="small"
            onPress={onDismiss}
          />
        )}
      </View>

      {/* Main recommendation */}
      <View style={styles.mainRecommendation}>
        <View style={styles.quantityBox}>
          <Text style={styles.quantityLabel}>Buy</Text>
          <Text style={styles.quantityValue}>{recommendedQuantity}</Text>
          <Text style={styles.quantityUnit}>units</Text>
        </View>
        <View style={styles.savingsBox}>
          <Text style={styles.savingsLabel}>To Save</Text>
          <Text style={styles.savingsValue}>${actualSavings.toFixed(2)}</Text>
          <Text style={styles.savingsPercent}>
            ({((actualSavings / regularCost) * 100).toFixed(0)}% off)
          </Text>
        </View>
      </View>

      {/* Reasoning */}
      <View style={styles.reasoningSection}>
        <View style={styles.reasoningItem}>
          <Text style={styles.reasoningIcon}>{LIMIT_ICONS[reasonForLimit]}</Text>
          <View style={styles.reasoningContent}>
            <Text style={styles.reasoningLabel}>{LIMIT_LABELS[reasonForLimit]}</Text>
            <Text style={styles.reasoningText}>
              Max recommended: {maxQuantity} units
            </Text>
          </View>
        </View>

        <View style={styles.reasoningItem}>
          <Text style={styles.reasoningIcon}>{'\u{1F4C5}'}</Text>
          <View style={styles.reasoningContent}>
            <Text style={styles.reasoningLabel}>Supply Duration</Text>
            <Text style={styles.reasoningText}>
              {daysSupply} days ({(daysSupply / 7).toFixed(1)} weeks)
            </Text>
          </View>
        </View>

        {expirationDays > 0 && (
          <View style={styles.reasoningItem}>
            <Text style={styles.reasoningIcon}>{'\u23F0'}</Text>
            <View style={styles.reasoningContent}>
              <Text style={styles.reasoningLabel}>Shelf Life</Text>
              <ProgressBar
                progress={(daysSupply / expirationDays) * 100}
                color={daysSupply <= expirationDays ? colors.success : colors.warning}
                height={4}
              />
              <Text style={styles.reasoningText}>
                {daysSupply <= expirationDays
                  ? 'Will use before expiry'
                  : 'May expire before use'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Next sale prediction */}
      {nextSalePrediction && (
        <View style={styles.predictionSection}>
          <Text style={styles.predictionIcon}>{'\u{1F52E}'}</Text>
          <View style={styles.predictionContent}>
            <Text style={styles.predictionTitle}>Next Sale Prediction</Text>
            <Text style={styles.predictionText}>
              Expected around <Text style={styles.predictionDate}>{nextSalePrediction}</Text>
              {daysUntilNextSale && (
                <Text style={styles.predictionDays}> (~{daysUntilNextSale} days)</Text>
              )}
            </Text>
          </View>
        </View>
      )}

      {/* Cost breakdown */}
      <View style={styles.costSection}>
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Regular price ({recommendedQuantity} x ${averagePrice.toFixed(2)})</Text>
          <Text style={styles.costRegular}>${regularCost.toFixed(2)}</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Sale price ({recommendedQuantity} x ${currentPrice.toFixed(2)})</Text>
          <Text style={styles.costSale}>${totalCost.toFixed(2)}</Text>
        </View>
        <View style={[styles.costRow, styles.costTotal]}>
          <Text style={styles.costTotalLabel}>Your Savings</Text>
          <Text style={styles.costTotalValue}>${actualSavings.toFixed(2)}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={`Add ${recommendedQuantity} to Cart`}
          onPress={() => onAddToCart?.(recommendedQuantity)}
          style={styles.addButton}
        />
        <View style={styles.quickActions}>
          <Button
            title={`Add ${Math.ceil(recommendedQuantity / 2)}`}
            variant="secondary"
            size="small"
            onPress={() => onAddToCart?.(Math.ceil(recommendedQuantity / 2))}
          />
          <Button
            title={`Add ${maxQuantity}`}
            variant="secondary"
            size="small"
            onPress={() => onAddToCart?.(maxQuantity)}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  itemName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  mainRecommendation: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  quantityBox: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary.main + '10',
    borderRadius: borderRadius.md,
  },
  quantityLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  quantityValue: {
    ...typography.h1,
    color: colors.primary.main,
    fontWeight: '700',
  },
  quantityUnit: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  savingsBox: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.md,
  },
  savingsLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  savingsValue: {
    ...typography.h2,
    color: colors.success,
    fontWeight: '700',
  },
  savingsPercent: {
    ...typography.caption,
    color: colors.success,
  },
  reasoningSection: {
    marginBottom: spacing.md,
  },
  reasoningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reasoningIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  reasoningContent: {
    flex: 1,
  },
  reasoningLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  reasoningText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  predictionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  predictionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  predictionContent: {
    flex: 1,
  },
  predictionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.info,
    marginBottom: spacing.xs,
  },
  predictionText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  predictionDate: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  predictionDays: {
    color: colors.text.disabled,
  },
  costSection: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  costLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  costRegular: {
    ...typography.body2,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  costSale: {
    ...typography.body2,
    color: colors.text.primary,
  },
  costTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  costTotalLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  costTotalValue: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.success,
  },
  actions: {
    gap: spacing.sm,
  },
  addButton: {
    width: '100%',
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
