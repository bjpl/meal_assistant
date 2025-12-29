import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { ProgressBar } from '../components/base/ProgressBar';
import { WeightChart } from '../components/analytics/WeightChart';
import { AdherenceCalendar } from '../components/analytics/AdherenceCalendar';
import { colors, spacing, typography } from '../utils/theme';
import { PatternId, DailyStats, PatternStats, WeightEntry } from '../types';
import { RootState, AppDispatch } from '../store';
import {
  fetchPatternStats,
  fetchWeightTrend,
  fetchAdherenceStats,
  selectWeightEntries,
  selectTargetWeight,
  selectPatternEffectiveness,
  selectWeightTrend,
  selectBestPattern,
} from '../store/slices/analyticsSlice';
import { selectDailyStats } from '../store/slices/mealsSlice';

export const AnalyticsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const weightEntries = useSelector(selectWeightEntries);
  const targetWeight = useSelector(selectTargetWeight) || 220;
  const patternEffectiveness = useSelector(selectPatternEffectiveness);
  const weightTrend = useSelector(selectWeightTrend);
  const bestPattern = useSelector(selectBestPattern);
  const dailyStats = useSelector((state: RootState) => state.analytics.dailyStats);
  const loading = useSelector((state: RootState) => state.analytics.loading);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');

  // Fetch data on mount
  useEffect(() => {
    dispatch(fetchPatternStats(30));
    dispatch(fetchWeightTrend());
    dispatch(fetchAdherenceStats(undefined));
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchPatternStats(30)),
      dispatch(fetchWeightTrend()),
      dispatch(fetchAdherenceStats(undefined)),
    ]);
    setRefreshing(false);
  };

  // Convert pattern effectiveness to PatternStats format for display
  const patternStats: PatternStats[] = patternEffectiveness.map(pe => ({
    patternId: pe.patternId,
    timesUsed: pe.totalDaysUsed,
    averageSatisfaction: pe.satisfactionScore,
    averageEnergy: pe.energyLevelAvg,
    adherenceRate: Math.round(pe.adherenceRate),
    lastUsed: new Date().toISOString().split('T')[0], // Fallback - not in type
  }));

  // Use sample data as fallback if no Redux data
  const displayWeightEntries = weightEntries.length > 0 ? weightEntries : [
    { date: new Date().toISOString().split('T')[0], weight: 250 },
  ];

  const displayDailyStats = dailyStats.length > 0 ? dailyStats : [];
  const displayPatternStats = patternStats.length > 0 ? patternStats : [];

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  // Calculate summary stats from Redux data
  const avgCalories = displayDailyStats.length > 0
    ? Math.round(displayDailyStats.reduce((sum, s) => sum + s.totalCalories, 0) / displayDailyStats.length)
    : 0;
  const avgProtein = displayDailyStats.length > 0
    ? Math.round(displayDailyStats.reduce((sum, s) => sum + s.totalProtein, 0) / displayDailyStats.length)
    : 0;
  const overallAdherence = displayDailyStats.length > 0
    ? Math.round(displayDailyStats.reduce((sum, s) => sum + s.adherenceScore, 0) / displayDailyStats.length)
    : 0;

  // Calculate weight change from Redux data
  const weightChange = weightTrend ? weightTrend.change.toFixed(1) : '0';
  const startWeight = displayWeightEntries.length > 0 ? displayWeightEntries[displayWeightEntries.length - 1].weight : 250;

  const getPatternName = (id: PatternId): string => {
    const names: Record<PatternId, string> = {
      A: 'Traditional',
      B: 'Reversed',
      C: 'Fasting',
      D: 'Protein Focus',
      E: 'Grazing',
      F: 'OMAD',
      G: 'Flexible',
    };
    return names[id];
  };

  if (loading && displayWeightEntries.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Track your progress and patterns</Text>
        </View>

        {/* Time Frame Selector */}
        <View style={styles.timeframeSelector}>
          {(['week', 'month', 'all'] as const).map((tf) => (
            <Button
              key={tf}
              title={tf.charAt(0).toUpperCase() + tf.slice(1)}
              onPress={() => setTimeframe(tf)}
              variant={timeframe === tf ? 'primary' : 'ghost'}
              size="small"
              style={styles.timeframeButton}
            />
          ))}
        </View>

        {/* Summary Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.summaryScroll}
        >
          <Card variant="elevated" style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>{'\u{1F525}'}</Text>
            <Text style={styles.summaryValue}>{avgCalories}</Text>
            <Text style={styles.summaryLabel}>Avg Calories</Text>
            <Badge
              text={avgCalories <= 1850 ? 'On Target' : 'Over'}
              variant={avgCalories <= 1850 ? 'success' : 'warning'}
              size="small"
            />
          </Card>

          <Card variant="elevated" style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>{'\u{1F4AA}'}</Text>
            <Text style={styles.summaryValue}>{avgProtein}g</Text>
            <Text style={styles.summaryLabel}>Avg Protein</Text>
            <Badge
              text={avgProtein >= 130 ? 'On Target' : 'Low'}
              variant={avgProtein >= 130 ? 'success' : 'warning'}
              size="small"
            />
          </Card>

          <Card variant="elevated" style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>{'\u2713'}</Text>
            <Text style={styles.summaryValue}>{overallAdherence}%</Text>
            <Text style={styles.summaryLabel}>Adherence</Text>
            <Badge
              text={overallAdherence >= 85 ? 'Great' : 'Good'}
              variant={overallAdherence >= 85 ? 'success' : 'info'}
              size="small"
            />
          </Card>

          <Card variant="elevated" style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>{'\u{2696}'}</Text>
            <Text style={styles.summaryValue}>{weightChange} lbs</Text>
            <Text style={styles.summaryLabel}>Weight Change</Text>
            <Badge
              text={parseFloat(weightChange) <= 0 ? 'On Track' : 'Gaining'}
              variant={parseFloat(weightChange) <= 0 ? 'success' : 'warning'}
              size="small"
            />
          </Card>
        </ScrollView>

        {/* Weight Chart */}
        <View style={styles.section}>
          <WeightChart
            entries={displayWeightEntries}
            targetWeight={targetWeight}
            startWeight={startWeight}
          />
        </View>

        {/* Adherence Calendar */}
        <View style={styles.section}>
          <AdherenceCalendar
            stats={displayDailyStats}
            month={selectedMonth}
            onDayPress={(date) => console.log('Day pressed:', date)}
            onMonthChange={handleMonthChange}
          />
        </View>

        {/* Pattern Effectiveness */}
        <View style={styles.section}>
          <Card variant="outlined" style={styles.patternCard}>
            <Text style={styles.sectionTitle}>Pattern Effectiveness</Text>
            <Text style={styles.sectionSubtitle}>
              Which patterns work best for you
            </Text>

            {displayPatternStats
              .sort((a, b) => b.adherenceRate - a.adherenceRate)
              .map((stat) => (
                <View key={stat.patternId} style={styles.patternRow}>
                  <View style={styles.patternInfo}>
                    <View
                      style={[
                        styles.patternDot,
                        { backgroundColor: colors.patterns[stat.patternId as PatternId] },
                      ]}
                    />
                    <View>
                      <Text style={styles.patternName}>
                        Pattern {stat.patternId}: {getPatternName(stat.patternId as PatternId)}
                      </Text>
                      <Text style={styles.patternMeta}>
                        Used {stat.timesUsed} times
                      </Text>
                    </View>
                  </View>
                  <View style={styles.patternStats}>
                    <View style={styles.patternStatItem}>
                      <Text style={styles.patternStatValue}>
                        {stat.averageSatisfaction.toFixed(1)}
                      </Text>
                      <Text style={styles.patternStatLabel}>{'\u2605'}</Text>
                    </View>
                    <View style={styles.patternStatItem}>
                      <Text style={styles.patternStatValue}>
                        {stat.adherenceRate}%
                      </Text>
                      <Text style={styles.patternStatLabel}>adh</Text>
                    </View>
                  </View>
                </View>
              ))}

            <View style={styles.recommendation}>
              <Text style={styles.recommendationIcon}>{'\u{1F4A1}'}</Text>
              <Text style={styles.recommendationText}>
                {bestPattern
                  ? `Pattern ${bestPattern.patternId} (${getPatternName(bestPattern.patternId)}) shows your highest satisfaction and adherence. Consider using it more often!`
                  : 'Log more meals to discover which patterns work best for you!'}
              </Text>
            </View>
          </Card>
        </View>

        {/* Energy & Satisfaction Trends */}
        <View style={styles.section}>
          <Card variant="outlined" style={styles.trendsCard}>
            <Text style={styles.sectionTitle}>Weekly Trends</Text>

            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Energy Level</Text>
              <ProgressBar
                progress={76}
                showPercentage
                color={colors.secondary.main}
                height={8}
                style={{ flex: 1, marginLeft: spacing.md }}
              />
            </View>

            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Satisfaction</Text>
              <ProgressBar
                progress={82}
                showPercentage
                color={colors.success}
                height={8}
                style={{ flex: 1, marginLeft: spacing.md }}
              />
            </View>

            <View style={styles.trendRow}>
              <Text style={styles.trendLabel}>Meal Logging</Text>
              <ProgressBar
                progress={94}
                showPercentage
                color={colors.info}
                height={8}
                style={{ flex: 1, marginLeft: spacing.md }}
              />
            </View>
          </Card>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Card variant="filled" style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>Insights</Text>
            {weightTrend && parseFloat(weightChange) !== 0 && (
              <View style={styles.insight}>
                <Text style={styles.insightIcon}>{'\u{1F31F}'}</Text>
                <Text style={styles.insightText}>
                  {parseFloat(weightChange) < 0
                    ? `You have lost ${Math.abs(parseFloat(weightChange))} lbs this month`
                    : `You have gained ${weightChange} lbs this month`}
                </Text>
              </View>
            )}
            {avgProtein >= 130 && (
              <View style={styles.insight}>
                <Text style={styles.insightIcon}>{'\u{1F4C8}'}</Text>
                <Text style={styles.insightText}>
                  Your protein intake is consistently above target, supporting muscle retention
                </Text>
              </View>
            )}
            {bestPattern && (
              <View style={styles.insight}>
                <Text style={styles.insightIcon}>{'\u{1F3AF}'}</Text>
                <Text style={styles.insightText}>
                  Pattern {bestPattern.patternId} ({getPatternName(bestPattern.patternId)}) has your highest success rate
                </Text>
              </View>
            )}
            {displayDailyStats.length === 0 && (
              <View style={styles.insight}>
                <Text style={styles.insightIcon}>{'\u{1F4A1}'}</Text>
                <Text style={styles.insightText}>
                  Start logging meals to see personalized insights about your nutrition patterns
                </Text>
              </View>
            )}
          </Card>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  timeframeSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  timeframeButton: {
    marginRight: spacing.xs,
  },
  summaryScroll: {
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    width: 130,
    alignItems: 'center',
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  summaryIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.text.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  patternCard: {
    marginBottom: spacing.md,
  },
  patternRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  patternInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patternDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  patternName: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  patternMeta: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  patternStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  patternStatItem: {
    alignItems: 'center',
  },
  patternStatValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patternStatLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.info + '10',
    borderRadius: spacing.sm,
  },
  recommendationIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  recommendationText: {
    ...typography.body2,
    color: colors.info,
    flex: 1,
  },
  trendsCard: {
    marginBottom: spacing.md,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trendLabel: {
    ...typography.body2,
    color: colors.text.secondary,
    width: 100,
  },
  insightsCard: {
    marginBottom: spacing.md,
  },
  insightsTitle: {
    ...typography.h3,
    color: colors.text.primary,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});
