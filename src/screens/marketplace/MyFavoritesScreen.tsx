// ============================================
// LUMINA — MEUS FAVORITOS v2.0
// src/screens/marketplace/MyFavoritesScreen.tsx
//
// v2.0 — tema do marketplace. A lista em card horizontal se
// manteve: favoritos é uma lista de consulta rápida, não uma
// vitrine — grade de duas colunas aqui seria redundante com a
// home.
//
// Hook, paginação e remoção otimista inalterados.
// ============================================

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MP, MP_GRADIENT, MP_FONT, spacing, borderRadius,
} from '../../theme/marketplace';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFavoriteProducts } from '../../hooks/useFavoriteProducts';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyFavoritesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { items, loading, loadMore, hasMore, loadingMore, refresh, remove, error } =
    useFavoriteProducts(user?.uid);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const renderItem = useCallback(({ item }: { item: {
    productId: string; title: string; coverImage: string; ownerId: string;
  } }) => (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: item.coverImage || 'https://via.placeholder.com/100' }}
          style={styles.cover}
          resizeMode="cover"
        />
      </TouchableOpacity>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {item.ownerId ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('RealProfile', { userId: item.ownerId })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.creatorLink}>Ver perfil do criador ›</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
            activeOpacity={0.85}
          >
            <Text style={styles.viewBtnText}>Ver produto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => remove(item.productId)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.removeBtnText}>♥</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [navigation, remove]);

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Favoritos</Text>
          {items.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {items.length} {items.length === 1 ? 'produto' : 'produtos'}
            </Text>
          )}
        </View>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={MP.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Erro ao carregar favoritos</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.productId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={MP.gold} />
          }
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MarketplaceEmptyState
                icon="❤️"
                title="Nenhum favorito ainda"
                subtitle="Explore o marketplace e favorite produtos"
              />
            </View>
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={MP.gold} style={{ margin: spacing.md }} />
              : <View style={{ height: spacing.lg }} />
          }
          renderItem={renderItem}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  backBtn: { color: MP.gold, fontSize: 30, width: 32 },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.xl,
    fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.tight,
  },
  headerSubtitle: {
    color: MP.textMuted,
    fontSize: MP_FONT.size.xs,
    marginTop: 1,
  },

  listContent: { padding: spacing.md },
  emptyWrap: { minHeight: 380, justifyContent: 'center' },

  card: {
    flexDirection: 'row',
    backgroundColor: MP.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cover: {
    width: 96, height: '100%',
    minHeight: 104,
    backgroundColor: MP.bgElevated,
  },
  info: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    color: MP.text,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.bold,
    lineHeight: 19,
  },
  creatorLink: {
    color: MP.purpleLight,
    fontSize: MP_FONT.size.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  viewBtn: {
    backgroundColor: MP.goldSubtle,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: MP.borderGold,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  viewBtnText: {
    color: MP.goldLight,
    fontWeight: MP_FONT.weight.bold,
    fontSize: MP_FONT.size.sm,
  },
  // Coração preenchido: o item ESTÁ favoritado, e tocar remove.
  // "Remover" em texto competia com o botão principal.
  removeBtn: {
    width: 32, height: 32,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: MP.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: MP.error, fontSize: 15 },

  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: spacing.xl, gap: spacing.sm,
  },
  errorIcon: { fontSize: 44 },
  errorText: {
    color: MP.text, fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.bold,
  },
  errorDetail: {
    color: MP.textMuted, fontSize: MP_FONT.size.sm,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  retryBtn: {
    backgroundColor: MP.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: { color: MP.textOnGold, fontWeight: MP_FONT.weight.bold },
});