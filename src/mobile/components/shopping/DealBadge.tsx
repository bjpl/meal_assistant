import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { DealInfo } from '../../types';

interface DealBadgeProps {
  deal: DealInfo;
  itemName?: string;
  onPress?: () => void;
  variant?: 'compact' | 'detailed' | 'banner';
}

export const DealBadge: React.FC<DealBadgeProps> = ({
  deal,
  itemName,
  onPress,
  variant = 'compact',
}) => {
  const savings = deal.originalPrice - deal.salePrice;
  const savingsPercent = Math.round((savings / deal.originalPrice) * 100);

  const getExpiryText = () => {
    const expiry = new Date(deal.expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Ends today!';
    if (diffDays === 1) return 'Ends tomorrow';
    if (diffDays <= 3) return `${diffDays} days left`;
    return `Until ${expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getConfidenceColor = () => {
    switch (deal.confidence) {
      case 'high':
        return colors.success;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.text.disabled;
      default:
        return colors.text.secondary;
    }
  };

  if (variant === 'compact') {
    return (
      <View style={styles.compactContainer}>
        <Badge
          text={`${savingsPercent}% OFF`}
          variant="success"
          size="small"
        />
        <Text style={styles.compactOriginal}>
          ${deal.originalPrice.toFixed(2)}
        </Text>
      </View>
    );
  }

  if (variant === 'banner') {
    return (
      <Card
        onPress={onPress}
        variant="filled"
        style={styles.bannerContainer}
        accentColor={colors.success}
      >
        <View style={styles.bannerLeft}>
          <View style={styles.percentBadge}>
            <Text style={styles.percentText}>{savingsPercent}%</Text>
            <Text style={styles.offText}>OFF</Text>
          </View>
        </View>

        <View style={styles.bannerContent}>
          {itemName && (
            <Text style={styles.bannerItemName} numberOfLines={1}>
              {itemName}
            </Text>
          )}
          <View style={styles.bannerPrices}>
            <Text style={styles.bannerSalePrice}>
              ${deal.salePrice.toFixed(2)}
            </Text>
            <Text style={styles.bannerOriginalPrice}>
              ${deal.originalPrice.toFixed(2)}
            </Text>
          </View>
          <View style={styles.bannerMeta}>
            <Text style={styles.bannerExpiry}>{getExpiryText()}</Text>
            <View style={styles.confidenceIndicator}>
              <View
                style={[
                  styles.confidenceDot,
                  { backgroundColor: getConfidenceColor() },
                ]}
              />
              <Text style={[styles.confidenceText, { color: getConfidenceColor() }]}>
                {deal.confidence}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bannerSavings}>
          <Text style={styles.savingsLabel}>Save</Text>
          <Text style={styles.savingsValue}>${savings.toFixed(2)}</Text>
        </View>
      </Card>
    );
  }

  // detailed variant
  return (
    <Card
      onPress={onPress}
      variant="outlined"
      style={styles.detailedContainer}
    >
      <View style={styles.detailedHeader}>
        <View style={styles.dealTag}>
          <Text style={styles.dealTagIcon}>{'\u{1F4B0}'}</Text>
          <Text style={styles.dealTagText}>DEAL</Text>
        </View>
        <View style={styles.confidenceIndicator}>
          <View
            style={[
              styles.confidenceDot,
              { backgroundColor: getConfidenceColor() },
            ]}
          />
          <Text style={[styles.confidenceText, { color: getConfidenceColor() }]}>
            {deal.confidence} confidence
          </Text>
        </View>
      </View>

      {itemName && (
        <Text style={styles.detailedItemName}>{itemName}</Text>
      )}

      <View style={styles.priceComparison}>
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>Regular Price</Text>
          <Text style={styles.originalPrice}>
            ${deal.originalPrice.toFixed(2)}
          </Text>
        </View>
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>{'\u2192'}</Text>
        </View>
        <View style={styles.priceItem}>
          <Text style={styles.priceLabel}>Sale Price</Text>
          <Text style={styles.salePrice}>
            ${deal.salePrice.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.savingsRow}>
        <View style={styles.savingsBox}>
          <Text style={styles.savingsAmount}>
            ${savings.toFixed(2)} ({savingsPercent}%)
          </Text>
          <Text style={styles.savingsText}>savings</Text>
        </View>
        <View style={styles.expiryBox}>
          <Text style={styles.expiryIcon}>{'\u23F0'}</Text>
          <Text style={styles.expiryText}>{getExpiryText()}</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  // Compact variant
  compactContainer: {
    alignItems: 'flex-end',
  },
  compactOriginal: {
    ...typography.caption,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
    fontSize: 10,
    marginTop: 2,
  },

  // Banner variant
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.success + '10',
  },
  bannerLeft: {
    marginRight: spacing.sm,
  },
  percentBadge: {
    backgroundColor: colors.success,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  percentText: {
    ...typography.h3,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  offText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
  },
  bannerContent: {
    flex: 1,
  },
  bannerItemName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bannerPrices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  bannerSalePrice: {
    ...typography.h3,
    color: colors.success,
    fontWeight: '700',
  },
  bannerOriginalPrice: {
    ...typography.body2,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  bannerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  bannerExpiry: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  bannerSavings: {
    alignItems: 'center',
    marginLeft: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.success + '30',
  },
  savingsLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  savingsValue: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.success,
  },

  // Detailed variant
  detailedContainer: {
    marginBottom: spacing.sm,
  },
  detailedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dealTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  dealTagIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  dealTagText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 1,
  },
  confidenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  confidenceText: {
    ...typography.caption,
    textTransform: 'capitalize',
  },
  detailedItemName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  priceComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  priceItem: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  originalPrice: {
    ...typography.h3,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  arrowContainer: {
    paddingHorizontal: spacing.sm,
  },
  arrow: {
    fontSize: 20,
    color: colors.success,
  },
  salePrice: {
    ...typography.h2,
    color: colors.success,
    fontWeight: '700',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  savingsAmount: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.success,
  },
  savingsText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  expiryBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  expiryText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
