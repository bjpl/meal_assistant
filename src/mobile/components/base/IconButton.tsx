import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, Text } from 'react-native';
import { colors, spacing, borderRadius } from '../../utils/theme';

export interface IconButtonProps {
  icon: string; // Unicode character or emoji
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  badge?: number;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 'medium',
  variant = 'default',
  disabled = false,
  badge,
  style,
}) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return { button: 32, icon: 16 };
      case 'large':
        return { button: 56, icon: 28 };
      default:
        return { button: 44, icon: 22 };
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return colors.background.tertiary;
    switch (variant) {
      case 'primary':
        return colors.primary.main;
      case 'secondary':
        return colors.secondary.main;
      case 'ghost':
        return 'transparent';
      default:
        return colors.background.secondary;
    }
  };

  const getIconColor = () => {
    if (disabled) return colors.text.disabled;
    switch (variant) {
      case 'primary':
        return colors.primary.contrast;
      case 'secondary':
        return colors.secondary.contrast;
      default:
        return colors.text.primary;
    }
  };

  const sizeValues = getSize();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          width: sizeValues.button,
          height: sizeValues.button,
          borderRadius: sizeValues.button / 2,
          backgroundColor: getBackgroundColor(),
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: sizeValues.icon,
          color: getIconColor(),
        }}
      >
        {icon}
      </Text>
      {badge !== undefined && badge > 0 && (
        <Text style={styles.badge}>
          {badge > 99 ? '99+' : badge}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    color: colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    minWidth: 18,
    textAlign: 'center',
  },
});
