import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { Button } from '../../components/base/Button';
import { Card } from '../../components/base/Card';
import {
  setFirstWeekPlan,
  completeOnboarding,
  goToPreviousStep,
  selectOnboarding,
  selectCalculatedTargets,
  useQuickStart,
} from '../../store/slices/onboardingSlice';
import { selectPatterns } from '../../store/slices/patternsSlice';
import { completeOnboarding as completeUserOnboarding, setPreferences } from '../../store/slices/userSlice';
import { WeekPlan, DayPlan, PlannedMeal } from '../../types/onboarding.types';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

interface FirstWeekScreenProps {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'FirstWeek'>;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DayCardProps {
  day: DayPlan;
  patternColor: string;
}

const DayCard: React.FC<DayCardProps> = ({ day, patternColor }) => (
  <Card variant="outlined" style={styles.dayCard}>
    <View style={styles.dayHeader}>
      <Text style={styles.dayName}>{day.dayName}</Text>
      <View style={[styles.patternBadge, { backgroundColor: patternColor }]}>
        <Text style={styles.patternBadgeText}>Pattern {day.patternId}</Text>
      </View>
    </View>
    <View style={styles.mealsList}>
      {day.meals.map((meal, index) => (
        <View key={index} style={styles.mealItem}>
          <Text style={styles.mealTime}>{meal.time}</Text>
          <View style={styles.mealInfo}>
            <Text style={styles.mealType}>{meal.description}</Text>
            <Text style={styles.mealStats}>{meal.calories} cal | {meal.protein}g protein</Text>
          </View>
        </View>
      ))}
    </View>
  </Card>
);

export const FirstWeekScreen: React.FC<FirstWeekScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const onboarding = useSelector(selectOnboarding);
  const targets = useSelector(selectCalculatedTargets);
  const patterns = useSelector(selectPatterns);

  const selectedPattern = useMemo(() => {
    return patterns.find(p => p.id === onboarding.selectedPattern);
  }, [patterns, onboarding.selectedPattern]);

  const patternColor = colors.patterns[onboarding.selectedPattern as keyof typeof colors.patterns] || colors.primary.main;

  // Generate first week plan
  const firstWeekPlan = useMemo((): WeekPlan => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday

    const days: DayPlan[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayName = DAY_NAMES[date.getDay()];

      // Use selected pattern for weekdays, maybe Traditional for weekends
      const usePattern = selectedPattern || patterns[0];

      const meals: PlannedMeal[] = [];

      // Calculate pattern's total baseline calories and protein for proper scaling
      const patternTotalCalories =
        (usePattern.meals.morning?.calories || 0) +
        (usePattern.meals.noon?.calories || 0) +
        (usePattern.meals.evening?.calories || 0);
      const patternTotalProtein =
        (usePattern.meals.morning?.protein || 0) +
        (usePattern.meals.noon?.protein || 0) +
        (usePattern.meals.evening?.protein || 0);

      // Skip breakfast if user selected "Skip" in schedule
      const breakfastTime = onboarding.mealTimes.breakfast;
      const skipBreakfast = breakfastTime === 'Skip';

      if (usePattern.meals.morning && usePattern.meals.morning.calories > 0 && !skipBreakfast) {
        meals.push({
          type: 'morning',
          time: breakfastTime || '07:30',
          calories: Math.round((usePattern.meals.morning.calories / patternTotalCalories) * targets.dailyCalories),
          protein: Math.round((usePattern.meals.morning.protein / patternTotalProtein) * targets.dailyProtein),
          description: 'Breakfast',
        });
      }

      if (usePattern.meals.noon) {
        // For Pattern E (Platter), handle the combined noon meal
        const isPlatterPattern = usePattern.id === 'E';
        meals.push({
          type: 'noon',
          time: onboarding.mealTimes.lunch || '12:00',
          calories: Math.round((usePattern.meals.noon.calories / patternTotalCalories) * targets.dailyCalories),
          protein: Math.round((usePattern.meals.noon.protein / patternTotalProtein) * targets.dailyProtein),
          description: isPlatterPattern ? 'Lunch Platter' : 'Lunch',
        });
      }

      if (usePattern.meals.evening) {
        // For Pattern E (Platter), handle the combined evening meal
        const isPlatterPattern = usePattern.id === 'E';
        meals.push({
          type: 'evening',
          time: onboarding.mealTimes.dinner || '18:30',
          calories: Math.round((usePattern.meals.evening.calories / patternTotalCalories) * targets.dailyCalories),
          protein: Math.round((usePattern.meals.evening.protein / patternTotalProtein) * targets.dailyProtein),
          description: isPlatterPattern ? 'Dinner Platter' : 'Dinner',
        });
      }

      days.push({
        date: date.toISOString().split('T')[0],
        dayName,
        patternId: onboarding.selectedPattern,
        meals,
      });
    }

    return {
      weekOf: startOfWeek.toISOString().split('T')[0],
      days,
      totalCalories: targets.dailyCalories * 7,
      estimatedGroceryCost: 85, // Estimate
    };
  }, [selectedPattern, targets, onboarding, patterns]);

  const handleStartJourney = () => {
    // Save first week plan
    dispatch(setFirstWeekPlan(firstWeekPlan));

    // Update user preferences with onboarding data
    dispatch(setPreferences({
      targetCalories: targets.dailyCalories,
      targetProtein: targets.dailyProtein,
      primaryPattern: onboarding.selectedPattern,
      mealReminders: {
        morning: onboarding.mealTimes.breakfast,
        noon: onboarding.mealTimes.lunch,
        evening: onboarding.mealTimes.dinner,
      },
    }));

    // Complete onboarding in both slices
    dispatch(completeOnboarding());
    dispatch(completeUserOnboarding());
  };

  const handleBack = () => {
    dispatch(goToPreviousStep());
    navigation.goBack();
  };

  const handleQuickStart = () => {
    dispatch(useQuickStart());
    dispatch(completeOnboarding());
    dispatch(completeUserOnboarding());
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your First Week</Text>
          <Text style={styles.subtitle}>
            Here is your personalized plan based on your preferences
          </Text>
        </View>

        {/* Summary Card */}
        <Card variant="filled" style={StyleSheet.flatten([styles.summaryCard, { backgroundColor: `${patternColor}20` }])}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: patternColor }]}>
                {targets.dailyCalories}
              </Text>
              <Text style={styles.summaryLabel}>Daily Calories</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: patternColor }]}>
                {targets.dailyProtein}g
              </Text>
              <Text style={styles.summaryLabel}>Daily Protein</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: patternColor }]}>
                {selectedPattern?.name}
              </Text>
              <Text style={styles.summaryLabel}>Pattern</Text>
            </View>
          </View>
        </Card>

        {/* Week Preview */}
        <View style={styles.weekSection}>
          <Text style={styles.sectionTitle}>Week Schedule Preview</Text>
          {firstWeekPlan.days.map((day, index) => (
            <DayCard key={index} day={day} patternColor={patternColor} />
          ))}
        </View>

        {/* Shopping List Preview */}
        <Card variant="outlined" style={styles.shoppingCard}>
          <View style={styles.shoppingHeader}>
            <Text style={styles.shoppingIcon}>{'\u{1F6D2}'}</Text>
            <View>
              <Text style={styles.shoppingTitle}>Shopping List Ready</Text>
              <Text style={styles.shoppingSubtitle}>
                Estimated cost: ${firstWeekPlan.estimatedGroceryCost}
              </Text>
            </View>
          </View>
          <Text style={styles.shoppingHint}>
            Your personalized shopping list will be generated after you start
          </Text>
        </Card>

        {/* Tips Card */}
        <Card variant="filled" style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips for Success</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>{'\u{2705}'}</Text>
            <Text style={styles.tipText}>Log your meals daily for best results</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>{'\u{2705}'}</Text>
            <Text style={styles.tipText}>Use the pattern switch feature when plans change</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>{'\u{2705}'}</Text>
            <Text style={styles.tipText}>Track your satisfaction to find what works</Text>
          </View>
        </Card>

        {/* Start Button */}
        <Button
          title="Start Your Journey"
          onPress={handleStartJourney}
          size="large"
          fullWidth
          style={StyleSheet.flatten([styles.startButton, { backgroundColor: patternColor }])}
        />

        {/* Quick Start Alternative */}
        <TouchableOpacity
          style={styles.quickStartContainer}
          onPress={handleQuickStart}
        >
          <Text style={styles.quickStartText}>
            Just want to explore? Use defaults and customize later
          </Text>
        </TouchableOpacity>

        {/* Back Button */}
        <Button
          title="Back to edit preferences"
          onPress={handleBack}
          variant="ghost"
          size="medium"
          fullWidth
          style={styles.backButton}
        />

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>
          <Text style={styles.progressText}>Step 6 of 6 - Ready to start!</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  summaryCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    ...typography.h2,
    fontWeight: '700',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  weekSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  dayCard: {
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dayName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  patternBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  patternBadgeText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  mealsList: {
    gap: spacing.xs,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTime: {
    ...typography.caption,
    color: colors.text.secondary,
    width: 50,
  },
  mealInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mealType: {
    ...typography.caption,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  mealStats: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  shoppingCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  shoppingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  shoppingIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  shoppingTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  shoppingSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  shoppingHint: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  tipsCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.background.secondary,
  },
  tipsTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tipIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  tipText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
  },
  startButton: {
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  quickStartContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  quickStartText: {
    ...typography.caption,
    color: colors.primary.main,
    textDecorationLine: 'underline',
  },
  backButton: {
    marginTop: spacing.sm,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
  },
  dotActive: {
    backgroundColor: colors.primary.main,
    width: 24,
  },
  dotCompleted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  progressText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});

export default FirstWeekScreen;
