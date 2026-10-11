// ============================================
// LUMINA — MODAL DE COMEMORAÇÃO DA COLEÇÃO v1.0
// src/modules/engagement/components/CollectionClaimModal.tsx
//
// Aparece depois do toque em "Coletar" numa coleção completa
// (10/10/2026). Mostra o ícone da coleção crescendo, uma chuva de
// fragmentos, o contador subindo até o valor coletado e o novo
// total do Cofre. Dois caminhos: "Ver meu Cofre" ou "Continuar".
//
// Só Animated do React Native (useNativeDriver) — sem biblioteca
// nova, igual no Android e no iOS. Respeita o "Reduzir movimento"
// do sistema: sem animação, mostra tudo direto.
// ============================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing,
  AccessibilityInfo, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../../theme/tokens';

export interface CollectionClaimInfo {
  icon:           string;
  title:          string;
  tierColor:      string;
  fragments:      number;
  vaultFragments: number;
}

interface Props {
  info:        CollectionClaimInfo | null;
  onClose:     () => void;
  onOpenVault: () => void;
}

const PARTICLE_COUNT = 14;
const PARTICLE_ICONS = ['🔮', '✨', '💎', '✨'];

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

export default function CollectionClaimModal({ info, onClose, onOpenVault }: Props) {
  const visible = info !== null;

  const iconScale   = useRef(new Animated.Value(0)).current;
  const glowSpin    = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const burst       = useRef(new Animated.Value(0)).current;
  const counter     = useRef(new Animated.Value(0)).current;

  const [shownFragments, setShownFragments] = useState(0);
  const [reduceMotion,   setReduceMotion]   = useState(false);

  // Direção de cada partícula: espalhadas num círculo, distância variada.
  const particles = useMemo(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle    = (i / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 110 + (i % 3) * 30;
    return {
      key:  `p${i}`,
      icon: PARTICLE_ICONS[i % PARTICLE_ICONS.length],
      dx:   Math.cos(angle) * distance,
      dy:   Math.sin(angle) * distance,
    };
  }), []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => { if (mounted) setReduceMotion(enabled); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!info) return;

    const listenerId = counter.addListener(({ value }) => setShownFragments(Math.round(value)));

    if (reduceMotion) {
      iconScale.setValue(1);
      contentFade.setValue(1);
      burst.setValue(1);
      counter.setValue(info.fragments);
      setShownFragments(info.fragments);
      AccessibilityInfo.announceForAccessibility(
        `Coleção coletada. Mais ${info.fragments} fragmentos no seu Cofre.`,
      );
      return () => counter.removeListener(listenerId);
    }

    iconScale.setValue(0);
    contentFade.setValue(0);
    burst.setValue(0);
    counter.setValue(0);
    glowSpin.setValue(0);
    setShownFragments(0);

    const spin = Animated.loop(
      Animated.timing(glowSpin, {
        toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    spin.start();

    const sequence = Animated.sequence([
      Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(burst, {
          toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        // O contador anima um número de texto — não roda no driver nativo.
        Animated.timing(counter, {
          toValue: info.fragments, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false,
        }),
      ]),
    ]);
    sequence.start();

    AccessibilityInfo.announceForAccessibility(
      `Coleção coletada. Mais ${info.fragments} fragmentos no seu Cofre.`,
    );

    return () => {
      spin.stop();
      sequence.stop();
      counter.removeListener(listenerId);
    };
  }, [info, reduceMotion, iconScale, glowSpin, contentFade, burst, counter]);

  if (!info) return null;

  const rotate = glowSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <LinearGradient
          colors={[COLORS.card, COLORS.background]}
          style={[styles.card, { borderColor: info.tierColor }]}
        >
          {/* Ícone com brilho girando e chuva de fragmentos */}
          <View style={styles.stage} accessible={false}>
            <Animated.View
              style={[
                styles.glow,
                { borderColor: info.tierColor + '88', transform: [{ rotate }] },
              ]}
            />
            {particles.map(p => (
              <Animated.Text
                key={p.key}
                style={[
                  styles.particle,
                  {
                    opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                      { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                      { scale:      burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.1] }) },
                    ],
                  },
                ]}
              >
                {p.icon}
              </Animated.Text>
            ))}
            <Animated.Text style={[styles.icon, { transform: [{ scale: iconScale }] }]}>
              {info.icon}
            </Animated.Text>
          </View>

          <Animated.View style={[styles.content, { opacity: contentFade }]}>
            <Text style={[styles.kicker, { color: info.tierColor }]}>COLEÇÃO COLETADA!</Text>
            <Text style={styles.title} accessibilityRole="header">{info.title}</Text>

            <Text style={styles.amount}>+{formatNumber(shownFragments)}</Text>
            <Text style={styles.amountLabel}>🔮 Fragmentos guardados no seu Cofre</Text>

            <View style={styles.vaultBox}>
              <Text style={styles.vaultLabel}>🗝️ Total no Cofre agora</Text>
              <Text style={styles.vaultValue}>{formatNumber(info.vaultFragments)}</Text>
            </View>

            <Text style={styles.hint}>
              No Cofre você pode sacar os fragmentos para a sua carteira e trocar por cristais.
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: info.tierColor }]}
              onPress={onOpenVault}
              accessibilityRole="button"
              accessibilityLabel="Ver meu Cofre"
            >
              <Text style={styles.primaryText}>Ver meu Cofre</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Continuar nas coleções"
            >
              <Text style={styles.secondaryText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const S = SPACING;
const R = BORDER_RADIUS;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center', padding: S.lg,
  },
  card: {
    width: '100%', maxWidth: 380, borderRadius: R.xl, borderWidth: 1.5,
    paddingVertical: S.lg, paddingHorizontal: S.lg, alignItems: 'center', overflow: 'hidden',
  },
  stage: {
    width: 180, height: 180, alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    borderWidth: 3, borderStyle: 'dashed',
  },
  particle: { position: 'absolute', fontSize: 20 },
  icon: {
    fontSize: 72,
    // Evita o emoji cortado no topo em alguns Android.
    lineHeight: Platform.OS === 'android' ? 90 : undefined,
  },
  content:  { width: '100%', alignItems: 'center', gap: S.xs },
  kicker:   { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.extrabold, letterSpacing: 1.5 },
  title:    { color: COLORS.surface, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.extrabold, textAlign: 'center' },
  amount:   { color: COLORS.secondary, fontSize: 48, fontWeight: FONT_WEIGHT.extrabold, marginTop: S.sm },
  amountLabel: { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, textAlign: 'center' },
  vaultBox: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.secondary + '1A', borderRadius: R.lg,
    paddingVertical: S.sm, paddingHorizontal: S.md, marginTop: S.md,
  },
  vaultLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  vaultValue: { color: COLORS.secondary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  hint: {
    color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center',
    lineHeight: 16, marginTop: S.sm,
  },
  primaryBtn: {
    width: '100%', borderRadius: R.full, paddingVertical: S.md,
    alignItems: 'center', marginTop: S.md,
  },
  primaryText:   { color: '#111111', fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.extrabold },
  secondaryBtn:  { width: '100%', paddingVertical: S.sm, alignItems: 'center' },
  secondaryText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold },
});
