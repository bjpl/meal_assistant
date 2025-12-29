import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch } from 'react-redux';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { ProgressBar } from '../components/base/ProgressBar';
import { IconButton } from '../components/base/IconButton';
import { PatternCard } from '../components/patterns/PatternCard';
import { DecisionTreeHelper } from '../components/patterns/DecisionTreeHelper';
import { PatternSwitchModal } from '../components/patterns/PatternSwitchModal';
import { PatternSwitchPreview } from './PatternSwitchPreview';
import { QuickLogWidget } from '../components/hydration/QuickLogWidget';
import { colors, spacing, typography } from '../utils/theme';
import { MealPattern, PatternId } from '../types';
import { createSwitchPreview } from '../utils/patternSwitch';
import { PatternSwitchPreviewData } from '../store/slices/patternsSlice';
import { RootState, AppDispatch } from '../store';
import { fetchPatterns } from '../store/slices/patternsSlice';
import { selectDailyProgress } from '../store/slices/mealsSlice';

type MainTabParamList = {
  Dashboard: undefined;
  Tracking: undefined;
  Kitchen: undefined;
  Stats: undefined;
  More: undefined;
};

export const DashboardScreen: React.FC = () => {
  // Navigation hook
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  // Redux hooks
  const dispatch = useDispatch<AppDispatch>();
  const patterns = useSelector((state: RootState) => state.patterns.patterns);
  const currentPatternId = useSelector((state: RootState) => state.patterns.selectedPattern);
  const loading = useSelector((state: RootState) => state.patterns.loading);
  const dailyProgress = useSelector((state: RootState) => selectDailyProgress(state)) || {
    calories: { consumed: 0, target: 1800 },
    protein: { consumed: 0, target: 135 },
    meals: { logged: 0, total: 3 },
  };

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<PatternId | null>(null);
  const [showDecisionTree, setShowDecisionTree] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showSwitchPreview, setShowSwitchPreview] = useState(false);
  const [switchPreviewData, setSwitchPreviewData] = useState<PatternSwitchPreviewData | null>(null);

  // Load patterns on mount
  useEffect(() => {
    dispatch(fetchPatterns());
  }, [dispatch]);

  // Determine the active pattern (selected or current from Redux)
  const activePatternId = selectedPattern || currentPatternId;
  const todayPattern = patterns.find(p => p.id === activePatternId);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    dispatch(fetchPatterns()).finally(() => {
      setRefreshing(false);
    });
  }, [dispatch]);

  // Pattern switch handlers
  const handleOpenSwitchModal = useCallback(() => {
    setShowSwitchModal(true);
  }, []);

  const handleSelectPatternForSwitch = useCallback((newPattern: MealPattern) => {
    if (!todayPattern) return;

    // Create preview data
    const preview = createSwitchPreview(
      todayPattern,
      newPattern,
      dailyProgress.calories.consumed,
      dailyProgress.protein.consumed,
      true, // inventory check - in production would be from actual inventory state
      []   // missing ingredients - in production would be from inventory check
    );

    setSwitchPreviewData(preview);
    setShowSwitchModal(false);
    setShowSwitchPreview(true);
  }, [todayPattern, dailyProgress]);

  const handleConfirmSwitch = useCallback((reason?: string) => {
    if (!switchPreviewData) return;

    // In production, dispatch to Redux:
    // dispatch(switchPattern({
    //   newPatternId: switchPreviewData.newPattern.id,
    //   reason,
    //   caloriesConsumed: switchPreviewData.caloriesConsumed,
    //   proteinConsumed: switchPreviewData.proteinConsumed,
    //   recalculatedMeals: switchPreviewData.remainingMeals,
    // }));

    // For now, update local state
    setSelectedPattern(switchPreviewData.newPattern.id);
    setShowSwitchPreview(false);
    setSwitchPreviewData(null);

    // Show success feedback
    Alert.alert(
      'Pattern Switched!',
      `You've switched to ${switchPreviewData.newPattern.name}. Your remaining meals have been recalculated.`,
      [{ text: 'OK' }]
    );
  }, [switchPreviewData]);

  const handleCancelSwitch = useCallback(() => {
    setShowSwitchPreview(false);
    setSwitchPreviewData(null);
  }, []);

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('en-US', options);
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
          <View>
            <Text style={styles.greeting}>Good Morning</Text>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              icon={'\u{1F504}'}
              onPress={handleOpenSwitchModal}
              variant="ghost"
            />
            <IconButton
              icon={'\u2699'}
              onPress={() => navigation.navigate('More')}
              variant="ghost"
            />
          </View>
        </View>

        {/* Today's Summary Card */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Today's Progress</Text>
            <Badge
              text={`Pattern ${activePatternId || 'A'}`}
              customColor={colors.patterns[activePatternId || 'A']}
            />
          </View>

          <View style={styles.progressSection}>
            <ProgressBar
              progress={(dailyProgress.calories.consumed / dailyProgress.calories.target) * 100}
              label="Calories"
              showPercentage
              color={colors.primary.main}
            />
            <Text style={styles.progressDetail}>
              {dailyProgress.calories.consumed} / {dailyProgress.calories.target} cal
            </Text>
          </View>

          <View style={styles.progressSection}>
            <ProgressBar
              progress={(dailyProgress.protein.consumed / dailyProgress.protein.target) * 100}
              label="Protein"
              showPercentage
              color={colors.secondary.main}
            />
            <Text style={styles.progressDetail}>
              {dailyProgress.protein.consumed}g / {dailyProgress.protein.target}g
            </Text>
          </View>

          <View style={styles.mealStatus}>
            <Text style={styles.mealStatusLabel}>Meals Logged</Text>
            <View style={styles.mealDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.mealDot,
                    i < dailyProgress.meals.logged && styles.mealDotFilled,
                  ]}
                />
              ))}
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="Log Meal"
            onPress={() => navigation.navigate('Tracking')}
            icon={<Text style={styles.buttonIcon}>{'\u{1F4F7}'}</Text>}
            style={styles.actionButton}
          />
          <Button
            title="Decision Helper"
            onPress={() => setShowDecisionTree(true)}
            variant="secondary"
            icon={<Text style={styles.buttonIcon}>{'\u2753'}</Text>}
            style={styles.actionButton}
          />
        </View>

        {/* Hydration Quick Log Widget */}
        <View style={styles.section}>
          <QuickLogWidget style={styles.hydrationWidget} />
        </View>

        {/* Today's Meals Preview */}
        {todayPattern && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            <Card variant="outlined" style={styles.mealsCard}>
              {(['morning', 'noon', 'evening'] as const).map((meal, index) => (
                <View key={meal}>
                  <View style={styles.mealRow}>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName}>
                        {meal.charAt(0).toUpperCase() + meal.slice(1)}
                      </Text>
                      <Text style={styles.mealTime}>
                        {todayPattern.meals[meal]?.time}
                      </Text>
                    </View>
                    <View style={styles.mealNutrition}>
                      <Text style={styles.mealCalories}>
                        {todayPattern.meals[meal]?.calories} cal
                      </Text>
                      <Text style={styles.mealProtein}>
                        {todayPattern.meals[meal]?.protein}g protein
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.mealIndicator,
                        index < dailyProgress.meals.logged && styles.mealIndicatorDone,
                      ]}
                    >
                      <Text style={styles.mealIndicatorText}>
                        {index < dailyProgress.meals.logged ? '\u2713' : ''}
                      </Text>
                    </View>
                  </View>
                  {index < 2 && <View style={styles.mealDivider} />}
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Pattern Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Pattern Switch</Text>
            <Button
              title="View All"
              onPress={handleOpenSwitchModal}
              variant="ghost"
              size="small"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {patterns.map((pattern) => (
              <Card
                key={pattern.id}
                onPress={() => setSelectedPattern(pattern.id)}
                accentColor={colors.patterns[pattern.id]}
                style={StyleSheet.flatten([
                  styles.miniPatternCard,
                  activePatternId === pattern.id && styles.miniPatternCardSelected,
                ])}
              >
                <Text
                  style={[
                    styles.miniPatternLetter,
                    { color: colors.patterns[pattern.id] },
                  ]}
                >
                  {pattern.id}
                </Text>
                <Text style={styles.miniPatternName}>{pattern.name}</Text>
                <Text style={styles.miniPatternCalories}>
                  {pattern.totalCalories} cal
                </Text>
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Card variant="filled" style={styles.activityCard}>
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>{'\u{1F37D}'}</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Lunch logged</Text>
                <Text style={styles.activityTime}>2 hours ago</Text>
              </View>
              <Text style={styles.activityValue}>850 cal</Text>
            </View>
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>{'\u2600}'}</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Breakfast logged</Text>
                <Text style={styles.activityTime}>6 hours ago</Text>
              </View>
              <Text style={styles.activityValue}>400 cal</Text>
            </View>
          </Card>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Decision Tree Modal */}
      <Modal
        visible={showDecisionTree}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <DecisionTreeHelper
            onPatternSelected={(patternId) => {
              setSelectedPattern(patternId);
              setShowDecisionTree(false);
            }}
            onClose={() => setShowDecisionTree(false)}
          />
        </View>
      </Modal>

      {/* Pattern Switch Modal - Tap 1 */}
      <Modal
        visible={showSwitchModal}
        animationType="slide"
        transparent={true}
      >
        {todayPattern && (
          <PatternSwitchModal
            visible={showSwitchModal}
            currentPattern={todayPattern}
            patterns={patterns}
            caloriesConsumed={dailyProgress.calories.consumed}
            proteinConsumed={dailyProgress.protein.consumed}
            onSelectPattern={handleSelectPatternForSwitch}
            onClose={() => setShowSwitchModal(false)}
          />
        )}
      </Modal>

      {/* Pattern Switch Preview - Tap 2 (Confirm) */}
      <Modal
        visible={showSwitchPreview}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {switchPreviewData && (
          <PatternSwitchPreview
            previewData={switchPreviewData}
            onConfirm={handleConfirmSwitch}
            onCancel={handleCancelSwitch}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  greeting: {
    ...typography.h2,
    color: colors.text.primary,
  },
  date: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  summaryCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressDetail: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  mealStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  mealStatusLabel: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  mealDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  mealDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border.light,
  },
  mealDotFilled: {
    backgroundColor: colors.success,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  mealsCard: {
    marginHorizontal: spacing.md,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mealTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealNutrition: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  mealCalories: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  mealProtein: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  mealIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealIndicatorDone: {
    backgroundColor: colors.success,
  },
  mealIndicatorText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  mealDivider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  miniPatternCard: {
    width: 100,
    alignItems: 'center',
    padding: spacing.md,
    marginLeft: spacing.md,
    marginRight: spacing.xs,
  },
  miniPatternCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  miniPatternLetter: {
    fontSize: 24,
    fontWeight: '700',
  },
  miniPatternName: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  miniPatternCalories: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  activityCard: {
    marginHorizontal: spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...typography.body2,
    color: colors.text.primary,
  },
  activityTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  activityValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  hydrationWidget: {
    marginHorizontal: spacing.md,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
});
