import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../utils/theme';
import { AccuracyPoint } from '../../types/ads.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AccuracyChartProps {
  data: AccuracyPoint[];
  height?: number;
  showLabels?: boolean;
  style?: ViewStyle;
}

export const AccuracyChart: React.FC<AccuracyChartProps> = ({
  data,
  height = 120,
  showLabels = true,
  style,
}) => {
  if (data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }, style]}>
        <Text style={styles.emptyText}>No accuracy data yet</Text>
        <Text style={styles.emptySubtext}>
          Process and review ads to track your accuracy
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.accuracy), 100);
  const minValue = Math.min(...data.map(d => d.accuracy), 0);
  const chartWidth = SCREEN_WIDTH - spacing.md * 4;
  const chartHeight = height - 40; // Leave room for labels

  const getY = (value: number) => {
    const range = maxValue - minValue || 1;
    return chartHeight - ((value - minValue) / range) * chartHeight;
  };

  const points = data.map((point, index) => ({
    x: (index / (data.length - 1 || 1)) * chartWidth,
    y: getY(point.accuracy),
    accuracy: point.accuracy,
    date: point.date,
  }));

  // Create SVG-like path using a View with absolute positioning
  const renderLine = () => {
    if (points.length < 2) return null;

    return points.slice(0, -1).map((point, index) => {
      const nextPoint = points[index + 1];
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return (
        <View
          key={index}
          style={[
            styles.line,
            {
              left: point.x,
              top: point.y,
              width: length,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
      );
    });
  };

  const renderPoints = () => {
    return points.map((point, index) => (
      <View
        key={index}
        style={[
          styles.point,
          {
            left: point.x - 4,
            top: point.y - 4,
            backgroundColor: getPointColor(point.accuracy),
          },
        ]}
      />
    ));
  };

  const getPointColor = (accuracy: number) => {
    if (accuracy >= 70) return colors.success;
    if (accuracy >= 50) return colors.warning;
    return colors.error;
  };

  const latestAccuracy = data[data.length - 1]?.accuracy || 0;
  const previousAccuracy = data[data.length - 2]?.accuracy;
  const trend = previousAccuracy
    ? latestAccuracy - previousAccuracy
    : 0;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.currentValue}>{Math.round(latestAccuracy)}%</Text>
          <Text style={styles.label}>Current Accuracy</Text>
        </View>
        {trend !== 0 && (
          <View style={[styles.trendBadge, trend > 0 ? styles.trendUp : styles.trendDown]}>
            <Text style={styles.trendArrow}>{trend > 0 ? '\u2191' : '\u2193'}</Text>
            <Text style={[styles.trendText, trend > 0 ? styles.trendTextUp : styles.trendTextDown]}>
              {Math.abs(trend).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.chartContainer, { height: chartHeight }]}>
        {/* Grid lines */}
        <View style={[styles.gridLine, { top: 0 }]} />
        <View style={[styles.gridLine, { top: chartHeight / 2 }]} />
        <View style={[styles.gridLine, { top: chartHeight }]} />

        {/* Chart */}
        <View style={styles.chart}>
          {renderLine()}
          {renderPoints()}
        </View>

        {/* Y-axis labels */}
        {showLabels && (
          <View style={styles.yAxis}>
            <Text style={styles.axisLabel}>{maxValue}%</Text>
            <Text style={styles.axisLabel}>{Math.round((maxValue + minValue) / 2)}%</Text>
            <Text style={styles.axisLabel}>{minValue}%</Text>
          </View>
        )}
      </View>

      {/* X-axis labels */}
      {showLabels && data.length > 1 && (
        <View style={styles.xAxis}>
          <Text style={styles.axisLabel}>
            {formatDate(data[0].date)}
          </Text>
          <Text style={styles.axisLabel}>
            {formatDate(data[data.length - 1].date)}
          </Text>
        </View>
      )}
    </View>
  );
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// Mini sparkline variant
export const AccuracySparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  style?: ViewStyle;
}> = ({ data, width = 60, height = 24, style }) => {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }));

  return (
    <View style={[{ width, height }, style]}>
      {points.slice(0, -1).map((point, index) => {
        const nextPoint = points[index + 1];
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <View
            key={index}
            style={[
              styles.sparkLine,
              {
                left: point.x,
                top: point.y,
                width: length,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  currentValue: {
    ...typography.h1,
    color: colors.text.primary,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  trendUp: {
    backgroundColor: colors.success + '20',
  },
  trendDown: {
    backgroundColor: colors.error + '20',
  },
  trendArrow: {
    fontSize: 14,
    marginRight: 2,
  },
  trendText: {
    ...typography.caption,
    fontWeight: '600',
  },
  trendTextUp: {
    color: colors.success,
  },
  trendTextDown: {
    color: colors.error,
  },
  chartContainer: {
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border.light,
  },
  chart: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 0,
    bottom: 0,
  },
  line: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary.main,
    transformOrigin: 'left center',
  },
  point: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 25,
    justifyContent: 'space-between',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingLeft: 30,
  },
  axisLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.disabled,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
  },
  emptyText: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  sparkLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary.main,
    transformOrigin: 'left center',
  },
});
