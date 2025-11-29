import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { MealPattern, PatternId } from '../../types';

interface PatternSelectorProps {
  patterns: MealPattern[];
  selectedPattern: PatternId;
  onPatternSelect: (patternId: PatternId) => void;
  variant?: 'compact' | 'full' | 'modal';
  visible?: boolean;
  onClose?: () => void;
}

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  patterns,
  selectedPattern,
  onPatternSelect,
  variant = 'compact',
  visible = true,
  onClose,
}) => {
  const renderPatternItem = (pattern: MealPattern, isCompact: boolean) => {
    const isSelected = pattern.id === selectedPattern;

    return (
      <Card
        key={pattern.id}
        onPress={() => {
          onPatternSelect(pattern.id);
          if (variant === 'modal' && onClose) {
            onClose();
          }
        }}
        variant={isSelected ? 'elevated' : 'outlined'}
        accentColor={colors.patterns[pattern.id]}
        style={StyleSheet.flatten([
          isCompact ? styles.compactCard : styles.fullCard,
          isSelected && styles.selectedCard,
        ])}
      >
        <View style={styles.patternHeader}>
          <View
            style={[
              styles.patternLetter,
              { backgroundColor: colors.patterns[pattern.id] + '20' },
            ]}
          >
            <Text
              style={[
                styles.patternLetterText,
                { color: colors.patterns[pattern.id] },
              ]}
            >
              {pattern.id}
            </Text>
          </View>
          {isSelected && (
            <Badge text="Active" variant="success" size="small" />
          )}
        </View>

        <Text style={styles.patternName}>{pattern.name}</Text>

        {!isCompact && (
          <>
            <Text style={styles.patternDescription} numberOfLines={2}>
              {pattern.description}
            </Text>

            <View style={styles.mealsPreview}>
              {(['morning', 'noon', 'evening'] as const).map((meal) => (
                <View key={meal} style={styles.mealPreviewItem}>
                  <Text style={styles.mealPreviewTime}>
                    {pattern.meals[meal]?.time}
                  </Text>
                  <Text style={styles.mealPreviewCalories}>
                    {pattern.meals[meal]?.calories} cal
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.patternStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pattern.totalCalories}</Text>
                <Text style={styles.statLabel}>cal/day</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{pattern.totalProtein}g</Text>
                <Text style={styles.statLabel}>protein</Text>
              </View>
            </View>

            <View style={styles.optimalFor}>
              {pattern.optimalFor.slice(0, 3).map((item, index) => (
                <Badge
                  key={index}
                  text={item}
                  size="small"
                  variant="info"
                  style={styles.optimalBadge}
                />
              ))}
            </View>
          </>
        )}

        {isCompact && (
          <Text style={styles.compactCalories}>
            {pattern.totalCalories} cal
          </Text>
        )}
      </Card>
    );
  };

  if (variant === 'modal') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Pattern</Text>
              <Button
                title="Close"
                onPress={onClose || (() => {})}
                variant="ghost"
                size="small"
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {patterns.map((pattern) => renderPatternItem(pattern, false))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  if (variant === 'compact') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactContainer}
      >
        {patterns.map((pattern) => renderPatternItem(pattern, true))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.fullContainer}>
      {patterns.map((pattern) => renderPatternItem(pattern, false))}
    </View>
  );
};

const styles = StyleSheet.create({
  compactContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  fullContainer: {
    gap: spacing.md,
  },
  compactCard: {
    width: 110,
    padding: spacing.sm,
    alignItems: 'center',
  },
  fullCard: {
    padding: spacing.md,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    width: '100%',
  },
  patternLetter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternLetterText: {
    fontSize: 20,
    fontWeight: '700',
  },
  patternName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  patternDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  compactCalories: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
  },
  mealPreviewItem: {
    alignItems: 'center',
  },
  mealPreviewTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealPreviewCalories: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patternStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  optimalFor: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optimalBadge: {
    marginBottom: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
});
