import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import {
  SocialEvent,
  CalorieBankingStrategy,
  CALORIE_ESTIMATES,
  MEAL_TYPE_LABELS,
} from '../../types/analytics.types';

interface EventPlanCardProps {
  event: SocialEvent;
  strategy: CalorieBankingStrategy;
  onEditEvent?: () => void;
  onEditStrategy?: () => void;
}

export const EventPlanCard: React.FC<EventPlanCardProps> = ({
  event,
  strategy,
  onEditEvent,
  onEditStrategy,
}) => {
  const {
    eventCalories,
    dailyBudget,
    allocatedToEvent,
    otherMeals,
    totalReduction,
    remainingForEvent,
    isAchievable,
    warnings,
  } = strategy;

  const budgetUsedPercent = (allocatedToEvent / dailyBudget) * 100;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card variant="elevated" style={styles.container}>
      {/* Event Header */}
      <View style={styles.eventHeader}>
        <View style={styles.eventIcon}>
          <Text style={styles.iconText}>{'\u{1F37D}'}</Text>
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.eventDetails}>
            {formatDate(event.date)} at {event.time}
          </Text>
          <View style={styles.eventTags}>
            <Badge
              text={MEAL_TYPE_LABELS[event.mealType]}
              variant="info"
              size="small"
            />
            <Badge
              text={`~${eventCalories} cal`}
              variant="default"
              size="small"
            />
          </View>
        </View>
      </View>

      {/* Calorie Banking Strategy */}
      <View style={styles.strategySection}>
        <Text style={styles.sectionTitle}>Calorie Banking Strategy</Text>

        {/* Budget Allocation */}
        <View style={styles.budgetBox}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetLabel}>Daily Budget</Text>
            <Text style={styles.budgetValue}>{dailyBudget} cal</Text>
          </View>
          <ProgressBar
            progress={budgetUsedPercent}
            height={8}
            segments={[
              {
                value: (totalReduction / dailyBudget) * 100,
                color: colors.success,
                label: 'Banked',
              },
              {
                value: ((dailyBudget - totalReduction - allocatedToEvent) / dailyBudget) * 100,
                color: colors.background.tertiary,
                label: 'Other',
              },
              {
                value: (allocatedToEvent / dailyBudget) * 100,
                color: colors.primary.main,
                label: 'Event',
              },
            ]}
          />
          <View style={styles.budgetLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Banked: {totalReduction} cal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary.main }]} />
              <Text style={styles.legendText}>Event: {allocatedToEvent} cal</Text>
            </View>
          </View>
        </View>

        {/* Meal Adjustments */}
        <Text style={styles.adjustmentsTitle}>Meal Adjustments</Text>
        {otherMeals.map((meal, index) => (
          <View key={index} style={styles.mealRow}>
            <View style={styles.mealInfo}>
              <Text style={styles.mealType}>
                {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
              </Text>
              <Text style={styles.mealChange}>
                {meal.originalCalories} {'\u2192'} {meal.reducedCalories} cal
              </Text>
            </View>
            <View style={styles.reductionBadge}>
              <Text style={styles.reductionText}>
                -{meal.reductionPercent}%
              </Text>
            </View>
            {meal.suggestedMeal && (
              <Text style={styles.suggestedMeal}>{meal.suggestedMeal}</Text>
            )}
          </View>
        ))}

        {/* Event Allocation Result */}
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Available for Event</Text>
          <Text
            style={[
              styles.resultValue,
              { color: isAchievable ? colors.success : colors.warning },
            ]}
          >
            {remainingForEvent} calories
          </Text>
          {remainingForEvent >= eventCalories ? (
            <Badge text="GOAL MET" variant="success" size="small" />
          ) : (
            <Badge
              text={`${eventCalories - remainingForEvent} cal short`}
              variant="warning"
              size="small"
            />
          )}
        </View>
      </View>

      {/* Warnings */}
      {warnings.length > 0 && (
        <View style={styles.warningsBox}>
          {warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Text style={styles.warningIcon}>{'\u26A0'}</Text>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Status */}
      <View style={styles.statusRow}>
        {isAchievable ? (
          <>
            <Text style={styles.statusIcon}>{'\u2713'}</Text>
            <Text style={styles.statusText}>
              Strategy achievable with {totalReduction} cal banked
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.statusIcon, { color: colors.warning }]}>{'\u26A0'}</Text>
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Consider smaller portions at event or add exercise
            </Text>
          </>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.main + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 24,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  eventDetails: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  eventTags: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  strategySection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  budgetBox: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  budgetLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  budgetValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  budgetLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  adjustmentsTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mealChange: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  reductionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.sm,
  },
  reductionText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.success,
  },
  suggestedMeal: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  resultBox: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  resultLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  resultValue: {
    ...typography.h2,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  warningsBox: {
    padding: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
    color: colors.warning,
  },
  warningText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.md,
  },
  statusIcon: {
    fontSize: 16,
    color: colors.success,
    marginRight: spacing.sm,
    fontWeight: '700',
  },
  statusText: {
    ...typography.caption,
    color: colors.success,
    flex: 1,
  },
});
