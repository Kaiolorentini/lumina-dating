// ============================================
// LUMINA — CARROSSEL DA ESPERA
// src/modules/verification/components/WaitingCarousel.tsx
//
// A espera pela aprovação é onboarding, não tela morta:
// a pessoa já se cadastrou e está parada — é o melhor
// momento para explicar o que o app faz.
//
// SEM conteúdo adulto nem imagens do marketplace: a
// verificação existe justamente para impedir isso antes
// da aprovação. O marketplace aparece só como texto.
//
// Animação com Animated do React Native, sem biblioteca
// nova: fade + leve subida, que é suficiente e não pesa
// no bundle.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../../theme';

const SLIDE_MS = 5000;
const FADE_MS = 400;

interface Slide {
  icon: string;
  title: string;
  body: string;
  /** Destaque em dourado sob o texto. Opcional. */
  highlight?: string;
}

const SLIDES: Slide[] = [
  {
    icon: '✨',
    title: 'Sintonia',
    body:
      'O Lumina calcula a compatibilidade entre você e cada pessoa a partir do que vocês têm em comum. Não é sorte: é Sintonia.',
  },
  {
    icon: '🗝️',
    title: 'Cofre de Sintonia',
    body:
      'Curtir, conversar e visitar perfis enche seu Cofre de Fragmentos. Eles viram Cristais, e Cristais abrem recursos do app.',
    highlight: 'Dá para evoluir sem gastar nada',
  },
  {
    icon: '🌱',
    title: 'Árvore da Sintonia',
    body:
      'Cada interação real faz sua Árvore crescer: de Broto a Galáxia. A cada estágio, uma recompensa nova.',
  },
  {
    icon: '🖼️',
    title: 'Molduras e badges',
    body:
      'Seu perfil ganha molduras animadas e emblemas que contam quem você é antes da primeira mensagem.',
  },
  {
    icon: '🏆',
    title: 'Conquistas e coleções',
    body:
      'São dezenas de conquistas escondidas pelo app. Complete uma coleção inteira e ganhe recompensas exclusivas.',
  },
  {
    icon: '💫',
    title: 'Conteúdo de criadores',
    body:
      'Criadores aprovados publicam conteúdo exclusivo no Lumina. Disponível só para contas verificadas.',
  },
  {
    icon: '🌟',
    title: 'Fundador',
    body:
      'As 2000 primeiras contas verificadas entram na história do Lumina com a conquista Fundador: moldura, emblema e título exclusivos, que ninguém mais poderá ganhar.',
    highlight: 'Sua verificação ainda está em tempo',
  },
];

export default function WaitingCarousel() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out, troca o conteúdo, fade in subindo.
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: FADE_MS, useNativeDriver: true }),
      ]).start(() => {
        if (!mountedRef.current) return;

        setIndex(prev => (prev + 1) % SLIDES.length);
        translateY.setValue(12);

        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        ]).start();
      });
    }, SLIDE_MS);

    return () => clearInterval(timer);
  }, [opacity, translateY]);

  function goTo(target: number) {
    if (target === index) return;
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (!mountedRef.current) return;
      setIndex(target);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }

  const slide = SLIDES[index];

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
        {slide.highlight ? (
          <Text style={styles.highlight}>{slide.highlight}</Text>
        ) : null}
      </Animated.View>

      {/* Indicador: também permite tocar para adiantar,
          para quem não quer esperar os 5 segundos. */}
      <View style={styles.dots}>
        {SLIDES.map((item, i) => (
          <TouchableOpacity
            key={item.title}
            onPress={() => goTo(i)}
            hitSlop={8}
            accessibilityLabel={`Ver ${item.title}`}
          >
            <View style={[styles.dot, i === index && styles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gold + '33',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    // Altura fixa: sem isso o card pula de tamanho a cada
    // troca de slide e a animação fica desconfortável.
    minHeight: 260,
    justifyContent: 'center',
    width: '100%',
  },
  icon: { fontSize: 48 },
  title: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  body: {
    color: colors.grayLight,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  highlight: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.grayDark,
  },
  dotActive: { backgroundColor: colors.gold, width: 20 },
});