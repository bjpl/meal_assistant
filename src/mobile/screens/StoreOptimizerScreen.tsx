import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors, spacing, borderRadius, typography } from '../utils/theme';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { WeightSliders } from '../components/optimization/WeightSliders';
import { StoreKanban } from '../components/optimization/StoreKanban';
import { ItemScoreCard } from '../components/optimization/ItemScoreCard';
import { RoutePreview } from '../components/optimization/RoutePreview';
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
  recalculateOptimization,
  startShoppingSession,
} from '../store/slices/optimizationSlice';

// ============================================
// Types
// ============================================
interface RootState {
  optimization: {
    weights: OptimizationWeights;
    activePreset: string;
    isCustomWeights: boolean;
    stores: Store[];
    items: OptimizedItem[];
    storeAssignments: Record<string, string[]>;
    route: OptimizedRoute | null;
    savings: {
      total: number;
      vsAveragePrice: number;
      perStore: Record<string, number>;
    };
    isCalculating: boolean;
    lastCalculated: string | null;
    error: string | null;
  };
}

// ============================================
// Mock Data for Development
// ============================================
const MOCK_STORES: Store[] = [
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
    name: 'Trader Joes',
    address: '321 Unique Lane',
    distance: 2.1,
    rating: 4.6,
    openHours: '8AM - 9PM',
    estimatedTime: 20,
    priceLevel: 2,
    sections: ['produce', 'frozen', 'pantry', 'snacks'],
    coordinates: { latitude: 37.7549, longitude: -122.4394 },
  },
  {
    id: 'store-5',
    name: 'Kyopo',
    address: '555 Seoul Street',
    distance: 2.5,
    rating: 4.4,
    openHours: '9AM - 8PM',
    estimatedTime: 30,
    priceLevel: 2,
    sections: ['produce', 'meat', 'frozen', 'pantry', 'specialty'],
    coordinates: { latitude: 37.7449, longitude: -122.4494 },
  },
  {
    id: 'store-6',
    name: 'Megamart',
    address: '777 Commerce Plaza',
    distance: 1.8,
    rating: 4.2,
    openHours: '7AM - 11PM',
    estimatedTime: 35,
    priceLevel: 2,
    sections: ['produce', 'bakery', 'deli', 'dairy', 'meat', 'frozen', 'pantry', 'electronics'],
    coordinates: { latitude: 37.7349, longitude: -122.4594 },
  },
];

const createMockItems = (): OptimizedItem[] => {
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

  const items: OptimizedItem[] = baseItems.map(item => ({
    ...item,
    price: 0,
    bestScore: 0,
    assignedStoreId: '',
    assignedStoreName: '',
    storeScores: {},
    manuallyAssigned: false,
  }));

  // Generate scores for each item at each store
  return items.map(item => {
    const storeScores: Record<string, StoreItemScore> = {};
    let bestStoreId = '';
    let bestScore = 0;
    let bestPrice = 0;

    MOCK_STORES.forEach(store => {
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

    const bestStore = MOCK_STORES.find(s => s.id === bestStoreId);

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
  const dispatch = useDispatch();

  // Local state for development (would use Redux in production)
  const [weights, setLocalWeights] = useState<OptimizationWeights>(
    WEIGHT_PRESETS[0].weights
  );
  const [activePreset, setActivePreset] = useState('balanced');
  const [isCustom, setIsCustom] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [stores] = useState<Store[]>(MOCK_STORES);
  const [items, setItems] = useState<OptimizedItem[]>(() => createMockItems());
  const [storeAssignments, setStoreAssignments] = useState<Record<string, string[]>>({});
  const [savings, setSavings] = useState<Record<string, number>>({});

  const [selectedItem, setSelectedItem] = useState<OptimizedItem | null>(null);
  const [showScoreCard, setShowScoreCard] = useState(false);

  // Calculate route
  const route = useMemo<OptimizedRoute>(() => {
    const stopsWithItems = stores.filter(
      store => (storeAssignments[store.id]?.length || 0) > 0
    );

    let totalDistance = 0;
    let totalDuration = 0;
    let totalSpend = 0;

    const stops = stopsWithItems.map((store, index) => {
      const storeItems = items.filter(
        item => storeAssignments[store.id]?.includes(item.id)
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
      savings: Math.round(totalSpend * 0.15 * 100) / 100, // Mock 15% savings
      startLocation: { latitude: 37.7749, longitude: -122.4194 },
    };
  }, [stores, items, storeAssignments]);

  // Initialize assignments
  useEffect(() => {
    const initialAssignments: Record<string, string[]> = {};
    const initialSavings: Record<string, number> = {};

    stores.forEach(store => {
      initialAssignments[store.id] = [];
      initialSavings[store.id] = 0;
    });

    items.forEach(item => {
      if (initialAssignments[item.assignedStoreId]) {
        initialAssignments[item.assignedStoreId].push(item.id);
        initialSavings[item.assignedStoreId] += item.price * 0.1; // Mock savings
      }
    });

    setStoreAssignments(initialAssignments);
    setSavings(initialSavings);
  }, []);

  // Handlers
  const handleWeightChange = useCallback(
    (key: keyof OptimizationWeights, value: number) => {
      const oldValue = weights[key];
      const diff = value - oldValue;

      const otherKeys = (['price', 'distance', 'quality', 'time'] as const)
        .filter(k => k !== key);

      const otherTotal = otherKeys.reduce((sum, k) => sum + weights[k], 0);

      const newWeights = { ...weights, [key]: value };

      if (otherTotal > 0) {
        otherKeys.forEach(k => {
          const proportion = weights[k] / otherTotal;
          newWeights[k] = Math.max(0, Math.round(weights[k] - diff * proportion));
        });
      }

      // Ensure total is 100
      const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
      if (total !== 100) {
        const adjustment = 100 - total;
        const adjustKey = otherKeys.find(k => newWeights[k] > 0) || otherKeys[0];
        newWeights[adjustKey] = Math.max(0, newWeights[adjustKey] + adjustment);
      }

      setLocalWeights(newWeights);
      setIsCustom(true);
      setActivePreset('custom');
      recalculate(newWeights);
    },
    [weights]
  );

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = WEIGHT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setLocalWeights({ ...preset.weights });
      setActivePreset(preset.id);
      setIsCustom(false);
      recalculate(preset.weights);
    }
  }, []);

  const recalculate = useCallback((newWeights: OptimizationWeights) => {
    setIsCalculating(true);

    // Simulate recalculation
    setTimeout(() => {
      // Re-assign items based on new weights
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

      setItems(updatedItems);
      setStoreAssignments(newAssignments);
      setSavings(newSavings);
      setIsCalculating(false);
    }, 500);
  }, [items, stores]);

  const handleMoveItem = useCallback(
    (itemId: string, fromStoreId: string, toStoreId: string) => {
      // Update assignments
      setStoreAssignments(prev => {
        const updated = { ...prev };
        updated[fromStoreId] = prev[fromStoreId]?.filter(id => id !== itemId) || [];
        updated[toStoreId] = [...(prev[toStoreId] || []), itemId];
        return updated;
      });

      // Update item
      setItems(prev =>
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
    },
    [stores]
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
    // Navigate to full map view
    console.log('Navigate to full route view');
  }, []);

  const handleStartShopping = useCallback((storeId: string) => {
    // Navigate to shopping mode
    console.log('Start shopping at:', storeId);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    recalculate(weights);
    setTimeout(() => setRefreshing(false), 1000);
  }, [weights, recalculate]);

  // Calculate totals for summary
  const totals = useMemo(() => {
    const totalItems = items.length;
    const totalStores = stores.filter(
      store => (storeAssignments[store.id]?.length || 0) > 0
    ).length;
    const totalSpend = items.reduce((sum, item) => sum + item.price, 0);
    const totalSavings = Object.values(savings).reduce((sum, s) => sum + s, 0);

    return { totalItems, totalStores, totalSpend, totalSavings };
  }, [items, stores, storeAssignments, savings]);

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
          <Text style={styles.title}>Shopping Optimizer</Text>
          <Text style={styles.subtitle}>
            Optimize your shopping trip across multiple stores
          </Text>
        </View>

        {/* Summary Cards */}
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

        {/* Weight Sliders */}
        <WeightSliders
          weights={weights}
          activePreset={activePreset}
          isCustom={isCustom}
          isCalculating={isCalculating}
          onWeightChange={handleWeightChange}
          onPresetSelect={handlePresetSelect}
        />

        {/* Store Kanban Board */}
        <StoreKanban
          stores={stores}
          items={items}
          storeAssignments={storeAssignments}
          savings={savings}
          onMoveItem={handleMoveItem}
          onScorePress={handleScorePress}
        />

        {/* Route Preview */}
        <RoutePreview
          route={route}
          onViewFullRoute={handleViewFullRoute}
          onStartShopping={handleStartShopping}
        />
      </ScrollView>

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
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.xs,
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
});

export default StoreOptimizerScreen;
