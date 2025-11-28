import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { Input } from '../base/Input';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';
import { MealComponent } from '../../types';

interface SubstitutionModalProps {
  visible: boolean;
  originalComponent: MealComponent | null;
  availableSubstitutes: MealComponent[];
  onSubstitute: (originalId: string, newComponent: MealComponent) => void;
  onClose: () => void;
}

const categoryColors: Record<string, string> = {
  protein: colors.secondary.main,
  carb: colors.info,
  vegetable: colors.success,
  fat: colors.warning,
  flavor: colors.primary.light,
  fruit: '#E91E63',
};

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  visible,
  originalComponent,
  availableSubstitutes,
  onSubstitute,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubstitute, setSelectedSubstitute] = useState<MealComponent | null>(null);

  const filteredSubstitutes = availableSubstitutes.filter(
    (sub) =>
      sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => {
    if (originalComponent && selectedSubstitute) {
      onSubstitute(originalComponent.id, selectedSubstitute);
      setSelectedSubstitute(null);
      setSearchQuery('');
      onClose();
    }
  };

  const getCalorieDifference = (substitute: MealComponent) => {
    if (!originalComponent) return 0;
    return substitute.calories - originalComponent.calories;
  };

  const getProteinDifference = (substitute: MealComponent) => {
    if (!originalComponent) return 0;
    return substitute.protein - originalComponent.protein;
  };

  const formatDifference = (diff: number, unit: string) => {
    if (diff === 0) return 'Same';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff}${unit}`;
  };

  if (!originalComponent) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Substitute Component</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          {/* Original Component */}
          <Card variant="filled" style={styles.originalCard}>
            <Text style={styles.sectionLabel}>Replacing:</Text>
            <View style={styles.componentRow}>
              <View style={styles.componentInfo}>
                <Text style={styles.componentName}>{originalComponent.name}</Text>
                <Badge
                  text={originalComponent.category}
                  size="small"
                  customColor={categoryColors[originalComponent.category]}
                />
              </View>
              <View style={styles.componentNutrition}>
                <Text style={styles.nutritionText}>
                  {originalComponent.calories} cal
                </Text>
                <Text style={styles.nutritionSubtext}>
                  {originalComponent.protein}g protein
                </Text>
              </View>
            </View>
          </Card>

          {/* Search */}
          <Input
            placeholder="Search substitutes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Text>{'\u{1F50D}'}</Text>}
            containerStyle={styles.searchInput}
          />

          {/* Suggested Substitutes */}
          {originalComponent.substitutes && originalComponent.substitutes.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={styles.sectionLabel}>Suggested:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {originalComponent.substitutes.map((name, index) => {
                  const substitute = availableSubstitutes.find(
                    (s) => s.name.toLowerCase() === name.toLowerCase()
                  );
                  if (!substitute) return null;
                  return (
                    <Card
                      key={index}
                      onPress={() => setSelectedSubstitute(substitute)}
                      variant={selectedSubstitute?.id === substitute.id ? 'elevated' : 'outlined'}
                      style={[
                        styles.suggestedCard,
                        selectedSubstitute?.id === substitute.id && styles.selectedCard,
                      ]}
                    >
                      <Text style={styles.suggestedName}>{substitute.name}</Text>
                      <Text style={styles.suggestedCalories}>
                        {substitute.calories} cal
                      </Text>
                    </Card>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* All Substitutes */}
          <Text style={styles.sectionLabel}>All Options:</Text>
          <ScrollView style={styles.substitutesList}>
            {filteredSubstitutes.map((substitute) => {
              const calDiff = getCalorieDifference(substitute);
              const proteinDiff = getProteinDifference(substitute);
              const isSelected = selectedSubstitute?.id === substitute.id;

              return (
                <Card
                  key={substitute.id}
                  onPress={() => setSelectedSubstitute(substitute)}
                  variant={isSelected ? 'elevated' : 'outlined'}
                  style={[styles.substituteCard, isSelected && styles.selectedCard]}
                >
                  <View style={styles.substituteRow}>
                    <View style={styles.substituteInfo}>
                      <View style={styles.substituteHeader}>
                        <Text style={styles.substituteName}>{substitute.name}</Text>
                        <Badge
                          text={substitute.category}
                          size="small"
                          customColor={categoryColors[substitute.category]}
                        />
                      </View>
                      <Text style={styles.substitutePortion}>{substitute.portion}</Text>
                    </View>

                    <View style={styles.substituteNutrition}>
                      <View style={styles.nutritionColumn}>
                        <Text style={styles.nutritionValue}>{substitute.calories}</Text>
                        <Text style={styles.nutritionUnit}>cal</Text>
                      </View>
                      <View style={styles.nutritionColumn}>
                        <Text style={styles.nutritionValue}>{substitute.protein}g</Text>
                        <Text style={styles.nutritionUnit}>protein</Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>{'\u2713'}</Text>
                      </View>
                    )}
                  </View>

                  {/* Difference Indicators */}
                  <View style={styles.differenceRow}>
                    <Badge
                      text={formatDifference(calDiff, ' cal')}
                      size="small"
                      variant={calDiff < 0 ? 'success' : calDiff > 0 ? 'warning' : 'default'}
                    />
                    <Badge
                      text={formatDifference(proteinDiff, 'g protein')}
                      size="small"
                      variant={proteinDiff > 0 ? 'success' : proteinDiff < 0 ? 'warning' : 'default'}
                    />
                  </View>
                </Card>
              );
            })}

            {filteredSubstitutes.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No substitutes found</Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              style={styles.actionButton}
            />
            <Button
              title="Confirm Swap"
              onPress={handleConfirm}
              disabled={!selectedSubstitute}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeIcon: {
    fontSize: 20,
    color: colors.text.secondary,
  },
  originalCard: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  componentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  componentName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  componentNutrition: {
    alignItems: 'flex-end',
  },
  nutritionText: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  nutritionSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  searchInput: {
    marginBottom: spacing.md,
  },
  suggestedSection: {
    marginBottom: spacing.md,
  },
  suggestedCard: {
    width: 100,
    padding: spacing.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  selectedCard: {
    borderColor: colors.primary.main,
    borderWidth: 2,
  },
  suggestedName: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  suggestedCalories: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  substitutesList: {
    maxHeight: 300,
    marginBottom: spacing.md,
  },
  substituteCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  substituteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  substituteInfo: {
    flex: 1,
  },
  substituteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  substituteName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  substitutePortion: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  substituteNutrition: {
    flexDirection: 'row',
    gap: spacing.md,
    marginRight: spacing.sm,
  },
  nutritionColumn: {
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  nutritionUnit: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  differenceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
