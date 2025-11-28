import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PatternEffectivenessMetrics } from '../../types/analytics.types';
import { PatternId } from '../../types';

interface PatternSuccessChartProps {
  patterns: PatternEffectivenessMetrics[];
  selectedMetric?: 'successRate' | 'weightChange' | 'energy' | 'satisfaction';
  onMetricChange?: (metric: 'successRate' | 'weightChange' | 'energy' | 'satisfaction') => void;
  onPatternPress?: (patternId: PatternId) => void;
}

const METRIC_LABELS = {
  successRate: 'Success Rate',
  weightChange: 'Weight Change',
  energy: 'Energy Level',
  satisfaction: 'Satisfaction',
};

const PATTERN_COLORS: Record<PatternId, string> = {
  A: colors.patterns.A,
  B: colors.patterns.B,
  C: colors.patterns.C,
  D: colors.patterns.D,
  E: colors.patterns.E,
  F: colors.patterns.F,
  G: colors.patterns.G,
};

export const PatternSuccessChart: React.FC<PatternSuccessChartProps> = ({
  patterns,
  selectedMetric = 'successRate',
  onMetricChange,
  onPatternPress,
}) => {
  if (patterns.length === 0) {
    return (
      <Card variant="outlined" style={styles.container}>
        <Text style={styles.title}>Pattern Success</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F4CA}'}</Text>
          <Text style={styles.emptyText}>
            Track more patterns to see effectiveness data
          </Text>
        </View>
      </Card>
    );
  }

  const getMetricValue = (pattern: PatternEffectivenessMetrics) => {
    switch (selectedMetric) {
      case 'successRate':
        return pattern.successRate;
      case 'weightChange':
        return Math.abs(pattern.weightChangeAvg) * 20; // Scale for display
      case 'energy':
        return pattern.energyLevelAvg;
      case 'satisfaction':
        return pattern.satisfactionScore * 20; // Scale 1-5 to 0-100
      default:
        return pattern.successRate;
    }
  };

  const getMetricDisplay = (pattern: PatternEffectivenessMetrics) => {
    switch (selectedMetric) {
      case 'successRate':
        return `${pattern.successRate}%`;
      case 'weightChange':
        const sign = pattern.weightChangeAvg >= 0 ? '+' : '';
        return `${sign}${pattern.weightChangeAvg.toFixed(1)} lbs/wk`;
      case 'energy':
        return `${pattern.energyLevelAvg}%`;
      case 'satisfaction':
        return `${pattern.satisfactionScore.toFixed(1)}/5`;
      default:
        return `${pattern.successRate}%`;
    }
  };

  const sortedPatterns = [...patterns].sort(
    (a, b) => getMetricValue(b) - getMetricValue(a)
  );
  const maxValue = Math.max(...patterns.map(getMetricValue), 1);

  return (
    <Card variant="outlined" style={styles.container}>
      <Text style={styles.title}>Pattern Effectiveness</Text>
      <Text style={styles.subtitle}>
        Compare how well each pattern works for you
      </Text>

      {/* Metric Selector */}
      {onMetricChange && (
        <View style={styles.metricSelector}>
          {(Object.keys(METRIC_LABELS) as Array<keyof typeof METRIC_LABELS>).map((metric) => (
            <TouchableOpacity
              key={metric}
              style={[
                styles.metricButton,
                selectedMetric === metric && styles.metricButtonActive,
              ]}
              onPress={() => onMetricChange(metric)}
            >
              <Text
                style={[
                  styles.metricButtonText,
                  selectedMetric === metric && styles.metricButtonTextActive,
                ]}
              >
                {METRIC_LABELS[metric]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bar Chart */}
      <View style={styles.chartContainer}>
        {sortedPatterns.map((pattern, index) => {
          const value = getMetricValue(pattern);
          const barWidth = (value / maxValue) * 100;
          const isTop = index === 0;

          return (
            <TouchableOpacity
              key={pattern.patternId}
              style={styles.barRow}
              onPress={() => onPatternPress?.(pattern.patternId)}
              activeOpacity={0.7}
            >
              <View style={styles.barLabel}>
                <View
                  style={[
                    styles.patternDot,
                    { backgroundColor: PATTERN_COLORS[pattern.patternId] },
                  ]}
                />
                <Text style={styles.patternName}>
                  {pattern.patternName}
                </Text>
                {isTop && (
                  <Badge text="BEST" variant="success" size="small" />
                )}
              </View>

              <View style={styles.barWrapper}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: PATTERN_COLORS[pattern.patternId],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{getMetricDisplay(pattern)}</Text>
              </View>

              <View style={styles.barMeta}>
                <Text style={styles.metaText}>
                  {pattern.totalDaysUsed} days | {pattern.adherenceRate}% adherence
                </Text>
                {pattern.currentStreak > 0 && (
                  <Text style={styles.streakText}>
                    {'\u{1F525}'} {pattern.currentStreak} day streak
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>
          {METRIC_LABELS[selectedMetric]} Comparison
        </Text>
        <Text style={styles.legendDescription}>
          {selectedMetric === 'successRate' && 'Percentage of days you met your goals with each pattern'}
          {selectedMetric === 'weightChange' && 'Average weekly weight change while using each pattern'}
          {selectedMetric === 'energy' && 'Your average reported energy level on each pattern'}
          {selectedMetric === 'satisfaction' && 'How satisfied you are with meals on each pattern'}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  metricSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metricButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
  },
  metricButtonActive: {
    backgroundColor: colors.primary.main,
  },
  metricButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  metricButtonTextActive: {
    color: colors.text.inverse,
  },
  chartContainer: {
    gap: spacing.md,
  },
  barRow: {
    marginBottom: spacing.xs,
  },
  barLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  patternDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  patternName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: colors.background.tertiary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },
  barValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    width: 80,
    textAlign: 'right',
  },
  barMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingLeft: 24,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10,
  },
  streakText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
  },
  legend: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
  },
  legendTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  legendDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
