import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Badge } from '../components/base/Badge';
import { Input } from '../components/base/Input';
import { EventPlanCard } from '../components/analytics/EventPlanCard';
import { RecoveryPlanCard } from '../components/analytics/RecoveryPlanCard';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import {
  SocialEvent,
  CalorieBankingStrategy,
  RecoveryPlan,
  EventMealType,
  CalorieEstimate,
  CALORIE_ESTIMATES,
  MEAL_TYPE_LABELS,
  BankedMeal,
  RecoveryMeal,
} from '../types/analytics.types';

interface SocialEventScreenProps {
  navigation?: any;
}

const MEAL_TYPES: EventMealType[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'drinks'];
const CALORIE_OPTIONS: CalorieEstimate[] = ['light', 'medium', 'heavy', 'unknown'];

export const SocialEventScreen: React.FC<SocialEventScreenProps> = ({
  navigation,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<'create' | 'plan' | 'recovery'>('create');

  // Event creation state
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [mealType, setMealType] = useState<EventMealType>('dinner');
  const [calorieEstimate, setCalorieEstimate] = useState<CalorieEstimate>('medium');
  const [restaurant, setRestaurant] = useState('');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const estimatedCalories = CALORIE_ESTIMATES[mealType][calorieEstimate];

  const handleCreateEvent = () => {
    // Create the event and generate banking strategy
    setMode('plan');
  };

  // Mock event for demonstration
  const mockEvent: SocialEvent = {
    id: 'event-1',
    name: eventName || 'Dinner with Friends',
    date: eventDate || '2025-11-25',
    time: eventTime || '7:00 PM',
    mealType: mealType,
    estimatedCalories: estimatedCalories,
    calorieEstimateType: calorieEstimate,
    restaurant: restaurant || 'Italian Restaurant',
    nutritionAvailable: false,
  };

  const mockStrategy: CalorieBankingStrategy = {
    eventId: 'event-1',
    eventCalories: estimatedCalories,
    dailyBudget: 1800,
    allocatedToEvent: estimatedCalories,
    otherMeals: [
      {
        mealType: 'morning',
        originalCalories: 400,
        reducedCalories: 320,
        reductionPercent: 20,
        suggestedMeal: 'Greek yogurt with berries',
      },
      {
        mealType: 'noon',
        originalCalories: 850,
        reducedCalories: 680,
        reductionPercent: 20,
        suggestedMeal: 'Large salad with grilled chicken',
      },
    ],
    totalReduction: 250,
    remainingForEvent: 800 + 250, // Base evening calories + banked
    isAchievable: estimatedCalories <= 1050,
    warnings: estimatedCalories > 1050 ? ['Event calories exceed budget. Consider lighter options.'] : [],
  };

  const mockRecoveryPlan: RecoveryPlan = {
    eventId: 'event-1',
    nextDayPattern: 'C',
    patternName: 'Intermittent Fasting',
    suggestedMeals: [
      {
        mealType: 'morning',
        calories: 0,
        protein: 0,
        description: 'Skip breakfast - water, black coffee, or tea only',
        emphasis: 'hydration',
      },
      {
        mealType: 'noon',
        calories: 700,
        protein: 55,
        description: 'Large protein-focused salad with grilled chicken, vegetables, and light dressing',
        emphasis: 'protein',
      },
      {
        mealType: 'evening',
        calories: 600,
        protein: 50,
        description: 'Lean protein with steamed vegetables and small portion of whole grains',
        emphasis: 'fiber',
      },
    ],
    noWeighFor: 48,
    damageControlTips: [
      'Do not restrict calories severely - this can backfire',
      'Focus on high-protein, high-fiber meals to stay satiated',
      'Light activity like a 30-minute walk helps digestion',
      'Avoid the "all or nothing" mentality',
      'Return to your normal pattern by day 2',
    ],
    hydrationGoal: 100,
    activitySuggestion: '30-minute morning walk to aid digestion and boost metabolism',
  };

  const renderCreateMode = () => (
    <View style={styles.createSection}>
      <Card variant="outlined" style={styles.formCard}>
        <Text style={styles.formTitle}>Event Details</Text>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Event Name</Text>
          <TextInput
            style={styles.textInput}
            value={eventName}
            onChangeText={setEventName}
            placeholder="e.g., Birthday Dinner, Work Happy Hour"
            placeholderTextColor={colors.text.disabled}
          />
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formField, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.textInput}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
          <View style={[styles.formField, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Time</Text>
            <TextInput
              style={styles.textInput}
              value={eventTime}
              onChangeText={setEventTime}
              placeholder="7:00 PM"
              placeholderTextColor={colors.text.disabled}
            />
          </View>
        </View>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Meal Type</Text>
          <View style={styles.optionsRow}>
            {MEAL_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  mealType === type && styles.optionButtonActive,
                ]}
                onPress={() => setMealType(type)}
              >
                <Text
                  style={[
                    styles.optionText,
                    mealType === type && styles.optionTextActive,
                  ]}
                >
                  {MEAL_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Expected Portion Size</Text>
          <View style={styles.optionsRow}>
            {CALORIE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  calorieEstimate === option && styles.optionButtonActive,
                ]}
                onPress={() => setCalorieEstimate(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    calorieEstimate === option && styles.optionTextActive,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.caloriePreview}>
            Estimated: ~{estimatedCalories} calories
          </Text>
        </View>

        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Restaurant (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={restaurant}
            onChangeText={setRestaurant}
            placeholder="Restaurant name for menu lookup"
            placeholderTextColor={colors.text.disabled}
          />
        </View>
      </Card>

      {/* Calorie Estimate Guide */}
      <Card variant="filled" style={styles.guideCard}>
        <Text style={styles.guideTitle}>{'\u{1F4CA}'} Calorie Estimation Guide</Text>
        <View style={styles.guideGrid}>
          <View style={styles.guideItem}>
            <Text style={styles.guideLabel}>Light</Text>
            <Text style={styles.guideDesc}>Appetizer-sized, salad, light fare</Text>
          </View>
          <View style={styles.guideItem}>
            <Text style={styles.guideLabel}>Medium</Text>
            <Text style={styles.guideDesc}>Standard entree, moderate portions</Text>
          </View>
          <View style={styles.guideItem}>
            <Text style={styles.guideLabel}>Heavy</Text>
            <Text style={styles.guideDesc}>Multiple courses, dessert, drinks</Text>
          </View>
          <View style={styles.guideItem}>
            <Text style={styles.guideLabel}>Unknown</Text>
            <Text style={styles.guideDesc}>Plan for average (safe estimate)</Text>
          </View>
        </View>
      </Card>

      <Button
        title="Create Event & Plan"
        onPress={handleCreateEvent}
        style={styles.createButton}
        disabled={!eventName && !eventDate}
      />
    </View>
  );

  const renderPlanMode = () => (
    <View style={styles.planSection}>
      <EventPlanCard
        event={mockEvent}
        strategy={mockStrategy}
        onEditEvent={() => setMode('create')}
        onEditStrategy={() => console.log('Edit strategy')}
      />

      <View style={styles.modeActions}>
        <Button
          title="View Recovery Plan"
          variant="secondary"
          onPress={() => setMode('recovery')}
          style={styles.modeButton}
        />
        <Button
          title="Edit Event"
          variant="ghost"
          onPress={() => setMode('create')}
          style={styles.modeButton}
        />
      </View>
    </View>
  );

  const renderRecoveryMode = () => (
    <View style={styles.recoverySection}>
      <RecoveryPlanCard
        plan={mockRecoveryPlan}
        onAcceptPlan={() => {
          console.log('Accept recovery plan');
          navigation?.goBack();
        }}
        onCustomize={() => console.log('Customize plan')}
      />

      <Button
        title="Back to Event Plan"
        variant="ghost"
        onPress={() => setMode('plan')}
        style={styles.backButton}
      />
    </View>
  );

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
        <Text style={styles.title}>Social Event Planning</Text>
        <Text style={styles.subtitle}>
          Plan ahead to enjoy events without derailing progress
        </Text>
      </View>

      {/* Mode Tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'create' && styles.modeTabActive]}
          onPress={() => setMode('create')}
        >
          <Text
            style={[styles.modeTabText, mode === 'create' && styles.modeTabTextActive]}
          >
            Create Event
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'plan' && styles.modeTabActive]}
          onPress={() => setMode('plan')}
        >
          <Text
            style={[styles.modeTabText, mode === 'plan' && styles.modeTabTextActive]}
          >
            Banking Plan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'recovery' && styles.modeTabActive]}
          onPress={() => setMode('recovery')}
        >
          <Text
            style={[styles.modeTabText, mode === 'recovery' && styles.modeTabTextActive]}
          >
            Recovery
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {mode === 'create' && renderCreateMode()}
      {mode === 'plan' && renderPlanMode()}
      {mode === 'recovery' && renderRecoveryMode()}
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
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: colors.primary.main,
  },
  modeTabText: {
    ...typography.body2,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: colors.text.inverse,
  },
  createSection: {},
  formCard: {
    marginBottom: spacing.md,
  },
  formTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  formField: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body1,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  optionButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  optionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  optionTextActive: {
    color: colors.text.inverse,
  },
  caloriePreview: {
    ...typography.body2,
    color: colors.primary.main,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  guideCard: {
    marginBottom: spacing.md,
  },
  guideTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  guideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  guideItem: {
    width: '48%',
  },
  guideLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  guideDesc: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  createButton: {
    width: '100%',
  },
  planSection: {},
  modeActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
  },
  recoverySection: {},
  backButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
});

export default SocialEventScreen;
