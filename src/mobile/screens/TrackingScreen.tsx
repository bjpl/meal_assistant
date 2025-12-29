import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Input } from '../components/base/Input';
import { StarRating } from '../components/base/StarRating';
import { Slider } from '../components/base/Slider';
import { Badge } from '../components/base/Badge';
import { PhotoCapture } from '../components/tracking/PhotoCapture';
import { NutritionSummary } from '../components/tracking/NutritionSummary';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { MealComponent, PatternId, ConsumedComponent } from '../types';
import { RootState, AppDispatch } from '../store';
import { logMeal, selectAvailableComponents } from '../store/slices/mealsSlice';

export const TrackingScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const mealComponents = useSelector(selectAvailableComponents);
  const loading = useSelector((state: RootState) => state.meals.loading);

  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [satisfaction, setSatisfaction] = useState(3); // Default to neutral (3 stars)
  const [energyLevel, setEnergyLevel] = useState(50);
  const [hungerBefore, setHungerBefore] = useState(70);
  const [hungerAfter, setHungerAfter] = useState(20);
  const [notes, setNotes] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<'morning' | 'noon' | 'evening'>('noon');
  const [selectedComponents, setSelectedComponents] = useState<string[]>(
    mealComponents.map((c: MealComponent) => c.id)
  );
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapComponentId, setSwapComponentId] = useState<string | null>(null);

  // Substitutes for swap functionality
  const substitutes: Record<string, { id: string; name: string; calories: number; protein: number }[]> = {
    'protein-1': [
      { id: 'sub-1', name: 'Turkey Breast', calories: 135, protein: 30 },
      { id: 'sub-2', name: 'Tofu', calories: 144, protein: 15 },
    ],
    'protein-2': [
      { id: 'sub-3', name: 'Tuna', calories: 132, protein: 29 },
      { id: 'sub-4', name: 'Shrimp', calories: 99, protein: 20 },
    ],
    'carb-1': [
      { id: 'sub-5', name: 'Quinoa', calories: 222, protein: 8 },
      { id: 'sub-6', name: 'White Rice', calories: 205, protein: 4 },
    ],
    'carb-2': [
      { id: 'sub-7', name: 'Regular Potato', calories: 161, protein: 4 },
      { id: 'sub-8', name: 'Butternut Squash', calories: 82, protein: 2 },
    ],
    'veg-1': [
      { id: 'sub-9', name: 'Cauliflower', calories: 27, protein: 2 },
      { id: 'sub-10', name: 'Green Beans', calories: 31, protein: 2 },
    ],
    'veg-2': [
      { id: 'sub-11', name: 'Spinach', calories: 23, protein: 3 },
      { id: 'sub-12', name: 'Kale', calories: 33, protein: 3 },
    ],
  };

  const handleSwapComponent = useCallback((componentId: string) => {
    setSwapComponentId(componentId);
    setShowSwapModal(true);
  }, []);

  const handleSelectSubstitute = useCallback((substituteId: string, substituteName: string) => {
    if (swapComponentId) {
      // In production, this would update the meal component
      Alert.alert('Swapped', `Replaced with ${substituteName}`);
      setShowSwapModal(false);
      setSwapComponentId(null);
    }
  }, [swapComponentId]);

  const handlePhotoTaken = (uri: string) => {
    setPhotoUri(uri);
    setShowCamera(false);
  };

  const toggleComponent = (componentId: string) => {
    setSelectedComponents(prev =>
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  };

  const calculateTotals = () => {
    const selected = mealComponents.filter((c: MealComponent) => selectedComponents.includes(c.id));
    return {
      calories: selected.reduce((sum: number, c: MealComponent) => sum + c.calories, 0),
      protein: selected.reduce((sum: number, c: MealComponent) => sum + c.protein, 0),
    };
  };

  const totals = calculateTotals();

  const handleSave = async () => {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Convert MealComponents to ConsumedComponents
    const consumedComponents: ConsumedComponent[] = selectedComponents
      .map(id => mealComponents.find(c => c.id === id))
      .filter(c => c !== undefined)
      .map(c => ({
        componentId: c!.id,
        name: c!.name,
        portion: 1,
        calories: c!.calories,
        protein: c!.protein,
      }));

    const mealData = {
      date: today,
      patternId: 'A' as PatternId, // Default pattern
      mealType: selectedMeal,
      components: consumedComponents,
      satisfaction: satisfaction as 1 | 2 | 3 | 4 | 5,
      energyLevel,
      hungerBefore,
      hungerAfter,
      notes,
      photoUri: photoUri || undefined,
      createdAt: now,
    };

    try {
      await dispatch(logMeal(mealData)).unwrap();
      Alert.alert('Success', 'Meal logged successfully!');
      // Reset form
      setSatisfaction(0);
      setEnergyLevel(50);
      setHungerBefore(70);
      setHungerAfter(20);
      setNotes('');
      setPhotoUri(null);
      setSelectedComponents(mealComponents.map((c: MealComponent) => c.id));
    } catch (error) {
      Alert.alert('Error', 'Failed to log meal. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.loadingText}>Loading meal data...</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Log Meal</Text>
              <Text style={styles.subtitle}>Track your nutrition and how you feel</Text>
            </View>

          {/* Meal Type Selection */}
          <View style={styles.mealSelector}>
            {(['morning', 'noon', 'evening'] as const).map((meal) => (
              <Button
                key={meal}
                title={meal.charAt(0).toUpperCase() + meal.slice(1)}
                onPress={() => setSelectedMeal(meal)}
                variant={selectedMeal === meal ? 'primary' : 'outline'}
                size="small"
                style={styles.mealButton}
              />
            ))}
          </View>

          {/* Photo Section */}
          <Card variant="outlined" style={styles.photoCard}>
            {photoUri ? (
              <View>
                <Image source={{ uri: photoUri }} style={styles.mealPhoto} />
                <View style={styles.photoActions}>
                  <Button
                    title="Retake"
                    onPress={() => setShowCamera(true)}
                    variant="outline"
                    size="small"
                  />
                  <Button
                    title="Remove"
                    onPress={() => setPhotoUri(null)}
                    variant="ghost"
                    size="small"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>{'\u{1F4F7}'}</Text>
                <Text style={styles.photoText}>Add a photo of your meal</Text>
                <Button
                  title="Take Photo"
                  onPress={() => setShowCamera(true)}
                  style={styles.takePhotoButton}
                />
              </View>
            )}
          </Card>

          {/* Nutrition Summary */}
          <NutritionSummary
            nutrition={totals}
            targets={{ calories: 850, protein: 60 }}
            variant="detailed"
          />

          {/* Component Selection */}
          <Card variant="outlined" style={styles.componentsCard}>
            <Text style={styles.sectionTitle}>Meal Components</Text>
            <Text style={styles.sectionSubtitle}>
              Toggle components you ate (tap to substitute)
            </Text>
            {mealComponents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No meal components available</Text>
              </View>
            ) : (
              mealComponents.map((component) => {
                const isSelected = selectedComponents.includes(component.id);
                return (
                  <View
                    key={component.id}
                    style={[
                      styles.componentRow,
                      !isSelected && styles.componentRowDisabled,
                    ]}
                  >
                    <Button
                      title=""
                      onPress={() => toggleComponent(component.id)}
                      variant={isSelected ? 'primary' : 'outline'}
                      size="small"
                      style={styles.componentToggle}
                      icon={
                        <Text style={{ color: isSelected ? colors.text.inverse : colors.primary.main }}>
                          {isSelected ? '\u2713' : ''}
                        </Text>
                      }
                    />
                    <View style={styles.componentInfo}>
                      <View style={styles.componentHeader}>
                        <Text
                          style={[
                            styles.componentName,
                            !isSelected && styles.componentNameDisabled,
                          ]}
                        >
                          {component.name}
                        </Text>
                        <Badge
                          text={component.category}
                          size="small"
                          customColor={
                            component.category === 'protein'
                              ? colors.secondary.main
                              : component.category === 'carb'
                              ? colors.info
                              : component.category === 'vegetable'
                              ? colors.success
                              : colors.warning
                          }
                        />
                      </View>
                      <Text style={styles.componentDetails}>
                        {component.portion} - {component.calories} cal, {component.protein}g protein
                      </Text>
                    </View>
                    <Button
                      title="Swap"
                      onPress={() => handleSwapComponent(component.id)}
                      variant="ghost"
                      size="small"
                    />
                  </View>
                );
              })
            )}
          </Card>

          {/* Satisfaction Rating */}
          <Card variant="outlined" style={styles.ratingCard}>
            <Text style={styles.sectionTitle}>How was it?</Text>
            <StarRating
              rating={satisfaction}
              onRatingChange={setSatisfaction}
              size={40}
              showLabel
              label="Satisfaction"
            />
          </Card>

          {/* Energy & Hunger Levels */}
          <Card variant="outlined" style={styles.slidersCard}>
            <Slider
              value={energyLevel}
              onValueChange={setEnergyLevel}
              label="Energy Level After Meal"
              leftLabel="Low"
              rightLabel="High"
            />
            <View style={styles.sliderDivider} />
            <Slider
              value={hungerBefore}
              onValueChange={setHungerBefore}
              label="Hunger Before Meal"
              leftLabel="Not Hungry"
              rightLabel="Very Hungry"
            />
            <View style={styles.sliderDivider} />
            <Slider
              value={hungerAfter}
              onValueChange={setHungerAfter}
              label="Hunger After Meal"
              leftLabel="Stuffed"
              rightLabel="Still Hungry"
            />
          </Card>

          {/* Notes */}
          <Card variant="outlined" style={styles.notesCard}>
            <Input
              label="Notes (optional)"
              placeholder="How did this meal make you feel?"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              inputStyle={styles.notesInput}
            />
          </Card>

          {/* Save Button */}
          <View style={styles.saveSection}>
            <Button
              title="Save Meal Log"
              onPress={handleSave}
              fullWidth
              disabled={satisfaction === 0}
            />
            <Text style={styles.saveHint}>
              {satisfaction === 0 ? 'Please rate your satisfaction to continue' : ''}
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Camera Modal */}
      <PhotoCapture
        visible={showCamera}
        onPhotoTaken={handlePhotoTaken}
        onCancel={() => setShowCamera(false)}
      />

      {/* Swap Component Modal */}
      <Modal visible={showSwapModal} animationType="slide" transparent>
        <View style={styles.swapModalOverlay}>
          <View style={styles.swapModalContent}>
            <Text style={styles.swapModalTitle}>Swap Component</Text>
            <Text style={styles.swapModalSubtitle}>Choose a substitute:</Text>
            {swapComponentId && substitutes[swapComponentId]?.map((sub) => (
              <View key={sub.id} style={styles.swapOption}>
                <View style={styles.swapOptionInfo}>
                  <Text style={styles.swapOptionName}>{sub.name}</Text>
                  <Text style={styles.swapOptionDetails}>
                    {sub.calories} cal, {sub.protein}g protein
                  </Text>
                </View>
                <Button
                  title="Select"
                  onPress={() => handleSelectSubstitute(sub.id, sub.name)}
                  variant="outline"
                  size="small"
                />
              </View>
            ))}
            <Button
              title="Cancel"
              onPress={() => {
                setShowSwapModal(false);
                setSwapComponentId(null);
              }}
              variant="ghost"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  mealSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  mealButton: {
    flex: 1,
  },
  photoCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  mealPhoto: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.sm,
  },
  photoPlaceholder: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  photoIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  photoText: {
    ...typography.body1,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  takePhotoButton: {
    minWidth: 150,
  },
  componentsCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  componentRowDisabled: {
    opacity: 0.5,
  },
  componentToggle: {
    width: 32,
    height: 32,
    padding: 0,
    marginRight: spacing.sm,
  },
  componentInfo: {
    flex: 1,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  componentName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  componentNameDisabled: {
    textDecorationLine: 'line-through',
  },
  componentDetails: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  ratingCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
  },
  slidersCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sliderDivider: {
    height: spacing.md,
  },
  notesCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  saveHint: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body1,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    ...typography.body1,
    color: colors.text.secondary,
  },
  swapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  swapModalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  swapModalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  swapModalSubtitle: {
    ...typography.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  swapOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  swapOptionInfo: {
    flex: 1,
  },
  swapOptionName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  swapOptionDetails: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
