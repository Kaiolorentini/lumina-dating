import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFavoriteProducts } from '../../hooks/useFavoriteProducts';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyFavoritesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { items, loading, loadMore, hasMore, loadingMore, refresh, remove, error } = useFavoriteProducts(user?.uid);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const renderItem = useCallback(({ item }: { item: {
    productId: string; title: string; coverImage: string; ownerId: string;
  } }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: item.coverImage || 'https://via.placeholder.com/60' }}
        style={styles.cover}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.ownerId ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('RealProfile', { userId: item.ownerId })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.creatorLink}>Ver perfil do criador →</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
          >
            <Text style={styles.viewBtnText}>Ver produto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => remove(item.productId)}
          >
            <Text style={styles.removeBtnText}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  ), [navigation, remove]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favoritos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
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
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
          }
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceEmptyState
              icon="❤️"
              title="Nenhum favorito ainda"
              subtitle="Explore o marketplace e favorite produtos"
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.gold} /> : null}
          renderItem={renderItem}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  listContent: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, marginBottom: spacing.md,
    flexDirection: 'row', overflow: 'hidden',
  },
  cover: {
    width: 80, height: 80,
  },
  info: {
    flex: 1, padding: spacing.md,
    justifyContent: 'center',
  },
  title: {
    color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  creatorLink: {
    color: colors.gold, fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  viewBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  viewBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  removeBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.gray,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  removeBtnText: { color: colors.gray, fontSize: fonts.sizes.sm },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md,
  },
  errorText: {
    color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.sm,
  },
  errorDetail: {
    color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', marginBottom: spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },
});
