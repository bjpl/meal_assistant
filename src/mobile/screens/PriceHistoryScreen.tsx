import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { PriceTrendChart } from '../components/analytics/PriceTrendChart';
import { DataQualityIndicator } from '../components/analytics/DataQualityBadge';
import { CrossStoreComparison } from '../components/analytics/CrossStoreComparison';
import { DealQualityCard } from '../components/deals/DealQualityCard';
import { StockUpRecommendationCard } from '../components/deals/StockUpRecommendation';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import {
  PriceHistory,
  CrossStorePrice,
  DealQualityScore,
  StockUpRecommendation,
  DataQualityLevel,
} from '../types/analytics.types';

interface PriceHistoryScreenProps {
  itemName?: string;
  navigation?: any;
}

// Mock data for demonstration
const mockPriceHistory: PriceHistory = {
  itemName: 'Chicken Breast (1 lb)',
  points: [
    { id: '1', itemName: 'Chicken Breast', price: 4.99, store: 'Safeway', date: '2025-09-15', isOnSale: false },
    { id: '2', itemName: 'Chicken Breast', price: 3.99, store: 'Costco', date: '2025-09-22', isOnSale: true },
    { id: '3', itemName: 'Chicken Breast', price: 4.79, store: 'Whole Foods', date: '2025-09-29', isOnSale: false },
    { id: '4', itemName: 'Chicken Breast', price: 4.49, store: 'Safeway', date: '2025-10-06', isOnSale: false },
    { id: '5', itemName: 'Chicken Breast', price: 3.49, store: 'Costco', date: '2025-10-13', isOnSale: true },
    { id: '6', itemName: 'Chicken Breast', price: 4.99, store: 'Safeway', date: '2025-10-20', isOnSale: false },
    { id: '7', itemName: 'Chicken Breast', price: 4.29, store: 'Walmart', date: '2025-10-27', isOnSale: false },
    { id: '8', itemName: 'Chicken Breast', price: 3.29, store: 'Costco', date: '2025-11-03', isOnSale: true },
    { id: '9', itemName: 'Chicken Breast', price: 4.69, store: 'Safeway', date: '2025-11-10', isOnSale: false },
    { id: '10', itemName: 'Chicken Breast', price: 3.99, store: 'Walmart', date: '2025-11-17', isOnSale: false },
    { id: '11', itemName: 'Chicken Breast', price: 2.99, store: 'Costco', date: '2025-11-20', isOnSale: true },
  ],
  qualityLevel: 'reliable',
  pointsNeeded: 9,
  averagePrice: 4.18,
  historicalLow: 2.99,
  historicalHigh: 4.99,
  currentPrice: 2.99,
  predictedPrice: 3.49,
  priceDropAlert: true,
  dropPercentage: 28.5,
};

const mockCrossStoreData: CrossStorePrice[] = [
  { store: 'Costco', currentPrice: 2.99, averagePrice: 3.59, lastUpdated: '2025-11-20', isLowestPrice: true, savingsVsAverage: -16.7 },
  { store: 'Walmart', currentPrice: 3.99, averagePrice: 4.19, lastUpdated: '2025-11-17', isLowestPrice: false, savingsVsAverage: -4.8 },
  { store: 'Safeway', currentPrice: 4.69, averagePrice: 4.49, lastUpdated: '2025-11-10', isLowestPrice: false, savingsVsAverage: 4.5 },
  { store: 'Whole Foods', currentPrice: 5.49, averagePrice: 5.29, lastUpdated: '2025-11-05', isLowestPrice: false, savingsVsAverage: 3.8 },
];

const mockDealQuality: DealQualityScore = {
  score: 9,
  assessment: 'excellent',
  vs30DayAvg: -28.5,
  vs90DayAvg: -22.1,
  vsHistoricalLow: 0,
  trueSavings: 28.5,
  isFakeDeal: false,
  warnings: [],
};

const mockStockUpRecommendation: StockUpRecommendation = {
  itemName: 'Chicken Breast (1 lb)',
  recommendedQuantity: 6,
  maxQuantity: 8,
  reasonForLimit: 'storage',
  estimatedSavings: 7.14,
  nextSalePrediction: 'Dec 15-20',
  daysUntilNextSale: 25,
  consumptionRatePerDay: 0.3,
  expirationDays: 90,
};

export const PriceHistoryScreen: React.FC<PriceHistoryScreenProps> = ({
  itemName = 'Chicken Breast (1 lb)',
  navigation,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | 'all'>('90d');
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleAddToCart = (quantity: number) => {
    console.log(`Adding ${quantity} to cart`);
    // TODO: Dispatch add to cart action
  };

  const handleStoreSelect = (store: string) => {
    setSelectedStore(store);
    // TODO: Navigate to store details or filter
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{itemName}</Text>
        <Text style={styles.subtitle}>Price Intelligence Dashboard</Text>
      </View>

      {/* Price Alert Banner */}
      {mockPriceHistory.priceDropAlert && (
        <Card variant="filled" style={styles.alertBanner}>
          <View style={styles.alertContent}>
            <Text style={styles.alertIcon}>{'\u{1F514}'}</Text>
            <View style={styles.alertText}>
              <Text style={styles.alertTitle}>Price Drop Alert!</Text>
              <Text style={styles.alertDescription}>
                {mockPriceHistory.dropPercentage?.toFixed(0)}% below average -
                Best price in {mockPriceHistory.points.length} weeks
              </Text>
            </View>
            <Badge text="BUY NOW" variant="success" />
          </View>
        </Card>
      )}

      {/* Data Quality Section */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>Data Quality</Text>
        <DataQualityIndicator
          level={mockPriceHistory.qualityLevel}
          pointsCount={mockPriceHistory.points.length}
        />
        {mockPriceHistory.qualityLevel === 'mature' && (
          <View style={styles.predictionNote}>
            <Text style={styles.predictionIcon}>{'\u{1F52E}'}</Text>
            <Text style={styles.predictionText}>
              Price predictions enabled with {mockPriceHistory.points.length}+ data points
            </Text>
          </View>
        )}
      </Card>

      {/* Price Trend Chart */}
      <PriceTrendChart
        priceHistory={mockPriceHistory}
        showPrediction={true}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onPointPress={(point) => console.log('Point pressed:', point)}
      />

      {/* Cross-Store Comparison */}
      <CrossStoreComparison
        itemName={itemName}
        stores={mockCrossStoreData}
        onStorePress={handleStoreSelect}
      />

      {/* Current Deal Quality */}
      <Text style={styles.sectionHeader}>Current Deal Analysis</Text>
      <DealQualityCard
        itemName={itemName}
        originalPrice={4.99}
        salePrice={2.99}
        quality={mockDealQuality}
      />

      {/* Stock Up Recommendation */}
      <Text style={styles.sectionHeader}>Stock Up Recommendation</Text>
      <StockUpRecommendationCard
        recommendation={mockStockUpRecommendation}
        currentPrice={2.99}
        averagePrice={4.18}
        onAddToCart={handleAddToCart}
      />

      {/* Price History Stats */}
      <Card variant="outlined" style={styles.section}>
        <Text style={styles.sectionTitle}>Price Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${mockPriceHistory.historicalLow.toFixed(2)}</Text>
            <Text style={styles.statLabel}>All-Time Low</Text>
            <Text style={styles.statMeta}>at Costco</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${mockPriceHistory.averagePrice.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Average Price</Text>
            <Text style={styles.statMeta}>90-day avg</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${mockPriceHistory.historicalHigh.toFixed(2)}</Text>
            <Text style={styles.statLabel}>All-Time High</Text>
            <Text style={styles.statMeta}>at Whole Foods</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{mockPriceHistory.points.length}</Text>
            <Text style={styles.statLabel}>Price Points</Text>
            <Text style={styles.statMeta}>tracked</Text>
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Set Price Alert"
          variant="secondary"
          onPress={() => console.log('Set alert')}
          style={styles.actionButton}
        />
        <Button
          title="View All Items"
          variant="ghost"
          onPress={() => navigation?.goBack()}
          style={styles.actionButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  alertBanner: {
    backgroundColor: colors.success + '15',
    marginBottom: spacing.md,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  alertText: {
    flex: 1,
  },
  alertTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.success,
  },
  alertDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  predictionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.info + '10',
    borderRadius: borderRadius.md,
  },
  predictionIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  predictionText: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  statMeta: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
});

export default PriceHistoryScreen;
