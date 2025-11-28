import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Card } from '../base/Card';
import { ProgressBar } from '../base/ProgressBar';
import { Badge } from '../base/Badge';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { RootState } from '../../store';
import { HydrationTrendDay, HourlyHydration } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 150;
const BAR_WIDTH = 30;

type TimeFrame = 'week' | 'month';

export interface HydrationTrendsProps {
  weeklyTrends?: HydrationTrendDay[];
  monthlyTrends?: HydrationTrendDay[];
  hourlyData?: HourlyHydration[];
}

// Generate sample data for demonstration
const generateSampleWeeklyData = (): HydrationTrendDay[] => {
  const data: HydrationTrendDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const waterOz = Math.round(80 + Math.random() * 60);
    data.push({
      date: date.toISOString().split('T')[0],
      water_oz: waterOz,
      caffeine_mg: Math.round(100 + Math.random() * 200),
      percent_of_goal: Math.round((waterOz / 125) * 100),
    });
  }
  return data;
};

const generateSampleHourlyData = (): HourlyHydration[] => {
  const data: HourlyHydration[] = [];
  const currentHour = new Date().getHours();
  for (let hour = 0; hour < 24; hour++) {
    if (hour <= currentHour && hour >= 6) {
      data.push({
        hour,
        water_oz: Math.round(4 + Math.random() * 12),
        caffeine_mg: hour < 14 ? Math.round(Math.random() * 95) : 0,
      });
    } else {
      data.push({ hour, water_oz: 0, caffeine_mg: 0 });
    }
  }
  return data;
};

export const HydrationTrends: React.FC<HydrationTrendsProps> = ({
  weeklyTrends: propWeeklyTrends,
  monthlyTrends: propMonthlyTrends,
  hourlyData: propHourlyData,
}) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');
  const { goal, trends } = useSelector((state: RootState) => state.hydration);

  // Use prop data or Redux data or sample data
  const weeklyTrends = propWeeklyTrends || trends.weekly.length > 0
    ? trends.weekly
    : generateSampleWeeklyData();
  const hourlyData = propHourlyData || generateSampleHourlyData();

  // Calculate statistics
  const stats = useMemo(() => {
    const data = weeklyTrends;
    if (data.length === 0) return null;

    const avgWater = Math.round(
      data.reduce((sum, d) => sum + d.water_oz, 0) / data.length
    );
    const avgPercent = Math.round(
      data.reduce((sum, d) => sum + d.percent_of_goal, 0) / data.length
    );
    const daysMetGoal = data.filter((d) => d.percent_of_goal >= 100).length;
    const bestDay = data.reduce(
      (max, d) => (d.water_oz > max.water_oz ? d : max),
      data[0]
    );
    const worstDay = data.reduce(
      (min, d) => (d.water_oz < min.water_oz ? d : min),
      data[0]
    );

    return { avgWater, avgPercent, daysMetGoal, bestDay, worstDay };
  }, [weeklyTrends]);

  const maxWater = Math.max(...weeklyTrends.map((d) => d.water_oz), goal.daily_water_oz);

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    return hour < 12 ? `${hour}a` : `${hour - 12}p`;
  };

  const getHourlyMax = () => {
    return Math.max(...hourlyData.map((h) => h.water_oz), 16);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Time Frame Selector */}
      <View style={styles.timeFrameSelector}>
        {(['week', 'month'] as TimeFrame[]).map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[
              styles.timeFrameButton,
              timeFrame === tf && styles.timeFrameButtonActive,
            ]}
            onPress={() => setTimeFrame(tf)}
          >
            <Text
              style={[
                styles.timeFrameText,
                timeFrame === tf && styles.timeFrameTextActive,
              ]}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Stats */}
      {stats && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
        >
          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statIcon}>{'\u{1F4A7}'}</Text>
            <Text style={styles.statValue}>{stats.avgWater}oz</Text>
            <Text style={styles.statLabel}>Avg Daily</Text>
          </Card>

          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statIcon}>{'\u{1F3AF}'}</Text>
            <Text style={styles.statValue}>{stats.avgPercent}%</Text>
            <Text style={styles.statLabel}>Avg Goal</Text>
          </Card>

          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statIcon}>{'\u{2705}'}</Text>
            <Text style={styles.statValue}>{stats.daysMetGoal}/7</Text>
            <Text style={styles.statLabel}>Days Met Goal</Text>
          </Card>

          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statIcon}>{'\u{1F31F}'}</Text>
            <Text style={styles.statValue}>{stats.bestDay.water_oz}oz</Text>
            <Text style={styles.statLabel}>Best Day</Text>
          </Card>
        </ScrollView>
      )}

      {/* Weekly Trend Chart */}
      <Card variant="outlined" style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <View style={styles.chart}>
          {/* Goal line */}
          <View
            style={[
              styles.goalLine,
              { bottom: (goal.daily_water_oz / maxWater) * CHART_HEIGHT },
            ]}
          >
            <Text style={styles.goalLineLabel}>{goal.daily_water_oz}oz goal</Text>
          </View>

          {/* Bars */}
          <View style={styles.barsContainer}>
            {weeklyTrends.map((day, index) => {
              const barHeight = (day.water_oz / maxWater) * CHART_HEIGHT;
              const metGoal = day.percent_of_goal >= 100;

              return (
                <View key={day.date} style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: metGoal ? colors.success : colors.info,
                      },
                    ]}
                  >
                    <Text style={styles.barValue}>{day.water_oz}</Text>
                  </View>
                  <Text style={styles.barLabel}>{getDayLabel(day.date)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      {/* Hourly Heatmap */}
      <Card variant="outlined" style={styles.heatmapCard}>
        <Text style={styles.sectionTitle}>Today's Hourly Breakdown</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.heatmapContainer}>
            {hourlyData.map((hourData) => {
              const intensity = hourData.water_oz / getHourlyMax();
              const bgColor =
                hourData.water_oz === 0
                  ? colors.background.tertiary
                  : `rgba(33, 150, 243, ${0.2 + intensity * 0.8})`;

              return (
                <View key={hourData.hour} style={styles.heatmapCell}>
                  <View
                    style={[styles.heatmapBlock, { backgroundColor: bgColor }]}
                  >
                    {hourData.water_oz > 0 && (
                      <Text style={styles.heatmapValue}>{hourData.water_oz}</Text>
                    )}
                  </View>
                  <Text style={styles.heatmapLabel}>
                    {formatHour(hourData.hour)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.heatmapLegend}>
          <Text style={styles.legendText}>Less</Text>
          <View style={styles.legendGradient}>
            {[0.2, 0.4, 0.6, 0.8, 1].map((opacity) => (
              <View
                key={opacity}
                style={[
                  styles.legendBlock,
                  { backgroundColor: `rgba(33, 150, 243, ${opacity})` },
                ]}
              />
            ))}
          </View>
          <Text style={styles.legendText}>More</Text>
        </View>
      </Card>

      {/* Adherence Calendar Preview */}
      <Card variant="filled" style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <Badge
            text={stats ? `${stats.daysMetGoal}/7 days` : '0/7 days'}
            variant={stats && stats.daysMetGoal >= 5 ? 'success' : 'info'}
            size="small"
          />
        </View>
        <View style={styles.calendarRow}>
          {weeklyTrends.map((day) => {
            const metGoal = day.percent_of_goal >= 100;
            const isToday =
              day.date === new Date().toISOString().split('T')[0];

            return (
              <View
                key={day.date}
                style={[
                  styles.calendarDay,
                  metGoal && styles.calendarDaySuccess,
                  isToday && styles.calendarDayToday,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    metGoal && styles.calendarDayTextSuccess,
                  ]}
                >
                  {getDayLabel(day.date).charAt(0)}
                </Text>
                {metGoal && <Text style={styles.checkMark}>{'\u{2713}'}</Text>}
              </View>
            );
          })}
        </View>
      </Card>

      {/* Insights */}
      {stats && (
        <Card variant="outlined" style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>Insights</Text>

          {stats.avgPercent >= 90 && (
            <View style={styles.insight}>
              <Text style={styles.insightIcon}>{'\u{1F31F}'}</Text>
              <Text style={styles.insightText}>
                Great hydration habits! You're averaging {stats.avgPercent}% of your daily goal.
              </Text>
            </View>
          )}

          {stats.daysMetGoal < 5 && (
            <View style={styles.insight}>
              <Text style={styles.insightIcon}>{'\u{1F4A1}'}</Text>
              <Text style={styles.insightText}>
                Try setting hourly reminders to help meet your water goal more consistently.
              </Text>
            </View>
          )}

          <View style={styles.insight}>
            <Text style={styles.insightIcon}>{'\u{1F4C8}'}</Text>
            <Text style={styles.insightText}>
              Your best hydration day was {getDayLabel(stats.bestDay.date)} with {stats.bestDay.water_oz}oz.
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  timeFrameSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginVertical: spacing.md,
    gap: spacing.xs,
  },
  timeFrameButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.tertiary,
  },
  timeFrameButtonActive: {
    backgroundColor: colors.info,
  },
  timeFrameText: {
    ...typography.body2,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  timeFrameTextActive: {
    color: colors.text.inverse,
  },
  statsScroll: {
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    width: 100,
    alignItems: 'center',
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  chartCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  chart: {
    height: CHART_HEIGHT + 40,
    position: 'relative',
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderTopColor: colors.success + '50',
    borderStyle: 'dashed',
  },
  goalLineLabel: {
    ...typography.caption,
    color: colors.success,
    position: 'absolute',
    right: 0,
    top: -16,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    paddingTop: spacing.sm,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: BAR_WIDTH,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xs,
    minHeight: 20,
  },
  barValue: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: 10,
  },
  barLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  heatmapCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  heatmapContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  heatmapCell: {
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  heatmapBlock: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapValue: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  heatmapLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.text.secondary,
    marginTop: 2,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  legendText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginHorizontal: spacing.xs,
  },
  legendGradient: {
    flexDirection: 'row',
    gap: 2,
  },
  legendBlock: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  calendarCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySuccess: {
    backgroundColor: colors.success + '20',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.info,
  },
  calendarDayText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  calendarDayTextSuccess: {
    color: colors.success,
  },
  checkMark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    fontSize: 12,
    color: colors.success,
  },
  insightsCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  insightIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  insightText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default HydrationTrends;
