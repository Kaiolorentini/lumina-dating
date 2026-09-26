// ============================================
// LUMINA — MODAL DE SUBIDA DE NÍVEL
// src/components/LevelUpModal.tsx
//
// O XPService calculava `leveledUp` e devolvia o valor, mas
// ninguém fazia nada com ele: sem flag, sem notificação, sem
// modal. A pessoa subia de nível e não ficava sabendo.
//
// Flag e não aviso na hora: o XP é creditado em segundo plano
// e o cliente já respondeu à ação faz tempo quando isso roda.
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';

interface Props {
  visible: boolean;
  level:   number | null;
  onClose: () => void;
}

export default function LevelUpModal({ visible, level, onClose }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      pulse.setValue(1);
      return;
    }

    Animated.timing(enter, {
      toValue: 1, duration: 520,
      easing: Easing.out(Easing.back(1.6)), useNativeDriver: true,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06, duration: 1100,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1, duration: 1100,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [visible]);

  if (level === null) return null;

  const scale = enter.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.7, 1],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: enter, transform: [{ scale }] }]}>
          <Text style={styles.kicker}>Você subiu de nível</Text>

          <Animated.View style={[styles.numberRing, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.number}>{level}</Text>
          </Animated.View>

          <Text style={styles.hint}>
            Cada visita, curtida e conversa rende XP. Continue
            assim e a sua Árvore da Sintonia cresce junto.
          </Text>

          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#05040AEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold + '55',
    gap: spacing.md,
  },
  kicker: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  numberRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: colors.gold + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    color: colors.gold,
    fontSize: 58,
    fontWeight: 'bold',
  },
  hint: {
    color: colors.grayLight,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  button: {
    marginTop: spacing.xs,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
});