import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { Button } from '../base/Button';

interface TutorialStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  icon?: string;
  onNext: () => void;
  onSkip: () => void;
  isLastStep?: boolean;
}

export const TutorialStep: React.FC<TutorialStepProps> = ({
  stepNumber,
  totalSteps,
  title,
  description,
  icon,
  onNext,
  onSkip,
  isLastStep = false,
}) => {
  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(stepNumber / totalSteps) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {stepNumber} / {totalSteps}
        </Text>
      </View>

      {/* Icon */}
      {icon && (
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}

      {/* Content */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip Tutorial</Text>
        </TouchableOpacity>

        <Button
          title={isLastStep ? 'Finish' : 'Next'}
          onPress={onNext}
          size="medium"
          style={styles.nextButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    margin: spacing.lg,
    ...shadows.lg,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  progressBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: 2,
  },
  progressText: {
    ...typography.caption,
    color: colors.text.secondary,
    minWidth: 40,
    textAlign: 'right',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  nextButton: {
    minWidth: 120,
  },
});

export default TutorialStep;
