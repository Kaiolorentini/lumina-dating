import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, alpha } from '../theme/tokens';
import { usePulse, useScalePress, useFadeIn } from '../hooks';

interface EnhancedEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  primaryAction?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  variant?: 'default' | 'elevated' | 'glass' | 'premium';
}

export function EnhancedEmptyState({
  title,
  description,
  icon,
  imageUrl,
  primaryAction,
  secondaryAction,
  variant = 'default',
}: EnhancedEmptyStateProps) {
  const [isVisible, setIsVisible] = useState(false);
  const pulseAnimation = usePulse(true, 1, 1.05, 2000);
  const scaleAction = useScalePress(0.95);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return styles.elevatedContainer;
      case 'glass':
        return styles.glassContainer;
      case 'premium':
        return styles.premiumContainer;
      default:
        return styles.defaultContainer;
    }
  };

  return (
    <Animated.View
      style={[styles.container, { opacity: pulseAnimation.scale }]}
      onLayout={() => setIsVisible(true)}
    >
      <BlurView
        style={getVariantStyles()}
        intensity={variant === 'glass' ? 60 : 80}
        tint="dark"
      >
        <View style={styles.content}>
          {imageUrl ? (
            <Animated.View style={{ transform: [{ scale: pulseAnimation.scale }] }}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="contain"
              />
            </Animated.View>
          ) : icon ? (
            <View style={styles.iconContainer}>{icon}</View>
          ) : (
            <View style={styles.defaultIcon}>
              <Text style={styles.defaultIconText}>📝</Text>
            </View>
          )}

          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          {(primaryAction || secondaryAction) && (
            <View style={styles.actionContainer}>
              {primaryAction && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryAction, { transform: [{ scale: scaleAction.scale }] }]}
                  onPressIn={scaleAction.handlePressIn}
                  onPressOut={scaleAction.handlePressOut}
                  onPress={primaryAction.onPress}
                >
                  <Text style={styles.actionText}>{primaryAction.label}</Text>
                </TouchableOpacity>
              )}
              {secondaryAction && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryAction]}
                  onPress={secondaryAction.onPress}
                >
                  <Text style={[styles.actionText, styles.secondaryActionText]}>{secondaryAction.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  defaultContainer: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.level3,
  },
  elevatedContainer: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.level2,
  },
  glassContainer: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    backgroundColor: alpha(COLORS.surface, 0.15),
    borderWidth: 1,
    borderColor: alpha(COLORS.white, 0.1),
    ...SHADOWS.level1,
  },
  premiumContainer: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl + SPACING.md,
    backgroundColor: alpha(COLORS.gold, 0.03),
    borderWidth: 1,
    borderColor: alpha(COLORS.gold, 0.2),
    ...SHADOWS.level3,
  },
  content: {
    alignItems: 'center',
  },
  image: {
    width: 120,
    height: 120,
    marginBottom: SPACING.lg,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  defaultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: alpha(COLORS.secondary, 0.1),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  defaultIconText: {
    fontSize: 40,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: FONT_SIZE.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primaryAction: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.level1,
  },
  secondaryAction: {
    backgroundColor: alpha(COLORS.surface, 0.1),
    borderWidth: 1,
    borderColor: alpha(COLORS.surface, 0.3),
  },
  actionText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
  },
  secondaryActionText: {
    color: COLORS.textPrimary,
  },
});