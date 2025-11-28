import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/base/Card';
import { Button } from '../../components/base/Button';
import { ProgressBar } from '../../components/base/ProgressBar';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { ProcessingStep, ProcessingProgress } from '../../types/ads.types';

interface ProcessingStepConfig {
  step: ProcessingStep;
  label: string;
  icon: string;
  duration: number; // in seconds
}

const processingSteps: ProcessingStepConfig[] = [
  { step: 'uploading', label: 'Uploading', icon: '\u{2B06}', duration: 2 },
  { step: 'detecting_store', label: 'Detecting store', icon: '\u{1F3EA}', duration: 2 },
  { step: 'extracting_text', label: 'Extracting text', icon: '\u{1F4DD}', duration: 2 },
  { step: 'finding_deals', label: 'Finding deals', icon: '\u{1F50D}', duration: 2 },
  { step: 'matching_to_list', label: 'Matching to list', icon: '\u{2705}', duration: 2 },
];

export interface AdProcessingScreenProps {
  navigation: any;
  route: {
    params: {
      adId: string;
      storeId: string;
      storeName: string;
    };
  };
}

export const AdProcessingScreen: React.FC<AdProcessingScreenProps> = ({
  navigation,
  route,
}) => {
  const { adId, storeName } = route.params;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [dealsFound, setDealsFound] = useState(0);
  const [matchedDeals, setMatchedDeals] = useState(0);

  const pulseAnim = useState(new Animated.Value(1))[0];
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Pulse animation for current step
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (isCancelled) return;

    const processSteps = async () => {
      for (let i = 0; i < processingSteps.length; i++) {
        if (isCancelled) break;

        setCurrentStepIndex(i);

        // Animate progress within step
        Animated.timing(progressAnim, {
          toValue: ((i + 1) / processingSteps.length) * 100,
          duration: processingSteps[i].duration * 1000,
          useNativeDriver: false,
        }).start();

        await new Promise(resolve =>
          setTimeout(resolve, processingSteps[i].duration * 1000)
        );

        // Simulate finding deals on step 4
        if (i === 3) {
          setDealsFound(8);
        }
        // Simulate matching on step 5
        if (i === 4) {
          setMatchedDeals(5);
        }
      }

      if (!isCancelled) {
        setIsComplete(true);
        // Auto-navigate to review after short delay
        setTimeout(() => {
          navigation.replace('DealReview', { adId });
        }, 1500);
      }
    };

    processSteps();
  }, [isCancelled, navigation, adId, progressAnim]);

  const handleCancel = () => {
    setIsCancelled(true);
    navigation.goBack();
  };

  const currentStep = processingSteps[currentStepIndex];
  const totalTime = processingSteps.reduce((sum, s) => sum + s.duration, 0);
  const elapsedTime = processingSteps
    .slice(0, currentStepIndex)
    .reduce((sum, s) => sum + s.duration, 0);
  const remainingTime = Math.max(0, totalTime - elapsedTime - currentStep.duration);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Processing Ad</Text>
          <Text style={styles.subtitle}>{storeName}</Text>
        </View>

        {/* Progress Indicator */}
        <Card variant="elevated" style={styles.progressCard}>
          <View style={styles.circularProgress}>
            <Animated.View
              style={[
                styles.progressCircle,
                isComplete && styles.progressCircleComplete,
                { transform: [{ scale: isComplete ? 1 : pulseAnim }] },
              ]}
            >
              {isComplete ? (
                <Text style={styles.completeIcon}>{'\u2713'}</Text>
              ) : (
                <Text style={styles.currentIcon}>{currentStep.icon}</Text>
              )}
            </Animated.View>
          </View>

          <Text style={styles.currentStepLabel}>
            {isComplete ? 'Complete!' : currentStep.label + '...'}
          </Text>

          <ProgressBar
            progress={isComplete ? 100 : (currentStepIndex / processingSteps.length) * 100 +
              ((1 / processingSteps.length) * 50)}
            height={8}
            style={styles.progressBar}
          />

          {!isComplete && (
            <Text style={styles.timeRemaining}>
              Estimated time remaining: {remainingTime}s
            </Text>
          )}
        </Card>

        {/* Step List */}
        <Card variant="outlined" style={styles.stepsCard}>
          {processingSteps.map((step, index) => {
            const isActive = index === currentStepIndex && !isComplete;
            const isDone = index < currentStepIndex || isComplete;

            return (
              <View
                key={step.step}
                style={[
                  styles.stepRow,
                  index < processingSteps.length - 1 && styles.stepRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.stepIcon,
                    isDone && styles.stepIconDone,
                    isActive && styles.stepIconActive,
                  ]}
                >
                  {isDone ? (
                    <Text style={styles.stepCheckmark}>{'\u2713'}</Text>
                  ) : isActive ? (
                    <ActivityIndicator size="small" color={colors.primary.main} />
                  ) : (
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isDone && styles.stepLabelDone,
                    isActive && styles.stepLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
                {isDone && (
                  <Text style={styles.stepDuration}>
                    {step.duration}s
                  </Text>
                )}
              </View>
            );
          })}
        </Card>

        {/* Results Preview (shown during matching step) */}
        {(currentStepIndex >= 3 || isComplete) && (
          <Card variant="filled" style={styles.resultsCard}>
            <View style={styles.resultsRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultValue}>{dealsFound}</Text>
                <Text style={styles.resultLabel}>Deals Found</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultItem}>
                <Text style={[styles.resultValue, styles.matchedValue]}>
                  {matchedDeals}
                </Text>
                <Text style={styles.resultLabel}>Matched to List</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Success Message */}
        {isComplete && (
          <View style={styles.successMessage}>
            <Text style={styles.successIcon}>{'\u{1F389}'}</Text>
            <Text style={styles.successText}>
              Processing complete! Opening review...
            </Text>
          </View>
        )}

        {/* Cancel Button */}
        {!isComplete && (
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="ghost"
            style={styles.cancelButton}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  progressCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  circularProgress: {
    marginBottom: spacing.lg,
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary.main + '20',
    borderWidth: 4,
    borderColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleComplete: {
    backgroundColor: colors.success + '20',
    borderColor: colors.success,
  },
  currentIcon: {
    fontSize: 36,
  },
  completeIcon: {
    fontSize: 40,
    color: colors.success,
    fontWeight: '700',
  },
  currentStepLabel: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  progressBar: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  timeRemaining: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  stepsCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stepRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepIconDone: {
    backgroundColor: colors.success,
  },
  stepIconActive: {
    backgroundColor: colors.primary.main + '20',
    borderWidth: 2,
    borderColor: colors.primary.main,
  },
  stepCheckmark: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  stepNumber: {
    ...typography.body2,
    color: colors.text.disabled,
    fontWeight: '600',
  },
  stepLabel: {
    ...typography.body1,
    color: colors.text.disabled,
    flex: 1,
  },
  stepLabelDone: {
    color: colors.text.primary,
  },
  stepLabelActive: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  stepDuration: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  resultsCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  resultItem: {
    alignItems: 'center',
  },
  resultValue: {
    ...typography.h1,
    color: colors.text.primary,
  },
  matchedValue: {
    color: colors.success,
  },
  resultLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  resultDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  successIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  successText: {
    ...typography.body1,
    color: colors.success,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 'auto',
  },
});

export default AdProcessingScreen;
