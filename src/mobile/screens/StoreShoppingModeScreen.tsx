import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { ProgressBar } from '../components/base/ProgressBar';
import {
  StoreShoppingSession,
  ShoppingModeItem,
  Store,
  STORE_SECTIONS,
} from '../types/optimization.types';

// ============================================
// Types
// ============================================
interface StoreShoppingModeScreenProps {
  storeId: string;
  storeName: string;
  items: ShoppingModeItem[];
  onComplete: (session: StoreShoppingSession) => void;
  onCancel: () => void;
}

interface SectionHeaderProps {
  section: string;
  itemCount: number;
  completedCount: number;
}

interface ShoppingItemRowProps {
  item: ShoppingModeItem;
  onCheck: () => void;
  onUnavailable: () => void;
  onPriceUpdate: (price: number) => void;
}

interface SubstituteModalProps {
  visible: boolean;
  itemName: string;
  onSelect: (substituteName: string) => void;
  onCancel: () => void;
}

// ============================================
// Helper Functions
// ============================================
const formatCurrency = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

const formatTime = (startTime: string): string => {
  const start = new Date(startTime);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

  if (diffMinutes < 1) return 'Just started';
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}h ${mins}m`;
};

const groupItemsBySection = (
  items: ShoppingModeItem[]
): Record<string, ShoppingModeItem[]> => {
  const grouped: Record<string, ShoppingModeItem[]> = {};

  // Initialize with sections in order
  STORE_SECTIONS.forEach(section => {
    grouped[section.name] = [];
  });
  grouped['Other'] = [];

  items.forEach(item => {
    const section = STORE_SECTIONS.find(
      s => s.id === item.section || s.name.toLowerCase() === item.section.toLowerCase()
    );
    const sectionName = section?.name || 'Other';
    grouped[sectionName].push(item);
  });

  // Remove empty sections
  Object.keys(grouped).forEach(key => {
    if (grouped[key].length === 0) {
      delete grouped[key];
    }
  });

  return grouped;
};

// ============================================
// Sub-Components
// ============================================
const SectionHeader: React.FC<SectionHeaderProps> = ({
  section,
  itemCount,
  completedCount,
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleContainer}>
      <Text style={styles.sectionTitle}>{section}</Text>
      <Text style={styles.sectionCount}>
        {completedCount}/{itemCount}
      </Text>
    </View>
    <ProgressBar
      progress={completedCount}
      max={itemCount}
      color={colors.primary.main}
      height={4}
      showLabel={false}
    />
  </View>
);

const ShoppingItemRow: React.FC<ShoppingItemRowProps> = ({
  item,
  onCheck,
  onUnavailable,
  onPriceUpdate,
}) => {
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [priceValue, setPriceValue] = useState(
    item.actualPrice?.toString() || item.estimatedPrice.toString()
  );

  const handlePriceSubmit = useCallback(() => {
    const price = parseFloat(priceValue);
    if (!isNaN(price) && price >= 0) {
      onPriceUpdate(price);
    }
    setShowPriceInput(false);
  }, [priceValue, onPriceUpdate]);

  return (
    <View style={[
      styles.itemRow,
      item.checked && styles.itemRowChecked,
      item.unavailable && styles.itemRowUnavailable,
    ]}>
      {/* Checkbox */}
      <TouchableOpacity
        style={[styles.checkbox, item.checked && styles.checkboxChecked]}
        onPress={onCheck}
        disabled={item.unavailable}
      >
        {item.checked && <Text style={styles.checkmark}>check</Text>}
      </TouchableOpacity>

      {/* Item Info */}
      <View style={styles.itemInfo}>
        <Text style={[
          styles.itemName,
          item.checked && styles.itemNameChecked,
          item.unavailable && styles.itemNameUnavailable,
        ]}>
          {item.name}
        </Text>
        <Text style={styles.itemQuantity}>
          {item.quantity} {item.unit}
        </Text>
        {item.unavailable && item.substituteName && (
          <Text style={styles.substituteText}>
            Substituted with: {item.substituteName}
          </Text>
        )}
      </View>

      {/* Price */}
      <TouchableOpacity
        style={styles.priceContainer}
        onPress={() => setShowPriceInput(true)}
        disabled={item.unavailable}
      >
        {showPriceInput ? (
          <TextInput
            style={styles.priceInput}
            value={priceValue}
            onChangeText={setPriceValue}
            keyboardType="decimal-pad"
            onBlur={handlePriceSubmit}
            onSubmitEditing={handlePriceSubmit}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <Text style={[
            styles.priceText,
            item.actualPrice && styles.priceActual,
            item.unavailable && styles.priceUnavailable,
          ]}>
            {formatCurrency(item.actualPrice || item.estimatedPrice)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Unavailable Button */}
      {!item.checked && !item.unavailable && (
        <TouchableOpacity
          style={styles.unavailableButton}
          onPress={onUnavailable}
        >
          <Text style={styles.unavailableButtonText}>N/A</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const SubstituteModal: React.FC<SubstituteModalProps> = ({
  visible,
  itemName,
  onSelect,
  onCancel,
}) => {
  const [substituteName, setSubstituteName] = useState('');

  const handleSubmit = useCallback(() => {
    if (substituteName.trim()) {
      onSelect(substituteName.trim());
      setSubstituteName('');
    }
  }, [substituteName, onSelect]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.substituteModalContent}>
          <Text style={styles.substituteModalTitle}>Item Unavailable</Text>
          <Text style={styles.substituteModalText}>
            {itemName} is not available. Would you like to add a substitute?
          </Text>

          <TextInput
            style={styles.substituteInput}
            placeholder="Enter substitute item name"
            value={substituteName}
            onChangeText={setSubstituteName}
            autoFocus
          />

          <View style={styles.substituteModalButtons}>
            <Button
              title="Skip"
              onPress={onCancel}
              variant="outline"
              style={styles.modalButton}
            />
            <Button
              title="Add Substitute"
              onPress={handleSubmit}
              variant="primary"
              style={styles.modalButton}
              disabled={!substituteName.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// Main Component
// ============================================
export const StoreShoppingModeScreen: React.FC<StoreShoppingModeScreenProps> = ({
  storeId,
  storeName,
  items: initialItems,
  onComplete,
  onCancel,
}) => {
  const [items, setItems] = useState<ShoppingModeItem[]>(initialItems);
  const [startTime] = useState(new Date().toISOString());
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [unavailableItemId, setUnavailableItemId] = useState<string | null>(null);

  // Group items by section
  const groupedItems = useMemo(() => groupItemsBySection(items), [items]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = items.length;
    const completed = items.filter(i => i.checked || i.unavailable).length;
    const checkedTotal = items
      .filter(i => i.checked)
      .reduce((sum, i) => sum + (i.actualPrice || i.estimatedPrice), 0);

    return { total, completed, checkedTotal };
  }, [items]);

  // Handlers
  const handleCheck = useCallback((itemId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  }, []);

  const handleUnavailable = useCallback((itemId: string) => {
    setUnavailableItemId(itemId);
    setShowSubstituteModal(true);
  }, []);

  const handleSubstituteSelect = useCallback((substituteName: string) => {
    if (unavailableItemId) {
      setItems(prev =>
        prev.map(item =>
          item.id === unavailableItemId
            ? { ...item, unavailable: true, substituteName }
            : item
        )
      );
    }
    setShowSubstituteModal(false);
    setUnavailableItemId(null);
  }, [unavailableItemId]);

  const handleSubstituteCancel = useCallback(() => {
    if (unavailableItemId) {
      setItems(prev =>
        prev.map(item =>
          item.id === unavailableItemId
            ? { ...item, unavailable: true }
            : item
        )
      );
    }
    setShowSubstituteModal(false);
    setUnavailableItemId(null);
  }, [unavailableItemId]);

  const handlePriceUpdate = useCallback((itemId: string, price: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, actualPrice: price } : item
      )
    );
  }, []);

  const handleComplete = useCallback(() => {
    const uncheckedItems = items.filter(i => !i.checked && !i.unavailable);

    if (uncheckedItems.length > 0) {
      Alert.alert(
        'Unchecked Items',
        `You have ${uncheckedItems.length} unchecked items. Complete anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            onPress: () => {
              const session: StoreShoppingSession = {
                storeId,
                storeName,
                items,
                startTime,
                endTime: new Date().toISOString(),
                status: 'completed',
                actualTotal: progress.checkedTotal,
              };
              onComplete(session);
            },
          },
        ]
      );
    } else {
      const session: StoreShoppingSession = {
        storeId,
        storeName,
        items,
        startTime,
        endTime: new Date().toISOString(),
        status: 'completed',
        actualTotal: progress.checkedTotal,
      };
      onComplete(session);
    }
  }, [items, progress.checkedTotal, onComplete, storeId, storeName, startTime]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Shopping?',
      'Your progress will be lost. Are you sure?',
      [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: onCancel },
      ]
    );
  }, [onCancel]);

  const unavailableItem = useMemo(
    () => items.find(i => i.id === unavailableItemId),
    [items, unavailableItemId]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.main} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.headerCancel}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{storeName}</Text>
            <Text style={styles.headerTimer}>{formatTime(startTime)}</Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              {progress.completed} of {progress.total} items
            </Text>
            <Text style={styles.progressTotal}>
              {formatCurrency(progress.checkedTotal)}
            </Text>
          </View>
          <ProgressBar
            progress={progress.completed}
            max={progress.total}
            color={colors.primary.contrast}
            backgroundColor={colors.primary.dark}
            height={8}
            showLabel={false}
          />
        </View>
      </View>

      {/* Items List */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <View key={section} style={styles.section}>
            <SectionHeader
              section={section}
              itemCount={sectionItems.length}
              completedCount={
                sectionItems.filter(i => i.checked || i.unavailable).length
              }
            />
            {sectionItems.map(item => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                onCheck={() => handleCheck(item.id)}
                onUnavailable={() => handleUnavailable(item.id)}
                onPriceUpdate={(price) => handlePriceUpdate(item.id, price)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerStats}>
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Running Total</Text>
            <Text style={styles.footerStatValue}>
              {formatCurrency(progress.checkedTotal)}
            </Text>
          </View>
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Remaining</Text>
            <Text style={styles.footerStatValue}>
              {progress.total - progress.completed} items
            </Text>
          </View>
        </View>
        <Button
          title={
            progress.completed === progress.total
              ? 'Complete Shopping'
              : `Complete (${progress.completed}/${progress.total})`
          }
          onPress={handleComplete}
          variant="primary"
          size="large"
          fullWidth
        />
      </View>

      {/* Substitute Modal */}
      <SubstituteModal
        visible={showSubstituteModal}
        itemName={unavailableItem?.name || ''}
        onSelect={handleSubstituteSelect}
        onCancel={handleSubstituteCancel}
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
    backgroundColor: colors.primary.main,
  },
  header: {
    backgroundColor: colors.primary.main,
    padding: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerCancel: {
    ...typography.body1,
    color: colors.primary.contrast,
    opacity: 0.9,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.primary.contrast,
  },
  headerTimer: {
    ...typography.caption,
    color: colors.primary.contrast,
    opacity: 0.8,
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 60,
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressText: {
    ...typography.body2,
    color: colors.primary.contrast,
  },
  progressTotal: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.primary.contrast,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    paddingBottom: spacing.md,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionCount: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  itemRowChecked: {
    backgroundColor: colors.success + '10',
  },
  itemRowUnavailable: {
    backgroundColor: colors.error + '10',
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
    fontSize: 14,
    color: colors.text.inverse,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    ...typography.body1,
    color: colors.text.primary,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  itemNameUnavailable: {
    textDecorationLine: 'line-through',
    color: colors.error,
  },
  itemQuantity: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  substituteText: {
    ...typography.caption,
    color: colors.primary.main,
    marginTop: 2,
    fontStyle: 'italic',
  },
  priceContainer: {
    minWidth: 60,
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  priceText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  priceActual: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  priceUnavailable: {
    textDecorationLine: 'line-through',
    color: colors.error,
  },
  priceInput: {
    ...typography.body2,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    minWidth: 60,
    textAlign: 'right',
  },
  unavailableButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    backgroundColor: colors.error + '20',
    borderRadius: borderRadius.sm,
  },
  unavailableButtonText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  footerStat: {},
  footerStatLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  footerStatValue: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  substituteModalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  substituteModalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  substituteModalText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  substituteInput: {
    ...typography.body1,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  substituteModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default StoreShoppingModeScreen;
