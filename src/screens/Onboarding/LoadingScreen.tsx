import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';

const { width, height } = Dimensions.get('window');
export const LOADING_DURATION = 7000;

const FRASES = [
  'Encontrando sua sintonia perfeita...',
  'Conexoes que brilham esperando por voce...',
  'IA preparando seus matches...',
  'Descobrindo perfis compativeis...',
  'Sincronizando sua conta...',
  'Seu mundo de conexoes esta pronto...',
];

export default function AppLoadingScreen() {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const [fraseIndex, setFraseIndex] = useState(0);
  const fraseAnim = useRef(new Animated.Value(1)).current;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: LOADING_DURATION,
      useNativeDriver: false,
    }).start();

    let currentPercent = 0;
    const percentInterval = setInterval(() => {
      currentPercent += 1;
      if (currentPercent >= 100) {
        currentPercent = 100;
        setPercent(100);
        clearInterval(percentInterval);
      } else {
        setPercent(currentPercent);
      }
    }, 70);

    const fraseInterval = setInterval(() => {
      Animated.timing(fraseAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setFraseIndex(prev => (prev + 1) % FRASES.length);
        Animated.timing(fraseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 1100);

    return () => {
      clearInterval(percentInterval);
      clearInterval(fraseInterval);
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <Image
            source={require('../../../assets/splash-icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Lumina</Text>
          <Text style={styles.appTagline}>AI Dating</Text>
        </Animated.View>

        <View style={styles.divider} />

        <View style={styles.featuresContainer}>
          <FeatureItem icon="✦" text="10 modelos de IA exclusivos" delay={300} />
          <FeatureItem icon="💬" text="Chat em tempo real com match" delay={600} />
          <FeatureItem icon="💰" text="Sistema de moedas e recompensas" delay={900} />
          <FeatureItem icon="🔔" text="Notificacoes de novas conexoes" delay={1200} />
        </View>

        <Animated.Text style={[styles.frase, { opacity: fraseAnim }]}>
          {FRASES[fraseIndex]}
        </Animated.Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Carregando</Text>
            <Text style={styles.progressPercent}>{percent}%</Text>
          </View>
          <View style={styles.progressBg}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
              <View style={styles.progressGlow} />
            </Animated.View>
          </View>
        </View>

      </Animated.View>

      <Text style={styles.footer}>Lumina Dating © 2026</Text>
    </View>
  );
}

function FeatureItem({ icon, text, delay }: { icon: string; text: string; delay: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, delay);
  }, []);

  return (
    <Animated.View style={[
      styles.featureItem,
      { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
    ]}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    height,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  logoContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: FONT_SIZE.display,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 6,
  },
  appTagline: {
    fontSize: FONT_SIZE.caption,
    color: COLORS.gold,
    letterSpacing: 4,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: alpha(COLORS.gold, 0.4),
  },
  featuresContainer: {
    width: '100%',
    gap: SPACING.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: alpha(COLORS.gold, 0.13),
  },
  featureIcon: {
    fontSize: FONT_SIZE.title,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.body,
    flex: 1,
  },
  frase: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.caption,
    textAlign: 'center',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  progressContainer: {
    width: '100%',
    gap: SPACING.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.overline,
    letterSpacing: 2,
  },
  progressPercent: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.overline,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1,
  },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  progressGlow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textPrimary,
    opacity: 0.8,
  },
  footer: {
    color: alpha(COLORS.textSecondary, 0.67),
    fontSize: FONT_SIZE.overline,
    letterSpacing: 2,
    marginBottom: SPACING.xl,
  },
});
