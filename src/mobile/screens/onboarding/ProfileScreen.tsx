import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { Button } from '../../components/base/Button';
import { Card } from '../../components/base/Card';
import { Slider } from '../../components/base/Slider';
import {
  updateProfile,
  goToNextStep,
  goToPreviousStep,
  skipOnboarding,
  selectProfile,
  selectCalculatedTargets,
} from '../../store/slices/onboardingSlice';
import {
  ActivityLevel,
  Gender,
  ACTIVITY_LABELS,
  GENDER_LABELS,
} from '../../types/onboarding.types';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

interface ProfileScreenProps {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Profile'>;
}

const GenderButton: React.FC<{
  gender: Gender;
  label: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ gender, label, selected, onSelect }) => (
  <TouchableOpacity
    style={[styles.genderButton, selected && styles.genderButtonSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <Text style={[styles.genderButtonText, selected && styles.genderButtonTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const ActivityLevelButton: React.FC<{
  level: ActivityLevel;
  label: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ level, label, selected, onSelect }) => (
  <TouchableOpacity
    style={[styles.activityButton, selected && styles.activityButtonSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <Text style={[styles.activityButtonText, selected && styles.activityButtonTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const profile = useSelector(selectProfile);
  const targets = useSelector(selectCalculatedTargets);

  const [localProfile, setLocalProfile] = useState(profile);

  const handleUpdate = (field: string, value: string | number) => {
    const updated = { ...localProfile, [field]: value };
    setLocalProfile(updated);
    dispatch(updateProfile({ [field]: value }));
  };

  const handleNext = () => {
    dispatch(goToNextStep());
    navigation.navigate('Patterns');
  };

  const handleBack = () => {
    dispatch(goToPreviousStep());
    navigation.goBack();
  };

  const handleSkip = () => {
    dispatch(skipOnboarding());
  };

  const formatHeight = (inches: number) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>About You</Text>
          <Text style={styles.subtitle}>
            This helps us calculate your personalized nutrition targets
          </Text>
        </View>

        {/* Name Input */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Your Name</Text>
          <TextInput
            style={styles.textInput}
            value={localProfile.name}
            onChangeText={(text) => handleUpdate('name', text)}
            placeholder="Enter your name"
            placeholderTextColor={colors.text.disabled}
          />
        </Card>

        {/* Gender Selection */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Biological Sex</Text>
          <Text style={styles.inputHint}>Used for accurate calorie calculations</Text>
          <View style={styles.genderRow}>
            {(Object.entries(GENDER_LABELS) as [Gender, string][]).map(([gender, label]) => (
              <GenderButton
                key={gender}
                gender={gender}
                label={label}
                selected={localProfile.gender === gender}
                onSelect={() => handleUpdate('gender', gender)}
              />
            ))}
          </View>
        </Card>

        {/* Age Slider */}
        <Card variant="outlined" style={styles.inputCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.inputLabel}>Age</Text>
            <Text style={styles.sliderValue}>{localProfile.age} years</Text>
          </View>
          <Slider
            value={localProfile.age}
            min={18}
            max={80}
            step={1}
            onValueChange={(value) => handleUpdate('age', value)}
          />
        </Card>

        {/* Height Slider */}
        <Card variant="outlined" style={styles.inputCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.inputLabel}>Height</Text>
            <Text style={styles.sliderValue}>{formatHeight(localProfile.height)}</Text>
          </View>
          <Slider
            value={localProfile.height}
            min={48}
            max={90}
            step={1}
            onValueChange={(value) => handleUpdate('height', value)}
          />
          <Text style={styles.rangeHint}>4'0" - 7'6"</Text>
        </Card>

        {/* Current Weight Slider */}
        <Card variant="outlined" style={styles.inputCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.inputLabel}>Current Weight</Text>
            <Text style={styles.sliderValue}>{localProfile.weight} lbs</Text>
          </View>
          <Slider
            value={localProfile.weight}
            min={80}
            max={400}
            step={1}
            onValueChange={(value) => handleUpdate('weight', value)}
          />
          <Text style={styles.rangeHint}>80 - 400 lbs (35 - 180 kg)</Text>
        </Card>

        {/* Target Weight Slider */}
        <Card variant="outlined" style={styles.inputCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.inputLabel}>Target Weight</Text>
            <Text style={styles.sliderValue}>{localProfile.targetWeight} lbs</Text>
          </View>
          <Slider
            value={localProfile.targetWeight}
            min={80}
            max={400}
            step={1}
            onValueChange={(value) => handleUpdate('targetWeight', value)}
          />
          <Text style={styles.rangeHint}>80 - 400 lbs (35 - 180 kg)</Text>
        </Card>

        {/* Target Date Display */}
        <Card variant="outlined" style={styles.inputCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.inputLabel}>Target Date</Text>
            <Text style={styles.sliderValue}>
              {new Date(localProfile.targetDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Text style={styles.targetDateInfo}>
            {(() => {
              const targetDate = new Date(localProfile.targetDate);
              const today = new Date();
              const weeksToGoal = Math.max(1, Math.round((targetDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000)));
              const weightToLose = localProfile.weight - localProfile.targetWeight;
              return `${weeksToGoal} weeks to lose ${weightToLose} lbs (${(weightToLose / weeksToGoal).toFixed(1)} lbs/week)`;
            })()}
          </Text>
        </Card>

        {/* Activity Level */}
        <Card variant="outlined" style={styles.inputCard}>
          <Text style={styles.inputLabel}>Activity Level</Text>
          <View style={styles.activityGrid}>
            {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([level, label]) => (
              <ActivityLevelButton
                key={level}
                level={level}
                label={label}
                selected={localProfile.activityLevel === level}
                onSelect={() => handleUpdate('activityLevel', level)}
              />
            ))}
          </View>
        </Card>

        {/* Calculated Targets Preview */}
        <Card variant="filled" style={styles.targetsCard}>
          <Text style={styles.targetsTitle}>Your Calculated Targets</Text>
          <View style={styles.targetsRow}>
            <View style={styles.targetItem}>
              <Text style={styles.targetValue}>{targets.dailyCalories}</Text>
              <Text style={styles.targetLabel}>Daily Calories</Text>
            </View>
            <View style={styles.targetDivider} />
            <View style={styles.targetItem}>
              <Text style={styles.targetValue}>{targets.dailyProtein}g</Text>
              <Text style={styles.targetLabel}>Daily Protein</Text>
            </View>
            <View style={styles.targetDivider} />
            <View style={styles.targetItem}>
              <Text style={styles.targetValue}>{targets.weeklyWeightLoss.toFixed(1)}</Text>
              <Text style={styles.targetLabel}>lbs/week</Text>
            </View>
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
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.progressText}>Step 2 of 6</Text>
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
  inputCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  inputLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  inputHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
  },
  genderButtonSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light,
  },
  genderButtonText: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  genderButtonTextSelected: {
    color: colors.primary.dark,
    fontWeight: '600',
  },
  textInput: {
    ...typography.body1,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sliderValue: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.primary.main,
  },
  activityGrid: {
    gap: spacing.xs,
  },
  activityButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
    marginBottom: spacing.xs,
  },
  activityButtonSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light,
  },
  activityButtonText: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  activityButtonTextSelected: {
    color: colors.primary.dark,
    fontWeight: '600',
  },
  targetsCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primary.light,
  },
  targetsTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.primary.dark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  targetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  targetItem: {
    alignItems: 'center',
    flex: 1,
  },
  targetValue: {
    ...typography.h2,
    color: colors.primary.dark,
  },
  targetLabel: {
    ...typography.caption,
    color: colors.primary.dark,
  },
  targetDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primary.main,
    opacity: 0.3,
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
  rangeHint: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  targetDateInfo: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
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

export default ProfileScreen;
