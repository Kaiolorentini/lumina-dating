import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../theme/tokens';

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
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  icon: {
    fontSize: FONT_SIZE.hero,
  },
  content: {
    flex: 1,
  },
  message: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  arrow: {
    color: COLORS.gold,
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
  },
});