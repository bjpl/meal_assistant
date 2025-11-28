import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  LayoutRectangle,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import { Button } from '../base/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeatureSpotlightProps {
  visible: boolean;
  targetRef?: React.RefObject<View>;
  targetLayout?: LayoutRectangle;
  title: string;
  description: string;
  onDismiss: () => void;
  tooltipPosition?: 'top' | 'bottom' | 'auto';
  showPulse?: boolean;
}

export const FeatureSpotlight: React.FC<FeatureSpotlightProps> = ({
  visible,
  targetRef,
  targetLayout,
  title,
  description,
  onDismiss,
  tooltipPosition = 'auto',
  showPulse = true,
}) => {
  const [layout, setLayout] = useState<LayoutRectangle | null>(targetLayout || null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (targetRef?.current && visible) {
      targetRef.current.measure((x, y, width, height, pageX, pageY) => {
        setLayout({ x: pageX, y: pageY, width, height });
      });
    }
  }, [targetRef, visible]);

  useEffect(() => {
    if (visible && showPulse) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, showPulse]);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const targetArea = layout || targetLayout;

  const getTooltipPosition = () => {
    if (!targetArea) {
      return { top: SCREEN_HEIGHT / 2 - 60, left: spacing.lg, right: spacing.lg };
    }

    const targetCenterY = targetArea.y + targetArea.height / 2;
    const isUpperHalf = targetCenterY < SCREEN_HEIGHT / 2;

    if (tooltipPosition === 'top' || (tooltipPosition === 'auto' && !isUpperHalf)) {
      return {
        bottom: SCREEN_HEIGHT - targetArea.y + spacing.md,
        left: spacing.lg,
        right: spacing.lg,
      };
    }

    return {
      top: targetArea.y + targetArea.height + spacing.md,
      left: spacing.lg,
      right: spacing.lg,
    };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onDismiss}
        />

        {/* Spotlight Ring */}
        {targetArea && (
          <Animated.View
            style={[
              styles.spotlightRing,
              {
                left: targetArea.x - 8,
                top: targetArea.y - 8,
                width: targetArea.width + 16,
                height: targetArea.height + 16,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}

        {/* Clear area over target */}
        {targetArea && (
          <View
            style={[
              styles.clearArea,
              {
                left: targetArea.x,
                top: targetArea.y,
                width: targetArea.width,
                height: targetArea.height,
              },
            ]}
          />
        )}

        {/* Tooltip */}
        <View style={[styles.tooltip, getTooltipPosition()]}>
          <View style={styles.tooltipArrow} />
          <Text style={styles.tooltipTitle}>{title}</Text>
          <Text style={styles.tooltipDescription}>{description}</Text>
          <Button
            title="Got it"
            onPress={onDismiss}
            size="small"
            fullWidth
            style={styles.dismissButton}
          />
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    backgroundColor: 'transparent',
  },
  clearArea: {
    position: 'absolute',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.lg,
  },
  tooltipArrow: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.background.primary,
  },
  tooltipTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  tooltipDescription: {
    ...typography.body2,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  dismissButton: {
    marginTop: spacing.xs,
  },
});

export default FeatureSpotlight;
