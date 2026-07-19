import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.surface, COLORS.background]}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.logo}>✦</Text>
          <Text style={styles.title}>Lumina</Text>
        </Animated.View>

        <Animated.Text
          style={[
            styles.subtitle,
            { opacity: subtitleAnim },
          ]}
        >
          Conexões que brilham
        </Animated.Text>
      </View>

      <Animated.Text
        style={[
          styles.tagline,
          { opacity: subtitleAnim },
        ]}
      >
        AI Dating
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logo: {
    fontSize: 60,
    color: COLORS.gold,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.display,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: FONT_SIZE.title,
    color: COLORS.gold,
    letterSpacing: 3,
    marginTop: SPACING.sm,
  },
  tagline: {
    position: 'absolute',
    bottom: SPACING.xxl,
    fontSize: FONT_SIZE.caption,
    color: COLORS.textSecondary,
    letterSpacing: 4,
  },
});
