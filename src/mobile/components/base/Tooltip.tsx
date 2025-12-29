/**
 * Tooltip Component
 * Provides contextual help and guidance throughout the app
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../utils/theme';

interface TooltipProps {
  content: string;
  title?: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showIcon?: boolean;
  iconSize?: number;
  maxWidth?: number;
  learnMoreUrl?: string;
  onLearnMore?: () => void;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  title,
  children,
  position = 'top',
  showIcon = true,
  iconSize = 16,
  maxWidth = 280,
  learnMoreUrl,
  onLearnMore,
}) => {
  const [visible, setVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const triggerRef = useRef<View>(null);

  const showTooltip = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      const screenHeight = Dimensions.get('window').height;

      let tooltipX = x + width / 2;
      let tooltipY = y;

      // Adjust based on position preference
      switch (position) {
        case 'bottom':
          tooltipY = y + height + 8;
          break;
        case 'top':
          tooltipY = y - 8;
          break;
        case 'left':
          tooltipX = x - 8;
          tooltipY = y + height / 2;
          break;
        case 'right':
          tooltipX = x + width + 8;
          tooltipY = y + height / 2;
          break;
      }

      // Keep tooltip on screen
      tooltipX = Math.max(spacing.md, Math.min(tooltipX, screenWidth - maxWidth - spacing.md));
      tooltipY = Math.max(spacing.xl, Math.min(tooltipY, screenHeight - 150));

      setTooltipPosition({ x: tooltipX, y: tooltipY });
      setVisible(true);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [position, maxWidth, fadeAnim]);

  const hideTooltip = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [fadeAnim]);

  return (
    <>
      <View ref={triggerRef} style={styles.triggerContainer}>
        {children}
        {showIcon && (
          <TouchableOpacity
            onPress={showTooltip}
            style={[styles.iconButton, { width: iconSize + 8, height: iconSize + 8 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.icon, { fontSize: iconSize }]}>{'\u{2139}'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={hideTooltip}
      >
        <Pressable style={styles.backdrop} onPress={hideTooltip}>
          <Animated.View
            style={[
              styles.tooltip,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [position === 'bottom' ? -10 : 10, 0],
                    }),
                  },
                ],
                left: tooltipPosition.x - maxWidth / 2,
                top: tooltipPosition.y,
                maxWidth,
              },
            ]}
          >
            {/* Arrow */}
            <View
              style={[
                styles.arrow,
                position === 'bottom' ? styles.arrowTop : styles.arrowBottom,
              ]}
            />

            {/* Content */}
            <View style={styles.tooltipContent}>
              {title && <Text style={styles.tooltipTitle}>{title}</Text>}
              <Text style={styles.tooltipText}>{content}</Text>

              {(learnMoreUrl || onLearnMore) && (
                <TouchableOpacity
                  onPress={() => {
                    hideTooltip();
                    onLearnMore?.();
                  }}
                  style={styles.learnMoreButton}
                >
                  <Text style={styles.learnMoreText}>Learn more</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

/**
 * Inline Info Icon with Tooltip
 * For use next to labels and headers
 */
interface InfoTooltipProps {
  content: string;
  title?: string;
  size?: 'small' | 'medium' | 'large';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  title,
  size = 'medium',
}) => {
  const iconSizes = { small: 14, medium: 18, large: 22 };

  return (
    <Tooltip
      content={content}
      title={title}
      showIcon={false}
    >
      <TouchableOpacity style={styles.infoIconButton}>
        <Text style={[styles.infoIcon, { fontSize: iconSizes[size] }]}>
          {'\u{24D8}'}
        </Text>
      </TouchableOpacity>
    </Tooltip>
  );
};

/**
 * Feature Callout
 * For highlighting new features or important information
 */
interface FeatureCalloutProps {
  title: string;
  description: string;
  icon?: string;
  variant?: 'info' | 'tip' | 'warning' | 'new';
  onDismiss?: () => void;
  dismissible?: boolean;
}

export const FeatureCallout: React.FC<FeatureCalloutProps> = ({
  title,
  description,
  icon,
  variant = 'info',
  onDismiss,
  dismissible = true,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const variantStyles = {
    info: { bg: colors.info + '15', border: colors.info, icon: '\u{24D8}' },
    tip: { bg: colors.success + '15', border: colors.success, icon: '\u{1F4A1}' },
    warning: { bg: colors.warning + '15', border: colors.warning, icon: '\u26A0' },
    new: { bg: colors.primary.main + '15', border: colors.primary.main, icon: '\u2728' },
  };

  const style = variantStyles[variant];

  return (
    <View
      style={[
        styles.callout,
        { backgroundColor: style.bg, borderLeftColor: style.border },
      ]}
    >
      <Text style={styles.calloutIcon}>{icon || style.icon}</Text>
      <View style={styles.calloutContent}>
        <Text style={styles.calloutTitle}>{title}</Text>
        <Text style={styles.calloutDescription}>{description}</Text>
      </View>
      {dismissible && (
        <TouchableOpacity
          onPress={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          style={styles.dismissButton}
        >
          <Text style={styles.dismissIcon}>{'\u2715'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  triggerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.text.secondary,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.text.primary,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  arrow: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: colors.text.primary,
    transform: [{ rotate: '45deg' }],
    left: '50%',
    marginLeft: -6,
  },
  arrowTop: {
    top: -6,
  },
  arrowBottom: {
    bottom: -6,
  },
  tooltipContent: {
    padding: spacing.md,
  },
  tooltipTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.background.primary,
    marginBottom: spacing.xs,
  },
  tooltipText: {
    ...typography.caption,
    color: colors.background.secondary,
    lineHeight: 18,
  },
  learnMoreButton: {
    marginTop: spacing.sm,
  },
  learnMoreText: {
    ...typography.caption,
    color: colors.primary.light,
    fontWeight: '600',
  },
  infoIconButton: {
    padding: spacing.xs,
  },
  infoIcon: {
    color: colors.text.secondary,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
  },
  calloutIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  calloutContent: {
    flex: 1,
  },
  calloutTitle: {
    ...typography.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  calloutDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  dismissButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  dismissIcon: {
    fontSize: 14,
    color: colors.text.disabled,
  },
});

export default Tooltip;
