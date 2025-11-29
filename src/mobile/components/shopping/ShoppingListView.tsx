import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { ShoppingItem, ShoppingList } from '../../types';

interface ShoppingListViewProps {
  list: ShoppingList;
  onToggleItem: (itemId: string) => void;
  onItemPress?: (item: ShoppingItem) => void;
  onAddItem?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  viewMode?: 'section' | 'store';
  showSearch?: boolean;
}

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  list,
  onToggleItem,
  onItemPress,
  onAddItem,
  onRefresh,
  refreshing = false,
  viewMode = 'section',
  showSearch = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getFilteredItems = () => {
    if (!searchQuery) return list.items;
    return list.items.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getSectionData = () => {
    const items = getFilteredItems();
    const sections: { [key: string]: ShoppingItem[] } = {};

    items.forEach((item) => {
      const key = viewMode === 'section' ? item.storeSection : (item.assignedStore || 'Unassigned');
      if (!sections[key]) {
        sections[key] = [];
      }
      sections[key].push(item);
    });

    return Object.entries(sections)
      .map(([title, data]) => ({
        title,
        data: data.sort((a, b) => {
          if (a.checked === b.checked) return a.name.localeCompare(b.name);
          return a.checked ? 1 : -1;
        }),
        checkedCount: data.filter((i) => i.checked).length,
        totalCount: data.length,
      }))
      .sort((a, b) => {
        if (a.checkedCount === a.totalCount && b.checkedCount !== b.totalCount) return 1;
        if (b.checkedCount === b.totalCount && a.checkedCount !== a.totalCount) return -1;
        return a.title.localeCompare(b.title);
      });
  };

  const getProgress = () => {
    const checked = list.items.filter((i) => i.checked).length;
    return (checked / list.items.length) * 100;
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
    <Card
      onPress={() => onToggleItem(item.id)}
      onLongPress={() => onItemPress && onItemPress(item)}
      variant={item.checked ? 'filled' : 'outlined'}
      style={StyleSheet.flatten([styles.itemCard, item.checked && styles.itemCardChecked])}
    >
      <View style={styles.itemRow}>
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
        </View>

        <View style={styles.itemContent}>
          <Text
            style={[styles.itemName, item.checked && styles.itemNameChecked]}
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
          {item.deal && (
            <Badge
              text={`${Math.round(((item.deal.originalPrice - item.deal.salePrice) / item.deal.originalPrice) * 100)}% OFF`}
              variant="success"
              size="small"
            />
          )}
          <Text style={[styles.itemPrice, item.checked && styles.itemPriceChecked]}>
            ${(item.estimatedPrice || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string; checkedCount: number; totalCount: number };
  }) => {
    const isComplete = section.checkedCount === section.totalCount;

    return (
      <View style={[styles.sectionHeader, isComplete && styles.sectionHeaderComplete]}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {isComplete && (
            <Badge text="Done" variant="success" size="small" />
          )}
        </View>
        <Text style={styles.sectionCount}>
          {section.checkedCount}/{section.totalCount}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <Card variant="elevated" style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <View>
            <Text style={styles.statsTitle}>{list.name}</Text>
            <Text style={styles.statsSubtitle}>
              {list.items.filter((i) => i.checked).length} of {list.items.length} items
            </Text>
          </View>
          <Badge
            text={list.status}
            variant={list.status === 'shopping' ? 'warning' : 'info'}
          />
        </View>

        <ProgressBar
          progress={getProgress()}
          height={8}
          color={colors.success}
          style={styles.progressBar}
        />

        <View style={styles.costSummary}>
          <View style={styles.costItem}>
            <Text style={styles.costValue}>
              ${list.items
                .filter((i) => i.checked && i.estimatedPrice)
                .reduce((sum, i) => sum + (i.estimatedPrice || 0), 0)
                .toFixed(2)}
            </Text>
            <Text style={styles.costLabel}>Spent</Text>
          </View>
          <View style={styles.costDivider} />
          <View style={styles.costItem}>
            <Text style={styles.costValue}>
              ${list.totalEstimatedCost.toFixed(2)}
            </Text>
            <Text style={styles.costLabel}>Budget</Text>
          </View>
          <View style={styles.costDivider} />
          <View style={styles.costItem}>
            <Text style={[styles.costValue, { color: colors.success }]}>
              ${list.items
                .filter((i) => i.deal)
                .reduce((sum, i) => sum + ((i.deal?.originalPrice || 0) - (i.deal?.salePrice || 0)), 0)
                .toFixed(2)}
            </Text>
            <Text style={styles.costLabel}>Saved</Text>
          </View>
        </View>
      </Card>

      {/* Search */}
      {showSearch && (
        <View style={styles.searchSection}>
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Text>{'\u{1F50D}'}</Text>}
            containerStyle={styles.searchInput}
          />
          {onAddItem && (
            <Button
              title="+"
              onPress={onAddItem}
              style={styles.addButton}
            />
          )}
        </View>
      )}

      {/* List */}
      <SectionList
        sections={getSectionData()}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F6D2}'}</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No items found' : 'Your list is empty'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try a different search term'
                : 'Add items to start shopping'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  statsTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statsSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  progressBar: {
    marginBottom: spacing.md,
  },
  costSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  costItem: {
    alignItems: 'center',
  },
  costValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  costLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  costDivider: {
    width: 1,
    backgroundColor: colors.border.light,
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
  addButton: {
    width: 48,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background.secondary,
  },
  sectionHeaderComplete: {
    backgroundColor: colors.success + '10',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  itemPrice: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  itemPriceChecked: {
    color: colors.text.secondary,
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
