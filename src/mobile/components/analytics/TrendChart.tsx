import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

interface TrendChartProps {
  data: DataPoint[];
  title: string;
  unit?: string;
  color?: string;
  targetValue?: number;
  showAverage?: boolean;
  timeframe?: 'week' | 'month' | 'all';
  onTimeframeChange?: (timeframe: 'week' | 'month' | 'all') => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 4;
const CHART_HEIGHT = 180;
const PADDING = { left: 40, right: 20, top: 20, bottom: 30 };

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title,
  unit = '',
  color = colors.primary.main,
  targetValue,
  showAverage = true,
  timeframe = 'month',
  onTimeframeChange,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);

  if (data.length === 0) {
    return (
      <Card variant="outlined" style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F4CA}'}</Text>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      </Card>
    );
  }

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  // Calculate chart dimensions
  const chartWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Scale functions
  const scaleX = (index: number) =>
    PADDING.left + (index / (data.length - 1)) * chartWidth;
  const scaleY = (value: number) =>
    PADDING.top + chartHeight - ((value - minValue) / range) * chartHeight;

  // Generate SVG path for the line
  const linePath = data
    .map((point, index) => {
      const x = scaleX(index);
      const y = scaleY(point.value);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate area path
  const areaPath = `${linePath} L ${scaleX(data.length - 1)} ${PADDING.top + chartHeight} L ${PADDING.left} ${PADDING.top + chartHeight} Z`;

  // Y-axis labels
  const yLabels = [minValue, (minValue + maxValue) / 2, maxValue].map((v) =>
    Math.round(v)
  );

  // X-axis labels (show subset)
  const xLabelCount = Math.min(5, data.length);
  const xLabelIndices = Array.from(
    { length: xLabelCount },
    (_, i) => Math.floor((i * (data.length - 1)) / (xLabelCount - 1))
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTrendIndicator = () => {
    if (data.length < 2) return null;
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;
    const change = secondAvg - firstAvg;
    const percentChange = (change / firstAvg) * 100;

    if (Math.abs(percentChange) < 1) {
      return { icon: '\u2194', text: 'Stable', color: colors.text.secondary };
    }
    if (percentChange > 0) {
      return { icon: '\u2191', text: `+${percentChange.toFixed(1)}%`, color: colors.success };
    }
    return { icon: '\u2193', text: `${percentChange.toFixed(1)}%`, color: colors.error };
  };

  const trend = getTrendIndicator();

  return (
    <Card variant="outlined" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {trend && (
            <View style={styles.trendRow}>
              <Text style={[styles.trendIcon, { color: trend.color }]}>{trend.icon}</Text>
              <Text style={[styles.trendText, { color: trend.color }]}>{trend.text}</Text>
            </View>
          )}
        </View>
        {onTimeframeChange && (
          <View style={styles.timeframeButtons}>
            {(['week', 'month', 'all'] as const).map((tf) => (
              <Button
                key={tf}
                title={tf.charAt(0).toUpperCase() + tf.slice(1)}
                onPress={() => onTimeframeChange(tf)}
                variant={timeframe === tf ? 'secondary' : 'ghost'}
                size="small"
                style={styles.timeframeButton}
              />
            ))}
          </View>
        )}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {yLabels.reverse().map((label, index) => (
            <Text key={index} style={styles.axisLabel}>
              {label}{unit}
            </Text>
          ))}
        </View>

        {/* Chart SVG */}
        <View style={styles.chart}>
          {/* Grid lines */}
          {yLabels.map((label, index) => {
            const y = scaleY(label);
            return (
              <View
                key={index}
                style={[styles.gridLine, { top: y }]}
              />
            );
          })}

          {/* Target line */}
          {targetValue !== undefined && (
            <View
              style={[
                styles.targetLine,
                { top: scaleY(targetValue) },
              ]}
            >
              <Text style={styles.targetLabel}>Target: {targetValue}{unit}</Text>
            </View>
          )}

          {/* Average line */}
          {showAverage && (
            <View
              style={[
                styles.averageLine,
                { top: scaleY(average) },
              ]}
            >
              <Text style={styles.averageLabel}>Avg: {Math.round(average)}{unit}</Text>
            </View>
          )}

          {/* Area fill (simplified with View) */}
          <View
            style={[
              styles.areaFill,
              {
                backgroundColor: color + '20',
                top: scaleY(maxValue),
                height: scaleY(minValue) - scaleY(maxValue),
              },
            ]}
          />

          {/* Data points */}
          {data.map((point, index) => {
            const x = scaleX(index);
            const y = scaleY(point.value);
            const isSelected = selectedPoint === point;

            return (
              <View
                key={index}
                style={[
                  styles.dataPoint,
                  {
                    left: x - 6,
                    top: y - 6,
                    backgroundColor: isSelected ? color : colors.background.primary,
                    borderColor: color,
                  },
                ]}
                onTouchEnd={() => setSelectedPoint(isSelected ? null : point)}
              >
                {isSelected && (
                  <View style={[styles.tooltip, { backgroundColor: color }]}>
                    <Text style={styles.tooltipValue}>
                      {point.value}{unit}
                    </Text>
                    <Text style={styles.tooltipDate}>
                      {formatDate(point.date)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxis}>
        {xLabelIndices.map((dataIndex) => (
          <Text key={dataIndex} style={styles.xLabel}>
            {formatDate(data[dataIndex].date)}
          </Text>
        ))}
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(minValue)}{unit}</Text>
          <Text style={styles.statLabel}>Min</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(average)}{unit}</Text>
          <Text style={styles.statLabel}>Average</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(maxValue)}{unit}</Text>
          <Text style={styles.statLabel}>Max</Text>
        </View>
        {targetValue !== undefined && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: average >= targetValue ? colors.success : colors.warning }]}>
              {targetValue}{unit}
            </Text>
            <Text style={styles.statLabel}>Target</Text>
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  trendIcon: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  trendText: {
    ...typography.body2,
    fontWeight: '600',
  },
  timeframeButtons: {
    flexDirection: 'row',
  },
  timeframeButton: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
  },
  yAxis: {
    width: PADDING.left,
    justifyContent: 'space-between',
    paddingVertical: PADDING.top,
  },
  axisLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
    textAlign: 'right',
    paddingRight: spacing.xs,
  },
  chart: {
    flex: 1,
    position: 'relative',
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
    height: 1,
    backgroundColor: colors.success,
    borderStyle: 'dashed',
  },
  targetLabel: {
    position: 'absolute',
    right: 0,
    top: -14,
    ...typography.caption,
    color: colors.success,
    fontSize: 10,
  },
  averageLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.warning,
    borderStyle: 'dashed',
  },
  averageLabel: {
    position: 'absolute',
    right: 0,
    top: -14,
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
  },
  areaFill: {
    position: 'absolute',
    left: PADDING.left - 40,
    right: PADDING.right - 20,
    borderRadius: borderRadius.sm,
  },
  dataPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  tooltip: {
    position: 'absolute',
    bottom: 20,
    left: -30,
    width: 72,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  tooltipValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  tooltipDate: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: PADDING.left,
    paddingRight: PADDING.right,
    marginTop: spacing.xs,
  },
  xLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
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
  },
});
