import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  DimensionValue,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { CrossStorePrice } from '../../types/analytics.types';

interface CrossStoreComparisonProps {
  itemName: string;
  stores: CrossStorePrice[];
  onStorePress?: (store: string) => void;
}

export const CrossStoreComparison: React.FC<CrossStoreComparisonProps> = ({
  itemName,
  stores,
  onStorePress,
}) => {
  if (stores.length === 0) {
    return null;
  }

  // Sort by current price
  const sortedStores = [...stores].sort((a, b) => a.currentPrice - b.currentPrice);
  const maxPrice = Math.max(...stores.map((s) => s.currentPrice));
  const minPrice = Math.min(...stores.map((s) => s.currentPrice));
  const priceRange = maxPrice - minPrice || 1;

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatSavings = (savings: number) => {
    if (savings === 0) return 'Avg';
    const sign = savings > 0 ? '+' : '';
    return `${sign}${savings.toFixed(0)}%`;
  };

  const getBarWidth = (price: number): DimensionValue => {
    // Normalize to 40-100% range for visual clarity
    const normalized = 40 + ((price - minPrice) / priceRange) * 60;
    return `${normalized}%` as DimensionValue;
  };

  return (
    <Card variant="outlined" style={styles.container}>
      <Text style={styles.title}>Price Comparison</Text>
      <Text style={styles.subtitle}>{itemName} across stores</Text>

      <View style={styles.storeList}>
        {sortedStores.map((store, index) => {
          const savings = store.savingsVsAverage;
          const isBest = store.isLowestPrice;

          return (
            <Card
              key={store.store}
              variant="filled"
              padding="small"
              style={styles.storeCard}
              onPress={onStorePress ? () => onStorePress(store.store) : undefined}
            >
              <View style={styles.storeHeader}>
                <View style={styles.storeInfo}>
                  {isBest && (
                    <Text style={styles.bestIcon}>{'\u{1F3C6}'}</Text>
                  )}
                  <Text style={styles.storeName}>{store.store}</Text>
                </View>
                <View style={styles.priceInfo}>
                  <Text style={[styles.price, isBest && styles.bestPrice]}>
                    {formatPrice(store.currentPrice)}
                  </Text>
                  <Badge
                    text={formatSavings(savings)}
                    variant={savings < 0 ? 'success' : savings > 0 ? 'error' : 'default'}
                    size="small"
                  />
                </View>
              </View>

              {/* Price bar */}
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: getBarWidth(store.currentPrice),
                      backgroundColor: isBest
                        ? colors.success
                        : index === sortedStores.length - 1
                        ? colors.error
                        : colors.primary.main,
                    },
                  ]}
                />
              </View>

              <View style={styles.storeFooter}>
                <Text style={styles.avgLabel}>
                  Avg: {formatPrice(store.averagePrice)}
                </Text>
                <Text style={styles.updateLabel}>
                  Updated {formatDate(store.lastUpdated)}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>

      {/* Potential savings */}
      {sortedStores.length > 1 && (
        <View style={styles.savingsBox}>
          <Text style={styles.savingsIcon}>{'\u{1F4B0}'}</Text>
          <View style={styles.savingsContent}>
            <Text style={styles.savingsTitle}>Potential Savings</Text>
            <Text style={styles.savingsText}>
              Save{' '}
              <Text style={styles.savingsAmount}>
                {formatPrice(maxPrice - minPrice)}
              </Text>{' '}
              by shopping at{' '}
              <Text style={styles.savingsStore}>{sortedStores[0].store}</Text>{' '}
              instead of{' '}
              <Text style={styles.savingsStore}>
                {sortedStores[sortedStores.length - 1].store}
              </Text>
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  storeList: {
    gap: spacing.sm,
  },
  storeCard: {
    padding: spacing.sm,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  storeName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  price: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  bestPrice: {
    color: colors.success,
  },
  barContainer: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  storeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avgLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  updateLabel: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10,
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  savingsIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  savingsContent: {
    flex: 1,
  },
  savingsTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  savingsText: {
    ...typography.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  savingsAmount: {
    fontWeight: '700',
    color: colors.success,
  },
  savingsStore: {
    fontWeight: '600',
    color: colors.text.primary,
  },
});
