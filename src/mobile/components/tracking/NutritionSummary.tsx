import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../base/Card';
import { ProgressBar } from '../base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

export interface NutritionData {
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export interface NutritionSummaryProps {
  nutrition: NutritionData;
  targets?: {
    calories: number;
    protein: number;
    carbs?: number;
    fat?: number;
  };
  variant?: 'compact' | 'detailed';
  showPercentages?: boolean;
}

export const NutritionSummary: React.FC<NutritionSummaryProps> = ({
  nutrition,
  targets,
  variant = 'compact',
  showPercentages = true,
}) => {
  const getMacroColor = (macro: string): string => {
    switch (macro) {
      case 'protein':
        return colors.secondary.main;
      case 'carbs':
        return colors.info;
      case 'fat':
        return colors.warning;
      case 'fiber':
        return colors.success;
      default:
        return colors.primary.main;
    }
  };

  const calculatePercentage = (value: number, target: number): number => {
    return Math.round((value / target) * 100);
  };

  if (variant === 'compact') {
    return (
      <Card variant="filled" style={styles.compactCard}>
        <View style={styles.compactRow}>
          <View style={styles.compactItem}>
            <Text style={styles.compactValue}>{nutrition.calories}</Text>
            <Text style={styles.compactLabel}>cal</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactItem}>
            <Text style={[styles.compactValue, { color: getMacroColor('protein') }]}>
              {nutrition.protein}g
            </Text>
            <Text style={styles.compactLabel}>protein</Text>
          </View>
          {nutrition.carbs !== undefined && (
            <>
              <View style={styles.compactDivider} />
              <View style={styles.compactItem}>
                <Text style={[styles.compactValue, { color: getMacroColor('carbs') }]}>
                  {nutrition.carbs}g
                </Text>
                <Text style={styles.compactLabel}>carbs</Text>
              </View>
            </>
          )}
          {nutrition.fat !== undefined && (
            <>
              <View style={styles.compactDivider} />
              <View style={styles.compactItem}>
                <Text style={[styles.compactValue, { color: getMacroColor('fat') }]}>
                  {nutrition.fat}g
                </Text>
                <Text style={styles.compactLabel}>fat</Text>
              </View>
            </>
          )}
        </View>
      </Card>
    );
  }

  return (
    <Card variant="outlined" style={styles.detailedCard}>
      <Text style={styles.cardTitle}>Nutrition Summary</Text>

      {/* Calories */}
      <View style={styles.nutrientRow}>
        <View style={styles.nutrientHeader}>
          <Text style={styles.nutrientIcon}>{'\u{1F525}'}</Text>
          <Text style={styles.nutrientLabel}>Calories</Text>
        </View>
        <Text style={styles.nutrientValue}>{nutrition.calories}</Text>
      </View>
      {targets && (
        <ProgressBar
          progress={calculatePercentage(nutrition.calories, targets.calories)}
          showPercentage={showPercentages}
          height={8}
          color={colors.primary.main}
          style={styles.progressBar}
        />
      )}

      {/* Protein */}
      <View style={styles.nutrientRow}>
        <View style={styles.nutrientHeader}>
          <Text style={styles.nutrientIcon}>{'\u{1F969}'}</Text>
          <Text style={styles.nutrientLabel}>Protein</Text>
        </View>
        <Text style={styles.nutrientValue}>{nutrition.protein}g</Text>
      </View>
      {targets && (
        <ProgressBar
          progress={calculatePercentage(nutrition.protein, targets.protein)}
          showPercentage={showPercentages}
          height={8}
          color={getMacroColor('protein')}
          style={styles.progressBar}
        />
      )}

      {/* Carbs */}
      {nutrition.carbs !== undefined && (
        <>
          <View style={styles.nutrientRow}>
            <View style={styles.nutrientHeader}>
              <Text style={styles.nutrientIcon}>{'\u{1F35E}'}</Text>
              <Text style={styles.nutrientLabel}>Carbohydrates</Text>
            </View>
            <Text style={styles.nutrientValue}>{nutrition.carbs}g</Text>
          </View>
          {targets?.carbs && (
            <ProgressBar
              progress={calculatePercentage(nutrition.carbs, targets.carbs)}
              showPercentage={showPercentages}
              height={8}
              color={getMacroColor('carbs')}
              style={styles.progressBar}
            />
          )}
        </>
      )}

      {/* Fat */}
      {nutrition.fat !== undefined && (
        <>
          <View style={styles.nutrientRow}>
            <View style={styles.nutrientHeader}>
              <Text style={styles.nutrientIcon}>{'\u{1F951}'}</Text>
              <Text style={styles.nutrientLabel}>Fat</Text>
            </View>
            <Text style={styles.nutrientValue}>{nutrition.fat}g</Text>
          </View>
          {targets?.fat && (
            <ProgressBar
              progress={calculatePercentage(nutrition.fat, targets.fat)}
              showPercentage={showPercentages}
              height={8}
              color={getMacroColor('fat')}
              style={styles.progressBar}
            />
          )}
        </>
      )}

      {/* Fiber */}
      {nutrition.fiber !== undefined && (
        <View style={styles.nutrientRow}>
          <View style={styles.nutrientHeader}>
            <Text style={styles.nutrientIcon}>{'\u{1F96C}'}</Text>
            <Text style={styles.nutrientLabel}>Fiber</Text>
          </View>
          <Text style={styles.nutrientValue}>{nutrition.fiber}g</Text>
        </View>
      )}

      {/* Macro Split Visualization */}
      {nutrition.carbs !== undefined && nutrition.fat !== undefined && (
        <View style={styles.macroSplit}>
          <Text style={styles.macroSplitTitle}>Macro Split</Text>
          <View style={styles.macroBar}>
            <View
              style={[
                styles.macroSegment,
                {
                  flex: nutrition.protein * 4,
                  backgroundColor: getMacroColor('protein'),
                  borderTopLeftRadius: borderRadius.sm,
                  borderBottomLeftRadius: borderRadius.sm,
                },
              ]}
            />
            <View
              style={[
                styles.macroSegment,
                {
                  flex: nutrition.carbs * 4,
                  backgroundColor: getMacroColor('carbs'),
                },
              ]}
            />
            <View
              style={[
                styles.macroSegment,
                {
                  flex: nutrition.fat * 9,
                  backgroundColor: getMacroColor('fat'),
                  borderTopRightRadius: borderRadius.sm,
                  borderBottomRightRadius: borderRadius.sm,
                },
              ]}
            />
          </View>
          <View style={styles.macroLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getMacroColor('protein') }]} />
              <Text style={styles.legendText}>Protein</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getMacroColor('carbs') }]} />
              <Text style={styles.legendText}>Carbs</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getMacroColor('fat') }]} />
              <Text style={styles.legendText}>Fat</Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  compactCard: {
    padding: spacing.sm,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  compactItem: {
    alignItems: 'center',
    flex: 1,
  },
  compactValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  compactLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  compactDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
  },
  detailedCard: {
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  nutrientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutrientIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  nutrientLabel: {
    ...typography.body1,
    color: colors.text.primary,
  },
  nutrientValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  progressBar: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  macroSplit: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  macroSplitTitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  macroBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  macroSegment: {
    height: '100%',
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
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
});
