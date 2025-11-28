import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography } from '../../utils/theme';
import { MealPattern, PatternId } from '../../types';

export interface PatternCardProps {
  pattern: MealPattern;
  isSelected?: boolean;
  isToday?: boolean;
  adherenceRate?: number;
  lastUsed?: string;
  onPress?: () => void;
}

export const PatternCard: React.FC<PatternCardProps> = ({
  pattern,
  isSelected = false,
  isToday = false,
  adherenceRate,
  lastUsed,
  onPress,
}) => {
  const patternColor = colors.patterns[pattern.id as PatternId];

  const getPatternIcon = (id: PatternId): string => {
    const icons: Record<PatternId, string> = {
      A: '\u2600', // sun - Traditional
      B: '\u263D', // moon - Reversed
      C: '\u23F0', // clock - Fasting
      D: '\u{1F4AA}', // muscle - Protein Focus
      E: '\u2728', // sparkles - Grazing
      F: '\u{1F37D}', // plate - OMAD
      G: '\u{1F500}', // shuffle - Flexible
    };
    return icons[id] || '\u2B50';
  };

  return (
    <Card
      onPress={onPress}
      variant={isSelected ? 'elevated' : 'outlined'}
      accentColor={patternColor}
      style={[
        styles.card,
        isSelected && { borderColor: patternColor, borderWidth: 2 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.icon, { color: patternColor }]}>
            {getPatternIcon(pattern.id)}
          </Text>
          <View style={styles.titleContainer}>
            <Text style={styles.patternId}>Pattern {pattern.id}</Text>
            <Text style={styles.patternName}>{pattern.name}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          {isToday && <Badge text="Today" variant="info" size="small" />}
          {isSelected && <Badge text="Selected" customColor={patternColor} size="small" />}
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {pattern.description}
      </Text>

      <View style={styles.optimalFor}>
        <Text style={styles.optimalLabel}>Best for:</Text>
        <Text style={styles.optimalText} numberOfLines={1}>
          {pattern.optimalFor.join(', ')}
        </Text>
      </View>

      <View style={styles.mealsPreview}>
        <View style={styles.mealSlot}>
          <Text style={styles.mealTime}>{pattern.meals.morning.time}</Text>
          <Text style={styles.mealCals}>{pattern.meals.morning.calories} cal</Text>
        </View>
        <View style={styles.mealDivider} />
        <View style={styles.mealSlot}>
          <Text style={styles.mealTime}>{pattern.meals.noon.time}</Text>
          <Text style={styles.mealCals}>{pattern.meals.noon.calories} cal</Text>
        </View>
        <View style={styles.mealDivider} />
        <View style={styles.mealSlot}>
          <Text style={styles.mealTime}>{pattern.meals.evening.time}</Text>
          <Text style={styles.mealCals}>{pattern.meals.evening.calories} cal</Text>
        </View>
      </View>

      <View style={styles.totals}>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{pattern.totalCalories}</Text>
          <Text style={styles.totalLabel}>calories</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalValue}>{pattern.totalProtein}g</Text>
          <Text style={styles.totalLabel}>protein</Text>
        </View>
      </View>

      {adherenceRate !== undefined && (
        <View style={styles.adherence}>
          <ProgressBar
            progress={adherenceRate}
            label="Adherence"
            showPercentage
            height={6}
            color={patternColor}
          />
        </View>
      )}

      {lastUsed && (
        <Text style={styles.lastUsed}>Last used: {lastUsed}</Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  patternId: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  patternName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  description: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  optimalFor: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  optimalLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  optimalText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  mealsPreview: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  mealSlot: {
    flex: 1,
    alignItems: 'center',
  },
  mealTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealCals: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mealDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.sm,
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  adherence: {
    marginTop: spacing.md,
  },
  lastUsed: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
});
