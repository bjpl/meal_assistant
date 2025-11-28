import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ExpiryIndicator } from './ExpiryIndicator';
import { colors, spacing, typography } from '../../utils/theme';
import { InventoryItem as InventoryItemType } from '../../types';

export interface InventoryItemProps {
  item: InventoryItemType;
  onPress?: () => void;
  onLongPress?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

const getCategoryIcon = (category: InventoryItemType['category']): string => {
  const icons: Record<InventoryItemType['category'], string> = {
    protein: '\u{1F969}',
    carb: '\u{1F35E}',
    vegetable: '\u{1F966}',
    fruit: '\u{1F34E}',
    dairy: '\u{1F95B}',
    pantry: '\u{1F36A}',
    frozen: '\u{2744}',
    leftover: '\u{1F37D}',
  };
  return icons[category] || '\u{1F4E6}';
};

const getLocationIcon = (location: InventoryItemType['location']): string => {
  const icons: Record<InventoryItemType['location'], string> = {
    fridge: '\u{1F9CA}',
    freezer: '\u2744\uFE0F',
    pantry: '\u{1F3E0}',
  };
  return icons[location] || '\u{1F4E6}';
};

export const InventoryItemComponent: React.FC<InventoryItemProps> = ({
  item,
  onPress,
  onLongPress,
  isSelected = false,
  compact = false,
}) => {
  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        style={[styles.compactContainer, isSelected && styles.selected]}
      >
        <Text style={styles.compactIcon}>{getCategoryIcon(item.category)}</Text>
        <Text style={styles.compactName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.compactQuantity}>
          {item.quantity} {item.unit}
        </Text>
        {item.expiryDate && (
          <ExpiryIndicator expiryDate={item.expiryDate} variant="dot" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Card
      onPress={onPress}
      variant={isSelected ? 'elevated' : 'outlined'}
      style={[styles.card, isSelected && styles.selectedCard]}
    >
      <View style={styles.mainContent}>
        <Text style={styles.icon}>{getCategoryIcon(item.category)}</Text>
        <View style={styles.details}>
          <View style={styles.header}>
            <Text style={styles.name}>{item.name}</Text>
            {item.isLeftover && (
              <Badge text="Leftover" variant="warning" size="small" />
            )}
          </View>
          <View style={styles.meta}>
            <Text style={styles.quantity}>
              {item.quantity} {item.unit}
            </Text>
            <View style={styles.locationTag}>
              <Text style={styles.locationIcon}>{getLocationIcon(item.location)}</Text>
              <Text style={styles.locationText}>{item.location}</Text>
            </View>
          </View>
        </View>
      </View>

      {item.expiryDate && (
        <View style={styles.expirySection}>
          <ExpiryIndicator
            expiryDate={item.expiryDate}
            variant="bar"
            showDaysLeft
          />
        </View>
      )}

      {item.store && item.pricePerUnit && (
        <View style={styles.purchaseInfo}>
          <Text style={styles.purchaseText}>
            ${item.pricePerUnit.toFixed(2)}/{item.unit} from {item.store}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  selectedCard: {
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  details: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantity: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: spacing.xs,
  },
  locationIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  locationText: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  expirySection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  purchaseInfo: {
    marginTop: spacing.xs,
  },
  purchaseText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.xs,
  },
  selected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light + '20',
  },
  compactIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  compactName: {
    ...typography.body2,
    color: colors.text.primary,
    flex: 1,
  },
  compactQuantity: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
});
