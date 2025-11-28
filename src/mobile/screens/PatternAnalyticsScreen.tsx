import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { PatternSuccessChart } from '../components/analytics/PatternSuccessChart';
import { ContextHeatmap } from '../components/analytics/ContextHeatmap';
import { RecommendationCard } from '../components/analytics/RecommendationCard';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import {
  PatternEffectivenessMetrics,
  PatternRecommendation,
  DayOfWeekCorrelation,
  WeatherCorrelation,
  StressCorrelation,
  ScheduleCorrelation,
} from '../types/analytics.types';
import { PatternId } from '../types';

interface PatternAnalyticsScreenProps {
  navigation?: any;
}

// Mock data for demonstration
const mockPatternMetrics: PatternEffectivenessMetrics[] = [
  {
    patternId: 'A',
    patternName: 'Traditional',
    successRate: 82,
    weightChangeAvg: -0.5,
    energyLevelAvg: 75,
    satisfactionScore: 4.2,
    adherenceRate: 88,
    totalDaysUsed: 45,
    currentStreak: 3,
  },
  {
    patternId: 'C',
    patternName: 'Fasting',
    successRate: 78,
    weightChangeAvg: -0.8,
    energyLevelAvg: 72,
    satisfactionScore: 3.8,
    adherenceRate: 75,
    totalDaysUsed: 28,
    currentStreak: 0,
  },
  {
    patternId: 'B',
    patternName: 'Reversed',
    successRate: 65,
    weightChangeAvg: -0.3,
    energyLevelAvg: 68,
    satisfactionScore: 3.5,
    adherenceRate: 70,
    totalDaysUsed: 15,
    currentStreak: 0,
  },
  {
    patternId: 'D',
    patternName: '4 Mini Meals',
    successRate: 58,
    weightChangeAvg: -0.2,
    energyLevelAvg: 80,
    satisfactionScore: 4.0,
    adherenceRate: 60,
    totalDaysUsed: 10,
    currentStreak: 0,
  },
];

const mockDayData: DayOfWeekCorrelation[] = [
  { day: 'monday', bestPattern: 'A', successRate: 85 },
  { day: 'tuesday', bestPattern: 'A', successRate: 82 },
  { day: 'wednesday', bestPattern: 'C', successRate: 78 },
  { day: 'thursday', bestPattern: 'A', successRate: 80 },
  { day: 'friday', bestPattern: 'B', successRate: 70 },
  { day: 'saturday', bestPattern: 'D', successRate: 75 },
  { day: 'sunday', bestPattern: 'C', successRate: 72 },
];

const mockWeatherData: WeatherCorrelation[] = [
  { weather: 'sunny', bestPattern: 'A', successRate: 85 },
  { weather: 'cloudy', bestPattern: 'C', successRate: 78 },
  { weather: 'rainy', bestPattern: 'D', successRate: 70 },
  { weather: 'cold', bestPattern: 'A', successRate: 82 },
  { weather: 'hot', bestPattern: 'C', successRate: 75 },
];

const mockStressData: StressCorrelation[] = [
  { level: 'low', bestPattern: 'C', successRate: 88 },
  { level: 'medium', bestPattern: 'A', successRate: 80 },
  { level: 'high', bestPattern: 'D', successRate: 65 },
];

const mockScheduleData: ScheduleCorrelation[] = [
  { type: 'work', bestPattern: 'A', successRate: 85 },
  { type: 'wfh', bestPattern: 'C', successRate: 82 },
  { type: 'weekend', bestPattern: 'D', successRate: 78 },
  { type: 'travel', bestPattern: 'B', successRate: 60 },
  { type: 'social', bestPattern: 'B', successRate: 55 },
];

const mockRecommendation: PatternRecommendation = {
  recommendedPattern: 'A',
  patternName: 'Traditional',
  confidence: 85,
  reasoning: [
    'Highest success rate on weekdays (85%)',
    'Best adherence during work days (88%)',
    'Consistent energy levels throughout the day',
    'Matches your current schedule type',
  ],
  contextFactors: [
    'Monday',
    'Work day',
    'Medium stress',
    'Sunny weather',
  ],
  fatigueWarning: false,
  consecutiveDays: 3,
  alternativePatterns: ['C', 'D'],
};

export const PatternAnalyticsScreen: React.FC<PatternAnalyticsScreenProps> = ({
  navigation,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<
    'successRate' | 'weightChange' | 'energy' | 'satisfaction'
  >('successRate');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handlePatternSelect = (patternId: PatternId) => {
    // Navigate to pattern switch preview with selected pattern
    navigation?.navigate('PatternSwitchPreview', { patternId });
  };

  const handleAcceptRecommendation = (patternId: PatternId) => {
    // Navigate to pattern switch preview to apply the recommendation
    navigation?.navigate('PatternSwitchPreview', {
      patternId,
      isRecommendation: true,
    });
  };

  const handleOverride = () => {
    // Navigate to dashboard where pattern selector is available
    navigation?.navigate('Dashboard', { showPatternSelector: true });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pattern Analytics</Text>
        <Text style={styles.subtitle}>
          Discover what works best for you
        </Text>
      </View>

      {/* AI Recommendation */}
      <Text style={styles.sectionHeader}>Today's Recommendation</Text>
      <RecommendationCard
        recommendation={mockRecommendation}
        onAccept={handleAcceptRecommendation}
        onOverride={handleOverride}
        onViewAlternatives={() => console.log('View alternatives')}
      />

      {/* Pattern Effectiveness */}
      <Text style={styles.sectionHeader}>Pattern Effectiveness</Text>
      <PatternSuccessChart
        patterns={mockPatternMetrics}
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        onPatternPress={handlePatternSelect}
      />

      {/* Context Correlations */}
      <Text style={styles.sectionHeader}>Context Correlations</Text>
      <ContextHeatmap
        dayOfWeekData={mockDayData}
        weatherData={mockWeatherData}
        stressData={mockStressData}
        scheduleData={mockScheduleData}
        onCellPress={(context, pattern) =>
          console.log('Cell pressed:', context, pattern)
        }
      />

      {/* Insights Summary */}
      <Card variant="outlined" style={styles.insightsCard}>
        <Text style={styles.insightsTitle}>{'\u{1F4A1}'} Key Insights</Text>
        <View style={styles.insightsList}>
          <View style={styles.insightItem}>
            <Text style={styles.insightBullet}>{'\u2022'}</Text>
            <Text style={styles.insightText}>
              <Text style={styles.insightHighlight}>Pattern A (Traditional)</Text> shows
              your highest overall success rate at 82%
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightBullet}>{'\u2022'}</Text>
            <Text style={styles.insightText}>
              <Text style={styles.insightHighlight}>Pattern C (Fasting)</Text> produces
              the best weight loss results (-0.8 lbs/week)
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightBullet}>{'\u2022'}</Text>
            <Text style={styles.insightText}>
              Your success rate drops significantly on <Text style={styles.insightHighlight}>travel days</Text> (60%)
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightBullet}>{'\u2022'}</Text>
            <Text style={styles.insightText}>
              <Text style={styles.insightHighlight}>High stress days</Text> work better
              with grazing patterns (Pattern D)
            </Text>
          </View>
        </View>
      </Card>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>98</Text>
          <Text style={styles.statLabel}>Days Tracked</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>76%</Text>
          <Text style={styles.statLabel}>Avg Adherence</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>-4.2</Text>
          <Text style={styles.statLabel}>lbs Lost</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="Plan Social Event"
          variant="secondary"
          onPress={() => navigation?.navigate('SocialEvent')}
          style={styles.actionButton}
        />
        <Button
          title="View Detailed Reports"
          variant="ghost"
          onPress={() => console.log('View reports')}
          style={styles.actionButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  insightsCard: {
    marginBottom: spacing.md,
  },
  insightsTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  insightsList: {
    gap: spacing.sm,
  },
  insightItem: {
    flexDirection: 'row',
  },
  insightBullet: {
    ...typography.body2,
    color: colors.primary.main,
    marginRight: spacing.sm,
    fontWeight: '700',
  },
  insightText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },
  insightHighlight: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  quickStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.primary.main,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
});

export default PatternAnalyticsScreen;
