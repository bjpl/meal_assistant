import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { Button } from '../base/Button';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { ShoppingItem, StoreAssignment } from '../../types';

interface StoreSectionProps {
  store: StoreAssignment;
  items: ShoppingItem[];
  onStorePress?: () => void;
  onItemToggle: (itemId: string) => void;
  onStartShopping?: () => void;
  isActive?: boolean;
}

export const StoreSection: React.FC<StoreSectionProps> = ({
  store,
  items,
  onStorePress,
  onItemToggle,
  onStartShopping,
  isActive = false,
}) => {
  const checkedItems = items.filter((i) => i.checked);
  const progress = (checkedItems.length / items.length) * 100;
  const isComplete = checkedItems.length === items.length;
  const totalSpent = checkedItems.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);
  const savings = items
    .filter((i) => i.deal)
    .reduce((sum, i) => sum + ((i.deal?.originalPrice || 0) - (i.deal?.salePrice || 0)), 0);

  const getStoreIcon = (storeName: string): string => {
    const name = storeName.toLowerCase();
    if (name.includes('costco')) return '\u{1F3EC}';
    if (name.includes('walmart')) return '\u{1F3EA}';
    if (name.includes('whole')) return '\u{1F331}';
    if (name.includes('target')) return '\u{1F3AF}';
    if (name.includes('trader')) return '\u{1F6F6}';
    return '\u{1F6D2}';
  };

  return (
    <Card
      onPress={onStorePress}
      variant={isActive ? 'elevated' : 'outlined'}
      accentColor={isComplete ? colors.success : isActive ? colors.primary.main : undefined}
      style={StyleSheet.flatten([styles.container, isComplete && styles.completeContainer])}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.storeInfo}>
          <Text style={styles.storeIcon}>{getStoreIcon(store.storeName)}</Text>
          <View>
            <Text style={styles.storeName}>{store.storeName}</Text>
            <Text style={styles.itemCount}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {isComplete ? (
            <Badge text="Complete" variant="success" />
          ) : (
            <Badge
              text={`${checkedItems.length}/${items.length}`}
              variant={isActive ? 'warning' : 'default'}
            />
          )}
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <ProgressBar
          progress={progress}
          height={6}
          color={isComplete ? colors.success : colors.primary.main}
        />
      </View>

      {/* Cost Summary */}
      <View style={styles.costRow}>
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Est. Total</Text>
          <Text style={styles.costValue}>${store.estimatedTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Spent</Text>
          <Text style={[styles.costValue, { color: colors.primary.main }]}>
            ${totalSpent.toFixed(2)}
          </Text>
        </View>
        {savings > 0 && (
          <View style={styles.costItem}>
            <Text style={styles.costLabel}>Savings</Text>
            <Text style={[styles.costValue, { color: colors.success }]}>
              ${savings.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Items Preview */}
      {isActive && (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsTitle}>Items</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Card
                onPress={() => onItemToggle(item.id)}
                variant="filled"
                style={StyleSheet.flatten([styles.itemCard, item.checked && styles.itemChecked])}
              >
                <View style={styles.itemRow}>
                  <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                    {item.checked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[styles.itemName, item.checked && styles.itemNameChecked]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.itemQuantity}>
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.itemPriceSection}>
                    {item.deal && (
                      <Badge text="DEAL" variant="success" size="small" />
                    )}
                    <Text style={styles.itemPrice}>
                      ${(item.estimatedPrice || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Card>
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Action */}
      {!isComplete && onStartShopping && !isActive && (
        <Button
          title="Shop This Store"
          onPress={onStartShopping}
          variant="outline"
          fullWidth
          style={styles.actionButton}
        />
      )}

      {isComplete && (
        <View style={styles.completeSection}>
          <Text style={styles.completeIcon}>{'\u2713'}</Text>
          <Text style={styles.completeText}>
            All items from {store.storeName} checked!
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  completeContainer: {
    backgroundColor: colors.success + '05',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  storeName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  itemCount: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  progressSection: {
    marginBottom: spacing.sm,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  costItem: {
    alignItems: 'center',
  },
  costLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  costValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemsSection: {
    marginTop: spacing.sm,
  },
  itemsTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemCard: {
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  itemChecked: {
    opacity: 0.6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 12,
    fontWeight: '600',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.body2,
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
  itemPriceSection: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  completeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  completeIcon: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  completeText: {
    ...typography.body2,
    color: colors.success,
    fontWeight: '600',
  },
});
