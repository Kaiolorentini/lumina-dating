import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, alpha } from '../../theme/tokens';
import { usePulse, useScalePress, useShimmer } from '../../hooks';

const { width } = Dimensions.get('window');

interface XPData {
  level: number;
  currentXP: number;
  neededXP: number;
  bonusXP?: number;
}

interface XPBarProps {
  currentXP: number;
  neededXP: number;
  level: number;
  showBonus?: boolean;
  bonusXP?: number;
}

export function XPBar({ currentXP, neededXP, level, showBonus, bonusXP }: XPBarProps) {
  const progress = currentXP / neededXP;
  const [showLevelUp, setShowLevelUp] = useState(false);
  const pulseAnimation = usePulse(true, 1, 1.2, 2000);

  useEffect(() => {
    if (currentXP >= neededXP * 0.95) {
      setShowLevelUp(true);
      const timeout = setTimeout(() => setShowLevelUp(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [currentXP, neededXP]);

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <Text style={styles.levelText}>Nível {level}</Text>
        <Text style={styles.xpText}>{currentXP}/{neededXP} XP</Text>
      </View>

      <View style={styles.xpBarContainer}>
        <Animated.View
          style={[styles.xpBar, {
            width: `${Math.min(progress * 100, 100)}%`,
            backgroundColor: progress >= 1 ? COLORS.success : COLORS.primary,
            transform: [{ scale: pulseAnimation.scale }],
          }]}
        />
        {showBonus && bonusXP && (
          <View style={styles.bonusXP}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3271/3271694.png' }}
              style={styles.bonusIcon}
              resizeMode="contain"
            />
            <Text style={styles.bonusText}>+{bonusXP} XP</Text>
          </View>
        )}
      </View>

      {showLevelUp && (
        <View style={styles.levelUpContainer}>
          <Text style={styles.levelUpText}>🌟 SUBIU DE NÍVEL! 🌟</Text>
        </View>
      )}
    </View>
  );
}

interface CoinDisplayProps {
  coins: number;
  size?: 'sm' | 'md' | 'lg';
}

export function CoinDisplay({ coins, size = 'md' }: CoinDisplayProps) {
  const scaleAnimation = useScalePress(0.9, 200);

  const sizeStyles = {
    sm: { width: 32, height: 32, iconSize: 16 },
    md: { width: 48, height: 48, iconSize: 24 },
    lg: { width: 72, height: 72, iconSize: 36 },
  };

  return (
    <TouchableOpacity
      style={[styles.coinContainer, sizeStyles[size]]}
      onPressIn={scaleAnimation.handlePressIn}
      onPressOut={scaleAnimation.handlePressOut}
    >
      <Animated.Image
        source={{ uri: 'https://cdn-icons-png.flaticon.com/512/281/281764.png' }}
        style={[{ transform: [{ scale: scaleAnimation.scale }] }, sizeStyles[size]]}
        resizeMode="contain"
      />
      <Text style={[styles.coinText, sizeStyles[size]]}>{coins}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  xpContainer: {
    width: '100%',
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  levelText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  xpText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  xpBarContainer: {
    height: 10,
    backgroundColor: alpha(COLORS.surface, 0.1),
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  xpBar: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  bonusXP: {
    position: 'absolute',
    right: SPACING.sm,
    top: -SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(COLORS.gold, 0.15),
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  bonusIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  bonusText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
  levelUpContainer: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  levelUpText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
  coinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(COLORS.gold, 0.1),
    borderRadius: BORDER_RADIUS.full,
  },
  coinIcon: {
    width: '100%',
    height: '100%',
  },
  coinText: {
    position: 'absolute',
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
});