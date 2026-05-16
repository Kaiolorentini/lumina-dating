import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';

interface Props {
  visitasHoje: number;
  onPress?: () => void;
}

export default function VisitsBanner({ visitasHoje, onPress }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visitasHoje > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visitasHoje]);

  if (visitasHoje === 0) return null;

  function getVisitMessage(): string {
    if (visitasHoje === 1) return 'Alguém visitou seu perfil';
    if (visitasHoje < 5) return `${visitasHoje} pessoas visitaram seu perfil`;
    if (visitasHoje < 10) return `${visitasHoje} visitas hoje — você está em alta!`;
    return `🔥 ${visitasHoje} visitas hoje — perfil bombando!`;
  }

  function getVisitIcon(): string {
    if (visitasHoje >= 10) return '🔥';
    if (visitasHoje >= 5) return '⚡';
    return '👀';
  }

  return (
    <Animated.View style={[
      styles.container,
      { transform: [{ scale: pulseAnim }] },
    ]}>
      <TouchableOpacity style={styles.inner} onPress={onPress}>
        <Text style={styles.icon}>{getVisitIcon()}</Text>
        <View style={styles.content}>
          <Text style={styles.message}>{getVisitMessage()}</Text>
          <Text style={styles.sub}>Toque para ver quem visitou</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  icon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
  },
  message: {
    color: colors.white,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  sub: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    marginTop: 2,
  },
  arrow: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
});