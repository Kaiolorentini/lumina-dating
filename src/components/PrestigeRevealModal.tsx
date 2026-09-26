// ============================================
// LUMINA — MODAL DE SUBIDA DE PRESTÍGIO
// src/components/PrestigeRevealModal.tsx
//
// São CINCO na vida inteira de uma conta. Marco comum vai para
// o sino; subir de estágio merece interromper.
//
// A aura do novo estágio é o centro do modal: é o que a pessoa
// acabou de ganhar e o que vai aparecer no card dela. Mostrar
// só o nome do estágio desperdiçaria o momento.
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, Dimensions,
} from 'react-native';
import { PrestigeAura } from './profile/PrestigeAura';
import { auraByStage } from '../config/prestigeAura';
import { colors, fonts, spacing, borderRadius } from '../theme';

const { width } = Dimensions.get('window');
const SCENE_W = Math.min(width * 0.72, 300);
const SCENE_H = SCENE_W * 1.15;

interface Props {
  visible: boolean;
  /** 1 a 4. O estágio 0 nunca abre modal — é o inicial. */
  stage:   number | null;
  onClose: () => void;
}

export default function PrestigeRevealModal({ visible, stage, onClose }: Props) {
  const enter = useRef(new Animated.Value(0)).current;

  const aura = auraByStage(stage);

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      return;
    }

    Animated.timing(enter, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!aura) return null;

  const scale = enter.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.85, 1],
  });
  const translateY = enter.interpolate({
    inputRange:  [0, 1],
    outputRange: [24, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            { borderColor: aura.color, opacity: enter, transform: [{ scale }, { translateY }] },
          ]}
        >
          <Text style={styles.kicker}>Novo estágio de Prestígio</Text>

          {/* A aura do estágio novo, sempre animada: aqui há um
              elemento só na tela e o momento pede. */}
          <View style={styles.scene}>
            <PrestigeAura
              color={aura.color}
              intensity={aura.glow}
              animated
              width={SCENE_W}
              height={SCENE_H}
            />
            <Text style={styles.icon}>{aura.icon}</Text>
          </View>

          <Animated.View style={[styles.info, { transform: [{ translateY }] }]}>
            <Text style={[styles.name, { color: aura.color }]}>{aura.name}</Text>
            <Text style={styles.description}>{aura.description}</Text>
            <Text style={styles.hint}>
              Sua aura aparece agora no seu card, e o título
              ficou disponível na tela de Títulos.
            </Text>
          </Animated.View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: aura.color }]}
            onPress={onClose}
            activeOpacity={0.85}
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
    maxWidth: 380,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  kicker: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scene: {
    width: SCENE_W,
    height: SCENE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 64 },
  info: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  name: {
    fontSize: fonts.sizes.xxl,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  description: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 21,
  },
  hint: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.md,
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