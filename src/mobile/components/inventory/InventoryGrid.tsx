import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ExpiryIndicator } from './ExpiryIndicator';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { InventoryItem, ExpiryStatus } from '../../types';

interface InventoryGridProps {
  items: InventoryItem[];
  onItemPress: (item: InventoryItem) => void;
  onItemLongPress?: (item: InventoryItem) => void;
  selectedItems?: string[];
  numColumns?: number;
}

const categoryIcons: Record<string, string> = {
  protein: '\u{1F357}',
  carb: '\u{1F35E}',
  vegetable: '\u{1F966}',
  fruit: '\u{1F34E}',
  dairy: '\u{1F95B}',
  pantry: '\u{1F3FA}',
  frozen: '\u2744',
  leftover: '\u{1F37D}',
};

const locationColors: Record<string, string> = {
  fridge: colors.info,
  freezer: '#2196F3',
  pantry: colors.warning,
};

const { width } = Dimensions.get('window');

export const InventoryGrid: React.FC<InventoryGridProps> = ({
  items,
  onItemPress,
  onItemLongPress,
  selectedItems = [],
  numColumns = 2,
}) => {
  const cardWidth = (width - spacing.md * 2 - spacing.sm * (numColumns - 1)) / numColumns;

  const getExpiryStatus = (expiryDate?: string): ExpiryStatus => {
    if (!expiryDate) return 'fresh';

    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 3) return 'expiring-soon';
    return 'fresh';
  };

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const isSelected = selectedItems.includes(item.id);
    const expiryStatus = getExpiryStatus(item.expiryDate);

    return (
      <Card
        onPress={() => onItemPress(item)}
        onLongPress={() => onItemLongPress && onItemLongPress(item)}
        variant={isSelected ? 'elevated' : 'outlined'}
        style={[
          styles.card,
          { width: cardWidth },
          isSelected && styles.selectedCard,
          expiryStatus === 'expired' && styles.expiredCard,
        ]}
      >
        {/* Selection Indicator */}
        {isSelected && (
          <View style={styles.selectionIndicator}>
            <Text style={styles.checkmark}>{'\u2713'}</Text>
          </View>
        )}

        {/* Category Icon */}
        <View style={[styles.iconContainer, { backgroundColor: locationColors[item.location] + '20' }]}>
          <Text style={styles.icon}>{categoryIcons[item.category] || '\u{1F4E6}'}</Text>
        </View>

        {/* Item Info */}
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.quantityRow}>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <Text style={styles.unit}>{item.unit}</Text>
        </View>

        {/* Location Badge */}
        <Badge
          text={item.location}
          size="small"
          customColor={locationColors[item.location]}
          style={styles.locationBadge}
        />

        {/* Expiry Indicator */}
        {item.expiryDate && (
          <View style={styles.expiryRow}>
            <ExpiryIndicator
              expiryDate={item.expiryDate}
              variant="compact"
            />
          </View>
        )}

        {/* Leftover Indicator */}
        {item.isLeftover && (
          <Badge
            text="Leftover"
            size="small"
            variant="warning"
            style={styles.leftoverBadge}
          />
        )}
      </Card>
    );
  };

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F4E6}'}</Text>
          <Text style={styles.emptyTitle}>No Items</Text>
          <Text style={styles.emptyText}>Your inventory is empty</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  selectedCard: {
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  expiredCard: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  selectionIndicator: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  checkmark: {
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  icon: {
    fontSize: 24,
  },
  itemName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
    minHeight: 36,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  quantity: {
    ...typography.h3,
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  unit: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  locationBadge: {
    marginBottom: spacing.xs,
  },
  expiryRow: {
    marginTop: spacing.xs,
  },
  leftoverBadge: {
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
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
  },
});
