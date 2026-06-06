import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyFavoritesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { favoriteIds, loading, loadMore, hasMore, loadingMore, refresh, toggleFavorite } = useFavorites(user?.uid);

  const renderItem = useCallback(({ item }: { item: string }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.productId} numberOfLines={1}>📦 {item.slice(0, 20)}...</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => navigation.navigate('ProductDetail', { productId: item })}
        >
          <Text style={styles.viewBtnText}>Ver produto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => toggleFavorite(item)}
        >
          <Text style={styles.removeBtnText}>❌</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [toggleFavorite]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favoritos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={favoriteIds}
          keyExtractor={item => item}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  listContent: { padding: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardInfo: { flex: 1 },
  productId: { color: colors.gray, fontSize: fonts.sizes.sm },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  viewBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  viewBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  removeBtn: { padding: spacing.sm },
  removeBtnText: { fontSize: 18 },
});