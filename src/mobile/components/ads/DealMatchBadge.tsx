import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';

export interface DealMatchBadgeProps {
  matchedItemName?: string;
  isMatched: boolean;
  savingsAmount?: number;
  style?: ViewStyle;
}

export const DealMatchBadge: React.FC<DealMatchBadgeProps> = ({
  matchedItemName,
  isMatched,
  savingsAmount,
  style,
}) => {
  if (!isMatched) {
    return (
      <View style={[styles.container, styles.notMatched, style]}>
        <Text style={styles.notMatchedIcon}>{'\u2717'}</Text>
        <Text style={styles.notMatchedText}>No match</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.matched, style]}>
      <View style={styles.matchInfo}>
        <Text style={styles.matchedIcon}>{'\u2713'}</Text>
        <View style={styles.matchTextContainer}>
          <Text style={styles.matchLabel}>Matched to:</Text>
          <Text style={styles.matchedItemName} numberOfLines={1}>
            {matchedItemName}
          </Text>
        </View>
      </View>
      {savingsAmount !== undefined && savingsAmount > 0 && (
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsText}>
            Save ${savingsAmount.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
};

// Compact variant for list views
export const DealMatchBadgeCompact: React.FC<{
  isMatched: boolean;
  savingsPercent?: number;
  style?: ViewStyle;
}> = ({ isMatched, savingsPercent, style }) => {
  if (!isMatched) {
    return null;
  }

  return (
    <View style={[styles.compactContainer, style]}>
      <Text style={styles.compactIcon}>{'\u{1F3AF}'}</Text>
      {savingsPercent !== undefined && savingsPercent > 0 && (
        <Text style={styles.compactText}>{savingsPercent}% off</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  matched: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  notMatched: {
    backgroundColor: colors.background.tertiary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchedIcon: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  notMatchedIcon: {
    color: colors.text.disabled,
    fontSize: 14,
    marginRight: spacing.xs,
  },
  matchTextContainer: {
    flex: 1,
  },
  matchLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  matchedItemName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.success,
  },
  notMatchedText: {
    ...typography.body2,
    color: colors.text.disabled,
  },
  savingsBadge: {
    marginTop: spacing.xs,
    backgroundColor: colors.success,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.xs,
    alignSelf: 'flex-start',
  },
  savingsText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main + '15',
    borderRadius: borderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  compactIcon: {
    fontSize: 10,
    marginRight: 2,
  },
  compactText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary.main,
    fontWeight: '600',
  },
});
