import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { Button } from '../base/Button';

const { width, height } = Dimensions.get('window');

export interface TutorialStepData {
  id: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'center';
  highlightArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface TutorialOverlayProps {
  visible: boolean;
  steps: TutorialStepData[];
  currentStepIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  visible,
  steps,
  currentStepIndex,
  onNext,
  onPrevious,
  onSkip,
  onComplete,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, currentStepIndex]);

  if (!visible || !currentStep) return null;

  const getCardPosition = () => {
    switch (currentStep.position) {
      case 'top':
        return { top: 100 };
      case 'bottom':
        return { bottom: 100 };
      default:
        return { top: height / 2 - 100 };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Spotlight area (if highlighted region exists) */}
        {currentStep.highlightArea && (
          <View
            style={[
              styles.spotlight,
              {
                left: currentStep.highlightArea.x,
                top: currentStep.highlightArea.y,
                width: currentStep.highlightArea.width,
                height: currentStep.highlightArea.height,
              },
            ]}
          />
        )}

        {/* Tutorial Card */}
        <View style={[styles.card, getCardPosition()]}>
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentStepIndex && styles.progressDotActive,
                  index < currentStepIndex && styles.progressDotCompleted,
                ]}
              />
            ))}
          </View>

          {/* Step Content */}
          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          <Text style={styles.stepDescription}>{currentStep.description}</Text>

          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            {!isFirstStep && (
              <Button
                title="Back"
                onPress={onPrevious}
                variant="ghost"
                size="small"
                style={styles.navButton}
              />
            )}

            <View style={styles.rightButtons}>
              <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip Tutorial</Text>
              </TouchableOpacity>

              <Button
                title={isLastStep ? 'Got it!' : 'Next'}
                onPress={isLastStep ? onComplete : onNext}
                size="small"
                style={styles.nextButton}
              />
            </View>
          </View>

          {/* Step Counter */}
          <Text style={styles.stepCounter}>
            {currentStepIndex + 1} of {steps.length}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary.main,
    borderRadius: borderRadius.md,
    ...shadows.lg,
  },
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
  },
  progressDotActive: {
    backgroundColor: colors.primary.main,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: colors.success,
  },
  stepTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stepDescription: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    minWidth: 80,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  nextButton: {
    minWidth: 100,
  },
  stepCounter: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default TutorialOverlay;
