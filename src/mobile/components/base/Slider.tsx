import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  Platform,
  GestureResponderEvent,
  PanResponder,
} from 'react-native';
import { colors, spacing, typography } from '../../utils/theme';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  trackColor?: string;
  fillColor?: string;
  thumbColor?: string;
  style?: ViewStyle;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  label,
  showValue = true,
  leftLabel,
  rightLabel,
  trackColor = colors.background.tertiary,
  fillColor = colors.primary.main,
  thumbColor = colors.primary.main,
  style,
}) => {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const trackRef = React.useRef<View>(null);
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  // Calculate percentage for display
  const percentage = max !== min ? ((value - min) / (max - min)) * 100 : 0;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, [percentage, animatedValue]);

  // Calculate value from position
  const calculateValue = React.useCallback((relativeX: number) => {
    if (trackWidth === 0) return;

    const clampedX = Math.max(0, Math.min(trackWidth, relativeX));
    const newPercentage = (clampedX / trackWidth) * 100;
    const rawValue = min + (newPercentage / 100) * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));

    if (clampedValue !== value) {
      onValueChange(clampedValue);
    }
  }, [trackWidth, min, max, step, value, onValueChange]);

  // Handle touch/click on track
  const handleTrackPress = React.useCallback((evt: GestureResponderEvent) => {
    // Use locationX which is relative to the target element
    const locationX = evt.nativeEvent.locationX;
    if (typeof locationX === 'number') {
      calculateValue(locationX);
    }
  }, [calculateValue]);

  // PanResponder for drag support
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const locationX = evt.nativeEvent.locationX;
          if (typeof locationX === 'number') {
            calculateValue(locationX);
          }
        },
        onPanResponderMove: (evt) => {
          const locationX = evt.nativeEvent.locationX;
          if (typeof locationX === 'number') {
            calculateValue(locationX);
          }
        },
      }),
    [calculateValue]
  );

  const thumbLeft = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [0, Math.max(0, trackWidth - 24)],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          {showValue && <Text style={styles.value}>{value}</Text>}
        </View>
      )}

      <View
        ref={trackRef}
        style={styles.trackContainer}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
        }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: trackColor }]} />
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: fillColor,
              width: animatedValue.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbColor,
              transform: [{ translateX: thumbLeft as any }],
            },
          ]}
        />
      </View>

      {(leftLabel || rightLabel) && (
        <View style={styles.labels}>
          <Text style={styles.labelText}>{leftLabel}</Text>
          <Text style={styles.labelText}>{rightLabel}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.body2,
    color: colors.text.secondary,
  },
  value: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.text.primary,
  },
  trackContainer: {
    height: 40,
    justifyContent: 'center',
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  } as any,
  track: {
    height: 6,
    borderRadius: 3,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    left: 0,
    top: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  labelText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
