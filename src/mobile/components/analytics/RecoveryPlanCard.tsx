import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { Button } from '../base/Button';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { RecoveryPlan, RecoveryMeal } from '../../types/analytics.types';
import { PatternId } from '../../types';

interface RecoveryPlanCardProps {
  plan: RecoveryPlan;
  onAcceptPlan?: () => void;
  onCustomize?: () => void;
}

const PATTERN_COLORS: Record<PatternId, string> = {
  A: colors.patterns.A,
  B: colors.patterns.B,
  C: colors.patterns.C,
  D: colors.patterns.D,
  E: colors.patterns.E,
  F: colors.patterns.F,
  G: colors.patterns.G,
};

const EMPHASIS_ICONS: Record<string, string> = {
  protein: '\u{1F969}',
  fiber: '\u{1F966}',
  hydration: '\u{1F4A7}',
  light: '\u{1F343}',
};

export const RecoveryPlanCard: React.FC<RecoveryPlanCardProps> = ({
  plan,
  onAcceptPlan,
  onCustomize,
}) => {
  const {
    nextDayPattern,
    patternName,
    suggestedMeals,
    noWeighFor,
    damageControlTips,
    hydrationGoal,
    activitySuggestion,
  } = plan;

  const totalCalories = suggestedMeals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = suggestedMeals.reduce((sum, m) => sum + m.protein, 0);

  return (
    <Card variant="elevated" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{'\u{1F3CB}'}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>Recovery Plan</Text>
          <Text style={styles.subtitle}>Get back on track after your event</Text>
        </View>
      </View>

      {/* Recommended Pattern */}
      <View style={styles.patternSection}>
        <Text style={styles.sectionTitle}>Next Day Pattern</Text>
        <View style={styles.patternBox}>
          <View
            style={[
              styles.patternBadge,
              { backgroundColor: PATTERN_COLORS[nextDayPattern] },
            ]}
          >
            <Text style={styles.patternLetter}>{nextDayPattern}</Text>
          </View>
          <View style={styles.patternInfo}>
            <Text style={styles.patternName}>{patternName}</Text>
            <Text style={styles.patternStats}>
              {totalCalories} cal | {totalProtein}g protein
            </Text>
          </View>
        </View>
      </View>

      {/* Suggested Meals */}
      <View style={styles.mealsSection}>
        <Text style={styles.sectionTitle}>Suggested Meals</Text>
        {suggestedMeals.map((meal, index) => (
          <View key={index} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealType}>
                {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
              </Text>
              <Badge
                text={meal.emphasis.toUpperCase()}
                customColor={
                  meal.emphasis === 'protein'
                    ? colors.error
                    : meal.emphasis === 'fiber'
                    ? colors.success
                    : meal.emphasis === 'hydration'
                    ? colors.info
                    : colors.warning
                }
                size="small"
              />
            </View>
            <Text style={styles.mealDescription}>{meal.description}</Text>
            <View style={styles.mealNutrition}>
              <Text style={styles.nutritionText}>
                {meal.calories} cal | {meal.protein}g protein
              </Text>
              <Text style={styles.emphasisIcon}>
                {EMPHASIS_ICONS[meal.emphasis]}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Important Reminders */}
      <View style={styles.remindersSection}>
        <Text style={styles.sectionTitle}>Important Reminders</Text>

        {/* No weigh warning */}
        <View style={styles.reminderBox}>
          <Text style={styles.reminderIcon}>{'\u{1F6AB}'}</Text>
          <View style={styles.reminderContent}>
            <Text style={styles.reminderTitle}>Skip the Scale</Text>
            <Text style={styles.reminderText}>
              Avoid weighing yourself for {noWeighFor} hours after the event.
              Water retention from sodium and carbs can cause temporary fluctuations.
            </Text>
          </View>
        </View>

        {/* Hydration goal */}
        <View style={styles.reminderBox}>
          <Text style={styles.reminderIcon}>{'\u{1F4A7}'}</Text>
          <View style={styles.reminderContent}>
            <Text style={styles.reminderTitle}>Hydration Goal</Text>
            <Text style={styles.reminderText}>
              Aim for <Text style={styles.reminderHighlight}>{hydrationGoal} oz</Text> of water
              to help flush excess sodium and reduce bloating.
            </Text>
          </View>
        </View>

        {/* Activity suggestion */}
        {activitySuggestion && (
          <View style={styles.reminderBox}>
            <Text style={styles.reminderIcon}>{'\u{1F6B6}'}</Text>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>Activity Suggestion</Text>
              <Text style={styles.reminderText}>{activitySuggestion}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Damage Control Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.sectionTitle}>Damage Control Tips</Text>
        {damageControlTips.map((tip, index) => (
          <View key={index} style={styles.tipItem}>
            <Text style={styles.tipBullet}>{'\u2713'}</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Motivational Message */}
      <View style={styles.motivationBox}>
        <Text style={styles.motivationIcon}>{'\u{1F4AA}'}</Text>
        <Text style={styles.motivationText}>
          One event does not derail your progress. Focus on getting back to your
          routine, and your body will regulate itself within a few days.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Accept Recovery Plan"
          onPress={onAcceptPlan}
          style={styles.actionButton}
        />
        <Button
          title="Customize Plan"
          variant="secondary"
          onPress={onCustomize}
          style={styles.actionButton}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  sectionTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  patternSection: {
    marginBottom: spacing.md,
  },
  patternBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
  },
  patternBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  patternLetter: {
    ...typography.h2,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  patternInfo: {
    flex: 1,
  },
  patternName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patternStats: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealsSection: {
    marginBottom: spacing.md,
  },
  mealCard: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  mealType: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mealDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  mealNutrition: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  emphasisIcon: {
    fontSize: 16,
  },
  remindersSection: {
    marginBottom: spacing.md,
  },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  reminderIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  reminderText: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  reminderHighlight: {
    fontWeight: '600',
    color: colors.info,
  },
  tipsSection: {
    marginBottom: spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  tipBullet: {
    ...typography.body2,
    color: colors.success,
    marginRight: spacing.sm,
    fontWeight: '700',
  },
  tipText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  motivationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  motivationIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  motivationText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
});
