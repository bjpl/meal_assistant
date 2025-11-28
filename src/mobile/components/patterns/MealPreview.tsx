import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography } from '../../utils/theme';
import { MealSlot, MealComponent } from '../../types';

interface MealPreviewProps {
  mealSlot: MealSlot;
  mealType: 'morning' | 'noon' | 'evening';
  targetCalories?: number;
  targetProtein?: number;
  onComponentPress?: (component: MealComponent) => void;
  showNutrition?: boolean;
  variant?: 'compact' | 'detailed';
}

const mealTypeLabels = {
  morning: 'Breakfast',
  noon: 'Lunch',
  evening: 'Dinner',
};

const mealTypeIcons = {
  morning: '\u2600', // Sun
  noon: '\u{1F31E}', // Sun with face
  evening: '\u{1F319}', // Crescent moon
};

const categoryColors: Record<string, string> = {
  protein: colors.secondary.main,
  carb: colors.info,
  vegetable: colors.success,
  fat: colors.warning,
  flavor: colors.primary.light,
  fruit: '#E91E63',
};

export const MealPreview: React.FC<MealPreviewProps> = ({
  mealSlot,
  mealType,
  targetCalories,
  targetProtein,
  onComponentPress,
  showNutrition = true,
  variant = 'detailed',
}) => {
  const calorieProgress = targetCalories
    ? (mealSlot.calories / targetCalories) * 100
    : 0;
  const proteinProgress = targetProtein
    ? (mealSlot.protein / targetProtein) * 100
    : 0;

  const groupedComponents = mealSlot.components.reduce((acc, component) => {
    if (!acc[component.category]) {
      acc[component.category] = [];
    }
    acc[component.category].push(component);
    return acc;
  }, {} as Record<string, MealComponent[]>);

  if (variant === 'compact') {
    return (
      <Card variant="outlined" style={styles.compactCard}>
        <View style={styles.compactHeader}>
          <Text style={styles.mealIcon}>{mealTypeIcons[mealType]}</Text>
          <View style={styles.compactInfo}>
            <Text style={styles.compactTitle}>{mealTypeLabels[mealType]}</Text>
            <Text style={styles.compactTime}>{mealSlot.time}</Text>
          </View>
          <View style={styles.compactNutrition}>
            <Text style={styles.compactCalories}>{mealSlot.calories}</Text>
            <Text style={styles.compactUnit}>cal</Text>
          </View>
        </View>
        {mealSlot.components.length > 0 && (
          <Text style={styles.compactComponents} numberOfLines={1}>
            {mealSlot.components.map((c) => c.name).join(', ')}
          </Text>
        )}
      </Card>
    );
  }

  return (
    <Card variant="outlined" style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.mealIcon}>{mealTypeIcons[mealType]}</Text>
          <View>
            <Text style={styles.mealTitle}>{mealTypeLabels[mealType]}</Text>
            <Text style={styles.mealTime}>{mealSlot.time}</Text>
          </View>
        </View>
        <Badge
          text={`${mealSlot.calories} cal`}
          variant="info"
        />
      </View>

      {/* Nutrition Progress */}
      {showNutrition && (
        <View style={styles.nutritionSection}>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Calories</Text>
            <ProgressBar
              progress={calorieProgress}
              height={6}
              color={colors.primary.main}
              style={styles.progressBar}
            />
            <Text style={styles.nutritionValue}>
              {mealSlot.calories}
              {targetCalories && ` / ${targetCalories}`}
            </Text>
          </View>
          <View style={styles.nutritionRow}>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <ProgressBar
              progress={proteinProgress}
              height={6}
              color={colors.secondary.main}
              style={styles.progressBar}
            />
            <Text style={styles.nutritionValue}>
              {mealSlot.protein}g
              {targetProtein && ` / ${targetProtein}g`}
            </Text>
          </View>
        </View>
      )}

      {/* Components */}
      {mealSlot.components.length > 0 && (
        <View style={styles.componentsSection}>
          <Text style={styles.componentsTitle}>Components</Text>

          {Object.entries(groupedComponents).map(([category, components]) => (
            <View key={category} style={styles.categoryGroup}>
              <View style={styles.categoryHeader}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: categoryColors[category] || colors.text.secondary },
                  ]}
                />
                <Text style={styles.categoryName}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </View>

              {components.map((component) => (
                <Card
                  key={component.id}
                  variant="filled"
                  style={styles.componentCard}
                  onPress={onComponentPress ? () => onComponentPress(component) : undefined}
                >
                  <View style={styles.componentRow}>
                    <View style={styles.componentInfo}>
                      <Text style={styles.componentName}>{component.name}</Text>
                      <Text style={styles.componentPortion}>{component.portion}</Text>
                    </View>
                    <View style={styles.componentNutrition}>
                      <Text style={styles.componentCalories}>
                        {component.calories} cal
                      </Text>
                      <Text style={styles.componentProtein}>
                        {component.protein}g protein
                      </Text>
                    </View>
                  </View>

                  {component.substitutes && component.substitutes.length > 0 && (
                    <View style={styles.substitutesRow}>
                      <Text style={styles.substitutesLabel}>Alternatives:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {component.substitutes.slice(0, 3).map((sub, index) => (
                          <Badge
                            key={index}
                            text={sub}
                            size="small"
                            variant="default"
                            style={styles.substituteBadge}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </Card>
              ))}
            </View>
          ))}
        </View>
      )}

      {mealSlot.components.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No components defined</Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  compactCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  mealTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  mealTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  compactTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  compactTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactNutrition: {
    alignItems: 'flex-end',
  },
  compactCalories: {
    ...typography.h3,
    color: colors.text.primary,
  },
  compactUnit: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactComponents: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  nutritionSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    width: 60,
  },
  progressBar: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  nutritionValue: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
  componentsSection: {
    marginTop: spacing.sm,
  },
  componentsTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  categoryGroup: {
    marginBottom: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  categoryName: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  componentCard: {
    padding: spacing.sm,
    marginLeft: spacing.md,
    marginBottom: spacing.xs,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  componentInfo: {
    flex: 1,
  },
  componentName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  componentPortion: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  componentNutrition: {
    alignItems: 'flex-end',
  },
  componentCalories: {
    ...typography.body2,
    color: colors.text.primary,
  },
  componentProtein: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  substitutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  substitutesLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  substituteBadge: {
    marginRight: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
});
