import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
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

    // Produto gratuito
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

    // Produto pago — createAsaasPayment
    setBuying(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createPayment = httpsCallable(functions, 'createAsaasPayment');
      const result = await createPayment({ productId, paymentMethod: 'pix' }) as any;

      navigation.navigate('Checkout', {
        saleId: result.data.saleId,
        checkoutUrl: result.data.checkoutUrl,
        pixQrCode: result.data.pixQrCode ?? undefined,
        pixCopyPaste: result.data.pixCopyPaste ?? undefined,
      });
    } catch (error: any) {
      const msg: string = error.message ?? '';

      // Sale pendente já existe — ir para checkout sem QR (usuário deve usar checkoutUrl)
      if (msg.includes('CheckoutUrl:')) {
        Alert.alert(
          '⚠️ Pagamento pendente',
          'Você já possui um pagamento em andamento para este produto. Finalize-o antes de iniciar um novo.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (msg.includes('já possui')) {
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!product) return null;

  const images = [product.coverImage, ...product.previewImages].filter(Boolean);
  const isFavorited = favoriteIds.includes(productId);
  const isOwner = product.ownerId === user?.uid;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
        <TouchableOpacity onPress={() => toggleFavorite(productId)}>
          <Text style={styles.favoriteBtn}>{isFavorited ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
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
          >
            <Text style={styles.buyButtonText}>📂 Abrir conteúdo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.buyButton, buying && styles.buyButtonDisabled]}
            onPress={handleBuy}
            disabled={buying}
          >
            {buying ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buyButtonText}>
                {product.isFree ? '🎁 Obter grátis' : `💳 Comprar — R$ ${product.price.toFixed(2)}`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  favoriteBtn: { fontSize: 22 },
  image: { width, height: 280 },
  dots: { flexDirection: 'row', justifyContent: 'center', padding: spacing.sm, gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.grayDark },
  dotActive: { backgroundColor: colors.gold, width: 16 },
  content: { padding: spacing.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  title: { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', flex: 1, marginRight: spacing.md },
  price: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  ratingRow: { marginBottom: spacing.sm },
  ratingText: { color: colors.gray, fontSize: fonts.sizes.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    backgroundColor: colors.surface, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
    borderWidth: 1, borderColor: colors.grayDark,
  },
  chipText: { color: colors.gray, fontSize: fonts.sizes.xs },
  sectionTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginTop: spacing.md, marginBottom: spacing.sm },
  description: { color: colors.gray, fontSize: fonts.sizes.md, lineHeight: 22 },
  filesInfo: { gap: spacing.xs },
  filesText: { color: colors.gray, fontSize: fonts.sizes.md },
  reviewCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.grayDark,
  },
  reviewRating: { fontSize: 14, marginBottom: spacing.xs },
  reviewComment: { color: colors.gray, fontSize: fonts.sizes.sm },
  footer: { padding: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.grayDark },
  buyButton: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyButtonText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  editButton: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.gold,
  },
  editButtonText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.md },
});