import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { Button } from '../../components/base/Button';
import { Card } from '../../components/base/Card';
import {
  setSelectedPattern,
  goToNextStep,
  goToPreviousStep,
  skipOnboarding,
  selectOnboarding,
} from '../../store/slices/onboardingSlice';
import { selectPatterns } from '../../store/slices/patternsSlice';
import { PatternId, MealPattern } from '../../types';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - spacing.lg * 2;

interface PatternExplorerScreenProps {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Patterns'>;
}

interface PatternCardProps {
  pattern: MealPattern;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
}

const PatternCard: React.FC<PatternCardProps> = ({
  pattern,
  isSelected,
  isRecommended,
  onSelect,
}) => {
  const patternColor = colors.patterns[pattern.id as keyof typeof colors.patterns] || colors.primary.main;

  return (
    <TouchableOpacity
      style={[
        styles.patternCard,
        isSelected && { borderColor: patternColor, borderWidth: 3 },
      ]}
      onPress={onSelect}
      activeOpacity={0.9}
    >
      {isRecommended && (
        <View style={[styles.recommendedBadge, { backgroundColor: patternColor }]}>
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
      )}

      <View style={styles.patternHeader}>
        <View style={[styles.patternBadge, { backgroundColor: patternColor }]}>
          <Text style={styles.patternLetter}>{pattern.id}</Text>
        </View>
        <View style={styles.patternTitleContainer}>
          <Text style={styles.patternName}>{pattern.name}</Text>
          <Text style={styles.patternCalories}>
            {pattern.totalCalories} cal | {pattern.totalProtein}g protein
          </Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedCheck, { backgroundColor: patternColor }]}>
            <Text style={styles.checkmark}>{'\u{2713}'}</Text>
          </View>
        )}
      </View>

      <Text style={styles.patternDescription}>{pattern.description}</Text>

      {/* Optimal For Tags */}
      <View style={styles.tagsContainer}>
        {pattern.optimalFor.slice(0, 3).map((tag, index) => (
          <View
            key={index}
            style={[styles.tag, { backgroundColor: `${patternColor}20` }]}
          >
            <Text style={[styles.tagText, { color: patternColor }]}>{tag}</Text>
          </View>
        ))}
      </View>

      {/* Meal Schedule Preview */}
      <View style={styles.schedulePreview}>
        <Text style={styles.scheduleTitle}>Daily Schedule:</Text>
        {pattern.meals.morning && (
          <View style={styles.scheduleItem}>
            <Text style={styles.scheduleTime}>{pattern.meals.morning.time}</Text>
            <Text style={styles.scheduleMeal}>
              Morning - {pattern.meals.morning.calories} cal
            </Text>
          </View>
        )}
        {pattern.meals.noon && (
          <View style={styles.scheduleItem}>
            <Text style={styles.scheduleTime}>{pattern.meals.noon.time}</Text>
            <Text style={styles.scheduleMeal}>
              Lunch - {pattern.meals.noon.calories} cal
            </Text>
          </View>
        )}
        {pattern.meals.evening && (
          <View style={styles.scheduleItem}>
            <Text style={styles.scheduleTime}>{pattern.meals.evening.time}</Text>
            <Text style={styles.scheduleMeal}>
              Dinner - {pattern.meals.evening.calories} cal
            </Text>
          </View>
        )}
      </View>

      <Button
        title={isSelected ? 'Selected' : 'Select This Pattern'}
        onPress={onSelect}
        variant={isSelected ? 'primary' : 'outline'}
        fullWidth
        style={StyleSheet.flatten([
          styles.selectButton,
          isSelected && { backgroundColor: patternColor },
        ])}
      />
    </TouchableOpacity>
  );
};

export const PatternExplorerScreen: React.FC<PatternExplorerScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const patterns = useSelector(selectPatterns);
  const onboarding = useSelector(selectOnboarding);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handlePatternSelect = (patternId: PatternId) => {
    dispatch(setSelectedPattern(patternId));
  };

  const handleNext = () => {
    dispatch(goToNextStep());
    navigation.navigate('Schedule');
  };

  const handleBack = () => {
    dispatch(goToPreviousStep());
    navigation.goBack();
  };

  const handleSkip = () => {
    dispatch(skipOnboarding());
  };

  // Recommend Traditional (A) for beginners
  const recommendedPattern = 'A';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Pattern</Text>
          <Text style={styles.subtitle}>
            Scroll to explore all 7 eating patterns. You can change this anytime.
          </Text>
        </View>

        {/* Pattern List (Vertical) */}
        <View style={styles.patternsList}>
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              isSelected={onboarding.selectedPattern === pattern.id}
              isRecommended={pattern.id === recommendedPattern}
              onSelect={() => handlePatternSelect(pattern.id)}
            />
          ))}
        </View>

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
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.progressText}>Step 3 of 6</Text>
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
  patternsList: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  patternCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -1,
    right: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: borderRadius.sm,
    borderBottomRightRadius: borderRadius.sm,
  },
  recommendedText: {
    ...typography.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  patternBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  patternLetter: {
    ...typography.h2,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  patternTitleContainer: {
    flex: 1,
  },
  patternName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  patternCalories: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  selectedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  patternDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    fontWeight: '500',
  },
  schedulePreview: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  scheduleTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  scheduleTime: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  scheduleMeal: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  selectButton: {
    marginTop: spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
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
    marginTop: spacing.lg,
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

export default PatternExplorerScreen;
