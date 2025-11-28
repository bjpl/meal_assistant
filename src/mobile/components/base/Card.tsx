import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../utils/theme';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  style?: ViewStyle;
  accentColor?: string;
  disabled?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'medium',
  onPress,
  style,
  accentColor,
  disabled = false,
}) => {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.background.primary,
          ...shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: colors.background.primary,
          borderWidth: 1,
          borderColor: colors.border.light,
        };
      case 'filled':
        return {
          backgroundColor: colors.background.secondary,
        };
      default:
        return {};
    }
  };

  const getPadding = (): number => {
    switch (padding) {
      case 'none':
        return 0;
      case 'small':
        return spacing.sm;
      case 'large':
        return spacing.lg;
      default:
        return spacing.md;
    }
  };

  const cardStyles: ViewStyle[] = [
    styles.card,
    getVariantStyles(),
    { padding: getPadding() },
    accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : {},
    disabled ? styles.disabled : {},
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={cardStyles}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
});
