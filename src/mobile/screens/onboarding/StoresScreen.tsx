import React from 'react';
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
import { StarRating } from '../../components/base/StarRating';
import {
  togglePreferredStore,
  setStoreRating,
  goToNextStep,
  goToPreviousStep,
  skipOnboarding,
  selectOnboarding,
} from '../../store/slices/onboardingSlice';
import { PreferredStore } from '../../types/onboarding.types';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

interface StoresScreenProps {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Stores'>;
}

interface StoreCardProps {
  store: PreferredStore;
  onToggle: () => void;
  onRatingChange: (rating: number) => void;
}

const STORE_ICONS: Record<string, string> = {
  walmart: '\u{1F6D2}',
  kroger: '\u{1F6D2}',
  aldi: '\u{1F4B0}',
  costco: '\u{1F4E6}',
  target: '\u{1F3AF}',
  trader_joes: '\u{1F33F}',
  whole_foods: '\u{1F34E}',
  kyopo: '\u{1F371}', // Korean food/bowl
  megamart: '\u{1F3EC}', // Department store
};

const StoreCard: React.FC<StoreCardProps> = ({ store, onToggle, onRatingChange }) => {
  const icon = STORE_ICONS[store.id] || '\u{1F3EA}';

  return (
    <Card
      variant={store.isPreferred ? 'elevated' : 'outlined'}
      style={[
        styles.storeCard,
        store.isPreferred && styles.storeCardSelected,
      ]}
    >
      <TouchableOpacity
        style={styles.storeCardContent}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.storeHeader}>
          <View style={styles.storeIconContainer}>
            <Text style={styles.storeIcon}>{icon}</Text>
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{store.name}</Text>
            {store.distance && (
              <Text style={styles.storeDistance}>{store.distance} miles away</Text>
            )}
          </View>
          <View style={[
            styles.checkbox,
            store.isPreferred && styles.checkboxSelected,
          ]}>
            {store.isPreferred && (
              <Text style={styles.checkmark}>{'\u{2713}'}</Text>
            )}
          </View>
        </View>

        {store.isPreferred && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>How much do you like this store?</Text>
            <StarRating
              rating={store.rating}
              onRatingChange={onRatingChange}
              size={24}
            />
          </View>
        )}
      </TouchableOpacity>
    </Card>
  );
};

export const StoresScreen: React.FC<StoresScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const onboarding = useSelector(selectOnboarding);

  const handleToggleStore = (storeId: string) => {
    dispatch(togglePreferredStore(storeId));
  };

  const handleRatingChange = (storeId: string, rating: number) => {
    dispatch(setStoreRating({ storeId, rating }));
  };

  const handleNext = () => {
    dispatch(goToNextStep());
    navigation.navigate('FirstWeek');
  };

  const handleBack = () => {
    dispatch(goToPreviousStep());
    navigation.goBack();
  };

  const handleSkip = () => {
    // Skip directly to main app instead of showing FirstWeek
    dispatch(skipOnboarding());
  };

  const selectedStores = onboarding.preferredStores.filter(s => s.isPreferred);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Stores</Text>
          <Text style={styles.subtitle}>
            Select your preferred grocery stores. This is optional - you can set this up later.
          </Text>
        </View>

        {/* Optional Badge */}
        <View style={styles.optionalBadge}>
          <Text style={styles.optionalIcon}>{'\u{1F3C3}'}</Text>
          <Text style={styles.optionalText}>
            Optional step - skip if you are not ready
          </Text>
        </View>

        {/* Store List */}
        <View style={styles.storeList}>
          {onboarding.preferredStores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              onToggle={() => handleToggleStore(store.id)}
              onRatingChange={(rating) => handleRatingChange(store.id, rating)}
            />
          ))}
        </View>

        {/* Selected Summary */}
        {selectedStores.length > 0 && (
          <Card variant="filled" style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {selectedStores.length} store{selectedStores.length > 1 ? 's' : ''} selected
            </Text>
            <Text style={styles.summaryText}>
              We will optimize your shopping lists for these stores and show you relevant deals.
            </Text>
          </Card>
        )}

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
            title={selectedStores.length > 0 ? 'Next' : 'Skip for Now'}
            onPress={selectedStores.length > 0 ? handleNext : handleSkip}
            size="large"
            style={styles.nextButton}
            variant={selectedStores.length > 0 ? 'primary' : 'outline'}
          />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={styles.dotCompleted} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.progressText}>Step 5 of 6</Text>
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
  optionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  optionalIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  optionalText: {
    ...typography.body2,
    color: colors.text.secondary,
    flex: 1,
  },
  storeList: {
    gap: spacing.sm,
  },
  storeCard: {
    marginBottom: spacing.xs,
  },
  storeCardSelected: {
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  storeCardContent: {
    padding: spacing.sm,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  storeIcon: {
    fontSize: 24,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  storeDistance: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.main,
  },
  checkmark: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
  },
  ratingContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  ratingLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  summaryCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primary.light,
  },
  summaryTitle: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.primary.dark,
    marginBottom: spacing.xs,
  },
  summaryText: {
    ...typography.body2,
    color: colors.primary.dark,
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

export default StoresScreen;
