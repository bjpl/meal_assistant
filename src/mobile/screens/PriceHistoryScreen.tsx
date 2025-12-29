/**
 * Price History Screen
 * Displays price trends, deal quality analysis, and recommendations
 * with real data integration and guided UX for flyer uploads
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { Tooltip, InfoTooltip, FeatureCallout } from '../components/base/Tooltip';
import { PriceTrendChart } from '../components/analytics/PriceTrendChart';
import { DataQualityIndicator } from '../components/analytics/DataQualityBadge';
import { CrossStoreComparison } from '../components/analytics/CrossStoreComparison';
import { DealQualityCard } from '../components/deals/DealQualityCard';
import { StockUpRecommendationCard } from '../components/deals/StockUpRecommendation';
import { FlyerUploadModal } from '../components/price/FlyerUploadModal';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { AppDispatch, RootState } from '../store';
import {
  fetchPriceHistory,
  fetchBestDeals,
  createPriceAlert,
  selectFlyerUploads,
  selectPriceLoading,
  selectLastSyncedAt,
  selectPriceAlerts,
} from '../store/slices/priceSlice';
import {
  PriceHistory,
  CrossStorePrice,
  DealQualityScore,
  StockUpRecommendation,
  DataQualityLevel,
} from '../types/analytics.types';

interface PriceHistoryScreenProps {
  itemName?: string;
}

// Default data when no real data is available yet
const defaultPriceHistory: PriceHistory = {
  itemName: 'No Data Yet',
  points: [],
  qualityLevel: 'insufficient',
  pointsNeeded: 20,
  averagePrice: 0,
  historicalLow: 0,
  historicalHigh: 0,
  currentPrice: 0,
  priceDropAlert: false,
};

const defaultCrossStoreData: CrossStorePrice[] = [];

const defaultDealQuality: DealQualityScore = {
  score: 0,
  assessment: 'average',
  vs30DayAvg: 0,
  vs90DayAvg: 0,
  vsHistoricalLow: 0,
  trueSavings: 0,
  isFakeDeal: false,
  warnings: [],
};

const defaultStockUpRecommendation: StockUpRecommendation = {
  itemName: '',
  recommendedQuantity: 0,
  maxQuantity: 0,
  reasonForLimit: 'consumption',
  estimatedSavings: 0,
  consumptionRatePerDay: 0,
  expirationDays: 0,
};

export const PriceHistoryScreen: React.FC<PriceHistoryScreenProps> = ({
  itemName = 'Chicken Breast (1 lb)',
}) => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const flyerUploads = useSelector(selectFlyerUploads);
  const loading = useSelector(selectPriceLoading);
  const lastSyncedAt = useSelector(selectLastSyncedAt);
  const priceAlerts = useSelector(selectPriceAlerts);
  const priceHistory = useSelector((state: RootState) =>
    state.price?.priceHistory?.[itemName]
  );

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | 'all'>('90d');
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [showFlyerUpload, setShowFlyerUpload] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  // Use real data if available, otherwise show defaults
  const displayPriceHistory = priceHistory || defaultPriceHistory;
  const hasRealData = flyerUploads.length > 0 || (priceHistory && priceHistory.points.length > 0);

  // Fetch data on mount
  useEffect(() => {
    if (itemName) {
      dispatch(fetchPriceHistory(itemName));
      dispatch(fetchBestDeals());
    }
  }, [dispatch, itemName]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchPriceHistory(itemName)).unwrap();
      await dispatch(fetchBestDeals()).unwrap();
    } catch (error) {
      // Errors handled by Redux
    }
    setRefreshing(false);
  }, [dispatch, itemName]);

  const handleAddToCart = (quantity: number) => {
    // @ts-ignore - Navigation params typing
    navigation.navigate('Shopping', {
      addItem: {
        name: itemName,
        quantity,
        store: 'Costco',
        price: displayPriceHistory.currentPrice,
      },
    });
  };

  const handleStoreSelect = (store: string) => {
    setSelectedStore(store);
    // @ts-ignore - Navigation params typing
    navigation.navigate('StoreOptimizer', { filterStore: store });
  };

  const handleSetPriceAlert = useCallback(() => {
    Alert.prompt(
      'Set Price Alert',
      `Get notified when ${itemName} drops below a certain price.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Alert',
          onPress: (targetPrice) => {
            if (targetPrice) {
              dispatch(createPriceAlert({
                itemName,
                targetPrice: parseFloat(targetPrice),
              }));
              Alert.alert('Alert Set!', `We'll notify you when the price drops below $${targetPrice}`);
            }
          },
        },
      ],
      'plain-text',
      displayPriceHistory.averagePrice > 0
        ? (displayPriceHistory.averagePrice * 0.8).toFixed(2)
        : '3.00'
    );
  }, [dispatch, itemName, displayPriceHistory.averagePrice]);

  const handleFlyerUploadSuccess = useCallback(() => {
    setShowOnboarding(false);
    onRefresh();
  }, [onRefresh]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backIcon}>{'\u2190'}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{itemName}</Text>
          </View>
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>Price Intelligence Dashboard</Text>
            <InfoTooltip
              title="Price Intelligence"
              content="Track prices across stores over time. The more data you add, the better our deal recommendations become."
              size="medium"
            />
          </View>
        </View>

        {/* First-Time User Onboarding */}
        {!hasRealData && showOnboarding && (
          <FeatureCallout
            variant="new"
            title="Get Started with Price Tracking"
            description="Add deals from your weekly store flyers to build your personal price database. We'll help you spot real deals and know when to stock up."
            onDismiss={() => setShowOnboarding(false)}
          />
        )}

        {/* Flyer Upload CTA - Always visible but more prominent when no data */}
        <Card
          variant={hasRealData ? 'outlined' : 'elevated'}
          style={StyleSheet.flatten([styles.uploadCard, !hasRealData ? styles.uploadCardHighlight : undefined])}
        >
          <View style={styles.uploadContent}>
            <View style={styles.uploadIcon}>
              <Text style={styles.uploadIconText}>{'\u{1F4F0}'}</Text>
            </View>
            <View style={styles.uploadText}>
              <Text style={styles.uploadTitle}>
                {hasRealData ? 'Add More Flyer Deals' : 'Add Your First Flyer'}
              </Text>
              <Text style={styles.uploadDescription}>
                {hasRealData
                  ? `${flyerUploads.length} uploads so far. Keep adding to improve accuracy.`
                  : 'Enter deals from Safeway, Costco, or other store ads.'
                }
              </Text>
            </View>
            <Button
              title={hasRealData ? 'Add' : 'Start'}
              onPress={() => setShowFlyerUpload(true)}
              variant={hasRealData ? 'outline' : 'primary'}
              size="small"
            />
          </View>

          {flyerUploads.length > 0 && (
            <View style={styles.recentUploads}>
              <Text style={styles.recentUploadsLabel}>Recent:</Text>
              {flyerUploads.slice(0, 3).map((upload) => (
                <Badge
                  key={upload.id}
                  text={`${upload.retailerName} (${upload.dealsCount})`}
                  size="small"
                  variant="info"
                  style={styles.uploadBadge}
                />
              ))}
            </View>
          )}
        </Card>

        {/* Price Alert Banner */}
        {displayPriceHistory.priceDropAlert && (
          <Card variant="filled" style={styles.alertBanner}>
            <View style={styles.alertContent}>
              <Text style={styles.alertIcon}>{'\u{1F514}'}</Text>
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>Price Drop Alert!</Text>
                <Text style={styles.alertDescription}>
                  {displayPriceHistory.dropPercentage?.toFixed(0)}% below average -
                  Best price in {displayPriceHistory.points.length} weeks
                </Text>
              </View>
              <Badge text="BUY NOW" variant="success" />
            </View>
          </Card>
        )}

        {/* Data Quality Section */}
        <Card variant="outlined" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Data Quality</Text>
            <InfoTooltip
              title="Data Quality Levels"
              content={
                "Insufficient: < 5 price points\n" +
                "Emerging: 5-9 points\n" +
                "Reliable: 10-19 points\n" +
                "Mature: 20+ points (predictions enabled)"
              }
            />
          </View>
          <DataQualityIndicator
            level={displayPriceHistory.qualityLevel}
            pointsCount={displayPriceHistory.points.length}
          />

          {displayPriceHistory.qualityLevel === 'insufficient' && (
            <View style={styles.dataNeededNote}>
              <Text style={styles.dataNeededIcon}>{'\u{1F4CA}'}</Text>
              <Text style={styles.dataNeededText}>
                Add {displayPriceHistory.pointsNeeded - displayPriceHistory.points.length} more price points to enable predictions
              </Text>
            </View>
          )}

          {displayPriceHistory.qualityLevel === 'mature' && (
            <View style={styles.predictionNote}>
              <Text style={styles.predictionIcon}>{'\u{1F52E}'}</Text>
              <Text style={styles.predictionText}>
                Price predictions enabled with {displayPriceHistory.points.length}+ data points
              </Text>
            </View>
          )}
        </Card>

        {/* Price Trend Chart */}
        {displayPriceHistory.points.length > 0 ? (
          <PriceTrendChart
            priceHistory={displayPriceHistory}
            showPrediction={displayPriceHistory.qualityLevel === 'mature'}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            onPointPress={(point) => {
              Alert.alert(
                point.store,
                `$${point.price.toFixed(2)} on ${point.date}`,
                [{ text: 'OK' }]
              );
            }}
          />
        ) : (
          <Card variant="outlined" style={styles.emptyChartCard}>
            <Text style={styles.emptyChartIcon}>{'\u{1F4C8}'}</Text>
            <Text style={styles.emptyChartTitle}>No Price Data Yet</Text>
            <Text style={styles.emptyChartText}>
              Add flyer deals to see price trends over time
            </Text>
            <Button
              title="Add Flyer Deals"
              onPress={() => setShowFlyerUpload(true)}
              variant="outline"
              style={styles.emptyChartButton}
            />
          </Card>
        )}

        {/* Cross-Store Comparison - Show placeholder if no data */}
        {displayPriceHistory.points.length > 0 && (
          <View style={styles.crossStoreSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Compare Stores</Text>
              <InfoTooltip
                title="Cross-Store Comparison"
                content="See which store has the best current price and how it compares to their typical pricing."
              />
            </View>
            <CrossStoreComparison
              itemName={itemName}
              stores={defaultCrossStoreData}
              onStorePress={handleStoreSelect}
            />
          </View>
        )}

        {/* Current Deal Quality - Only show if we have active deals */}
        {displayPriceHistory.currentPrice > 0 && displayPriceHistory.averagePrice > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Deal Analysis</Text>
              <InfoTooltip
                title="Deal Quality Score"
                content="We analyze the current price against 30-day, 90-day, and historical averages to determine if this is a genuine deal or a 'fake sale' where prices were inflated before."
              />
            </View>
            <DealQualityCard
              itemName={itemName}
              originalPrice={displayPriceHistory.historicalHigh || displayPriceHistory.averagePrice}
              salePrice={displayPriceHistory.currentPrice}
              quality={defaultDealQuality}
            />
          </>
        )}

        {/* Stock Up Recommendation */}
        {displayPriceHistory.currentPrice > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Stock Up Recommendation</Text>
              <InfoTooltip
                title="Stock Up Calculator"
                content="Based on your consumption rate, storage capacity, and the current deal quality, we calculate how many units you should buy to maximize savings."
              />
            </View>
            <StockUpRecommendationCard
              recommendation={{
                ...defaultStockUpRecommendation,
                itemName,
              }}
              currentPrice={displayPriceHistory.currentPrice}
              averagePrice={displayPriceHistory.averagePrice}
              onAddToCart={handleAddToCart}
            />
          </>
        )}

        {/* Price History Stats */}
        {displayPriceHistory.points.length > 0 && (
          <Card variant="outlined" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Price Statistics</Text>
              <InfoTooltip
                title="Historical Stats"
                content="All-time low and high prices help you evaluate if a current 'sale' is actually a good deal."
              />
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>${displayPriceHistory.historicalLow.toFixed(2)}</Text>
                <Text style={styles.statLabel}>All-Time Low</Text>
                <Text style={styles.statMeta}>best price seen</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>${displayPriceHistory.averagePrice.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Average Price</Text>
                <Text style={styles.statMeta}>90-day avg</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>${displayPriceHistory.historicalHigh.toFixed(2)}</Text>
                <Text style={styles.statLabel}>All-Time High</Text>
                <Text style={styles.statMeta}>highest seen</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{displayPriceHistory.points.length}</Text>
                <Text style={styles.statLabel}>Price Points</Text>
                <Text style={styles.statMeta}>tracked</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Price Alerts */}
        {priceAlerts.length > 0 && (
          <Card variant="outlined" style={styles.section}>
            <Text style={styles.sectionTitle}>Your Price Alerts</Text>
            {priceAlerts
              .filter((alert) => alert.itemName === itemName)
              .map((alert) => (
                <View key={alert.id} style={styles.alertRow}>
                  <Text style={styles.alertItemName}>Alert below ${alert.targetPrice.toFixed(2)}</Text>
                  <Badge
                    text={alert.isTriggered ? 'Triggered!' : 'Watching'}
                    variant={alert.isTriggered ? 'success' : 'info'}
                    size="small"
                  />
                </View>
              ))}
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Set Price Alert"
            variant="secondary"
            onPress={handleSetPriceAlert}
            style={styles.actionButton}
            icon={<Text style={styles.buttonIcon}>{'\u{1F514}'}</Text>}
          />
          <Button
            title="Add More Deals"
            variant="outline"
            onPress={() => setShowFlyerUpload(true)}
            style={styles.actionButton}
            icon={<Text style={styles.buttonIcon}>{'\u{1F4F0}'}</Text>}
          />
        </View>

        {/* Last synced indicator */}
        {lastSyncedAt && (
          <Text style={styles.lastSynced}>
            Last updated: {new Date(lastSyncedAt).toLocaleString()}
          </Text>
        )}
      </ScrollView>

      {/* Flyer Upload Modal */}
      <FlyerUploadModal
        visible={showFlyerUpload}
        onClose={() => setShowFlyerUpload(false)}
        onSuccess={handleFlyerUploadSuccess}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
    marginLeft: -spacing.xs,
  },
  backIcon: {
    fontSize: 24,
    color: colors.text.primary,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  uploadCard: {
    marginBottom: spacing.md,
  },
  uploadCardHighlight: {
    borderColor: colors.primary.main,
    borderWidth: 2,
    backgroundColor: colors.primary.main + '08',
  },
  uploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.light + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  uploadIconText: {
    fontSize: 24,
  },
  uploadText: {
    flex: 1,
  },
  uploadTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  uploadDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  recentUploads: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  recentUploadsLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  uploadBadge: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  crossStoreSection: {
    marginBottom: spacing.md,
  },
  dataNeededNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
  },
  dataNeededIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  dataNeededText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
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
  emptyChartCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyChartIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyChartTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyChartText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyChartButton: {
    minWidth: 160,
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
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  alertItemName: {
    ...typography.body2,
    color: colors.text.primary,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  lastSynced: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default PriceHistoryScreen;
