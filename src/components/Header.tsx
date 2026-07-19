import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, SHADOWS, GLASS } from '../theme/tokens';
import { RootStackParamList } from '../navigation/types';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { usePulse, useScalePress } from '../hooks';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showHome?: boolean;
  rightElement?: React.ReactNode;
  elevated?: boolean;
  onPress?: () => void;
}

export default function Header({
  title,
  showBack = true,
  showHome = true,
  rightElement,
  elevated,
  onPress,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const canGoBack = navigation.canGoBack();

  const scaleButton = useScalePress(0.92);
  const pulseLogo = usePulse(true, 1, 1.03, 3000);

  const handleBackPress = () => {
    if (canGoBack) navigation.goBack();
    onPress?.();
  };

  return (
    <BlurView
      intensity={elevated ? GLASS.blur.medium : GLASS.blur.subtle}
      tint="dark"
      style={[
        styles.container,
        { paddingTop: insets.top + SPACING.md },
        elevated && styles.elevated,
      ]}
    >
      <View style={styles.left}>
        {showBack && (
          <AnimatedPressable
            style={[styles.button, { transform: [{ scale: scaleButton.scale }] }]}
            onPress={handleBackPress}
            activeOpacity={0.7}
            onPressIn={scaleButton.handlePressIn}
            onPressOut={scaleButton.handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            accessibilityHint="Retorna para a tela anterior"
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Voltar</Text>
          </AnimatedPressable>
        )}
      </View>

      <View style={styles.center}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseLogo.scale }] }}>
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Início"
              accessibilityHint="Abre a tela inicial do Lumina"
            >
              <Text style={styles.logo}>✦ Lumina</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <View style={styles.right}>
        {rightElement ? (
          <AnimatedPressable
            style={styles.button}
            onPress={rightElement ? () => {} : () => navigation.navigate('MainTabs')}
            activeOpacity={0.7}
            onPressIn={scaleButton.handlePressIn}
            onPressOut={scaleButton.handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Abrir menu"
          >
            {rightElement}
          </AnimatedPressable>
        ) : showHome && !canGoBack && (
          <AnimatedPressable
            style={[styles.button, { transform: [{ scale: scaleButton.scale }] }]}
            onPress={() => navigation.navigate('MainTabs')}
            activeOpacity={0.7}
            onPressIn={scaleButton.handlePressIn}
            onPressOut={scaleButton.handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Início"
          >
            <Text style={styles.homeIcon}>⌂</Text>
          </AnimatedPressable>
        )}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  elevated: {
    ...SHADOWS.level1,
    borderBottomWidth: 0,
  },
  left: {
    width: 80,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 80,
    alignItems: 'flex-end',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: SPACING.xs,
    minWidth: 44,
    minHeight: 44,
  },
  backIcon: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.hero,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  backText: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  homeIcon: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.xxl,
  },
  logo: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 2,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
});