import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  fetchInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  selectInventoryItems,
  selectInventoryLoading
} from '../store/slices/inventorySlice';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Input } from '../components/base/Input';
import { Badge } from '../components/base/Badge';
import { IconButton } from '../components/base/IconButton';
import { InventoryItemComponent } from '../components/inventory/InventoryItem';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { InventoryItem } from '../types';

type FilterLocation = 'all' | 'fridge' | 'freezer' | 'pantry';
type SortBy = 'name' | 'expiry' | 'category';

export const InventoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const inventory = useSelector(selectInventoryItems);
  const loading = useSelector(selectInventoryLoading);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState<FilterLocation>('all');
  const [sortBy, setSortBy] = useState<SortBy>('expiry');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemLocation, setNewItemLocation] = useState<FilterLocation>('fridge');

  useEffect(() => {
    dispatch(fetchInventory());
  }, [dispatch]);

  const onRefresh = async () => {
    await dispatch(fetchInventory()).unwrap();
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
      // Show item detail alert with options
      Alert.alert(
        item.name,
        `Quantity: ${item.quantity} ${item.unit || 'units'}\nLocation: ${item.location}\n${item.expiryDate ? `Expires: ${new Date(item.expiryDate).toLocaleDateString()}` : ''}`,
        [
          { text: 'Edit', onPress: () => handleEditItem(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteItem(item.id) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    Alert.prompt(
      'Update Quantity',
      `Current: ${item.quantity}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: (newQty) => {
            if (newQty && !isNaN(Number(newQty))) {
              dispatch(updateInventoryItem({ itemId: item.id, updates: { quantity: Number(newQty) } }));
            }
          },
        },
      ],
      'plain-text',
      String(item.quantity)
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await dispatch(deleteInventoryItem(itemId)).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleViewExpiring = useCallback(() => {
    // Filter to show only expiring items
    setSortBy('expiry');
    setFilterLocation('all');
    setSearchQuery('');
    // Set filter to expiring-only mode in future iteration
    Alert.alert('Expiring Items', 'Items sorted by expiry date. Items expiring soon are shown first.');
  }, []);

  const handleBatchMove = useCallback(() => {
    if (selectedItems.length === 0) return;
    setShowMoveModal(true);
  }, [selectedItems]);

  const handleBatchQuantity = useCallback(() => {
    if (selectedItems.length === 0) return;
    setShowQuantityModal(true);
  }, [selectedItems]);

  const handleMoveItems = async (newLocation: FilterLocation) => {
    if (newLocation === 'all') return;
    try {
      await Promise.all(
        selectedItems.map(id =>
          dispatch(updateInventoryItem({ itemId: id, updates: { location: newLocation as 'fridge' | 'freezer' | 'pantry' } })).unwrap()
        )
      );
      setSelectedItems([]);
      setShowMoveModal(false);
      Alert.alert('Success', `Moved ${selectedItems.length} items to ${newLocation}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to move items');
    }
  };

  const handleManualEntry = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    try {
      await dispatch(addInventoryItem({
        name: newItemName.trim(),
        quantity: Number(newItemQuantity) || 1,
        unit: 'units',
        category: 'pantry',
        location: newItemLocation === 'all' ? 'pantry' : newItemLocation,
        purchaseDate: new Date().toISOString().split('T')[0],
      })).unwrap();
      setNewItemName('');
      setNewItemQuantity('1');
      setShowManualEntryModal(false);
      setShowAddModal(false);
      Alert.alert('Success', 'Item added to inventory');
    } catch (error) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleScanBarcode = () => {
    Alert.alert('Scanner', 'Barcode scanning requires camera permissions. This feature will open the camera to scan product barcodes.', [{ text: 'OK' }]);
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
            onPress={handleViewExpiring}
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
          onPress={handleScanBarcode}
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
            onPress={async () => {
              try {
                await Promise.all(selectedItems.map(id => dispatch(deleteInventoryItem(id)).unwrap()));
                setSelectedItems([]);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete items');
              }
            }}
            variant="outline"
            size="small"
          />
          <Button
            title="Move"
            onPress={handleBatchMove}
            variant="outline"
            size="small"
          />
          <Button
            title="Update Qty"
            onPress={handleBatchQuantity}
            variant="outline"
            size="small"
          />
        </View>
      )}

      {/* Inventory List */}
      {loading && inventory.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
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
            <RefreshControl refreshing={loading} onRefresh={onRefresh} />
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
      )}

      {/* Move Items Modal */}
      <Modal visible={showMoveModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Move {selectedItems.length} Items To</Text>
            {(['fridge', 'freezer', 'pantry'] as const).map((loc) => (
              <Button
                key={loc}
                title={loc.charAt(0).toUpperCase() + loc.slice(1)}
                onPress={() => handleMoveItems(loc)}
                variant="outline"
                fullWidth
                style={styles.quickAddButton}
              />
            ))}
            <Button
              title="Cancel"
              onPress={() => setShowMoveModal(false)}
              variant="ghost"
              fullWidth
            />
          </Card>
        </View>
      </Modal>

      {/* Quantity Update Modal */}
      <Modal visible={showQuantityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Quantity</Text>
            <Text style={styles.modalSubtitle}>{selectedItems.length} items selected</Text>
            <View style={styles.quantityActions}>
              <Button title="-1" onPress={() => {
                Promise.all(selectedItems.map(id => {
                  const item = inventory.find(i => i.id === id);
                  if (item && item.quantity > 1) {
                    return dispatch(updateInventoryItem({ itemId: id, updates: { quantity: item.quantity - 1 } })).unwrap();
                  }
                  return Promise.resolve();
                })).then(() => setShowQuantityModal(false));
              }} variant="outline" />
              <Button title="+1" onPress={() => {
                Promise.all(selectedItems.map(id => {
                  const item = inventory.find(i => i.id === id);
                  if (item) {
                    return dispatch(updateInventoryItem({ itemId: id, updates: { quantity: item.quantity + 1 } })).unwrap();
                  }
                  return Promise.resolve();
                })).then(() => setShowQuantityModal(false));
              }} variant="outline" />
              <Button title="Set to 0" onPress={() => {
                Promise.all(selectedItems.map(id =>
                  dispatch(updateInventoryItem({ itemId: id, updates: { quantity: 0 } })).unwrap()
                )).then(() => {
                  setShowQuantityModal(false);
                  setSelectedItems([]);
                });
              }} variant="outline" />
            </View>
            <Button
              title="Cancel"
              onPress={() => setShowQuantityModal(false)}
              variant="ghost"
              fullWidth
            />
          </Card>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal visible={showManualEntryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <Input
              label="Item Name"
              placeholder="e.g., Chicken breast"
              value={newItemName}
              onChangeText={setNewItemName}
            />
            <Input
              label="Quantity"
              placeholder="1"
              value={newItemQuantity}
              onChangeText={setNewItemQuantity}
              keyboardType="numeric"
            />
            <Text style={styles.locationLabel}>Location</Text>
            <View style={styles.locationButtons}>
              {(['fridge', 'freezer', 'pantry'] as const).map((loc) => (
                <Button
                  key={loc}
                  title={loc.charAt(0).toUpperCase() + loc.slice(1)}
                  onPress={() => setNewItemLocation(loc)}
                  variant={newItemLocation === loc ? 'primary' : 'outline'}
                  size="small"
                  style={styles.locationButton}
                />
              ))}
            </View>
            <Button
              title="Add Item"
              onPress={handleManualEntry}
              fullWidth
              style={styles.quickAddButton}
            />
            <Button
              title="Cancel"
              onPress={() => setShowManualEntryModal(false)}
              variant="ghost"
              fullWidth
            />
          </Card>
        </View>
      </Modal>

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
                onPress={() => {
                  setShowAddModal(false);
                  handleScanBarcode();
                }}
                icon={<Text style={styles.optionIcon}>{'\u{1F4F7}'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
              <Button
                title="Manual Entry"
                onPress={() => {
                  setShowAddModal(false);
                  setShowManualEntryModal(true);
                }}
                variant="outline"
                icon={<Text style={styles.optionIcon}>{'\u270D'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
              <Button
                title="From Shopping List"
                onPress={() => {
                  setShowAddModal(false);
                  (navigation as any).navigate?.('Kitchen');
                  Alert.alert('Shopping List', 'Navigate to Shopping tab to add purchased items to inventory');
                }}
                variant="outline"
                icon={<Text style={styles.optionIcon}>{'\u{1F6D2}'}</Text>}
                fullWidth
                style={styles.quickAddButton}
              />
              <Button
                title="Log Leftover"
                onPress={() => {
                  setShowAddModal(false);
                  setNewItemName('Leftover ');
                  setShowManualEntryModal(true);
                }}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.md,
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
  modalSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  quantityActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  locationLabel: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  locationButtons: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  locationButton: {
    flex: 1,
  },
});
