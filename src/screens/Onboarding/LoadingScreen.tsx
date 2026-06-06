import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { colors, fonts, spacing } from '../../theme';

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

    // Incrementa 1% a cada 70ms = 100% em 7000ms exatos
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
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: fonts.sizes.xxxl,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  appTagline: {
    fontSize: fonts.sizes.sm,
    color: colors.gold,
    letterSpacing: 4,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: colors.gold + '66',
  },
  featuresContainer: {
    width: '100%',
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold + '22',
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    flex: 1,
  },
  frase: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  progressContainer: {
    width: '100%',
    gap: spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    letterSpacing: 2,
  },
  progressPercent: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  progressBg: {
    width: '100%',
    height: 6,
    backgroundColor: colors.grayDark,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.gold,
    borderRadius: 3,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  progressGlow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    opacity: 0.8,
  },
  footer: {
    color: colors.gray + '88',
    fontSize: fonts.sizes.xs,
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
});