/**
 * Store Optimizer Screen
 * Multi-store shopping optimization with weight-based scoring
 * Features: Weight sliders, store kanban, route preview, savings estimation
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { WeightSliders } from '../components/optimization/WeightSliders';
import { StoreKanban } from '../components/optimization/StoreKanban';
import { ItemScoreCard } from '../components/optimization/ItemScoreCard';
import { RoutePreview } from '../components/optimization/RoutePreview';
import { InfoTooltip, FeatureCallout } from '../components/base/Tooltip';
import { RootState, AppDispatch } from '../store';
import {
  OptimizationWeights,
  OptimizedItem,
  Store,
  OptimizedRoute,
  StoreItemScore,
  WEIGHT_PRESETS,
} from '../types/optimization.types';
import {
  setWeights,
  applyPreset,
  updateSingleWeight,
  moveItem,
  setStores,
  setItems,
  recalculateOptimization,
  fetchNearbyStores,
  calculateOptimization,
  estimateSavings,
  selectOptimizationWeights,
  selectActivePreset,
  selectIsCustomWeights,
  selectStores,
  selectItems,
  selectStoreAssignments,
  selectRoute,
  selectSavings,
  selectIsCalculating,
  selectHasData,
  selectOptimizationError,
} from '../store/slices/optimizationSlice';

// ============================================
// Demo Data Generator (for first-time use)
// ============================================
const generateDemoStores = (): Store[] => [
  {
    id: 'store-1',
    name: 'Costco',
    address: '123 Warehouse Blvd',
    distance: 3.2,
    rating: 4.5,
    openHours: '9AM - 8PM',
    estimatedTime: 45,
    priceLevel: 1,
    sections: ['produce', 'meat', 'dairy', 'frozen', 'pantry'],
    coordinates: { latitude: 37.7849, longitude: -122.4094 },
  },
  {
    id: 'store-2',
    name: 'Safeway',
    address: '456 Main St',
    distance: 1.5,
    rating: 4.0,
    openHours: '7AM - 10PM',
    estimatedTime: 25,
    priceLevel: 2,
    sections: ['produce', 'bakery', 'deli', 'dairy', 'meat', 'frozen', 'pantry'],
    coordinates: { latitude: 37.7749, longitude: -122.4194 },
  },
  {
    id: 'store-3',
    name: 'Whole Foods',
    address: '789 Organic Ave',
    distance: 2.8,
    rating: 4.7,
    openHours: '8AM - 9PM',
    estimatedTime: 30,
    priceLevel: 3,
    sections: ['produce', 'bakery', 'deli', 'dairy', 'meat', 'frozen', 'pantry'],
    coordinates: { latitude: 37.7649, longitude: -122.4294 },
  },
  {
    id: 'store-4',
    name: "Trader Joe's",
    address: '321 Unique Lane',
    distance: 2.1,
    rating: 4.6,
    openHours: '8AM - 9PM',
    estimatedTime: 20,
    priceLevel: 2,
    sections: ['produce', 'frozen', 'pantry', 'snacks'],
    coordinates: { latitude: 37.7549, longitude: -122.4394 },
  },
];

const generateDemoItems = (stores: Store[]): OptimizedItem[] => {
  const baseItems = [
    { id: 'item-1', name: 'Chicken Breast', category: 'meat', quantity: 2, unit: 'lb' },
    { id: 'item-2', name: 'Broccoli', category: 'produce', quantity: 1, unit: 'bunch' },
    { id: 'item-3', name: 'Greek Yogurt', category: 'dairy', quantity: 2, unit: 'container' },
    { id: 'item-4', name: 'Brown Rice', category: 'pantry', quantity: 1, unit: 'bag' },
    { id: 'item-5', name: 'Olive Oil', category: 'pantry', quantity: 1, unit: 'bottle' },
    { id: 'item-6', name: 'Eggs', category: 'dairy', quantity: 1, unit: 'dozen' },
    { id: 'item-7', name: 'Bananas', category: 'produce', quantity: 1, unit: 'bunch' },
    { id: 'item-8', name: 'Salmon', category: 'meat', quantity: 1, unit: 'lb' },
  ];

  return baseItems.map(item => {
    const storeScores: Record<string, StoreItemScore> = {};
    let bestStoreId = '';
    let bestScore = 0;
    let bestPrice = 0;

    stores.forEach(store => {
      const basePrice = Math.random() * 5 + 2;
      const priceScore = Math.floor(Math.random() * 40 + 50);
      const distanceScore = Math.floor(100 - store.distance * 15);
      const qualityScore = Math.floor(store.rating * 20);
      const timeScore = Math.floor(100 - store.estimatedTime);
      const totalScore = (priceScore + distanceScore + qualityScore + timeScore) / 4;

      storeScores[store.id] = {
        storeId: store.id,
        storeName: store.name,
        price: Math.round(basePrice * 100) / 100,
        priceScore,
        distanceScore,
        qualityScore,
        timeScore,
        totalScore,
        inStock: Math.random() > 0.1,
        lastUpdated: new Date().toISOString(),
      };

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestStoreId = store.id;
        bestPrice = storeScores[store.id].price;
      }
    });

    const bestStore = stores.find(s => s.id === bestStoreId);

    return {
      ...item,
      assignedStoreId: bestStoreId,
      assignedStoreName: bestStore?.name || '',
      price: bestPrice,
      storeScores,
      bestScore,
      manuallyAssigned: false,
    };
  });
};

// ============================================
// Component
// ============================================
export const StoreOptimizerScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const weights = useSelector(selectOptimizationWeights) || WEIGHT_PRESETS[0].weights;
  const activePreset = useSelector(selectActivePreset) || 'balanced';
  const isCustom = useSelector(selectIsCustomWeights) || false;
  const reduxStores = useSelector(selectStores);
  const reduxItems = useSelector(selectItems);
  const storeAssignments = useSelector(selectStoreAssignments);
  const route = useSelector(selectRoute);
  const savings = useSelector(selectSavings);
  const isCalculating = useSelector(selectIsCalculating);
  const hasData = useSelector(selectHasData);
  const error = useSelector(selectOptimizationError);

  // Local UI state
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OptimizedItem | null>(null);
  const [showScoreCard, setShowScoreCard] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [localStores, setLocalStores] = useState<Store[]>([]);
  const [localItems, setLocalItems] = useState<OptimizedItem[]>([]);
  const [localAssignments, setLocalAssignments] = useState<Record<string, string[]>>({});
  const [localSavings, setLocalSavings] = useState<Record<string, number>>({});

  // Use Redux data if available, otherwise local demo data
  const stores = reduxStores.length > 0 ? reduxStores : localStores;
  const items = reduxItems.length > 0 ? reduxItems : localItems;
  const assignments = Object.keys(storeAssignments).length > 0 ? storeAssignments : localAssignments;
  const savingsData = savings?.perStore || localSavings;

  // Initialize demo data if no Redux data
  useEffect(() => {
    if (!hasData && localStores.length === 0) {
      const demoStores = generateDemoStores();
      const demoItems = generateDemoItems(demoStores);
      setLocalStores(demoStores);
      setLocalItems(demoItems);

      // Initialize assignments
      const initialAssignments: Record<string, string[]> = {};
      const initialSavings: Record<string, number> = {};

      demoStores.forEach(store => {
        initialAssignments[store.id] = [];
        initialSavings[store.id] = 0;
      });

      demoItems.forEach(item => {
        if (initialAssignments[item.assignedStoreId]) {
          initialAssignments[item.assignedStoreId].push(item.id);
          initialSavings[item.assignedStoreId] += item.price * 0.1;
        }
      });

      setLocalAssignments(initialAssignments);
      setLocalSavings(initialSavings);
    }
  }, [hasData, localStores.length]);

  // Calculate route from current data
  const calculatedRoute = useMemo<OptimizedRoute>(() => {
    if (route) return route;

    const stopsWithItems = stores.filter(
      store => (assignments[store.id]?.length || 0) > 0
    );

    let totalDistance = 0;
    let totalDuration = 0;
    let totalSpend = 0;

    const stops = stopsWithItems.map((store, index) => {
      const storeItems = items.filter(
        item => assignments[store.id]?.includes(item.id)
      );
      const storeSpend = storeItems.reduce((sum, item) => sum + item.price, 0);

      totalDistance += store.distance;
      totalDuration += store.estimatedTime + (store.distance * 2);
      totalSpend += storeSpend;

      return {
        storeId: store.id,
        storeName: store.name,
        order: index + 1,
        estimatedArrival: new Date(Date.now() + totalDuration * 60000).toISOString(),
        estimatedDuration: store.estimatedTime,
        itemCount: storeItems.length,
        estimatedSpend: storeSpend,
        coordinates: store.coordinates,
      };
    });

    return {
      stops,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration: Math.round(totalDuration),
      totalSpend: Math.round(totalSpend * 100) / 100,
      savings: Math.round(totalSpend * 0.15 * 100) / 100,
      startLocation: { latitude: 37.7749, longitude: -122.4194 },
    };
  }, [route, stores, items, assignments]);

  // Handlers
  const handleWeightChange = useCallback(
    (key: keyof OptimizationWeights, value: number) => {
      dispatch(updateSingleWeight({ key, value }));
      recalculateWithWeights({ ...weights, [key]: value });
    },
    [dispatch, weights]
  );

  const handlePresetSelect = useCallback((presetId: string) => {
    dispatch(applyPreset(presetId));
    const preset = WEIGHT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      recalculateWithWeights(preset.weights);
    }
  }, [dispatch]);

  const recalculateWithWeights = useCallback((newWeights: OptimizationWeights) => {
    // Re-assign items based on new weights (local calculation)
    const newAssignments: Record<string, string[]> = {};
    const newSavings: Record<string, number> = {};

    stores.forEach(store => {
      newAssignments[store.id] = [];
      newSavings[store.id] = 0;
    });

    const updatedItems = items.map(item => {
      if (item.manuallyAssigned) {
        newAssignments[item.assignedStoreId]?.push(item.id);
        return item;
      }

      let bestStoreId = item.assignedStoreId;
      let bestScore = 0;
      let bestPrice = item.price;

      const scores = item.storeScores as Record<string, StoreItemScore>;

      Object.entries(scores).forEach(([storeId, storeScore]) => {
        const weightedScore =
          (storeScore.priceScore * newWeights.price +
           storeScore.distanceScore * newWeights.distance +
           storeScore.qualityScore * newWeights.quality +
           storeScore.timeScore * newWeights.time) / 100;

        if (weightedScore > bestScore && storeScore.inStock) {
          bestScore = weightedScore;
          bestStoreId = storeId;
          bestPrice = storeScore.price;
        }
      });

      const bestStore = stores.find(s => s.id === bestStoreId);
      newAssignments[bestStoreId]?.push(item.id);
      newSavings[bestStoreId] = (newSavings[bestStoreId] || 0) + bestPrice * 0.1;

      return {
        ...item,
        assignedStoreId: bestStoreId,
        assignedStoreName: bestStore?.name || '',
        price: bestPrice,
        bestScore,
      };
    });

    setLocalItems(updatedItems);
    setLocalAssignments(newAssignments);
    setLocalSavings(newSavings);
  }, [items, stores]);

  const handleMoveItem = useCallback(
    (itemId: string, fromStoreId: string, toStoreId: string) => {
      // Update local assignments
      setLocalAssignments(prev => {
        const updated = { ...prev };
        updated[fromStoreId] = prev[fromStoreId]?.filter(id => id !== itemId) || [];
        updated[toStoreId] = [...(prev[toStoreId] || []), itemId];
        return updated;
      });

      // Update item
      setLocalItems(prev =>
        prev.map(item => {
          if (item.id !== itemId) return item;

          const toStore = stores.find(s => s.id === toStoreId);
          const scores = item.storeScores as Record<string, StoreItemScore>;
          const newPrice = scores[toStoreId]?.price || item.price;

          return {
            ...item,
            assignedStoreId: toStoreId,
            assignedStoreName: toStore?.name || '',
            price: newPrice,
            manuallyAssigned: true,
          };
        })
      );

      // Also dispatch to Redux
      dispatch(moveItem({ itemId, fromStoreId, toStoreId }));
    },
    [dispatch, stores]
  );

  const handleScorePress = useCallback((item: OptimizedItem) => {
    setSelectedItem(item);
    setShowScoreCard(true);
  }, []);

  const handleSelectStore = useCallback(
    (itemId: string, storeId: string) => {
      const item = items.find(i => i.id === itemId);
      if (item && item.assignedStoreId !== storeId) {
        handleMoveItem(itemId, item.assignedStoreId, storeId);
      }
    },
    [items, handleMoveItem]
  );

  const handleViewFullRoute = useCallback(() => {
    Alert.alert(
      'Route Details',
      `Total Distance: ${calculatedRoute.totalDistance} mi\nTotal Time: ${calculatedRoute.totalDuration} min\nStores: ${calculatedRoute.stops.length}`,
      [{ text: 'OK' }]
    );
  }, [calculatedRoute]);

  const handleStartShopping = useCallback((storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    Alert.alert(
      'Start Shopping',
      `Ready to shop at ${store?.name}?\nItems: ${assignments[storeId]?.length || 0}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => console.log('Start shopping at:', storeId) },
      ]
    );
  }, [stores, assignments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    recalculateWithWeights(weights);
    setTimeout(() => setRefreshing(false), 500);
  }, [weights, recalculateWithWeights]);

  const handleFetchStores = useCallback(() => {
    // Default to San Francisco coordinates
    dispatch(fetchNearbyStores({ lat: 37.7749, lng: -122.4194, radius: 10 }));
  }, [dispatch]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalItems = items.length;
    const totalStores = stores.filter(
      store => (assignments[store.id]?.length || 0) > 0
    ).length;
    const totalSpend = items.reduce((sum, item) => sum + item.price, 0);
    const totalSavings = Object.values(savingsData).reduce((sum, s) => sum + s, 0);

    return { totalItems, totalStores, totalSpend, totalSavings };
  }, [items, stores, assignments, savingsData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary.main]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Shopping Optimizer</Text>
            <InfoTooltip
              content="Optimize your shopping trip across multiple stores based on price, distance, quality, and time preferences."
              title="About Optimizer"
              size="medium"
            />
          </View>
          <Text style={styles.subtitle}>
            Optimize your shopping trip across multiple stores
          </Text>
        </View>

        {/* Onboarding Callout */}
        {showOnboarding && !hasData && (
          <View style={styles.calloutContainer}>
            <FeatureCallout
              variant="tip"
              title="Smart Shopping Optimization"
              description="Adjust the sliders below to prioritize what matters most to you: lowest prices, shortest travel, highest quality, or fastest shopping. The system will automatically assign each item to the best store."
              onDismiss={() => setShowOnboarding(false)}
            />
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.calloutContainer}>
            <FeatureCallout
              variant="warning"
              title="Something went wrong"
              description={error}
              dismissible
            />
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trip Summary</Text>
          <InfoTooltip
            content="Overview of your optimized shopping trip including total items, stores to visit, estimated spend, and calculated savings compared to single-store shopping."
            title="Trip Summary"
          />
        </View>
        <View style={styles.summaryRow}>
          <Card variant="filled" padding="small" style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.totalItems}</Text>
            <Text style={styles.summaryLabel}>Items</Text>
          </Card>
          <Card variant="filled" padding="small" style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.totalStores}</Text>
            <Text style={styles.summaryLabel}>Stores</Text>
          </Card>
          <Card variant="filled" padding="small" style={styles.summaryCard}>
            <Text style={styles.summaryValue}>${totals.totalSpend.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Est. Total</Text>
          </Card>
          <Card variant="filled" padding="small" style={StyleSheet.flatten([styles.summaryCard, styles.savingsCard])}>
            <Text style={[styles.summaryValue, styles.savingsValue]}>
              ${totals.totalSavings.toFixed(0)}
            </Text>
            <Text style={styles.summaryLabel}>Savings</Text>
          </Card>
        </View>

        {/* Weight Sliders Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Optimization Weights</Text>
          <InfoTooltip
            content="Adjust these sliders to control how items are assigned to stores. Higher weight = more importance. Use presets for common shopping styles, or create your own custom mix."
            title="Weight Sliders"
          />
        </View>
        <WeightSliders
          weights={weights}
          activePreset={activePreset}
          isCustom={isCustom}
          isCalculating={isCalculating}
          onWeightChange={handleWeightChange}
          onPresetSelect={handlePresetSelect}
        />

        {/* Weight Legend */}
        <Card variant="outlined" padding="medium" style={styles.legendCard}>
          <Text style={styles.legendTitle}>What Each Weight Means:</Text>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>$</Text>
            <View style={styles.legendText}>
              <Text style={styles.legendLabel}>Price</Text>
              <Text style={styles.legendDesc}>Favor stores with lower prices</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>{'\u{1F4CD}'}</Text>
            <View style={styles.legendText}>
              <Text style={styles.legendLabel}>Distance</Text>
              <Text style={styles.legendDesc}>Favor stores closer to you</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>{'\u2B50'}</Text>
            <View style={styles.legendText}>
              <Text style={styles.legendLabel}>Quality</Text>
              <Text style={styles.legendDesc}>Favor higher-rated stores</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendIcon}>{'\u23F1'}</Text>
            <View style={styles.legendText}>
              <Text style={styles.legendLabel}>Time</Text>
              <Text style={styles.legendDesc}>Favor stores with faster shopping</Text>
            </View>
          </View>
        </Card>

        {/* Store Kanban Board */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Store Assignments</Text>
          <InfoTooltip
            content="Each column shows items assigned to that store. Tap an item's score badge to see the full breakdown. Drag items between stores to manually override the optimization."
            title="Store Kanban"
          />
        </View>

        {stores.length === 0 ? (
          <Card variant="outlined" padding="large" style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'\u{1F6D2}'}</Text>
            <Text style={styles.emptyTitle}>No Stores Available</Text>
            <Text style={styles.emptyText}>
              Add stores to your list or let us find stores near you.
            </Text>
            <Button
              title="Find Nearby Stores"
              variant="primary"
              onPress={handleFetchStores}
              loading={isCalculating}
              style={styles.emptyButton}
            />
          </Card>
        ) : (
          <StoreKanban
            stores={stores}
            items={items}
            storeAssignments={assignments}
            savings={savingsData}
            onMoveItem={handleMoveItem}
            onScorePress={handleScorePress}
          />
        )}

        {/* Route Preview */}
        {calculatedRoute.stops.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Optimized Route</Text>
              <InfoTooltip
                content="The suggested order to visit stores, optimized for minimum travel time. Tap 'View Full Route' for map details or 'Start Shopping' to begin your trip."
                title="Route Preview"
              />
            </View>
            <RoutePreview
              route={calculatedRoute}
              onViewFullRoute={handleViewFullRoute}
              onStartShopping={handleStartShopping}
            />
          </>
        )}

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <FeatureCallout
            variant="info"
            title="Pro Tips"
            description="Items with a lock icon were manually assigned and won't change when you adjust weights. Tap the score badge on any item to see why it was assigned to that store."
            dismissible={false}
          />
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {isCalculating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Optimizing...</Text>
        </View>
      )}

      {/* Score Card Modal */}
      <ItemScoreCard
        visible={showScoreCard}
        item={selectedItem}
        stores={stores}
        currentWeights={weights}
        onClose={() => setShowScoreCard(false)}
        onSelectStore={handleSelectStore}
      />
    </SafeAreaView>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  header: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  calloutContainer: {
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  savingsCard: {
    backgroundColor: colors.success + '15',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  savingsValue: {
    color: colors.success,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  legendCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  legendTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  legendIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
    marginRight: spacing.sm,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    ...typography.body2,
    fontWeight: '500',
    color: colors.text.primary,
  },
  legendDesc: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  emptyCard: {
    marginHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyButton: {
    minWidth: 180,
  },
  tipsSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
});

export default StoreOptimizerScreen;
