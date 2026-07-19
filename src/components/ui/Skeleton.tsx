import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, colors, BORDER_RADIUS, SPACING, alpha } from '../../theme/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  variant?: 'text' | 'rect' | 'circle';
  shimmer?: boolean;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  variant = 'text',
  shimmer = true,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const radius =
    borderRadius ??
    (variant === 'circle' ? height / 2 : variant === 'text' ? BORDER_RADIUS.sm : BORDER_RADIUS.md);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 300],
  });

  return (
    <View
      style={[
        styles.base,
        {
          width: width as any,
          height,
          borderRadius: radius,
        },
        variant === 'circle' && { width: height },
        style,
      ]}
    >
      {shimmer && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX }], overflow: 'hidden', borderRadius: radius },
          ]}
        >
          <LinearGradient
            colors={['transparent', alpha(COLORS.textPrimary, 0.05), 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

export function SkeletonLine({ width = '100%', style }: { width?: number | string; style?: ViewStyle }) {
  return <Skeleton width={width} height={14} style={{ marginBottom: SPACING.sm, ...style } as ViewStyle} />;
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.card, style as ViewStyle]}>
      <Skeleton width="100%" height={120} variant="rect" borderRadius={12} />
      <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={14} />
        <Skeleton width="90%" height={14} />
      </View>
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.profileSkeleton}>
      <Skeleton width={100} height={100} variant="circle" />
      <Skeleton width={160} height={20} style={{ marginTop: SPACING.md }} />
      <Skeleton width={120} height={14} style={{ marginTop: SPACING.xs }} />
      <View style={styles.profileSkeletonSections}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.profileSkeletonSection}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="100%" height={14} style={{ marginTop: SPACING.sm }} />
            <Skeleton width="80%" height={14} style={{ marginTop: SPACING.xs }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.card,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  profileSkeleton: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  profileSkeletonSections: {
    width: '100%',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xl,
    gap: SPACING.lg,
  },
  profileSkeletonSection: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
});
