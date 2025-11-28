import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SectionList,
  RefreshControl,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Input } from '../components/base/Input';
import { Badge } from '../components/base/Badge';
import { IconButton } from '../components/base/IconButton';
import { ProgressBar } from '../components/base/ProgressBar';
import { DealMatchBadgeCompact } from '../components/ads/DealMatchBadge';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { ShoppingItem, ShoppingList, DealInfo } from '../types';

// Sample data organized by store section
const sampleShoppingList: ShoppingList = {
  id: 'list-1',
  name: 'Week of Nov 25',
  weekOf: '2025-11-25',
  items: [
    { id: '1', name: 'Chicken Breast', quantity: 4, unit: 'lbs', category: 'protein', storeSection: 'Meat', assignedStore: 'Costco', estimatedPrice: 19.99, checked: false, deal: { originalPrice: 24.99, salePrice: 19.99, expiryDate: '2025-11-27', confidence: 'high' } },
    { id: '2', name: 'Salmon Fillets', quantity: 2, unit: 'lbs', category: 'protein', storeSection: 'Seafood', assignedStore: 'Whole Foods', estimatedPrice: 17.98, checked: false },
    { id: '3', name: 'Greek Yogurt', quantity: 6, unit: 'cups', category: 'dairy', storeSection: 'Dairy', assignedStore: 'Safeway', estimatedPrice: 8.94, checked: true },
    { id: '4', name: 'Basmati Rice', quantity: 10, unit: 'lbs', category: 'carb', storeSection: 'Grains', assignedStore: 'Costco', estimatedPrice: 12.99, checked: false, deal: { originalPrice: 15.99, salePrice: 12.99, expiryDate: '2025-11-30', confidence: 'medium' } },
    { id: '5', name: 'Bell Peppers', quantity: 6, unit: 'count', category: 'vegetable', storeSection: 'Produce', assignedStore: 'Safeway', estimatedPrice: 5.94, checked: false },
    { id: '6', name: 'Broccoli', quantity: 2, unit: 'lbs', category: 'vegetable', storeSection: 'Produce', assignedStore: 'Safeway', estimatedPrice: 3.98, checked: true },
    { id: '7', name: 'Black Beans', quantity: 6, unit: 'cans', category: 'pantry', storeSection: 'Canned', assignedStore: 'Walmart', estimatedPrice: 5.94, checked: false },
    { id: '8', name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'pantry', storeSection: 'Oils', assignedStore: 'Costco', estimatedPrice: 14.99, checked: false },
    { id: '9', name: 'Eggs', quantity: 2, unit: 'dozen', category: 'dairy', storeSection: 'Dairy', assignedStore: 'Costco', estimatedPrice: 7.99, checked: false },
    { id: '10', name: 'Sweet Potatoes', quantity: 3, unit: 'lbs', category: 'vegetable', storeSection: 'Produce', assignedStore: 'Safeway', estimatedPrice: 4.47, checked: false },
  ],
  stores: [
    { storeId: 'costco', storeName: 'Costco', items: ['1', '4', '8', '9'], estimatedTotal: 55.96 },
    { storeId: 'safeway', storeName: 'Safeway', items: ['3', '5', '6', '10'], estimatedTotal: 22.33 },
    { storeId: 'wholefoods', storeName: 'Whole Foods', items: ['2'], estimatedTotal: 17.98 },
    { storeId: 'walmart', storeName: 'Walmart', items: ['7'], estimatedTotal: 5.94 },
  ],
  totalEstimatedCost: 102.21,
  status: 'planning',
};

type ViewMode = 'section' | 'store';

// Props interface for navigation
export interface ShoppingScreenProps {
  navigation?: any;
  route?: {
    params?: {
      newDeals?: any[];
    };
  };
}

export const ShoppingScreen: React.FC<ShoppingScreenProps> = ({ navigation, route }) => {
  const [list, setList] = useState<ShoppingList>(sampleShoppingList);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('section');
  const [activeStore, setActiveStore] = useState<string | null>(null);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [showAdUploadPrompt, setShowAdUploadPrompt] = useState(false);

  // Count items with active deals
  const itemsWithDeals = list.items.filter(i => i.deal).length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleItem = (itemId: string) => {
    setList(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ),
    }));
  };

  const getCheckedCount = () => list.items.filter(i => i.checked).length;
  const getTotalItems = () => list.items.length;
  const getProgress = () => (getCheckedCount() / getTotalItems()) * 100;

  const getActualTotal = () =>
    list.items
      .filter(i => i.checked && i.estimatedPrice)
      .reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);

  const getSavings = () =>
    list.items
      .filter(i => i.deal)
      .reduce((sum, i) => sum + ((i.deal?.originalPrice || 0) - (i.deal?.salePrice || 0)), 0);

  const getSectionData = () => {
    const sections: { [key: string]: ShoppingItem[] } = {};
    list.items.forEach(item => {
      if (!sections[item.storeSection]) {
        sections[item.storeSection] = [];
      }
      sections[item.storeSection].push(item);
    });
    return Object.entries(sections).map(([title, data]) => ({ title, data }));
  };

  const getStoreData = () => {
    return list.stores.map(store => ({
      title: store.storeName,
      estimatedTotal: store.estimatedTotal,
      data: list.items.filter(item => store.items.includes(item.id)),
    }));
  };

  const renderDealBadge = (deal?: DealInfo) => {
    if (!deal) return null;

    const savings = deal.originalPrice - deal.salePrice;
    const savingsPercent = Math.round((savings / deal.originalPrice) * 100);

    return (
      <View style={styles.dealBadge}>
        <Badge
          text={`${savingsPercent}% OFF`}
          variant="success"
          size="small"
        />
        <Text style={styles.dealOriginal}>${deal.originalPrice.toFixed(2)}</Text>
        {deal.confidence && (
          <View style={[
            styles.confidenceDot,
            {
              backgroundColor:
                deal.confidence === 'high' ? colors.success :
                deal.confidence === 'medium' ? colors.warning :
                colors.error
            }
          ]} />
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <Card
      onPress={() => toggleItem(item.id)}
      variant={item.checked ? 'filled' : 'outlined'}
      style={[styles.itemCard, item.checked && styles.itemCardChecked]}
    >
      <View style={styles.itemRow}>
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
        </View>
        <View style={styles.itemContent}>
          <Text
            style={[
              styles.itemName,
              item.checked && styles.itemNameChecked,
            ]}
          >
            {item.name}
          </Text>
          <Text style={styles.itemQuantity}>
            {item.quantity} {item.unit}
            {viewMode === 'section' && item.assignedStore && (
              <Text style={styles.itemStore}> - {item.assignedStore}</Text>
            )}
          </Text>
        </View>
        <View style={styles.itemPriceSection}>
          {renderDealBadge(item.deal)}
          <Text style={[styles.itemPrice, item.checked && styles.itemPriceChecked]}>
            ${(item.estimatedPrice || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderSectionHeader = ({ section }: { section: { title: string; estimatedTotal?: number } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.estimatedTotal && (
        <Text style={styles.sectionTotal}>${section.estimatedTotal.toFixed(2)}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Shopping List</Text>
          <Text style={styles.subtitle}>{list.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon={'\u{1F4F0}'}
            onPress={() => navigation?.navigate('AdUpload') || setShowAdUploadPrompt(true)}
            variant="default"
          />
          <IconButton
            icon={'\u{1F4F7}'}
            onPress={() => setShowReceiptScanner(true)}
            variant="default"
          />
          <IconButton icon="+" onPress={() => {}} variant="primary" />
        </View>
      </View>

      {/* Active Deals Banner */}
      {itemsWithDeals > 0 && (
        <TouchableOpacity
          style={styles.dealsBanner}
          onPress={() => navigation?.navigate('DealReview', { adId: 'current' })}
        >
          <View style={styles.dealsBannerContent}>
            <Text style={styles.dealsBannerIcon}>{'\u{1F3F7}'}</Text>
            <View style={styles.dealsBannerText}>
              <Text style={styles.dealsBannerTitle}>
                {itemsWithDeals} items with active deals
              </Text>
              <Text style={styles.dealsBannerSubtitle}>
                Potential savings: ${getSavings().toFixed(2)}
              </Text>
            </View>
          </View>
          <Text style={styles.dealsBannerArrow}>{'\u276F'}</Text>
        </TouchableOpacity>
      )}

      {/* Progress Card */}
      <Card variant="elevated" style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {getCheckedCount()} of {getTotalItems()} items
          </Text>
          <Badge
            text={list.status}
            variant={list.status === 'shopping' ? 'warning' : 'info'}
          />
        </View>
        <ProgressBar
          progress={getProgress()}
          height={10}
          color={colors.success}
        />
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>${getActualTotal().toFixed(2)}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.statValue}>${list.totalEstimatedCost.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Budget</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              ${getSavings().toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>
      </Card>

      {/* View Mode Toggle */}
      <View style={styles.viewToggle}>
        <Button
          title="By Section"
          onPress={() => setViewMode('section')}
          variant={viewMode === 'section' ? 'primary' : 'outline'}
          size="small"
          style={styles.toggleButton}
        />
        <Button
          title="By Store"
          onPress={() => setViewMode('store')}
          variant={viewMode === 'store' ? 'primary' : 'outline'}
          size="small"
          style={styles.toggleButton}
        />
      </View>

      {/* Store Quick Select (when in store mode) */}
      {viewMode === 'store' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storeScroll}
        >
          {list.stores.map(store => {
            const storeItems = list.items.filter(i => store.items.includes(i.id));
            const checkedCount = storeItems.filter(i => i.checked).length;
            const isComplete = checkedCount === storeItems.length;

            return (
              <Card
                key={store.storeId}
                onPress={() => setActiveStore(
                  activeStore === store.storeId ? null : store.storeId
                )}
                variant={activeStore === store.storeId ? 'elevated' : 'outlined'}
                style={[
                  styles.storeCard,
                  isComplete && styles.storeCardComplete,
                ]}
              >
                <Text style={styles.storeName}>{store.storeName}</Text>
                <Text style={styles.storeCount}>
                  {checkedCount}/{storeItems.length}
                </Text>
                <Text style={styles.storeTotal}>
                  ${store.estimatedTotal.toFixed(2)}
                </Text>
                {isComplete && (
                  <Badge text="Done" variant="success" size="small" />
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {/* Shopping List */}
      <SectionList
        sections={viewMode === 'section' ? getSectionData() : getStoreData()}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickySectionHeadersEnabled
      />

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Button
          title="Start Shopping"
          onPress={() => setList(prev => ({ ...prev, status: 'shopping' }))}
          fullWidth
          disabled={list.status === 'shopping'}
        />
      </View>

      {/* Receipt Scanner Modal */}
      <Modal visible={showReceiptScanner} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Scan Receipt</Text>
            <View style={styles.receiptPlaceholder}>
              <Text style={styles.receiptIcon}>{'\u{1F4F8}'}</Text>
              <Text style={styles.receiptText}>
                Take a photo of your receipt to automatically update prices
              </Text>
            </View>
            <Button
              title="Open Camera"
              onPress={() => {}}
              fullWidth
              style={{ marginBottom: spacing.sm }}
            />
            <Button
              title="Cancel"
              onPress={() => setShowReceiptScanner(false)}
              variant="ghost"
              fullWidth
            />
          </Card>
        </View>
      </Modal>

      {/* Ad Upload Prompt Modal (fallback when navigation not available) */}
      <Modal visible={showAdUploadPrompt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card variant="elevated" style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Weekly Ad</Text>
            <View style={styles.receiptPlaceholder}>
              <Text style={styles.receiptIcon}>{'\u{1F4F0}'}</Text>
              <Text style={styles.receiptText}>
                Upload your store's weekly ad to automatically find deals that match your shopping list
              </Text>
            </View>
            <View style={styles.adUploadFeatures}>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>{'\u2713'}</Text>
                <Text style={styles.featureText}>Auto-detect deals from PDF or photos</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>{'\u2713'}</Text>
                <Text style={styles.featureText}>Match deals to your shopping list</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureIcon}>{'\u2713'}</Text>
                <Text style={styles.featureText}>Processing in under 10 seconds</Text>
              </View>
            </View>
            <Button
              title="Upload Ad"
              onPress={() => {
                setShowAdUploadPrompt(false);
                navigation?.navigate('AdUpload');
              }}
              fullWidth
              style={{ marginBottom: spacing.sm }}
            />
            <Button
              title="Cancel"
              onPress={() => setShowAdUploadPrompt(false)}
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
  progressCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  progressStat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleButton: {
    flex: 1,
    marginRight: spacing.xs,
  },
  storeScroll: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  storeCard: {
    width: 100,
    alignItems: 'center',
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  storeCardComplete: {
    backgroundColor: colors.success + '10',
    borderColor: colors.success,
  },
  storeName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  storeCount: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  storeTotal: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.primary.main,
    marginBottom: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background.secondary,
  },
  sectionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionTotal: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  itemCard: {
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  itemCardChecked: {
    opacity: 0.7,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    ...typography.body1,
    color: colors.text.primary,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  itemQuantity: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  itemStore: {
    color: colors.primary.main,
  },
  itemPriceSection: {
    alignItems: 'flex-end',
  },
  dealBadge: {
    alignItems: 'flex-end',
    marginBottom: spacing.xs / 2,
  },
  dealOriginal: {
    ...typography.caption,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
    fontSize: 10,
  },
  itemPrice: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemPriceChecked: {
    color: colors.text.secondary,
  },
  quickActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  receiptPlaceholder: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  receiptIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  receiptText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  dealsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.success + '15',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  dealsBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dealsBannerIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  dealsBannerText: {
    flex: 1,
  },
  dealsBannerTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.success,
  },
  dealsBannerSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  dealsBannerArrow: {
    fontSize: 16,
    color: colors.success,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: spacing.xs / 2,
    alignSelf: 'flex-end',
  },
  adUploadFeatures: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureIcon: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  featureText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
});
