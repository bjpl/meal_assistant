/**
 * PatternSwitchModal Component
 * Modal for selecting a new pattern to switch to mid-day
 * Implements 2-tap pattern switching (User Story 1.1.3)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { MealPattern, PatternId } from '../../types';

export interface PatternSwitchModalProps {
  visible: boolean;
  currentPattern: MealPattern;
  patterns: MealPattern[];
  caloriesConsumed: number;
  proteinConsumed: number;
  onSelectPattern: (pattern: MealPattern) => void;
  onClose: () => void;
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

export const PatternSwitchModal: React.FC<PatternSwitchModalProps> = ({
  visible,
  currentPattern,
  patterns,
  caloriesConsumed,
  proteinConsumed,
  onSelectPattern,
  onClose,
}) => {
  if (!visible) return null;

  const availablePatterns = patterns.filter(p => p.id !== currentPattern.id);
  const remainingCalories = Math.max(0, 1800 - caloriesConsumed);
  const remainingProtein = Math.max(0, 130 - proteinConsumed);

  const renderCurrentPattern = () => (
    <Card variant="filled" style={styles.currentPatternCard}>
      <View style={styles.currentPatternHeader}>
        <Text style={styles.currentLabel}>Current Pattern</Text>
        <Badge
          text={`Pattern ${currentPattern.id}`}
          customColor={colors.patterns[currentPattern.id]}
        />
      </View>
      <View style={styles.currentPatternContent}>
        <Text style={[styles.patternIcon, { color: colors.patterns[currentPattern.id] }]}>
          {getPatternIcon(currentPattern.id)}
        </Text>
        <View style={styles.currentPatternInfo}>
          <Text style={styles.currentPatternName}>{currentPattern.name}</Text>
          <Text style={styles.currentPatternDesc} numberOfLines={1}>
            {currentPattern.description}
          </Text>
        </View>
      </View>
      <View style={styles.consumedStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{caloriesConsumed}</Text>
          <Text style={styles.statLabel}>cal consumed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{remainingCalories}</Text>
          <Text style={styles.statLabel}>cal remaining</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{proteinConsumed}g</Text>
          <Text style={styles.statLabel}>protein</Text>
        </View>
      </View>
    </Card>
  );

  const renderPatternOption = (pattern: MealPattern) => {
    const patternColor = colors.patterns[pattern.id];

    return (
      <TouchableOpacity
        key={pattern.id}
        onPress={() => onSelectPattern(pattern)}
        activeOpacity={0.7}
      >
        <Card
          variant="outlined"
          accentColor={patternColor}
          style={styles.patternOptionCard}
        >
          <View style={styles.patternOptionHeader}>
            <Text style={[styles.optionIcon, { color: patternColor }]}>
              {getPatternIcon(pattern.id)}
            </Text>
            <View style={styles.patternOptionInfo}>
              <Text style={styles.optionId}>Pattern {pattern.id}</Text>
              <Text style={styles.optionName}>{pattern.name}</Text>
            </View>
            <View style={styles.optionArrow}>
              <Text style={styles.arrowText}>{'\u203A'}</Text>
            </View>
          </View>

          <Text style={styles.optionDescription} numberOfLines={2}>
            {pattern.description}
          </Text>

          <View style={styles.mealTimesPreview}>
            {(['morning', 'noon', 'evening'] as const).map(meal => (
              <View key={meal} style={styles.mealTimeItem}>
                <Text style={styles.mealTimeLabel}>
                  {meal.charAt(0).toUpperCase() + meal.slice(1)}
                </Text>
                <Text style={styles.mealTimeValue}>
                  {pattern.meals[meal].time}
                </Text>
                <Text style={styles.mealCalValue}>
                  {pattern.meals[meal].calories} cal
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.optionFooter}>
            <Text style={styles.optionTotal}>
              {pattern.totalCalories} cal / {pattern.totalProtein}g protein
            </Text>
            <Badge text="Tap to preview" variant="info" size="small" />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Switch Pattern</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>{'\u2715'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Pattern Section */}
          {renderCurrentPattern()}

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Switch to:</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Pattern Options Grid */}
          <View style={styles.patternsGrid}>
            {availablePatterns.map(renderPatternOption)}
          </View>
        </ScrollView>

        {/* Cancel Button */}
        <View style={styles.footer}>
          <Button
            title="Cancel"
            onPress={onClose}
            variant="outline"
            fullWidth
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeIcon: {
    fontSize: 20,
    color: colors.text.secondary,
  },
  content: {
    padding: spacing.md,
  },
  currentPatternCard: {
    marginBottom: spacing.md,
  },
  currentPatternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  currentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  currentPatternContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  patternIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  currentPatternInfo: {
    flex: 1,
  },
  currentPatternName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  currentPatternDesc: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  consumedStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    ...typography.body2,
    color: colors.text.secondary,
    marginHorizontal: spacing.md,
  },
  patternsGrid: {
    gap: spacing.md,
  },
  patternOptionCard: {
    marginBottom: spacing.sm,
  },
  patternOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  patternOptionInfo: {
    flex: 1,
  },
  optionId: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  optionName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  optionArrow: {
    padding: spacing.sm,
  },
  arrowText: {
    fontSize: 24,
    color: colors.text.secondary,
  },
  optionDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  mealTimesPreview: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  mealTimeItem: {
    flex: 1,
    alignItems: 'center',
  },
  mealTimeLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
  mealTimeValue: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '500',
  },
  mealCalValue: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
  optionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTotal: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
