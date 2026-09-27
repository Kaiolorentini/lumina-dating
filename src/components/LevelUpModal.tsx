// ============================================
// LUMINA — MODAL DE SUBIDA DE NÍVEL
// src/components/LevelUpModal.tsx
//
// O XPService calculava `leveledUp` e devolvia o valor, mas
// ninguém fazia nada com ele: sem flag, sem notificação, sem
// modal. A pessoa subia de nível e não ficava sabendo.
//
// v2 — MARCOS DE NÍVEL. Quando o nível atravessado é um marco
// (10, 20, 30, 40, 46 a 50), o MESMO modal mostra o prêmio:
// fragmentos no Cofre e/ou cristais premium. Um modal só — dois
// em fila para o mesmo momento cansariam.
//
// O prêmio JÁ FOI CREDITADO pelo servidor quando isto aparece:
// o modal comemora, não resgata.
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../theme';

export interface LevelRewardInfo {
  /** Maior marco atravessado. */
  level:           number;
  fragments:       number;
  crystalsPremium: number;
}

interface Props {
  visible: boolean;
  level:   number | null;
  /** Presente quando o nível atravessado é um marco. */
  reward?: LevelRewardInfo | null;
  onClose: () => void;
}

export default function LevelUpModal({ visible, level, reward, onClose }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      pulse.setValue(1);
      return;
    }

    let loop: Animated.CompositeAnimation | null = null;

    Animated.timing(enter, {
      toValue: 1, duration: 520,
      easing: Easing.out(Easing.back(1.6)), useNativeDriver: true,
    }).start(() => {
      loop = Animated.loop(
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
      );
      loop.start();
    });

    return () => { loop?.stop(); };
  }, [visible]);

  if (level === null) return null;

  const scale = enter.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.7, 1],
  });

  const hasReward = !!reward && (reward.fragments > 0 || reward.crystalsPremium > 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            hasReward && styles.cardReward,
            { opacity: enter, transform: [{ scale }] },
          ]}
        >
          <Text style={styles.kicker}>
            {hasReward ? 'Marco alcançado' : 'Você subiu de nível'}
          </Text>

          <Animated.View style={[styles.numberRing, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.number}>{level}</Text>
          </Animated.View>

          {hasReward && reward ? (
            <View style={styles.rewardBox}>
              <Text style={styles.rewardTitle}>🎁 Recompensa do nível {reward.level}</Text>
              {reward.fragments > 0 && (
                <Text style={styles.rewardLine}>
                  🔮 {reward.fragments} fragmentos no seu Cofre
                </Text>
              )}
              {reward.crystalsPremium > 0 && (
                <Text style={styles.rewardLinePremium}>
                  💎 {reward.crystalsPremium} cristais premium
                </Text>
              )}
              <Text style={styles.rewardNote}>Já está na sua conta.</Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              Cada visita, curtida e conversa rende XP. Continue
              assim e a sua Árvore da Sintonia cresce junto.
            </Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
          >
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
  cardReward: {
    borderColor: colors.gold,
    borderWidth: 2,
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
  rewardBox: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold + '12',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rewardTitle: {
    color: colors.gold,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  rewardLine: {
    color: '#B57BEE',
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  rewardLinePremium: {
    color: '#FFD700',
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
  },
  rewardNote: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    marginTop: 2,
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