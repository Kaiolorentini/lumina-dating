import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Button, Card, Input, ConfirmSheet } from '../../components/ui';
import { useAppFeedback } from '../../hooks/useAppFeedback';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
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

  const { favoriteIds, toggleFavorite } = useFavorites(user?.uid);
  const { reviews } = useReviews(productId, user?.uid);
  const { checkAccess } = usePurchases(user?.uid);
  const { marketplaceEnabled } = useAppSettings();
  const { isBlocked } = useUserPermissions(user?.uid);
  const [hasAccess, setHasAccess] = useState(false);
  const [confirmBuy, setConfirmBuy] = useState(false);
  const { success: notifySuccess, error: notifyError } = useAppFeedback();

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
      notifyError('Produto não encontrado');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy() {
    if (!user) return;
    if (isBlocked) {
      notifyError('Conta bloqueada. Você não pode fazer compras.');
      return;
    }
    if (!marketplaceEnabled) {
      notifyError('Marketplace temporariamente indisponível.');
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
          notifySuccess('✅ Produto desbloqueado! Você já pode acessar o conteúdo.');
        }
      } catch (error: any) {
        notifyError(error.message ?? 'Não foi possível obter o produto.');
      } finally {
        setBuying(false);
      }
      return;
    }

    setConfirmBuy(true);
  }

  async function confirmPurchase() {
    if (!user) return;
    setBuying(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createPayment = httpsCallable(functions, 'createAsaasPayment');
      const trimmedCoupon = couponCode.trim().toUpperCase();
      const result = await createPayment({
        productId,
        paymentMethod: 'pix',
        ...(trimmedCoupon && { couponCode: trimmedCoupon }),
      }) as any;

      navigation.navigate('Checkout', {
        saleId: result.data.saleId,
        checkoutUrl: result.data.checkoutUrl,
        pixQrCode: result.data.pixQrCode ?? undefined,
        pixCopyPaste: result.data.pixCopyPaste ?? undefined,
      });
    } catch (error: any) {
      const msg: string = error.message ?? '';

      if (msg.includes('CheckoutUrl:')) {
        notifyError('⚠️ Pagamento pendente. Finalize o pagamento em andamento antes de iniciar um novo.');
        return;
      }

      if (msg.includes('já possui')) {
        setHasAccess(true);
        notifySuccess('✅ Você já possui este produto!');
        return;
      }

      notifyError(error.message ?? 'Erro ao iniciar pagamento. Tente novamente.');
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  if (!product) return null;

  const images = [product.coverImage, ...product.previewImages].filter(Boolean);
  const isFavorited = favoriteIds.includes(productId);
  const isOwner = product.ownerId === user?.uid;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
        <Button label={isFavorited ? '❤️' : '🤍'} variant="ghost" onPress={() => toggleFavorite(productId)} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
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

        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentImage && styles.dotActive]} />
            ))}
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title}</Text>
            <Text style={styles.price}>
              {product.isFree ? 'Grátis' : `R$ ${product.price.toFixed(2)}`}
            </Text>
          </View>

          {product.averageRating > 0 && (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>
                ⭐ {product.averageRating.toFixed(1)} ({product.reviewsCount} avaliações)
              </Text>
            </View>
          )}

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{product.category}</Text>
            </View>
            {product.tags?.map(tag => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>#{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Sobre este produto</Text>
          <Text style={styles.description}>{product.description}</Text>

          <Text style={styles.sectionTitle}>O que você recebe</Text>
          <View style={styles.filesInfo}>
            <Text style={styles.filesText}>
              📦 {product.files?.length ?? 0} arquivo(s) incluídos
            </Text>
            {product.previewFiles?.length > 0 && (
              <Text style={styles.filesText}>
                👁️ {product.previewFiles.length} prévia(s) gratuita(s)
              </Text>
            )}
          </View>

          {reviews.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Avaliações</Text>
              {reviews.slice(0, 3).map((review, i) => (
                <View key={i} style={styles.reviewCard}>
                  <Text style={styles.reviewRating}>{'⭐'.repeat(review.rating)}</Text>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isOwner ? (
          <Button label="✏️ Editar produto" onPress={() => navigation.navigate('EditProduct', { productId })} variant="ghost" fullWidth />
        ) : hasAccess ? (
          <Button label="📂 Abrir conteúdo" onPress={() => navigation.navigate('ContentViewer', { productId, purchaseId: `${user?.uid}_${productId}` })} variant="primary" fullWidth />
        ) : (
          <>
            {!product.isFree && (
              <Input
                placeholder="Cupom de desconto (opcional)"
                value={couponCode}
                onChangeText={(t: string) => setCouponCode(t.toUpperCase())}
                autoCapitalize="characters"
                editable={!buying}
              />
            )}
            <Button
              label={product.isFree ? '🎁 Obter grátis' : `💳 Comprar — R$ ${product.price.toFixed(2)}`}
              onPress={handleBuy}
              loading={buying}
              disabled={buying}
              variant="primary"
              fullWidth
            />
            <ConfirmSheet
              visible={confirmBuy && !product.isFree}
              onClose={() => setConfirmBuy(false)}
              title="💳 Confirmar compra"
              message={`Deseja comprar "${product?.title}" por R$ ${product?.price.toFixed(2)}?${couponCode.trim() ? '\nCupom aplicado: ' + couponCode.trim().toUpperCase() : ''}`}
              confirmLabel="Comprar agora"
              onConfirm={confirmPurchase}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27),
  },
  // backBtn removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, flex: 1, textAlign: 'center' },
  // favoriteBtn removed — now uses Button
  image: { width, height: 280 },
  dots: { flexDirection: 'row', justifyContent: 'center', padding: SPACING.sm, gap: SPACING.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.gold, width: 16 },
  content: { padding: SPACING.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, flex: 1, marginRight: SPACING.md },
  price: { color: COLORS.gold, fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  ratingRow: { marginBottom: SPACING.sm },
  ratingText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs / 2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },
  sectionTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.md, marginBottom: SPACING.sm },
  description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body, lineHeight: 22 },
  filesInfo: { gap: SPACING.xs },
  filesText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
  reviewCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  reviewRating: { fontSize: FONT_SIZE.body, marginBottom: SPACING.xs },
  reviewComment: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  footer: { padding: SPACING.md, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  // couponRow/couponInput removed — now uses Input
  // buyButton/buyButtonDisabled/buyButtonText removed — now uses Button
  // editButton/editButtonText removed — now uses Button
});
