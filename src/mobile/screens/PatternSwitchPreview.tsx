/**
 * PatternSwitchPreview Screen
 * Shows detailed preview of pattern switch with meal recalculations
 * Implements the second tap of 2-tap pattern switching
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { ProgressBar } from '../components/base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { MealPattern, PatternId } from '../types';
import { RecalculatedMeal, PatternSwitchPreviewData } from '../store/slices/patternsSlice';

export interface PatternSwitchPreviewProps {
  previewData: PatternSwitchPreviewData;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

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

export const PatternSwitchPreview: React.FC<PatternSwitchPreviewProps> = ({
  previewData,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const [successAnimation] = useState(new Animated.Value(0));
  const [isConfirming, setIsConfirming] = useState(false);

  const {
    currentPattern,
    newPattern,
    currentTime,
    caloriesConsumed,
    proteinConsumed,
    remainingMeals,
    warnings,
    inventorySufficient,
    missingIngredients,
  } = previewData;

  // Calculate remaining targets
  const remainingCalories = Math.max(0, 1800 - caloriesConsumed);
  const remainingProtein = Math.max(0, 130 - proteinConsumed);
  const remainingMealsCount = remainingMeals.filter(m => m.isRemaining).length;

  // Calculate new pattern remaining calories
  const newPatternRemainingCals = remainingMeals
    .filter(m => m.isRemaining)
    .reduce((sum, m) => sum + m.newCalories, 0);

  const handleConfirm = () => {
    if (warnings.length > 0) {
      Alert.alert(
        'Switch Pattern?',
        'There are some warnings about this switch. Are you sure you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch Anyway',
            onPress: () => {
              setIsConfirming(true);
              animateSuccess();
            },
          },
        ]
      );
    } else {
      setIsConfirming(true);
      animateSuccess();
    }
  };

  const animateSuccess = () => {
    Animated.sequence([
      Animated.timing(successAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onConfirm(reason || undefined);
    });
  };

  const renderPatternComparison = () => (
    <View style={styles.comparisonContainer}>
      {/* Current Pattern */}
      <Card variant="outlined" style={styles.patternCard}>
        <View style={styles.patternHeader}>
          <Text style={styles.patternLabel}>From</Text>
          <Badge
            text={`Pattern ${currentPattern.id}`}
            customColor={colors.patterns[currentPattern.id]}
            size="small"
          />
        </View>
        <Text style={[styles.patternIcon, { color: colors.patterns[currentPattern.id] }]}>
          {getPatternIcon(currentPattern.id)}
        </Text>
        <Text style={styles.patternName}>{currentPattern.name}</Text>
      </Card>

      {/* Arrow */}
      <View style={styles.arrowContainer}>
        <Text style={styles.arrowIcon}>{'\u2192'}</Text>
      </View>

      {/* New Pattern */}
      <Card variant="elevated" style={[styles.patternCard, styles.newPatternCard]}>
        <View style={styles.patternHeader}>
          <Text style={styles.patternLabel}>To</Text>
          <Badge
            text={`Pattern ${newPattern.id}`}
            customColor={colors.patterns[newPattern.id]}
            size="small"
          />
        </View>
        <Text style={[styles.patternIcon, { color: colors.patterns[newPattern.id] }]}>
          {getPatternIcon(newPattern.id)}
        </Text>
        <Text style={styles.patternName}>{newPattern.name}</Text>
      </Card>
    </View>
  );

  const renderMealChanges = () => (
    <Card variant="outlined" style={styles.changesCard}>
      <Text style={styles.sectionTitle}>What Changes</Text>

      {remainingMeals.map((meal, index) => {
        const hasChange = meal.originalCalories !== meal.newCalories;

        return (
          <View key={meal.mealType} style={styles.mealChangeRow}>
            <View style={styles.mealChangeInfo}>
              <View style={styles.mealChangeHeader}>
                <Text style={styles.mealChangeName}>
                  {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
                </Text>
                {meal.isRemaining ? (
                  <Badge text="Remaining" variant="success" size="small" />
                ) : (
                  <Badge text="Passed" variant="warning" size="small" />
                )}
              </View>
              <Text style={styles.mealChangeTime}>{meal.time}</Text>
            </View>

            <View style={styles.mealChangeValues}>
              {hasChange ? (
                <>
                  <Text style={styles.oldValue}>{meal.originalCalories} cal</Text>
                  <Text style={styles.changeArrow}>{'\u2192'}</Text>
                  <Text style={styles.newValue}>{meal.newCalories} cal</Text>
                </>
              ) : (
                <Text style={styles.unchangedValue}>{meal.newCalories} cal</Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Summary */}
      <View style={styles.changeSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Remaining Meals</Text>
          <Text style={styles.summaryValue}>{remainingMealsCount}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Available Calories</Text>
          <Text style={styles.summaryValue}>{newPatternRemainingCals}</Text>
        </View>
      </View>
    </Card>
  );

  const renderNotificationChanges = () => (
    <Card variant="filled" style={styles.notificationCard}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationIcon}>{'\u{1F514}'}</Text>
        <Text style={styles.notificationTitle}>Notifications Updated</Text>
      </View>
      <Text style={styles.notificationText}>
        Meal reminders will be rescheduled based on {newPattern.name} pattern timing.
      </Text>
      <View style={styles.notificationTimes}>
        {remainingMeals
          .filter(m => m.isRemaining && m.time !== 'Skip')
          .map(meal => (
            <View key={meal.mealType} style={styles.notificationTimeItem}>
              <Text style={styles.notificationTimeLabel}>
                {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
              </Text>
              <Text style={styles.notificationTimeValue}>{meal.time}</Text>
            </View>
          ))}
      </View>
    </Card>
  );

  const renderWarnings = () => {
    if (warnings.length === 0 && inventorySufficient) return null;

    return (
      <Card variant="outlined" style={styles.warningsCard}>
        <View style={styles.warningsHeader}>
          <Text style={styles.warningIcon}>{'\u26A0'}</Text>
          <Text style={styles.warningsTitle}>Things to Consider</Text>
        </View>

        {warnings.map((warning, index) => (
          <View key={index} style={styles.warningItem}>
            <Text style={styles.warningBullet}>{'\u2022'}</Text>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ))}

        {!inventorySufficient && missingIngredients.length > 0 && (
          <View style={styles.ingredientWarning}>
            <Text style={styles.ingredientWarningTitle}>Missing Ingredients:</Text>
            <Text style={styles.ingredientWarningList}>
              {missingIngredients.join(', ')}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  const renderReasonInput = () => (
    <Card variant="outlined" style={styles.reasonCard}>
      <Text style={styles.reasonLabel}>Why are you switching? (optional)</Text>
      <TextInput
        style={styles.reasonInput}
        placeholder="e.g., Business lunch, feeling hungry, schedule change..."
        placeholderTextColor={colors.text.disabled}
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={2}
      />
    </Card>
  );

  const renderProgressSummary = () => (
    <Card variant="filled" style={styles.progressCard}>
      <Text style={styles.progressTitle}>Today's Progress</Text>

      <View style={styles.progressItem}>
        <ProgressBar
          progress={(caloriesConsumed / 1800) * 100}
          label="Calories"
          showPercentage
          color={colors.primary.main}
        />
        <Text style={styles.progressDetail}>
          {caloriesConsumed} / 1800 cal ({remainingCalories} remaining)
        </Text>
      </View>

      <View style={styles.progressItem}>
        <ProgressBar
          progress={(proteinConsumed / 130) * 100}
          label="Protein"
          showPercentage
          color={colors.secondary.main}
        />
        <Text style={styles.progressDetail}>
          {proteinConsumed}g / 130g ({remainingProtein}g remaining)
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="ghost"
          size="small"
        />
        <Text style={styles.headerTitle}>Preview Switch</Text>
        <Text style={styles.headerTime}>{currentTime}</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Pattern Comparison */}
        {renderPatternComparison()}

        {/* Today's Progress */}
        {renderProgressSummary()}

        {/* Meal Changes */}
        {renderMealChanges()}

        {/* Notification Changes */}
        {renderNotificationChanges()}

        {/* Warnings */}
        {renderWarnings()}

        {/* Reason Input */}
        {renderReasonInput()}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      <Animated.View
        style={[
          styles.footer,
          {
            opacity: successAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          },
        ]}
      >
        <Button
          title="Cancel"
          onPress={onCancel}
          variant="outline"
          style={styles.cancelButton}
        />
        <Button
          title="Confirm Switch"
          onPress={handleConfirm}
          variant="primary"
          style={styles.confirmButton}
          loading={isConfirming}
        />
      </Animated.View>
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
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerTime: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  patternCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  newPatternCard: {
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
  },
  patternLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  patternIcon: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  patternName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  arrowContainer: {
    paddingHorizontal: spacing.sm,
  },
  arrowIcon: {
    fontSize: 24,
    color: colors.text.secondary,
  },
  progressCard: {
    marginBottom: spacing.md,
  },
  progressTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  progressItem: {
    marginBottom: spacing.md,
  },
  progressDetail: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  changesCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  mealChangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  mealChangeInfo: {
    flex: 1,
  },
  mealChangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealChangeName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mealChangeTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealChangeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  oldValue: {
    ...typography.body2,
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  changeArrow: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  newValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.primary.main,
  },
  unchangedValue: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  changeSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  notificationCard: {
    marginBottom: spacing.md,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  notificationIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  notificationTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  notificationText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  notificationTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  notificationTimeItem: {
    backgroundColor: colors.background.primary,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  notificationTimeLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  notificationTimeValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  warningsCard: {
    marginBottom: spacing.md,
    borderColor: colors.warning,
  },
  warningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    color: colors.warning,
  },
  warningsTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.warning,
  },
  warningItem: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  warningBullet: {
    ...typography.body2,
    color: colors.warning,
    marginRight: spacing.sm,
  },
  warningText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
  },
  ingredientWarning: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
  },
  ingredientWarningTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  ingredientWarningList: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  reasonCard: {
    marginBottom: spacing.md,
  },
  reasonLabel: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  reasonInput: {
    ...typography.body1,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
});
