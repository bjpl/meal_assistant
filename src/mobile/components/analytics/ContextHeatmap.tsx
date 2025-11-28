import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../base/Card';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import {
  ContextType,
  DayOfWeekCorrelation,
  WeatherCorrelation,
  StressCorrelation,
  ScheduleCorrelation,
} from '../../types/analytics.types';
import { PatternId } from '../../types';

interface ContextHeatmapProps {
  dayOfWeekData: DayOfWeekCorrelation[];
  weatherData: WeatherCorrelation[];
  stressData: StressCorrelation[];
  scheduleData: ScheduleCorrelation[];
  onCellPress?: (context: string, pattern: PatternId) => void;
}

const PATTERN_COLORS: Record<PatternId, string> = {
  A: colors.patterns.A,
  B: colors.patterns.B,
  C: colors.patterns.C,
  D: colors.patterns.D,
  E: colors.patterns.E,
  F: colors.patterns.F,
  G: colors.patterns.G,
};

const PATTERN_NAMES: Record<PatternId, string> = {
  A: 'Traditional',
  B: 'Reversed',
  C: 'Fasting',
  D: '4 Mini',
  E: 'Platter',
  F: 'Big Breakfast',
  G: 'Morning Feast',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEATHER_LABELS = ['Sunny', 'Cloudy', 'Rainy', 'Cold', 'Hot'];
const STRESS_LABELS = ['Low', 'Medium', 'High'];
const SCHEDULE_LABELS = ['Work', 'WFH', 'Weekend', 'Travel', 'Social'];

type TabType = 'day' | 'weather' | 'stress' | 'schedule';

export const ContextHeatmap: React.FC<ContextHeatmapProps> = ({
  dayOfWeekData,
  weatherData,
  stressData,
  scheduleData,
  onCellPress,
}) => {
  const [selectedTab, setSelectedTab] = useState<TabType>('day');

  const getHeatmapColor = (successRate: number) => {
    if (successRate >= 80) return colors.success;
    if (successRate >= 60) return colors.primary.main;
    if (successRate >= 40) return colors.warning;
    return colors.error;
  };

  const renderHeatmapCell = (
    context: string,
    pattern: PatternId,
    successRate: number,
    sampleSize: number
  ) => {
    const isLowSample = sampleSize < 5;

    return (
      <TouchableOpacity
        key={`${context}-${pattern}`}
        style={[
          styles.cell,
          {
            backgroundColor: getHeatmapColor(successRate) + (isLowSample ? '40' : ''),
            borderColor: PATTERN_COLORS[pattern],
            borderWidth: 2,
          },
        ]}
        onPress={() => onCellPress?.(context, pattern)}
        activeOpacity={0.7}
      >
        <Text style={styles.cellPattern}>{pattern}</Text>
        <Text style={styles.cellRate}>{successRate}%</Text>
        {isLowSample && <Text style={styles.cellSample}>n={sampleSize}</Text>}
      </TouchableOpacity>
    );
  };

  const renderDayHeatmap = () => (
    <View style={styles.heatmapGrid}>
      {dayOfWeekData.map((item, index) => (
        <View key={item.day} style={styles.heatmapRow}>
          <Text style={styles.rowLabel}>{DAY_LABELS[index]}</Text>
          {renderHeatmapCell(item.day, item.bestPattern, item.successRate, 10)}
        </View>
      ))}
    </View>
  );

  const renderWeatherHeatmap = () => (
    <View style={styles.heatmapGrid}>
      {weatherData.map((item, index) => (
        <View key={item.weather} style={styles.heatmapRow}>
          <Text style={styles.rowLabel}>{WEATHER_LABELS[index]}</Text>
          {renderHeatmapCell(item.weather, item.bestPattern, item.successRate, 8)}
        </View>
      ))}
    </View>
  );

  const renderStressHeatmap = () => (
    <View style={styles.heatmapGrid}>
      {stressData.map((item, index) => (
        <View key={item.level} style={styles.heatmapRow}>
          <Text style={styles.rowLabel}>{STRESS_LABELS[index]}</Text>
          {renderHeatmapCell(item.level, item.bestPattern, item.successRate, 12)}
        </View>
      ))}
    </View>
  );

  const renderScheduleHeatmap = () => (
    <View style={styles.heatmapGrid}>
      {scheduleData.map((item, index) => (
        <View key={item.type} style={styles.heatmapRow}>
          <Text style={styles.rowLabel}>{SCHEDULE_LABELS[index]}</Text>
          {renderHeatmapCell(item.type, item.bestPattern, item.successRate, 6)}
        </View>
      ))}
    </View>
  );

  return (
    <Card variant="outlined" style={styles.container}>
      <Text style={styles.title}>Context-Pattern Correlation</Text>
      <Text style={styles.subtitle}>
        Best performing pattern by context
      </Text>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        {[
          { key: 'day', label: 'Day of Week', icon: '\u{1F4C5}' },
          { key: 'weather', label: 'Weather', icon: '\u2600' },
          { key: 'stress', label: 'Stress', icon: '\u{1F9E0}' },
          { key: 'schedule', label: 'Schedule', icon: '\u{1F4BC}' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              selectedTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setSelectedTab(tab.key as TabType)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                selectedTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Heatmap Content */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.heatmapScroll}
      >
        {selectedTab === 'day' && renderDayHeatmap()}
        {selectedTab === 'weather' && renderWeatherHeatmap()}
        {selectedTab === 'stress' && renderStressHeatmap()}
        {selectedTab === 'schedule' && renderScheduleHeatmap()}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Success Rate</Text>
        <View style={styles.legendScale}>
          <View style={[styles.legendItem, { backgroundColor: colors.error }]}>
            <Text style={styles.legendText}>0-39%</Text>
          </View>
          <View style={[styles.legendItem, { backgroundColor: colors.warning }]}>
            <Text style={styles.legendText}>40-59%</Text>
          </View>
          <View style={[styles.legendItem, { backgroundColor: colors.primary.main }]}>
            <Text style={styles.legendText}>60-79%</Text>
          </View>
          <View style={[styles.legendItem, { backgroundColor: colors.success }]}>
            <Text style={styles.legendText}>80%+</Text>
          </View>
        </View>
      </View>

      {/* Pattern Key */}
      <View style={styles.patternKey}>
        <Text style={styles.legendTitle}>Patterns</Text>
        <View style={styles.patternGrid}>
          {(Object.keys(PATTERN_NAMES) as PatternId[]).map((id) => (
            <View key={id} style={styles.patternItem}>
              <View
                style={[styles.patternDot, { backgroundColor: PATTERN_COLORS[id] }]}
              />
              <Text style={styles.patternLabel}>
                {id}: {PATTERN_NAMES[id]}
              </Text>
            </View>
          ))}
        </View>
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
  tabContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  tabActive: {
    backgroundColor: colors.primary.main,
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  tabLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  heatmapScroll: {
    marginBottom: spacing.md,
  },
  heatmapGrid: {
    gap: spacing.sm,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    width: 60,
    fontWeight: '600',
  },
  cell: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  cellPattern: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  cellRate: {
    ...typography.caption,
    color: colors.text.inverse,
    fontSize: 10,
  },
  cellSample: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
  },
  legend: {
    marginBottom: spacing.md,
  },
  legendTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  legendScale: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  legendItem: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  legendText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
  },
  patternKey: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  patternItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
  },
  patternDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  patternLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
});
