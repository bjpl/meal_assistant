import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { Button } from '../../components/base/Button';
import { Card } from '../../components/base/Card';
import {
  updateMealTimes,
  goToNextStep,
  goToPreviousStep,
  skipOnboarding,
  selectOnboarding,
} from '../../store/slices/onboardingSlice';
import {
  WorkSchedule,
  WorkoutTiming,
  WORK_SCHEDULE_LABELS,
  WORKOUT_TIMING_LABELS,
} from '../../types/onboarding.types';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

interface ScheduleScreenProps {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Schedule'>;
}

interface TimeButtonProps {
  time: string;
  selected: boolean;
  onSelect: () => void;
}

const TimeButton: React.FC<TimeButtonProps> = ({ time, selected, onSelect }) => (
  <TouchableOpacity
    style={[styles.timeButton, selected && styles.timeButtonSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <Text style={[styles.timeButtonText, selected && styles.timeButtonTextSelected]}>
      {time}
    </Text>
  </TouchableOpacity>
);

interface OptionButtonProps {
  label: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}

const OptionButton: React.FC<OptionButtonProps> = ({ label, icon, selected, onSelect }) => (
  <TouchableOpacity
    style={[styles.optionButton, selected && styles.optionButtonSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <Text style={styles.optionIcon}>{icon}</Text>
    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const BREAKFAST_TIMES = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', 'Skip'];
const LUNCH_TIMES = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];
const DINNER_TIMES = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];

const SCHEDULE_OPTIONS: { value: WorkSchedule; label: string; icon: string }[] = [
  { value: '9to5', label: '9-5 Office', icon: '\u{1F3E2}' },
  { value: 'shift', label: 'Shift Work', icon: '\u{1F3ED}' },
  { value: 'flexible', label: 'Flexible', icon: '\u{23F0}' },
  { value: 'remote', label: 'Work from Home', icon: '\u{1F3E0}' },
];

const WORKOUT_OPTIONS: { value: WorkoutTiming; label: string; icon: string }[] = [
  { value: 'morning', label: 'Morning', icon: '\u{1F305}' },
  { value: 'afternoon', label: 'Afternoon', icon: '\u{2600}' },
  { value: 'evening', label: 'Evening', icon: '\u{1F307}' },
  { value: 'none', label: 'No Workouts', icon: '\u{1F6CB}' },
];

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const onboarding = useSelector(selectOnboarding);
  const [mealTimes, setMealTimes] = useState(onboarding.mealTimes);

  const handleTimeSelect = (meal: 'breakfast' | 'lunch' | 'dinner', time: string) => {
    const updated = { ...mealTimes, [meal]: time };
    setMealTimes(updated);
    dispatch(updateMealTimes({ [meal]: time }));
  };

  const handleScheduleSelect = (schedule: WorkSchedule) => {
    const updated = { ...mealTimes, workSchedule: schedule };
    setMealTimes(updated);
    dispatch(updateMealTimes({ workSchedule: schedule }));

    // Auto-adjust meal times based on schedule
    if (schedule === 'shift') {
      const updatedWithTimes = {
        ...updated,
        breakfast: '05:00',
        lunch: '11:00',
        dinner: '18:00',
      };
      setMealTimes(updatedWithTimes);
      dispatch(updateMealTimes({
        breakfast: '05:00',
        lunch: '11:00',
        dinner: '18:00',
      }));
    } else if (schedule === 'remote') {
      const updatedWithTimes = {
        ...updated,
        breakfast: '08:00',
        lunch: '12:30',
        dinner: '19:00',
      };
      setMealTimes(updatedWithTimes);
      dispatch(updateMealTimes({
        breakfast: '08:00',
        lunch: '12:30',
        dinner: '19:00',
      }));
    } else if (schedule === '9to5') {
      const updatedWithTimes = {
        ...updated,
        breakfast: '07:00',
        lunch: '12:00',
        dinner: '18:30',
      };
      setMealTimes(updatedWithTimes);
      dispatch(updateMealTimes({
        breakfast: '07:00',
        lunch: '12:00',
        dinner: '18:30',
      }));
    } else if (schedule === 'flexible') {
      const updatedWithTimes = {
        ...updated,
        breakfast: '08:30',
        lunch: '13:00',
        dinner: '19:30',
      };
      setMealTimes(updatedWithTimes);
      dispatch(updateMealTimes({
        breakfast: '08:30',
        lunch: '13:00',
        dinner: '19:30',
      }));
    }
  };

  const handleWorkoutSelect = (timing: WorkoutTiming) => {
    const updated = { ...mealTimes, workoutTiming: timing };
    setMealTimes(updated);
    dispatch(updateMealTimes({ workoutTiming: timing }));
  };

  const handleNext = () => {
    dispatch(goToNextStep());
    navigation.navigate('Stores');
  };

  const handleBack = () => {
    dispatch(goToPreviousStep());
    navigation.goBack();
  };

  const handleSkip = () => {
    dispatch(skipOnboarding());
  };

  const formatTime = (time: string) => {
    if (time === 'Skip') return 'Skip';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Schedule</Text>
          <Text style={styles.subtitle}>
            Set your typical meal times. We will use these for reminders.
          </Text>
        </View>

        {/* Work Schedule */}
        <Card variant="outlined" style={styles.card}>
          <Text style={styles.cardTitle}>Work Schedule</Text>
          <View style={styles.optionsGrid}>
            {SCHEDULE_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={mealTimes.workSchedule === option.value}
                onSelect={() => handleScheduleSelect(option.value)}
              />
            ))}
          </View>
        </Card>

        {/* Breakfast Time */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealIcon}>{'\u{1F373}'}</Text>
            <View>
              <Text style={styles.cardTitle}>Breakfast</Text>
              <Text style={styles.selectedTime}>
                {mealTimes.breakfast === 'Skip' ? 'Skipped' : formatTime(mealTimes.breakfast)}
              </Text>
            </View>
          </View>
          <View style={styles.timeGrid}>
            {BREAKFAST_TIMES.map((time) => (
              <TimeButton
                key={time}
                time={time === 'Skip' ? 'Skip' : formatTime(time)}
                selected={mealTimes.breakfast === time}
                onSelect={() => handleTimeSelect('breakfast', time)}
              />
            ))}
          </View>
        </Card>

        {/* Lunch Time */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealIcon}>{'\u{1F96A}'}</Text>
            <View>
              <Text style={styles.cardTitle}>Lunch</Text>
              <Text style={styles.selectedTime}>{formatTime(mealTimes.lunch)}</Text>
            </View>
          </View>
          <View style={styles.timeGrid}>
            {LUNCH_TIMES.map((time) => (
              <TimeButton
                key={time}
                time={formatTime(time)}
                selected={mealTimes.lunch === time}
                onSelect={() => handleTimeSelect('lunch', time)}
              />
            ))}
          </View>
        </Card>

        {/* Dinner Time */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealIcon}>{'\u{1F35D}'}</Text>
            <View>
              <Text style={styles.cardTitle}>Dinner</Text>
              <Text style={styles.selectedTime}>{formatTime(mealTimes.dinner)}</Text>
            </View>
          </View>
          <View style={styles.timeGrid}>
            {DINNER_TIMES.map((time) => (
              <TimeButton
                key={time}
                time={formatTime(time)}
                selected={mealTimes.dinner === time}
                onSelect={() => handleTimeSelect('dinner', time)}
              />
            ))}
          </View>
        </Card>

        {/* Workout Timing */}
        <Card variant="outlined" style={styles.card}>
          <Text style={styles.cardTitle}>Workout Timing</Text>
          <Text style={styles.cardSubtitle}>
            This helps us optimize your nutrition around exercise
          </Text>
          <View style={styles.optionsGrid}>
            {WORKOUT_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={mealTimes.workoutTiming === option.value}
                onSelect={() => handleWorkoutSelect(option.value)}
              />
            ))}
          </View>
        </Card>

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Back"
            onPress={handleBack}
            variant="outline"
            size="large"
            style={styles.backButton}
          />
          <Button
            title="Next"
            onPress={handleNext}
            size="large"
            style={styles.nextButton}
          />
        </View>

        {/* Skip Button */}
        <Button
          title="Skip Onboarding"
          onPress={handleSkip}
          variant="ghost"
          size="small"
          fullWidth
          style={styles.skipButton}
        />

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.progressText}>Step 4 of 6</Text>
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
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mealIcon: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  selectedTime: {
    ...typography.caption,
    color: colors.primary.main,
    fontWeight: '500',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  optionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  optionButtonSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light,
  },
  optionIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  optionText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary.dark,
    fontWeight: '600',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  timeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
    minWidth: 70,
    alignItems: 'center',
  },
  timeButtonSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main,
  },
  timeButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  timeButtonTextSelected: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  skipButton: {
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

export default ScheduleScreen;
