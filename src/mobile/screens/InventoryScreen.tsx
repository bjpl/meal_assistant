import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Input } from '../components/base/Input';
import { Badge } from '../components/base/Badge';
import { IconButton } from '../components/base/IconButton';
import { InventoryItemComponent } from '../components/inventory/InventoryItem';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { InventoryItem } from '../types';

// Sample data
const sampleInventory: InventoryItem[] = [
  {
    id: '1',
    name: 'Chicken Breast',
    category: 'protein',
    quantity: 4,
    unit: 'lbs',
    expiryDate: '2025-11-25',
    purchaseDate: '2025-11-20',
    location: 'fridge',
    pricePerUnit: 4.99,
    store: 'Costco',
  },
  {
    id: '2',
    name: 'Basmati Rice',
    category: 'carb',
    quantity: 10,
    unit: 'lbs',
    purchaseDate: '2025-11-15',
    location: 'pantry',
    pricePerUnit: 1.29,
    store: 'Costco',
  },
  {
    id: '3',
    name: 'Mixed Vegetables',
    category: 'vegetable',
    quantity: 2,
    unit: 'bags',
    expiryDate: '2025-11-23',
    purchaseDate: '2025-11-20',
    location: 'fridge',
  },
  {
    id: '4',
    name: 'Greek Yogurt',
    category: 'dairy',
    quantity: 3,
    unit: 'cups',
    expiryDate: '2025-11-26',
    purchaseDate: '2025-11-19',
    location: 'fridge',
    pricePerUnit: 1.49,
    store: 'Safeway',
  },
  {
    id: '5',
    name: 'Salmon Fillets',
    category: 'protein',
    quantity: 2,
    unit: 'lbs',
    expiryDate: '2026-02-15',
    purchaseDate: '2025-11-18',
    location: 'freezer',
    pricePerUnit: 8.99,
    store: 'Whole Foods',
  },
  {
    id: '6',
    name: 'Black Beans',
    category: 'pantry',
    quantity: 6,
    unit: 'cans',
    purchaseDate: '2025-11-10',
    location: 'pantry',
    pricePerUnit: 0.99,
    store: 'Walmart',
  },
  {
    id: '7',
    name: 'Leftover Chicken Bowl',
    category: 'leftover',
    quantity: 1,
    unit: 'container',
    expiryDate: '2025-11-24',
    purchaseDate: '2025-11-21',
    location: 'fridge',
    isLeftover: true,
    parentMealId: 'meal-123',
  },
];

type FilterLocation = 'all' | 'fridge' | 'freezer' | 'pantry';
type SortBy = 'name' | 'expiry' | 'category';

export const InventoryScreen: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>(sampleInventory);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState<FilterLocation>('all');
  const [sortBy, setSortBy] = useState<SortBy>('expiry');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getFilteredAndSortedInventory = () => {
    let filtered = inventory;

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by location
    if (filterLocation !== 'all') {
      filtered = filtered.filter(item => item.location === filterLocation);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'expiry':
          if (!a.expiryDate && !b.expiryDate) return 0;
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleItemPress = (item: InventoryItem) => {
    if (batchMode) {
      toggleItemSelection(item.id);
    } else {
      // Navigate to item detail
      console.log('Open item detail:', item.id);
    }
  };

  const getExpiringCount = () => {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return inventory.filter(item => {
      if (!item.expiryDate) return false;
      return new Date(item.expiryDate) <= threeDaysFromNow;
    }).length;
  };

  const getLocationCounts = () => {
    return {
      fridge: inventory.filter(i => i.location === 'fridge').length,
      freezer: inventory.filter(i => i.location === 'freezer').length,
      pantry: inventory.filter(i => i.location === 'pantry').length,
    };
  };

  const filteredInventory = getFilteredAndSortedInventory();
  const locationCounts = getLocationCounts();
  const expiringCount = getExpiringCount();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>
            {inventory.length} items tracked
          </Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon={batchMode ? '\u2713' : '\u270F'}
            onPress={() => {
              setBatchMode(!batchMode);
              setSelectedItems([]);
            }}
            variant={batchMode ? 'primary' : 'default'}
          />
          <IconButton
            icon="+"
            onPress={() => setShowAddModal(true)}
            variant="primary"
          />
        </View>
      </View>

      {/* Alerts */}
      {expiringCount > 0 && (
        <Card
          variant="filled"
          style={styles.alertCard}
          accentColor={colors.expiry.expiringSoon}
        >
          <Text style={styles.alertIcon}>{'\u26A0'}</Text>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {expiringCount} item{expiringCount > 1 ? 's' : ''} expiring soon
            </Text>
            <Text style={styles.alertSubtitle}>
              Check your inventory to reduce waste
            </Text>
          </View>
          <Button
            title="View"
            onPress={() => {}}
            variant="ghost"
            size="small"
          />
        </Card>
      )}

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <Input
          placeholder="Search inventory..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Text>{'\u{1F50D}'}</Text>}
          containerStyle={styles.searchInput}
        />
        <IconButton
          icon={'\u{1F4F7}'}
          onPress={() => console.log('Open barcode scanner')}
          variant="secondary"
        />
      </View>

      {/* Location Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        {(['all', 'fridge', 'freezer', 'pantry'] as FilterLocation[]).map((loc) => (
          <Button
            key={loc}
            title={`${loc.charAt(0).toUpperCase() + loc.slice(1)}${
              loc !== 'all' ? ` (${locationCounts[loc as keyof typeof locationCounts]})` : ''
            }`}
            onPress={() => setFilterLocation(loc)}
            variant={filterLocation === loc ? 'primary' : 'outline'}
            size="small"
            style={styles.filterButton}
          />
        ))}
      </ScrollView>

      {/* Sort Options */}
      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {(['expiry', 'name', 'category'] as SortBy[]).map((sort) => (
          <Button
            key={sort}
            title={sort.charAt(0).toUpperCase() + sort.slice(1)}
            onPress={() => setSortBy(sort)}
            variant={sortBy === sort ? 'secondary' : 'ghost'}
            size="small"
          />
        ))}
      </View>

      {/* Batch Mode Actions */}
      {batchMode && selectedItems.length > 0 && (
        <View style={styles.batchActions}>
          <Text style={styles.batchCount}>
            {selectedItems.length} selected
          </Text>
          <Button
            title="Delete"
            onPress={() => {
              setInventory(prev => prev.filter(i => !selectedItems.includes(i.id)));
              setSelectedItems([]);
            }}
            variant="outline"
            size="small"
          />
          <Button
            title="Move"
            onPress={() => {}}
            variant="outline"
            size="small"
          />
          <Button
            title="Update Qty"
            onPress={() => {}}
            variant="outline"
            size="small"
          />
        </View>
      )}

      {/* Inventory List */}
      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InventoryItemComponent
            item={item}
            onPress={() => handleItemPress(item)}
            onLongPress={() => {
              if (!batchMode) {
                setBatchMode(true);
                setSelectedItems([item.id]);
              }
            }}
            isSelected={selectedItems.includes(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F4E6}'}</Text>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term'
                : 'Add items to start tracking your inventory'}
            </Text>
          </View>
        }
      />

      {/* Quick Add Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <View style={styles.quickAddOptions}>
              <Button
                title="Scan Barcode"
                onPress={() => {}}
                icon={<Text style={styles.optionIcon}>{'\u{1F4F7}'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
              <Button
                title="Manual Entry"
                onPress={() => {}}
                variant="outline"
                icon={<Text style={styles.optionIcon}>{'\u270D'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
              <Button
                title="From Shopping List"
                onPress={() => {}}
                variant="outline"
                icon={<Text style={styles.optionIcon}>{'\u{1F6D2}'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
              <Button
                title="Log Leftover"
                onPress={() => {}}
                variant="outline"
                icon={<Text style={styles.optionIcon}>{'\u{1F37D}'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
            </View>
            <Button
              title="Cancel"
              onPress={() => setShowAddModal(false)}
              variant="ghost"
              fullWidth
            />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  alertIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  alertSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterButton: {
    marginRight: spacing.xs,
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sortLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  batchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.light + '20',
    gap: spacing.sm,
  },
  batchCount: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.primary.main,
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
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
  emptySubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  quickAddOptions: {
    marginBottom: spacing.md,
  },
  quickAddButton: {
    marginBottom: spacing.sm,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
});
