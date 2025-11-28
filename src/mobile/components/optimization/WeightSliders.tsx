import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../utils/theme';
import { Slider } from '../base/Slider';
import { Card } from '../base/Card';
import {
  OptimizationWeights,
  WEIGHT_PRESETS,
} from '../../types/optimization.types';

// ============================================
// Types
// ============================================
export interface WeightSlidersProps {
  weights: OptimizationWeights;
  activePreset: string;
  isCustom: boolean;
  isCalculating: boolean;
  onWeightChange: (key: keyof OptimizationWeights, value: number) => void;
  onPresetSelect: (presetId: string) => void;
}

interface PresetButtonProps {
  preset: typeof WEIGHT_PRESETS[0];
  isActive: boolean;
  onPress: () => void;
}

interface WeightSliderRowProps {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}

// ============================================
// Weight Colors
// ============================================
const WEIGHT_COLORS = {
  price: '#4CAF50',     // Green
  distance: '#2196F3',  // Blue
  quality: '#FF9800',   // Orange
  time: '#9C27B0',      // Purple
};

const WEIGHT_ICONS = {
  price: '$',
  distance: 'mi',
  quality: 'star',
  time: 'min',
};

// ============================================
// Sub-Components
// ============================================
const PresetButton: React.FC<PresetButtonProps> = ({ preset, isActive, onPress }) => (
  <TouchableOpacity
    style={[
      styles.presetButton,
      isActive && styles.presetButtonActive,
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[
      styles.presetButtonText,
      isActive && styles.presetButtonTextActive,
    ]}>
      {preset.name}
    </Text>
  </TouchableOpacity>
);

const CustomPresetButton: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <View style={[
    styles.presetButton,
    styles.customPresetButton,
    isActive && styles.presetButtonActive,
  ]}>
    <Text style={[
      styles.presetButtonText,
      isActive && styles.presetButtonTextActive,
    ]}>
      Custom
    </Text>
  </View>
);

const WeightSliderRow: React.FC<WeightSliderRowProps> = ({
  label,
  value,
  color,
  onChange,
}) => (
  <View style={styles.sliderRow}>
    <View style={styles.sliderHeader}>
      <View style={styles.labelContainer}>
        <View style={[styles.colorIndicator, { backgroundColor: color }]} />
        <Text style={styles.sliderLabel}>{label}</Text>
      </View>
      <Text style={[styles.sliderValue, { color }]}>{value}%</Text>
    </View>
    <Slider
      value={value}
      min={0}
      max={100}
      step={5}
      onValueChange={onChange}
      fillColor={color}
      thumbColor={color}
      showValue={false}
    />
  </View>
);

// ============================================
// Main Component
// ============================================
export const WeightSliders: React.FC<WeightSlidersProps> = ({
  weights,
  activePreset,
  isCustom,
  isCalculating,
  onWeightChange,
  onPresetSelect,
}) => {
  // Memoize total calculation
  const totalWeight = useMemo(
    () => weights.price + weights.distance + weights.quality + weights.time,
    [weights]
  );

  const isValidTotal = totalWeight === 100;

  // Callbacks
  const handlePriceChange = useCallback(
    (value: number) => onWeightChange('price', value),
    [onWeightChange]
  );

  const handleDistanceChange = useCallback(
    (value: number) => onWeightChange('distance', value),
    [onWeightChange]
  );

  const handleQualityChange = useCallback(
    (value: number) => onWeightChange('quality', value),
    [onWeightChange]
  );

  const handleTimeChange = useCallback(
    (value: number) => onWeightChange('time', value),
    [onWeightChange]
  );

  return (
    <Card variant="elevated" padding="medium" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Optimization Priorities</Text>
        {isCalculating && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary.main} />
            <Text style={styles.loadingText}>Recalculating...</Text>
          </View>
        )}
      </View>

      {/* Preset Buttons */}
      <View style={styles.presetsContainer}>
        {WEIGHT_PRESETS.map(preset => (
          <PresetButton
            key={preset.id}
            preset={preset}
            isActive={activePreset === preset.id}
            onPress={() => onPresetSelect(preset.id)}
          />
        ))}
        <CustomPresetButton isActive={isCustom} />
      </View>

      {/* Weight Sliders */}
      <View style={styles.slidersContainer}>
        <WeightSliderRow
          label="Price"
          value={weights.price}
          color={WEIGHT_COLORS.price}
          onChange={handlePriceChange}
        />

        <WeightSliderRow
          label="Distance"
          value={weights.distance}
          color={WEIGHT_COLORS.distance}
          onChange={handleDistanceChange}
        />

        <WeightSliderRow
          label="Quality"
          value={weights.quality}
          color={WEIGHT_COLORS.quality}
          onChange={handleQualityChange}
        />

        <WeightSliderRow
          label="Time"
          value={weights.time}
          color={WEIGHT_COLORS.time}
          onChange={handleTimeChange}
        />
      </View>

      {/* Total Indicator */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={[
          styles.totalValue,
          !isValidTotal && styles.totalValueInvalid,
        ]}>
          {totalWeight}%
        </Text>
        {!isValidTotal && (
          <Text style={styles.totalWarning}>
            (should equal 100%)
          </Text>
        )}
      </View>

      {/* Weight Summary Bar */}
      <View style={styles.summaryBar}>
        {weights.price > 0 && (
          <View
            style={[
              styles.summarySegment,
              { flex: weights.price, backgroundColor: WEIGHT_COLORS.price },
            ]}
          />
        )}
        {weights.distance > 0 && (
          <View
            style={[
              styles.summarySegment,
              { flex: weights.distance, backgroundColor: WEIGHT_COLORS.distance },
            ]}
          />
        )}
        {weights.quality > 0 && (
          <View
            style={[
              styles.summarySegment,
              { flex: weights.quality, backgroundColor: WEIGHT_COLORS.quality },
            ]}
          />
        )}
        {weights.time > 0 && (
          <View
            style={[
              styles.summarySegment,
              { flex: weights.time, backgroundColor: WEIGHT_COLORS.time },
            ]}
          />
        )}
      </View>
    </Card>
  );
};

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  presetButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  presetButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  customPresetButton: {
    borderStyle: 'dashed',
  },
  presetButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  presetButtonTextActive: {
    color: colors.primary.contrast,
  },
  slidersContainer: {
    marginBottom: spacing.md,
  },
  sliderRow: {
    marginBottom: spacing.sm,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  sliderLabel: {
    ...typography.body2,
    color: colors.text.primary,
    fontWeight: '500',
  },
  sliderValue: {
    ...typography.body1,
    fontWeight: '700',
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.body2,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  totalValue: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalValueInvalid: {
    color: colors.error,
  },
  totalWarning: {
    ...typography.caption,
    color: colors.error,
    marginLeft: spacing.xs,
  },
  summaryBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
  },
  summarySegment: {
    height: '100%',
  },
});

export default WeightSliders;
