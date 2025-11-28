import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';
import { DataQualityBadge } from './DataQualityBadge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { PriceHistory, DataQualityLevel } from '../../types/analytics.types';

interface PriceTrendChartProps {
  priceHistory: PriceHistory;
  onPointPress?: (point: { date: string; price: number; store: string }) => void;
  showPrediction?: boolean;
  timeframe?: '30d' | '90d' | 'all';
  onTimeframeChange?: (timeframe: '30d' | '90d' | 'all') => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.md * 4;
const CHART_HEIGHT = 160;
const PADDING = { left: 50, right: 20, top: 30, bottom: 30 };

export const PriceTrendChart: React.FC<PriceTrendChartProps> = ({
  priceHistory,
  onPointPress,
  showPrediction = true,
  timeframe = '90d',
  onTimeframeChange,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const { points, qualityLevel, historicalLow, historicalHigh, predictedPrice, priceDropAlert, dropPercentage } = priceHistory;

  if (points.length === 0) {
    return (
      <Card variant="outlined" style={styles.container}>
        <Text style={styles.title}>{priceHistory.itemName}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F4CA}'}</Text>
          <Text style={styles.emptyText}>No price history available</Text>
          <Text style={styles.emptyHint}>
            Add purchases to build price intelligence
          </Text>
        </View>
      </Card>
    );
  }

  // Filter points by timeframe
  const filterPoints = () => {
    const now = new Date();
    const filtered = points.filter((p) => {
      const date = new Date(p.date);
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (timeframe === '30d') return diffDays <= 30;
      if (timeframe === '90d') return diffDays <= 90;
      return true;
    });
    return filtered.length > 0 ? filtered : points;
  };

  const filteredPoints = filterPoints();
  const prices = filteredPoints.map((p) => p.price);
  const minPrice = Math.min(...prices, historicalLow);
  const maxPrice = Math.max(...prices, historicalHigh);
  const range = maxPrice - minPrice || 1;
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // Chart dimensions
  const chartWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Scale functions
  const scaleX = (index: number) =>
    PADDING.left + (index / Math.max(filteredPoints.length - 1, 1)) * chartWidth;
  const scaleY = (value: number) =>
    PADDING.top + chartHeight - ((value - minPrice) / range) * chartHeight;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  const handlePointPress = (index: number) => {
    setSelectedPoint(selectedPoint === index ? null : index);
    if (onPointPress && filteredPoints[index]) {
      onPointPress(filteredPoints[index]);
    }
  };

  return (
    <Card variant="outlined" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{priceHistory.itemName}</Text>
          {priceDropAlert && dropPercentage && (
            <Badge
              text={`${dropPercentage.toFixed(0)}% DROP`}
              variant="success"
              size="small"
            />
          )}
        </View>
        <DataQualityBadge
          level={qualityLevel}
          pointsCount={points.length}
          pointsNeeded={priceHistory.pointsNeeded}
          size="small"
        />
      </View>

      {/* Timeframe selector */}
      {onTimeframeChange && (
        <View style={styles.timeframeRow}>
          {(['30d', '90d', 'all'] as const).map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[
                styles.timeframeButton,
                timeframe === tf && styles.timeframeButtonActive,
              ]}
              onPress={() => onTimeframeChange(tf)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  timeframe === tf && styles.timeframeTextActive,
                ]}
              >
                {tf === 'all' ? 'All' : tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Chart */}
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.yLabel}>{formatPrice(maxPrice)}</Text>
          <Text style={styles.yLabel}>{formatPrice((maxPrice + minPrice) / 2)}</Text>
          <Text style={styles.yLabel}>{formatPrice(minPrice)}</Text>
        </View>

        {/* Chart area */}
        <View style={styles.chart}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio, index) => (
            <View
              key={index}
              style={[
                styles.gridLine,
                { top: PADDING.top + chartHeight * (1 - ratio) },
              ]}
            />
          ))}

          {/* Historical low marker */}
          <View style={[styles.markerLine, { top: scaleY(historicalLow) }]}>
            <View style={[styles.markerDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.markerLabel, { color: colors.success }]}>
              Low: {formatPrice(historicalLow)}
            </Text>
          </View>

          {/* Historical high marker */}
          <View style={[styles.markerLine, { top: scaleY(historicalHigh) }]}>
            <View style={[styles.markerDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.markerLabel, { color: colors.error }]}>
              High: {formatPrice(historicalHigh)}
            </Text>
          </View>

          {/* Average line */}
          <View
            style={[
              styles.avgLine,
              { top: scaleY(avgPrice) },
            ]}
          />

          {/* Area fill */}
          <View
            style={[
              styles.areaFill,
              {
                top: scaleY(maxPrice),
                height: scaleY(minPrice) - scaleY(maxPrice),
              },
            ]}
          />

          {/* Data points */}
          {filteredPoints.map((point, index) => {
            const x = scaleX(index);
            const y = scaleY(point.price);
            const isSelected = selectedPoint === index;
            const isSale = point.isOnSale;

            return (
              <TouchableOpacity
                key={`${point.date}-${index}`}
                style={[
                  styles.dataPoint,
                  {
                    left: x - 8,
                    top: y - 8,
                    backgroundColor: isSale ? colors.success : colors.primary.main,
                    borderColor: isSelected ? colors.text.primary : 'transparent',
                    borderWidth: isSelected ? 2 : 0,
                    transform: [{ scale: isSelected ? 1.3 : 1 }],
                  },
                ]}
                onPress={() => handlePointPress(index)}
              >
                {isSelected && (
                  <View style={styles.tooltip}>
                    <Text style={styles.tooltipPrice}>
                      {formatPrice(point.price)}
                    </Text>
                    <Text style={styles.tooltipDate}>
                      {formatDate(point.date)}
                    </Text>
                    <Text style={styles.tooltipStore}>{point.store}</Text>
                    {isSale && (
                      <Badge text="SALE" variant="success" size="small" />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Prediction point */}
          {showPrediction && predictedPrice && qualityLevel === 'mature' && (
            <View
              style={[
                styles.predictionPoint,
                {
                  left: scaleX(filteredPoints.length - 1) + 30 - 8,
                  top: scaleY(predictedPrice) - 8,
                },
              ]}
            >
              <Text style={styles.predictionLabel}>
                Predicted: {formatPrice(predictedPrice)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxis}>
        {filteredPoints.length > 0 && (
          <>
            <Text style={styles.xLabel}>{formatDate(filteredPoints[0].date)}</Text>
            <Text style={styles.xLabel}>
              {formatDate(filteredPoints[filteredPoints.length - 1].date)}
            </Text>
          </>
        )}
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatPrice(historicalLow)}</Text>
          <Text style={styles.statLabel}>Best Price</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatPrice(avgPrice)}</Text>
          <Text style={styles.statLabel}>Average</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatPrice(priceHistory.currentPrice)}</Text>
          <Text style={styles.statLabel}>Current</Text>
        </View>
        {predictedPrice && qualityLevel === 'mature' && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.info }]}>
              {formatPrice(predictedPrice)}
            </Text>
            <Text style={styles.statLabel}>Predicted</Text>
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
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  timeframeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  timeframeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
  },
  timeframeButtonActive: {
    backgroundColor: colors.primary.main,
  },
  timeframeText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  timeframeTextActive: {
    color: colors.text.inverse,
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
  yLabel: {
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
  markerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 1,
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  markerLabel: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '600',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.warning,
    borderStyle: 'dashed',
  },
  areaFill: {
    position: 'absolute',
    left: 0,
    right: PADDING.right,
    backgroundColor: colors.primary.main + '15',
    borderRadius: borderRadius.sm,
  },
  dataPoint: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    zIndex: 10,
  },
  tooltip: {
    position: 'absolute',
    bottom: 24,
    left: -40,
    width: 100,
    padding: spacing.sm,
    backgroundColor: colors.text.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    zIndex: 20,
  },
  tooltipPrice: {
    ...typography.body2,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  tooltipDate: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
  },
  tooltipStore: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
  },
  predictionPoint: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.info,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.info,
  },
  predictionLabel: {
    position: 'absolute',
    top: -20,
    left: -30,
    ...typography.caption,
    color: colors.info,
    fontSize: 9,
    fontWeight: '600',
    width: 80,
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
    marginBottom: spacing.xs,
  },
  emptyHint: {
    ...typography.caption,
    color: colors.text.disabled,
  },
});
