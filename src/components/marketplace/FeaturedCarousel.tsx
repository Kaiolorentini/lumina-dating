// ============================================
// LUMINA — CARROSSEL DE DESTAQUES
// src/components/marketplace/FeaturedCarousel.tsx
//
// Coverflow 3D: o card central de frente, os vizinhos rotacionados
// no eixo Y e reduzidos. O painel de informação vive ABAIXO, em
// texto reto — a rotação prejudicaria a leitura de preço e título
// se eles estivessem dentro do card.
//
// PERFORMANCE (o carrossel roda na home, sempre montado):
// 1. rotateY, scale e opacity vêm de interpolate sobre UM
//    Animated.Value alimentado pelo scroll — useNativeDriver
//    true, tudo na thread de UI.
// 2. FlatList com windowSize 3: só os cards vizinhos ficam
//    montados. Uma ScrollView renderizaria todos de uma vez.
// 3. O avanço automático usa scrollToOffset, não state — não
//    dispara re-render da lista a cada 4s.
// 4. O painel de info é o único que re-renderiza, e só quando o
//    índice central muda de fato.
//
// INTERAÇÃO: qualquer toque ou arrasto pausa o giro por 8s.
// Sem isso o carrossel troca o card que a pessoa está olhando.
// ============================================

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Animated, Dimensions,
  TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MP, MP_GRADIENT, MP_SHADOW, MP_FONT, MP_CATEGORY,
  spacing, borderRadius,
} from '../../theme/marketplace';
import { Product } from '../../shared/types/marketplace';

const { width: SCREEN_W } = Dimensions.get('window');

const CARD_W   = Math.round(SCREEN_W * 0.62);
const CARD_H   = Math.round(CARD_W * 1.15);
const SPACING_ = spacing.md;
const ITEM_W   = CARD_W + SPACING_;
const SIDE_PAD = (SCREEN_W - CARD_W) / 2;

const AUTOPLAY_MS = 4000;
const PAUSE_MS    = 8000;

interface Props {
  products: Product[];
  onPressProduct: (productId: string) => void;
}

// ------------------------------------------
// Card individual — memo evita recriar a árvore
// enquanto só o scroll muda.
// ------------------------------------------
const CoverCard = memo(function CoverCard({
  product, index, scrollX, onPress,
}: {
  product: Product;
  index: number;
  scrollX: Animated.Value;
  onPress: () => void;
}) {
  const inputRange = [
    (index - 1) * ITEM_W,
    index * ITEM_W,
    (index + 1) * ITEM_W,
  ];

  const rotateY = scrollX.interpolate({
    inputRange,
    outputRange: ['38deg', '0deg', '-38deg'],
    extrapolate: 'clamp',
  });

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.82, 1, 0.82],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.45, 1, 0.45],
    extrapolate: 'clamp',
  });

  const translateX = scrollX.interpolate({
    inputRange,
    outputRange: [22, 0, -22],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.itemWrap}>
      <Animated.View
        style={[
          styles.cardShell,
          {
            opacity,
            transform: [
              { perspective: 900 },
              { rotateY },
              { scale },
              { translateX },
            ],
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.cardTouch}>
          <Image
            source={{ uri: product.coverImage || 'https://via.placeholder.com/500' }}
            style={styles.cover}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(11,7,22,0.65)', 'transparent', 'rgba(11,7,22,0.55)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✦ DESTAQUE</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

// ------------------------------------------
// Carrossel
// ------------------------------------------
export function FeaturedCarousel({ products, onPressProduct }: Props) {
  const scrollX  = useRef(new Animated.Value(0)).current;
  const listRef  = useRef<FlatListType>(null);
  const indexRef = useRef(0);
  const pausedUntil = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);

  // Autoplay. scrollToOffset em vez de setState: mover o índice
  // por estado re-renderizaria a lista inteira a cada 4 segundos.
  useEffect(() => {
    if (products.length <= 1) return;

    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;

      const next = (indexRef.current + 1) % products.length;
      listRef.current?.scrollToOffset({
        offset: next * ITEM_W,
        animated: true,
      });
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [products.length]);

  const pause = useCallback(() => {
    pausedUntil.current = Date.now() + PAUSE_MS;
  }, []);

  // O índice central sai do offset — só atualiza o state quando
  // muda de verdade, para o painel de info não piscar a cada frame.
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_W);
    if (idx !== indexRef.current && idx >= 0 && idx < products.length) {
      indexRef.current = idx;
      setActiveIndex(idx);
    }
  }, [products.length]);

  if (products.length === 0) return null;

  const active = products[activeIndex] ?? products[0];
  const cat = MP_CATEGORY[active.category as keyof typeof MP_CATEGORY];
  const isFree = active.isFree || active.price === 0;

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={listRef as any}
        data={products}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_W}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
        // Só os vizinhos montados — evita segurar N imagens grandes.
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        getItemLayout={(_: unknown, index: number) => ({
          length: ITEM_W, offset: ITEM_W * index, index,
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true, listener: handleScroll as any },
        )}
        scrollEventThrottle={16}
        onScrollBeginDrag={pause}
        onMomentumScrollEnd={pause}
        renderItem={({ item, index }: { item: Product; index: number }) => (
          <CoverCard
            product={item}
            index={index}
            scrollX={scrollX}
            onPress={() => { pause(); onPressProduct(item.id); }}
          />
        )}
      />

      {/* Painel de informação — gira junto com o card central,
          mas em texto reto para não perder legibilidade. */}
      <View style={styles.info}>
        <View style={styles.catRow}>
          <Text style={styles.catIcon}>{cat?.icon ?? '✧'}</Text>
          <Text style={styles.catLabel}>{cat?.label ?? active.category}</Text>
          {active.averageRating > 0 && (
            <>
              <View style={styles.dot} />
              <Text style={styles.rating}>★ {active.averageRating.toFixed(1)}</Text>
            </>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>{active.title}</Text>

        <View style={styles.priceRow}>
          {isFree ? (
            <Text style={styles.priceFree}>Grátis</Text>
          ) : (
            <View style={styles.priceGroup}>
              <Text style={styles.priceCurrency}>R$</Text>
              <Text style={styles.priceValue}>
                {active.price.toFixed(2).replace('.', ',')}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.cta}
            onPress={() => { pause(); onPressProduct(active.id); }}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Ver produto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Indicadores */}
      <View style={styles.dots}>
        {products.map((_, i) => (
          <View
            key={i}
            style={[styles.dotIndicator, i === activeIndex && styles.dotIndicatorActive]}
          />
        ))}
      </View>
    </View>
  );
}

// Tipo do ref — Animated.FlatList não expõe o tipo diretamente.
type FlatListType = { scrollToOffset: (p: { offset: number; animated?: boolean }) => void };

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },

  itemWrap: {
    width: ITEM_W,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cardShell: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: borderRadius.lg,
    ...MP_SHADOW.purpleGlow,
  },
  cardTouch: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: MP.borderStrong,
    overflow: 'hidden',
    backgroundColor: MP.surface,
  },
  cover: { width: '100%', height: '100%' },

  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: MP.gold,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    color: MP.textOnGold,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.wider,
  },

  info: {
    paddingHorizontal: spacing.lg,
    gap: 7,
    alignItems: 'center',
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catIcon: { fontSize: 12 },
  catLabel: {
    color: MP.purpleLight,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: MP_FONT.tracking.wide,
  },
  dot: {
    width: 3, height: 3,
    borderRadius: borderRadius.full,
    backgroundColor: MP.textMuted,
  },
  rating: {
    color: MP.goldLight,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
  },

  title: {
    color: MP.text,
    fontSize: MP_FONT.size.xl,
    fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.tight,
    textAlign: 'center',
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  priceCurrency: {
    color: MP.gold,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.semibold,
  },
  priceValue: {
    color: MP.gold,
    fontSize: MP_FONT.size.xxl,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.tight,
  },
  priceFree: {
    color: MP.free,
    fontSize: MP_FONT.size.xxl,
    fontWeight: MP_FONT.weight.heavy,
  },

  cta: {
    backgroundColor: MP.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    ...MP_SHADOW.goldGlow,
  },
  ctaText: {
    color: MP.textOnGold,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.heavy,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  dotIndicator: {
    width: 6, height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: MP.border,
  },
  dotIndicatorActive: {
    width: 20,
    backgroundColor: MP.gold,
  },
});