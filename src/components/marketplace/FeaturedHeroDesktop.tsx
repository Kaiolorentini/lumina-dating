// ============================================
// LUMINA — DESTAQUES DO MARKETPLACE (COMPUTADOR)
// src/components/marketplace/FeaturedHeroDesktop.tsx
//
// 13/10/2026 (web D7, correção do D5): os destaques eram 2 cartões
// lado a lado com a capa esticada para ~600×230 — a imagem ficava
// cortada e borrada, sem cara de vitrine. Agora é um carrossel de
// verdade:
//   • palco grande: a capa NÍTIDA em 4:5 (nunca esticada) sobre o
//     fundo da própria capa desfocado, título, categoria, nota,
//     preço e "Ver produto";
//   • ao lado, a fila dos outros destaques (miniaturas clicáveis);
//   • setas ‹ ›, pontos e giro automático a cada 6 s, que PARA com
//     o mouse em cima (a pessoa nunca perde o que está lendo).
// Usa a mesma lista de destaques que a tela já busca.
// ============================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MP, MP_FONT, MP_CATEGORY } from '../../theme/marketplace';
import { Product, ProductCategory } from '../../shared/types/marketplace';
import { ratingShort, ratingA11y } from '../../shared/utils/rating';
import HoverPressable from '../web/HoverPressable';
import { useBreakpoint } from '../../hooks/useBreakpoint';

const AUTOPLAY_MS  = 6000;
const STAGE_HEIGHT = 320;
const COVER_W      = 216;
const COVER_H      = 270;   // 4:5
const QUEUE_MAX    = 4;
/** Abaixo desta largura de janela a fila lateral some (falta espaço). */
const QUEUE_MIN_WINDOW = 1200;

interface Props {
  products: Product[];
  onOpen:   (productId: string) => void;
}

function priceLabel(p: Product): string {
  return p.isFree || p.price === 0 ? 'Grátis' : `R$ ${p.price.toFixed(2).replace('.', ',')}`;
}

export default function FeaturedHeroDesktop({ products, onOpen }: Props) {
  const [index, setIndex]     = useState(0);
  const [hovered, setHovered] = useState(false);
  const count = products.length;
  const { width } = useBreakpoint();
  const showQueue = width >= QUEUE_MIN_WINDOW;

  // A lista pode encolher (produto tirado do destaque).
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || hovered) return;
    const id = setInterval(() => setIndex(i => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, hovered]);

  if (count === 0) return null;
  const current = products[Math.min(index, count - 1)];
  const cat = MP_CATEGORY[current.category as ProductCategory];
  const queue = products
    .map((p, i) => ({ p, i }))
    .filter(x => x.i !== index)
    .slice(0, QUEUE_MAX);

  const go = (delta: number) => setIndex(i => (i + delta + count) % count);

  return (
    <Pressable
      accessible={false}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={styles.wrap}
    >
      {/* ── Palco ── */}
      <View style={styles.stage} accessibilityLabel={`Destaque ${index + 1} de ${count}: ${current.title}`}>
        {current.coverImage ? (
          <Image source={{ uri: current.coverImage }} style={StyleSheet.absoluteFill} blurRadius={28} resizeMode="cover" />
        ) : null}
        <LinearGradient
          colors={['rgba(10,5,18,0.96)', 'rgba(10,5,18,0.78)', 'rgba(10,5,18,0.55)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.stageRow}>
          <HoverPressable
            onPress={() => onOpen(current.id)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${current.title}`}
            style={styles.cover}
            hoverStyle={styles.coverHover}
          >
            {current.coverImage ? (
              <Image source={{ uri: current.coverImage }} style={styles.coverImg} resizeMode="cover" />
            ) : (
              <View style={[styles.coverImg, styles.coverEmpty]}>
                <Text style={styles.coverEmptyIcon}>{cat?.icon ?? '✧'}</Text>
              </View>
            )}
          </HoverPressable>

          <View style={styles.info}>
            <Text style={styles.kicker}>{index === 0 ? '✦ DESTAQUE DA SEMANA' : '✦ EM DESTAQUE'}</Text>
            <Text style={styles.title} numberOfLines={2}>{current.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{cat?.icon} {cat?.label ?? current.category}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.rating} accessibilityLabel={ratingA11y(current)}>{ratingShort(current)}</Text>
            </View>
            <Text style={styles.price}>{priceLabel(current)}</Text>
            <View style={styles.actions}>
              <HoverPressable
                onPress={() => onOpen(current.id)}
                accessibilityRole="button"
                style={styles.cta}
                hoverStyle={styles.ctaHover}
              >
                <Text style={styles.ctaText}>Ver produto</Text>
              </HoverPressable>
              {count > 1 && (
                <View style={styles.nav}>
                  <HoverPressable onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Destaque anterior" style={styles.arrow} hoverStyle={styles.arrowHover}>
                    <Text style={styles.arrowText}>‹</Text>
                  </HoverPressable>
                  <View style={styles.dots}>
                    {products.map((p, i) => (
                      <Pressable
                        key={p.id}
                        onPress={() => setIndex(i)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ir para o destaque ${i + 1}`}
                        style={[styles.dot, i === index && styles.dotActive]}
                      />
                    ))}
                  </View>
                  <HoverPressable onPress={() => go(1)} accessibilityRole="button" accessibilityLabel="Próximo destaque" style={styles.arrow} hoverStyle={styles.arrowHover}>
                    <Text style={styles.arrowText}>›</Text>
                  </HoverPressable>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ── Fila dos outros destaques ── */}
      {showQueue && queue.length > 0 && (
        <View style={styles.queue} accessibilityLabel="Outros destaques">
          <Text style={styles.queueTitle}>Também em destaque</Text>
          {queue.map(({ p, i }) => (
            <HoverPressable
              key={p.id}
              onPress={() => setIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={`Mostrar ${p.title}`}
              style={styles.queueItem}
              hoverStyle={styles.queueItemHover}
            >
              {p.coverImage ? (
                <Image source={{ uri: p.coverImage }} style={styles.queueCover} resizeMode="cover" />
              ) : (
                <View style={[styles.queueCover, styles.coverEmpty]} />
              )}
              <View style={styles.queueInfo}>
                <Text style={styles.queueName} numberOfLines={2}>{p.title}</Text>
                <Text style={styles.queuePrice}>{priceLabel(p)}</Text>
              </View>
            </HoverPressable>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap:  { flexDirection: 'row', gap: 16, height: STAGE_HEIGHT },
  stage: { flex: 1, minWidth: 0, borderRadius: 24, overflow: 'hidden', backgroundColor: MP.bgElevated, borderWidth: 1, borderColor: MP.border },
  stageRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 32, paddingHorizontal: 28 },
  cover: { width: COVER_W, height: COVER_H, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: MP.borderGold },
  coverHover: { borderColor: MP.gold, transform: [{ scale: 1.02 }] },
  coverImg:   { width: '100%', height: '100%', backgroundColor: MP.surface },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: MP.surface },
  coverEmptyIcon: { fontSize: 48 },

  info:    { flex: 1, minWidth: 0, gap: 10 },
  kicker:  { color: MP.goldLight, fontSize: 12, fontWeight: MP_FONT.weight.bold, letterSpacing: 1.2 },
  title:   { color: MP.text, fontSize: 30, fontWeight: MP_FONT.weight.heavy, lineHeight: 36 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta:    { color: MP.purpleLight, fontSize: 14, fontWeight: MP_FONT.weight.bold },
  metaDot: { color: MP.textMuted },
  rating:  { color: MP.goldLight, fontSize: 14, fontWeight: MP_FONT.weight.bold },
  price:   { color: MP.goldLight, fontSize: 26, fontWeight: MP_FONT.weight.heavy, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 6, flexWrap: 'wrap' },
  cta:     { paddingHorizontal: 26, paddingVertical: 12, borderRadius: 14, backgroundColor: MP.gold },
  ctaHover: { backgroundColor: MP.goldLight },
  ctaText: { color: MP.textOnGold, fontWeight: MP_FONT.weight.heavy, fontSize: 15 },
  nav:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: MP.border, backgroundColor: 'rgba(10,5,18,0.6)' },
  arrowHover: { borderColor: MP.gold },
  arrowText: { color: MP.text, fontSize: 22, lineHeight: 24, fontWeight: MP_FONT.weight.bold },
  dots:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 22, backgroundColor: MP.gold },

  queue:      { width: 270, gap: 8, padding: 14, borderRadius: 24, backgroundColor: MP.surface, borderWidth: 1, borderColor: MP.border },
  queueTitle: { color: MP.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  queueItem:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, borderRadius: 12 },
  queueItemHover: { backgroundColor: MP.bgElevated },
  queueCover: { width: 48, height: 60, borderRadius: 8 },
  queueInfo:  { flex: 1, minWidth: 0, gap: 3 },
  queueName:  { color: MP.text, fontSize: 13, fontWeight: MP_FONT.weight.bold, lineHeight: 17 },
  queuePrice: { color: MP.goldLight, fontSize: 13, fontWeight: MP_FONT.weight.bold },
});
