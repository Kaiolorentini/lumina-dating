// ============================================
// LUMINA — MODAL DE SINTONIA
// src/components/SintoniaRevealModal.tsx
//
// Duas luzes que se encontram e se fundem — não duas fotos
// lado a lado, que é o padrão do gênero. A identidade do
// Lumina é cósmica, e o momento merece ser o mais bonito do
// app.
//
// A animação tem três tempos: as luzes vêm das bordas, se
// tocam no centro com um clarão, e ficam pulsando juntas.
// Nada de loop infinito de partículas: isso roda no momento
// em que a pessoa abre o app, e travar a abertura seria pior
// que não ter animação.
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../theme';

const { width } = Dimensions.get('window');
const SCENE = Math.min(width * 0.8, 320);

interface Props {
  visible:   boolean;
  /** Nome de quem sintonizou com o usuário. */
  otherName: string;
  onClose:   () => void;
  /** Abre a conversa. Sem isto, só o botão de fechar aparece. */
  onOpenChat?: () => void;
}

export default function SintoniaRevealModal({
  visible,
  otherName,
  onClose,
  onOpenChat,
}: Props) {
  // 0 = luzes nas bordas, 1 = encontradas no centro.
  const approach = useRef(new Animated.Value(0)).current;
  // Clarão do encontro.
  const flash    = useRef(new Animated.Value(0)).current;
  // Respiração depois do encontro.
  const breathe  = useRef(new Animated.Value(1)).current;
  const content  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      approach.setValue(0);
      flash.setValue(0);
      breathe.setValue(1);
      content.setValue(0);
      return;
    }

    Animated.sequence([
      // 1. As luzes se aproximam
      Animated.timing(approach, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      // 2. Clarão do encontro
      Animated.timing(flash, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // 3. Texto entra
      Animated.timing(content, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Respiração contínua, leve.
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: 1.06, duration: 1600,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 1, duration: 1600,
            easing: Easing.inOut(Easing.sin), useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [visible]);

  // As luzes partem das bordas e param no centro.
  const leftX = approach.interpolate({
    inputRange:  [0, 1],
    outputRange: [-SCENE * 0.34, -SCENE * 0.055],
  });
  const rightX = approach.interpolate({
    inputRange:  [0, 1],
    outputRange: [SCENE * 0.34, SCENE * 0.055],
  });

  const flashOpacity = flash.interpolate({
    inputRange:  [0, 0.45, 1],
    outputRange: [0, 0.9, 0.35],
  });
  const flashScale = flash.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.4, 1.25],
  });

  const contentY = content.interpolate({
    inputRange:  [0, 1],
    outputRange: [18, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>

          <View style={styles.scene}>
            {/* Clarão do encontro, atrás das duas luzes */}
            <Animated.View
              style={[
                styles.layer,
                { opacity: flashOpacity, transform: [{ scale: flashScale }] },
              ]}
            >
              <Svg width={SCENE} height={SCENE}>
                <Defs>
                  <RadialGradient id="sintoniaFlash" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
                    <Stop offset="35%"  stopColor={colors.gold} stopOpacity="0.55" />
                    <Stop offset="100%" stopColor={colors.gold} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={SCENE / 2} cy={SCENE / 2} r={SCENE / 2} fill="url(#sintoniaFlash)" />
              </Svg>
            </Animated.View>

            {/* Luz da esquerda — dourada */}
            <Animated.View
              style={[
                styles.layer,
                { transform: [{ translateX: leftX }, { scale: breathe }] },
              ]}
            >
              <Svg width={SCENE} height={SCENE}>
                <Defs>
                  <RadialGradient id="sintoniaLeft" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="22%"  stopColor={colors.gold} stopOpacity="0.85" />
                    <Stop offset="100%" stopColor={colors.gold} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={SCENE / 2} cy={SCENE / 2} r={SCENE * 0.3} fill="url(#sintoniaLeft)" />
              </Svg>
            </Animated.View>

            {/* Luz da direita — violeta, a cor da marca */}
            <Animated.View
              style={[
                styles.layer,
                { transform: [{ translateX: rightX }, { scale: breathe }] },
              ]}
            >
              <Svg width={SCENE} height={SCENE}>
                <Defs>
                  <RadialGradient id="sintoniaRight" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="22%"  stopColor="#B57BEE" stopOpacity="0.85" />
                    <Stop offset="100%" stopColor="#7B2FBE" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={SCENE / 2} cy={SCENE / 2} r={SCENE * 0.3} fill="url(#sintoniaRight)" />
              </Svg>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.content,
              { opacity: content, transform: [{ translateY: contentY }] },
            ]}
          >
            <Text style={styles.title}>✦ Sintonia</Text>
            <Text style={styles.subtitle}>
              Você e {otherName} se encontraram.
            </Text>

            {onOpenChat && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onOpenChat}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>Começar a conversa</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.laterText}>Agora não</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
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
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  scene: {
    width: SCENE,
    height: SCENE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  title: {
    color: colors.gold,
    fontSize: fonts.sizes.xxl,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  subtitle: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fonts.sizes.md,
  },
  laterText: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    paddingVertical: spacing.sm,
  },
});