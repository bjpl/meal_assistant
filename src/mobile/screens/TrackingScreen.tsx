import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/base/Card';
import { Button } from '../components/base/Button';
import { Input } from '../components/base/Input';
import { StarRating } from '../components/base/StarRating';
import { Slider } from '../components/base/Slider';
import { Badge } from '../components/base/Badge';
import { PhotoCapture } from '../components/tracking/PhotoCapture';
import { NutritionSummary } from '../components/tracking/NutritionSummary';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { MealComponent, PatternId } from '../types';

// Sample components data
const sampleComponents: MealComponent[] = [
  { id: '1', name: 'Chicken Breast', category: 'protein', calories: 280, protein: 52, portion: '6 oz' },
  { id: '2', name: 'Basmati Rice', category: 'carb', calories: 210, protein: 4, portion: '1 cup' },
  { id: '3', name: 'Roasted Vegetables', category: 'vegetable', calories: 185, protein: 4, portion: '1.5 cups' },
  { id: '4', name: 'Olive Oil', category: 'fat', calories: 120, protein: 0, portion: '1 tbsp' },
];

export const TrackingScreen: React.FC = () => {
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [satisfaction, setSatisfaction] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(50);
  const [hungerBefore, setHungerBefore] = useState(70);
  const [hungerAfter, setHungerAfter] = useState(20);
  const [notes, setNotes] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<'morning' | 'noon' | 'evening'>('noon');
  const [selectedComponents, setSelectedComponents] = useState<string[]>(
    sampleComponents.map(c => c.id)
  );

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
    const selected = sampleComponents.filter(c => selectedComponents.includes(c.id));
    return {
      calories: selected.reduce((sum, c) => sum + c.calories, 0),
      protein: selected.reduce((sum, c) => sum + c.protein, 0),
    };
  };

  const totals = calculateTotals();

  const handleSave = () => {
    // In production, this would dispatch to Redux store
    console.log('Saving meal log:', {
      photoUri,
      satisfaction,
      energyLevel,
      hungerBefore,
      hungerAfter,
      notes,
      selectedMeal,
      selectedComponents,
      totals,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
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
            {sampleComponents.map((component) => {
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
                    onPress={() => {}}
                    variant="ghost"
                    size="small"
                  />
                </View>
              );
            })}
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
      </KeyboardAvoidingView>

      {/* Camera Modal */}
      <PhotoCapture
        visible={showCamera}
        onPhotoTaken={handlePhotoTaken}
        onCancel={() => setShowCamera(false)}
      />
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
});
