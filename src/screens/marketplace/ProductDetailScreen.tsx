// ============================================
// LUMINA — PRODUCT DETAIL v3.0
// src/screens/marketplace/ProductDetailScreen.tsx
//
// v3.0 — tema do marketplace. A tela usava o tema clássico e
// o usuário saía de um card roxo para uma página dourada sem
// relação visual.
//
// Nenhuma regra mudou: modal de CPF, cupom expansível, guards
// de bloqueio e de marketplace desativado, tratamento de sale
// pendente — tudo idêntico à v2.
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert, Dimensions, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MP, MP_GRADIENT, MP_SHADOW, MP_FONT, MP_CATEGORY,
  spacing, borderRadius,
} from '../../theme/marketplace';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';
import { useReviews } from '../../hooks/useReviews';
import { usePurchases } from '../../hooks/usePurchases';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useAppSettings } from '../../hooks/useAppSettings';
import { getProduct, incrementProductViews } from '../../services/marketplace/productService';
import { Product } from '../../shared/types/marketplace';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import ScreenContainer from '../../components/ScreenContainer';
import CpfPromptModal from '../../components/CpfPromptModal';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'ProductDetail'>;
const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { productId } = route.params;
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [showCoupon, setShowCoupon] = useState(false);
  const [awaitingCpf, setAwaitingCpf] = useState(false);

  const { favoriteIds, toggleFavorite } = useFavorites(user?.uid);
  const { reviews } = useReviews(productId, user?.uid);
  const { checkAccess } = usePurchases(user?.uid);
  const { marketplaceEnabled } = useAppSettings();
  const { isBlocked } = useUserPermissions(user?.uid);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    loadProduct();
    incrementProductViews(productId).catch(() => {});
  }, [productId]);

  useEffect(() => {
    if (user?.uid) {
      checkAccess(productId).then(setHasAccess);
    }
  }, [productId, user?.uid]);

  async function loadProduct() {
    try {
      const p = await getProduct(productId);
      setProduct(p);
    } catch {
      Alert.alert('Erro', 'Produto não encontrado');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy() {
    if (!user) return;
    if (isBlocked) {
      Alert.alert('Conta bloqueada', 'Você não pode fazer compras.');
      return;
    }
    if (!marketplaceEnabled) {
      Alert.alert('Indisponível', 'Marketplace temporariamente indisponível.');
      return;
    }

    if (product?.isFree) {
      setBuying(true);
      try {
        const functions = getFunctions(app, 'us-central1');
        const createFree = httpsCallable(functions, 'createFreeProductPurchase');
        const result = await createFree({ productId }) as any;
        if (result.data.success) {
          setHasAccess(true);
          Alert.alert('✅ Produto desbloqueado!', 'Você já pode acessar o conteúdo.');
        }
      } catch (error: any) {
        Alert.alert('Erro', error.message ?? 'Não foi possível obter o produto.');
      } finally {
        setBuying(false);
      }
      return;
    }

    // Produto pago — o CPF é exigido pelo Asaas para gerar a
    // cobrança, então pedimos antes de chamar a CF.
    setAwaitingCpf(true);
  }

  function handleCpfCancel() {
    setAwaitingCpf(false);
  }

  async function handleCpfConfirm(cpfDigits: string) {
    setBuying(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createPayment = httpsCallable(functions, 'createAsaasPayment');
      const trimmedCoupon = couponCode.trim().toUpperCase();
      const result = await createPayment({
        productId,
        paymentMethod: 'pix',
        cpf: cpfDigits,
        ...(trimmedCoupon && { couponCode: trimmedCoupon }),
      }) as any;

      setAwaitingCpf(false);

      navigation.navigate('Checkout', {
        saleId: result.data.saleId,
        checkoutUrl: result.data.checkoutUrl,
        pixQrCode: result.data.pixQrCode ?? undefined,
        pixCopyPaste: result.data.pixCopyPaste ?? undefined,
      });
    } catch (error: any) {
      const msg: string = error.message ?? '';

      if (msg.includes('CheckoutUrl:') || msg.includes('pagamento em aberto')) {
        setAwaitingCpf(false);
        Alert.alert(
          '⚠️ Pagamento pendente',
          'Você já possui um pagamento em andamento para este produto. Finalize-o antes de iniciar um novo.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (msg.includes('já possui')) {
        setAwaitingCpf(false);
        setHasAccess(true);
        Alert.alert('✅', 'Você já possui este produto!');
        return;
      }

      Alert.alert('Erro ao iniciar pagamento', error.message ?? 'Tente novamente.');
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LinearGradient
          colors={MP_GRADIENT.screen}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={MP.gold} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!product) return null;

  const images = [product.coverImage, ...product.previewImages].filter(Boolean);
  const isFavorited = favoriteIds.includes(productId);
  const isOwner = product.ownerId === user?.uid;
  const isFree = product.isFree || product.price === 0;
  const cat = MP_CATEGORY[product.category as keyof typeof MP_CATEGORY];

  return (
    <ScreenContainer>
      <LinearGradient
        colors={MP_GRADIENT.screen}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
        <TouchableOpacity
          onPress={() => toggleFavorite(productId)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.favoriteBtn}>{isFavorited ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.galleryWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentImage(idx);
            }}
            scrollEventThrottle={16}
          >
            {images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.image} resizeMode="cover" />
            ))}
          </ScrollView>

          {/* Véu na base da galeria: costura a imagem com o corpo
              da tela, evitando o corte seco que existia antes. */}
          <LinearGradient
            colors={['transparent', MP.bg]}
            style={styles.galleryFade}
            pointerEvents="none"
          />

          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentImage && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.catRow}>
            <Text style={styles.catIcon}>{cat?.icon ?? '✧'}</Text>
            <Text style={styles.catLabel}>{cat?.label ?? product.category}</Text>
            {product.averageRating > 0 && (
              <>
                <View style={styles.catDot} />
                <Text style={styles.rating}>
                  ★ {product.averageRating.toFixed(1)} ({product.reviewsCount})
                </Text>
              </>
            )}
          </View>

          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.priceBlock}>
            {isFree ? (
              <Text style={styles.priceFree}>Grátis</Text>
            ) : (
              <View style={styles.priceGroup}>
                <Text style={styles.priceCurrency}>R$</Text>
                <Text style={styles.priceValue}>
                  {product.price.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            )}
          </View>

          {product.tags?.length > 0 && (
            <View style={styles.chipRow}>
              {product.tags.map(tag => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Sobre este produto</Text>
          <Text style={styles.description}>{product.description}</Text>

          <Text style={styles.sectionTitle}>O que você recebe</Text>
          <View style={styles.deliveryBox}>
            <View style={styles.deliveryRow}>
              <Text style={styles.deliveryIcon}>📦</Text>
              <Text style={styles.deliveryText}>
                {product.files?.length ?? 0} arquivo(s) incluídos
              </Text>
            </View>
            {product.previewFiles?.length > 0 && (
              <View style={styles.deliveryRow}>
                <Text style={styles.deliveryIcon}>👁️</Text>
                <Text style={styles.deliveryText}>
                  {product.previewFiles.length} prévia(s) gratuita(s)
                </Text>
              </View>
            )}
          </View>

          {reviews.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Avaliações</Text>
              {reviews.slice(0, 3).map((review, i) => (
                <View key={i} style={styles.reviewCard}>
                  <Text style={styles.reviewRating}>{'★'.repeat(review.rating)}</Text>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))}
            </>
          )}

          <View style={{ height: spacing.xl }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isOwner ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProduct', { productId })}
          >
            <Text style={styles.editButtonText}>✏️ Editar produto</Text>
          </TouchableOpacity>
        ) : hasAccess ? (
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => navigation.navigate('ContentViewer', {
              productId,
              purchaseId: `${user?.uid}_${productId}`,
            })}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={MP_GRADIENT.gold}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buyButtonInner}
            >
              <Text style={styles.buyButtonText}>📂 Abrir conteúdo</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <>
            {!product.isFree && (
              <View style={styles.couponRow}>
                {!showCoupon ? (
                  <TouchableOpacity
                    style={styles.couponToggle}
                    onPress={() => setShowCoupon(true)}
                    disabled={buying}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.couponToggleText}>🎟️  Tenho um cupom de desconto</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    <View style={styles.couponHeader}>
                      <Text style={styles.couponLabel}>Cupom de desconto</Text>
                      <TouchableOpacity
                        onPress={() => { setShowCoupon(false); setCouponCode(''); }}
                        disabled={buying}
                      >
                        <Text style={styles.couponDismiss}>Não tenho</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Digite o código"
                      placeholderTextColor={MP.textMuted}
                      value={couponCode}
                      onChangeText={t => setCouponCode(t.toUpperCase())}
                      autoCapitalize="characters"
                      editable={!buying}
                      autoFocus
                    />
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity
              style={[styles.buyButton, buying && styles.buyButtonDisabled]}
              onPress={handleBuy}
              disabled={buying}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={MP_GRADIENT.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buyButtonInner}
              >
                {buying ? (
                  <ActivityIndicator color={MP.textOnGold} />
                ) : (
                  <Text style={styles.buyButtonText}>
                    {product.isFree
                      ? '🎁 Obter grátis'
                      : `Comprar · R$ ${product.price.toFixed(2).replace('.', ',')}`}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>

      <CpfPromptModal
        visible={awaitingCpf}
        loading={buying}
        onConfirm={handleCpfConfirm}
        onCancel={handleCpfCancel}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  backBtn: { color: MP.gold, fontSize: 30, width: 32 },
  headerTitle: {
    color: MP.text, fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.semibold,
    flex: 1, textAlign: 'center',
  },
  favoriteBtn: { fontSize: 20, width: 32, textAlign: 'right' },

  galleryWrap: { position: 'relative' },
  image: { width, height: 300, backgroundColor: MP.bgElevated },
  galleryFade: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 72,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6, height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(245, 240, 255, 0.35)',
  },
  dotActive: { backgroundColor: MP.gold, width: 18 },

  content: { paddingHorizontal: spacing.md },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  catIcon: { fontSize: 12 },
  catLabel: {
    color: MP.purpleLight,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: MP_FONT.tracking.wide,
  },
  catDot: {
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
    fontSize: MP_FONT.size.xxl,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.tight,
    lineHeight: 30,
  },

  priceBlock: { marginTop: spacing.sm, marginBottom: spacing.md },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceCurrency: {
    color: MP.gold,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.semibold,
  },
  priceValue: {
    color: MP.gold,
    fontSize: MP_FONT.size.display,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.tight,
  },
  priceFree: {
    color: MP.free,
    fontSize: MP_FONT.size.display,
    fontWeight: MP_FONT.weight.heavy,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: MP.border,
  },
  chipText: { color: MP.textSoft, fontSize: MP_FONT.size.xs },

  sectionTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: MP_FONT.tracking.tight,
  },
  description: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.md,
    lineHeight: 22,
  },

  deliveryBox: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deliveryIcon: { fontSize: 16 },
  deliveryText: { color: MP.textSoft, fontSize: MP_FONT.size.md },

  reviewCard: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewRating: { color: MP.gold, fontSize: 13, marginBottom: spacing.xs },
  reviewComment: { color: MP.textSoft, fontSize: MP_FONT.size.sm, lineHeight: 19 },

  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: MP.border,
    backgroundColor: MP.bgElevated,
  },

  couponRow: { marginBottom: spacing.sm },
  couponToggle: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.borderGold,
    borderStyle: 'dashed',
  },
  couponToggleText: {
    color: MP.goldLight,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.bold,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  couponLabel: {
    color: MP.text,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.bold,
  },
  couponDismiss: { color: MP.textMuted, fontSize: MP_FONT.size.xs },
  couponInput: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    color: MP.text,
    padding: spacing.md,
    fontSize: MP_FONT.size.md,
    letterSpacing: 1,
  },

  buyButton: {
    borderRadius: borderRadius.full,
    ...MP_SHADOW.goldGlow,
  },
  buyButtonInner: {
    borderRadius: borderRadius.full,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyButtonText: {
    color: MP.textOnGold,
    fontWeight: MP_FONT.weight.heavy,
    fontSize: MP_FONT.size.lg,
  },

  editButton: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.full,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MP.borderGold,
  },
  editButtonText: {
    color: MP.goldLight,
    fontWeight: MP_FONT.weight.bold,
    fontSize: MP_FONT.size.md,
  },
});