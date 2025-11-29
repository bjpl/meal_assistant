import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Card } from '../base/Card';
import { Button } from '../base/Button';
import { Badge } from '../base/Badge';
import { Slider } from '../base/Slider';
import { colors, spacing, typography } from '../../utils/theme';
import { MealComponent } from '../../types';

interface ComponentListProps {
  components: MealComponent[];
  selectedComponents: string[];
  onToggleComponent: (componentId: string) => void;
  onPortionChange?: (componentId: string, portion: number) => void;
  onSubstitutePress?: (component: MealComponent) => void;
  editable?: boolean;
  showPortionSlider?: boolean;
}

const categoryColors: Record<string, string> = {
  protein: colors.secondary.main,
  carb: colors.info,
  vegetable: colors.success,
  fat: colors.warning,
  flavor: colors.primary.light,
  fruit: '#E91E63',
};

const categoryIcons: Record<string, string> = {
  protein: '\u{1F357}',
  carb: '\u{1F35E}',
  vegetable: '\u{1F966}',
  fat: '\u{1F95C}',
  flavor: '\u{1F9C2}',
  fruit: '\u{1F34E}',
};

interface PortionState {
  [key: string]: number;
}

export const ComponentList: React.FC<ComponentListProps> = ({
  components,
  selectedComponents,
  onToggleComponent,
  onPortionChange,
  onSubstitutePress,
  editable = true,
  showPortionSlider = false,
}) => {
  const [portions, setPortions] = useState<PortionState>(() => {
    const initial: PortionState = {};
    components.forEach((c) => {
      initial[c.id] = 1;
    });
    return initial;
  });

  const handlePortionChange = (componentId: string, value: number) => {
    const newPortion = value / 100;
    setPortions((prev) => ({ ...prev, [componentId]: newPortion }));
    if (onPortionChange) {
      onPortionChange(componentId, newPortion);
    }
  };

  const getAdjustedCalories = (component: MealComponent) => {
    const portion = portions[component.id] || 1;
    return Math.round(component.calories * portion);
  };

  const getAdjustedProtein = (component: MealComponent) => {
    const portion = portions[component.id] || 1;
    return Math.round(component.protein * portion);
  };

  const renderComponent = ({ item }: { item: MealComponent }) => {
    const isSelected = selectedComponents.includes(item.id);
    const portion = portions[item.id] || 1;

    return (
      <Card
        variant={isSelected ? 'elevated' : 'outlined'}
        style={StyleSheet.flatten([styles.componentCard, !isSelected && styles.componentCardDeselected])}
      >
        <View style={styles.componentRow}>
          {/* Toggle Button */}
          {editable && (
            <Button
              title=""
              onPress={() => onToggleComponent(item.id)}
              variant={isSelected ? 'primary' : 'outline'}
              size="small"
              style={styles.toggleButton}
              icon={
                <Text style={{ color: isSelected ? colors.text.inverse : colors.primary.main }}>
                  {isSelected ? '\u2713' : ''}
                </Text>
              }
            />
          )}

          {/* Component Icon */}
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: (categoryColors[item.category] || colors.text.secondary) + '20' },
            ]}
          >
            <Text style={styles.iconText}>
              {categoryIcons[item.category] || '\u{1F37D}'}
            </Text>
          </View>

          {/* Component Info */}
          <View style={styles.componentInfo}>
            <View style={styles.componentHeader}>
              <Text
                style={[
                  styles.componentName,
                  !isSelected && styles.componentNameDeselected,
                ]}
              >
                {item.name}
              </Text>
              <Badge
                text={item.category}
                size="small"
                customColor={categoryColors[item.category] || colors.text.secondary}
              />
            </View>
            <Text style={styles.componentPortion}>
              {item.portion}
              {portion !== 1 && ` (${Math.round(portion * 100)}%)`}
            </Text>
          </View>

          {/* Nutrition */}
          <View style={styles.componentNutrition}>
            <Text style={[styles.nutritionCalories, !isSelected && styles.nutritionDeselected]}>
              {getAdjustedCalories(item)} cal
            </Text>
            <Text style={[styles.nutritionProtein, !isSelected && styles.nutritionDeselected]}>
              {getAdjustedProtein(item)}g protein
            </Text>
          </View>
        </View>

        {/* Portion Slider */}
        {showPortionSlider && isSelected && (
          <View style={styles.sliderSection}>
            <Slider
              value={portion * 100}
              onValueChange={(value) => handlePortionChange(item.id, value)}
              min={25}
              max={200}
              step={25}
              label="Portion"
              leftLabel="1/4"
              rightLabel="2x"
            />
          </View>
        )}

        {/* Substitute Button */}
        {editable && item.substitutes && item.substitutes.length > 0 && (
          <View style={styles.substituteSection}>
            <Text style={styles.substituteLabel}>
              {item.substitutes.length} substitute{item.substitutes.length > 1 ? 's' : ''} available
            </Text>
            <Button
              title="Swap"
              onPress={() => onSubstitutePress && onSubstitutePress(item)}
              variant="ghost"
              size="small"
            />
          </View>
        )}
      </Card>
    );
  };

  // Group components by category
  const groupedComponents = components.reduce((acc, component) => {
    if (!acc[component.category]) {
      acc[component.category] = [];
    }
    acc[component.category].push(component);
    return acc;
  }, {} as Record<string, MealComponent[]>);

  const categoryOrder = ['protein', 'carb', 'vegetable', 'fat', 'flavor', 'fruit'];
  const sortedCategories = Object.keys(groupedComponents).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {components
              .filter((c) => selectedComponents.includes(c.id))
              .reduce((sum, c) => sum + getAdjustedCalories(c), 0)}
          </Text>
          <Text style={styles.summaryLabel}>total cal</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {components
              .filter((c) => selectedComponents.includes(c.id))
              .reduce((sum, c) => sum + getAdjustedProtein(c), 0)}g
          </Text>
          <Text style={styles.summaryLabel}>protein</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {selectedComponents.length}/{components.length}
          </Text>
          <Text style={styles.summaryLabel}>selected</Text>
        </View>
      </View>

      {/* Component List by Category */}
      {sortedCategories.map((category) => (
        <View key={category} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: categoryColors[category] || colors.text.secondary },
              ]}
            />
            <Text style={styles.categoryTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
          </View>
          {groupedComponents[category].map((item) => (
            <View key={item.id}>{renderComponent({ item })}</View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  categoryTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  componentCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  componentCardDeselected: {
    opacity: 0.6,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    width: 32,
    height: 32,
    padding: 0,
    marginRight: spacing.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconText: {
    fontSize: 20,
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
  componentNameDeselected: {
    textDecorationLine: 'line-through',
  },
  componentPortion: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  componentNutrition: {
    alignItems: 'flex-end',
  },
  nutritionCalories: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
  },
  nutritionProtein: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  nutritionDeselected: {
    color: colors.text.disabled,
  },
  sliderSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  substituteSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  substituteLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
