import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { Button } from '../../components/base/Button';
import { Card } from '../../components/base/Card';
import { startOnboarding, skipOnboarding, goToNextStep } from '../../store/slices/onboardingSlice';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
}

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>
      <Text style={styles.featureIconText}>{icon}</Text>
    </View>
    <View style={styles.featureContent}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(startOnboarding());
  }, [dispatch]);

  const handleGetStarted = () => {
    dispatch(goToNextStep());
    navigation.navigate('Profile');
  };

  const handleSkipToLogin = () => {
    dispatch(skipOnboarding());
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>{'\u{1F957}'}</Text>
          </View>
          <Text style={styles.title}>Meal Assistant</Text>
          <Text style={styles.subtitle}>
            Your personal guide to healthy eating patterns
          </Text>
        </View>

        {/* Feature Showcase */}
        <Card variant="filled" style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>What you will get:</Text>

          <FeatureItem
            icon={'\u{1F4C5}'}
            title="7 Flexible Eating Patterns"
            description="From Traditional to Intermittent Fasting - find what works for you"
          />

          <FeatureItem
            icon={'\u{1F4F8}'}
            title="Easy Meal Tracking"
            description="Snap a photo and rate your meals in seconds"
          />

          <FeatureItem
            icon={'\u{1F6D2}'}
            title="Smart Shopping Lists"
            description="Optimized lists based on store sales and your preferences"
          />

          <FeatureItem
            icon={'\u{1F4CA}'}
            title="Progress Analytics"
            description="Track your journey with insights that matter"
          />

          <FeatureItem
            icon={'\u{1F373}'}
            title="Meal Prep Planning"
            description="Efficient batch cooking with parallel task scheduling"
          />
        </Card>

        {/* Time Estimate */}
        <View style={styles.timeEstimate}>
          <Text style={styles.timeIcon}>{'\u{23F1}'}</Text>
          <Text style={styles.timeText}>Setup takes less than 5 minutes</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            size="large"
            fullWidth
            style={styles.primaryButton}
          />

          <View style={styles.skipButtonsRow}>
            <Button
              title="Skip"
              onPress={handleSkipToLogin}
              variant="outline"
              size="medium"
              style={styles.skipButton}
            />
            <Button
              title="I already have an account"
              onPress={handleSkipToLogin}
              variant="ghost"
              size="medium"
              style={styles.secondaryButton}
            />
          </View>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.progressText}>Step 1 of 6</Text>
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
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoIcon: {
    fontSize: 48,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  featuresCard: {
    marginTop: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  featureIconText: {
    fontSize: 20,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  featureDescription: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  timeIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  timeText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  buttonContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  primaryButton: {
    paddingVertical: spacing.md,
  },
  skipButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skipButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 2,
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
  progressText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});

export default WelcomeScreen;
