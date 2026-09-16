import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing } from '../../theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const scaleAnim    = useRef(new Animated.Value(0.8)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const verbsAnim    = useRef(new Animated.Value(0)).current;

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
      // Os três verbos entram por último: são a promessa, e
      // promessa depois do nome soa melhor do que junto.
      Animated.timing(verbsAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#0D0D0D', '#1A1A1A', '#0D0D0D']}
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
          style={[styles.subtitle, { opacity: subtitleAnim }]}
        >
          a sua nova conexão favorita
        </Animated.Text>

        {/* Os três verbos, separados por losangos. Em linha única
            ficariam longos demais para caber sem quebrar feio. */}
        <Animated.View style={[styles.verbsRow, { opacity: verbsAnim }]}>
          <Text style={styles.verb}>Descubra</Text>
          <Text style={styles.verbDot}>◆</Text>
          <Text style={styles.verb}>Sintonize</Text>
          <Text style={styles.verbDot}>◆</Text>
          <Text style={styles.verb}>Acenda</Text>
        </Animated.View>

        <Animated.Text
          style={[styles.vipLine, { opacity: verbsAnim }]}
        >
          o conteúdo VIP
        </Animated.Text>
      </View>

      <Animated.Text
        style={[styles.tagline, { opacity: verbsAnim }]}
      >
        LUMINA
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
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logo: {
    fontSize: 60,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fonts.sizes.xxxl,
    color: colors.white,
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.gold,
    letterSpacing: 1.5,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  verbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  verb: {
    color: colors.white,
    fontSize: fonts.sizes.sm,
    letterSpacing: 2,
    fontWeight: '600',
  },
  verbDot: {
    color: colors.gold,
    fontSize: 7,
    opacity: 0.7,
  },
  vipLine: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    letterSpacing: 3,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  tagline: {
    position: 'absolute',
    bottom: spacing.xxl,
    fontSize: fonts.sizes.xs,
    color: colors.gray,
    letterSpacing: 5,
    opacity: 0.6,
  },
});