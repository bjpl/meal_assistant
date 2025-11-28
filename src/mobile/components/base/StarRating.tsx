import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../../utils/theme';

export interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  showLabel?: boolean;
  label?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 32,
  onRatingChange,
  readOnly = false,
  showLabel = false,
  label,
}) => {
  const handlePress = (index: number) => {
    if (!readOnly && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  const getRatingLabel = () => {
    switch (rating) {
      case 1:
        return 'Poor';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Great';
      case 5:
        return 'Excellent';
      default:
        return '';
    }
  };

  const renderStar = (index: number) => {
    const filled = index < rating;
    const starColor = filled
      ? colors.satisfaction[rating as 1 | 2 | 3 | 4 | 5] || colors.warning
      : colors.border.light;

    return (
      <TouchableOpacity
        key={index}
        onPress={() => handlePress(index)}
        disabled={readOnly}
        activeOpacity={readOnly ? 1 : 0.7}
        style={styles.starButton}
      >
        <Text style={{ fontSize: size, color: starColor }}>
          {filled ? '\u2605' : '\u2606'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.starsContainer}>
        {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
      </View>
      {showLabel && rating > 0 && (
        <Text style={[styles.ratingLabel, { color: colors.satisfaction[rating as 1 | 2 | 3 | 4 | 5] }]}>
          {getRatingLabel()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: spacing.xs / 2,
  },
  ratingLabel: {
    ...typography.body2,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
