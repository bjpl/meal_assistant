import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { ProgressBar } from '../components/base/ProgressBar';
import { WeightChart } from '../components/analytics/WeightChart';
import { AdherenceCalendar } from '../components/analytics/AdherenceCalendar';
import { colors, spacing, typography } from '../utils/theme';
import { WeightEntry, DailyStats, PatternStats, PatternId } from '../types';

// Sample data
const sampleWeightEntries: WeightEntry[] = [
  { date: '2025-11-01', weight: 250 },
  { date: '2025-11-04', weight: 249 },
  { date: '2025-11-07', weight: 248.5 },
  { date: '2025-11-10', weight: 247 },
  { date: '2025-11-14', weight: 246.5 },
  { date: '2025-11-17', weight: 245 },
  { date: '2025-11-20', weight: 244.5 },
  { date: '2025-11-22', weight: 244 },
];

const sampleDailyStats: DailyStats[] = [
  { date: '2025-11-01', patternId: 'A', totalCalories: 1820, totalProtein: 138, mealsLogged: 3, adherenceScore: 95, averageSatisfaction: 4, averageEnergy: 75 },
  { date: '2025-11-02', patternId: 'A', totalCalories: 1750, totalProtein: 142, mealsLogged: 3, adherenceScore: 88, averageSatisfaction: 4, averageEnergy: 70 },
  { date: '2025-11-03', patternId: 'B', totalCalories: 1900, totalProtein: 135, mealsLogged: 3, adherenceScore: 72, averageSatisfaction: 3, averageEnergy: 65 },
  { date: '2025-11-04', patternId: 'C', totalCalories: 1800, totalProtein: 140, mealsLogged: 2, adherenceScore: 90, averageSatisfaction: 4, averageEnergy: 80 },
  { date: '2025-11-05', patternId: 'A', totalCalories: 1850, totalProtein: 136, mealsLogged: 3, adherenceScore: 85, averageSatisfaction: 4, averageEnergy: 72 },
  { date: '2025-11-06', patternId: 'E', totalCalories: 1780, totalProtein: 138, mealsLogged: 5, adherenceScore: 78, averageSatisfaction: 3, averageEnergy: 68 },
  { date: '2025-11-07', patternId: 'A', totalCalories: 1820, totalProtein: 141, mealsLogged: 3, adherenceScore: 92, averageSatisfaction: 5, averageEnergy: 85 },
  { date: '2025-11-10', patternId: 'D', totalCalories: 1750, totalProtein: 155, mealsLogged: 3, adherenceScore: 94, averageSatisfaction: 4, averageEnergy: 78 },
  { date: '2025-11-11', patternId: 'A', totalCalories: 1800, totalProtein: 138, mealsLogged: 3, adherenceScore: 88, averageSatisfaction: 4, averageEnergy: 75 },
  { date: '2025-11-12', patternId: 'A', totalCalories: 1830, totalProtein: 140, mealsLogged: 3, adherenceScore: 91, averageSatisfaction: 4, averageEnergy: 77 },
  { date: '2025-11-15', patternId: 'B', totalCalories: 1790, totalProtein: 142, mealsLogged: 3, adherenceScore: 82, averageSatisfaction: 4, averageEnergy: 72 },
  { date: '2025-11-16', patternId: 'C', totalCalories: 1760, totalProtein: 138, mealsLogged: 2, adherenceScore: 88, averageSatisfaction: 4, averageEnergy: 79 },
  { date: '2025-11-17', patternId: 'A', totalCalories: 1810, totalProtein: 139, mealsLogged: 3, adherenceScore: 93, averageSatisfaction: 5, averageEnergy: 82 },
  { date: '2025-11-18', patternId: 'A', totalCalories: 1780, totalProtein: 141, mealsLogged: 3, adherenceScore: 90, averageSatisfaction: 4, averageEnergy: 76 },
  { date: '2025-11-19', patternId: 'D', totalCalories: 1730, totalProtein: 158, mealsLogged: 3, adherenceScore: 96, averageSatisfaction: 5, averageEnergy: 85 },
  { date: '2025-11-20', patternId: 'A', totalCalories: 1820, totalProtein: 137, mealsLogged: 3, adherenceScore: 89, averageSatisfaction: 4, averageEnergy: 74 },
  { date: '2025-11-21', patternId: 'G', totalCalories: 1850, totalProtein: 135, mealsLogged: 3, adherenceScore: 75, averageSatisfaction: 3, averageEnergy: 70 },
];

const samplePatternStats: PatternStats[] = [
  { patternId: 'A', timesUsed: 12, averageSatisfaction: 4.2, averageEnergy: 76, adherenceRate: 90, lastUsed: '2025-11-20' },
  { patternId: 'B', timesUsed: 3, averageSatisfaction: 3.7, averageEnergy: 69, adherenceRate: 77, lastUsed: '2025-11-15' },
  { patternId: 'C', timesUsed: 2, averageSatisfaction: 4.0, averageEnergy: 80, adherenceRate: 89, lastUsed: '2025-11-16' },
  { patternId: 'D', timesUsed: 2, averageSatisfaction: 4.5, averageEnergy: 82, adherenceRate: 95, lastUsed: '2025-11-19' },
  { patternId: 'E', timesUsed: 1, averageSatisfaction: 3.0, averageEnergy: 68, adherenceRate: 78, lastUsed: '2025-11-06' },
  { patternId: 'G', timesUsed: 1, averageSatisfaction: 3.0, averageEnergy: 70, adherenceRate: 75, lastUsed: '2025-11-21' },
];

export const AnalyticsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  // Calculate summary stats
  const avgCalories = Math.round(
    sampleDailyStats.reduce((sum, s) => sum + s.totalCalories, 0) / sampleDailyStats.length
  );
  const avgProtein = Math.round(
    sampleDailyStats.reduce((sum, s) => sum + s.totalProtein, 0) / sampleDailyStats.length
  );
  const overallAdherence = Math.round(
    sampleDailyStats.reduce((sum, s) => sum + s.adherenceScore, 0) / sampleDailyStats.length
  );

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
            <Text style={styles.summaryValue}>-6 lbs</Text>
            <Text style={styles.summaryLabel}>Weight Change</Text>
            <Badge text="On Track" variant="success" size="small" />
          </Card>
        </ScrollView>

        {/* Weight Chart */}
        <View style={styles.section}>
          <WeightChart
            entries={sampleWeightEntries}
            targetWeight={220}
            startWeight={250}
          />
        </View>

        {/* Adherence Calendar */}
        <View style={styles.section}>
          <AdherenceCalendar
            stats={sampleDailyStats}
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

            {samplePatternStats
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
                Pattern D (Protein Focus) shows your highest satisfaction and adherence.
                Consider using it more often!
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
            <View style={styles.insight}>
              <Text style={styles.insightIcon}>{'\u{1F31F}'}</Text>
              <Text style={styles.insightText}>
                You have lost 6 lbs this month at a healthy rate of 1.5 lbs/week
              </Text>
            </View>
            <View style={styles.insight}>
              <Text style={styles.insightIcon}>{'\u{1F4C8}'}</Text>
              <Text style={styles.insightText}>
                Your protein intake is consistently above target, supporting muscle retention
              </Text>
            </View>
            <View style={styles.insight}>
              <Text style={styles.insightIcon}>{'\u{1F3AF}'}</Text>
              <Text style={styles.insightText}>
                Morning meals have the highest adherence rate (95%)
              </Text>
            </View>
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
});
