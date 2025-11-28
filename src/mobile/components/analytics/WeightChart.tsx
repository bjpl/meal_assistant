import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { colors, spacing, typography } from '../../utils/theme';
import { WeightEntry } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 4;
const CHART_HEIGHT = 180;

export interface WeightChartProps {
  entries: WeightEntry[];
  targetWeight?: number;
  startWeight?: number;
}

export const WeightChart: React.FC<WeightChartProps> = ({
  entries,
  targetWeight,
  startWeight,
}) => {
  if (entries.length === 0) {
    return (
      <Card variant="outlined" style={styles.container}>
        <Text style={styles.title}>Weight Trend</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{2696}'}</Text>
          <Text style={styles.emptyText}>No weight entries yet</Text>
          <Text style={styles.emptySubtext}>Start tracking to see your progress</Text>
        </View>
      </Card>
    );
  }

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const weights = sortedEntries.map(e => e.weight);
  const minWeight = Math.min(...weights, targetWeight || Infinity) - 5;
  const maxWeight = Math.max(...weights, startWeight || 0) + 5;
  const range = maxWeight - minWeight;

  const latestWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const weightChange = latestWeight - firstWeight;
  const changePercent = ((weightChange / firstWeight) * 100).toFixed(1);

  const getY = (weight: number): number => {
    return CHART_HEIGHT - ((weight - minWeight) / range) * CHART_HEIGHT;
  };

  const getX = (index: number): number => {
    return (index / (sortedEntries.length - 1)) * CHART_WIDTH;
  };

  // Generate SVG path
  const generatePath = (): string => {
    if (sortedEntries.length < 2) return '';

    let path = `M ${getX(0)} ${getY(weights[0])}`;
    for (let i = 1; i < weights.length; i++) {
      path += ` L ${getX(i)} ${getY(weights[i])}`;
    }
    return path;
  };

  // Generate area path for gradient effect
  const generateAreaPath = (): string => {
    if (sortedEntries.length < 2) return '';

    let path = `M ${getX(0)} ${CHART_HEIGHT}`;
    path += ` L ${getX(0)} ${getY(weights[0])}`;
    for (let i = 1; i < weights.length; i++) {
      path += ` L ${getX(i)} ${getY(weights[i])}`;
    }
    path += ` L ${getX(weights.length - 1)} ${CHART_HEIGHT}`;
    path += ' Z';
    return path;
  };

  return (
    <Card variant="outlined" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weight Trend</Text>
        <Badge
          text={`${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} lbs`}
          variant={weightChange <= 0 ? 'success' : 'error'}
        />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{latestWeight}</Text>
          <Text style={styles.statLabel}>Current (lbs)</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{firstWeight}</Text>
          <Text style={styles.statLabel}>Starting</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: weightChange <= 0 ? colors.success : colors.error }]}>
            {changePercent}%
          </Text>
          <Text style={styles.statLabel}>Change</Text>
        </View>
        {targetWeight && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{targetWeight}</Text>
              <Text style={styles.statLabel}>Goal</Text>
            </View>
          </>
        )}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{maxWeight.toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{((maxWeight + minWeight) / 2).toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{minWeight.toFixed(0)}</Text>
        </View>

        {/* Chart area */}
        <View style={styles.chart}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <View
              key={i}
              style={[
                styles.gridLine,
                { top: ratio * CHART_HEIGHT },
              ]}
            />
          ))}

          {/* Target weight line */}
          {targetWeight && (
            <View
              style={[
                styles.targetLine,
                { top: getY(targetWeight) },
              ]}
            >
              <Text style={styles.targetLabel}>Goal: {targetWeight}</Text>
            </View>
          )}

          {/* Data points and connecting line visualization */}
          {sortedEntries.map((entry, index) => (
            <View
              key={entry.date}
              style={[
                styles.dataPoint,
                {
                  left: getX(index) - 4,
                  top: getY(entry.weight) - 4,
                },
              ]}
            />
          ))}

          {/* Simplified line connecting points */}
          {sortedEntries.length >= 2 && sortedEntries.map((entry, index) => {
            if (index === 0) return null;
            const prevEntry = sortedEntries[index - 1];
            const x1 = getX(index - 1);
            const y1 = getY(prevEntry.weight);
            const x2 = getX(index);
            const y2 = getY(entry.weight);
            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.line,
                  {
                    width: length,
                    left: x1,
                    top: y1,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxis}>
        {sortedEntries.length <= 7 ? (
          sortedEntries.map((entry, index) => (
            <Text key={entry.date} style={styles.axisLabel}>
              {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          ))
        ) : (
          <>
            <Text style={styles.axisLabel}>
              {new Date(sortedEntries[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.axisLabel}>
              {new Date(sortedEntries[sortedEntries.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
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
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  axisLabel: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10,
  },
  chart: {
    flex: 1,
    position: 'relative',
    marginLeft: spacing.xs,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border.light,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.success,
    borderStyle: 'dashed',
  },
  targetLabel: {
    position: 'absolute',
    right: 0,
    top: -16,
    ...typography.caption,
    fontSize: 10,
    color: colors.success,
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
  },
  line: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary.main,
    transformOrigin: 'left center',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 44,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body1,
    color: colors.text.primary,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
