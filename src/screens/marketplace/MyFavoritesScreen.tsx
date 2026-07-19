import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT , alpha} from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFavoriteProducts } from '../../hooks/useFavoriteProducts';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { Button, Card } from '../../components/ui';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyFavoritesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { items, loading, loadMore, hasMore, loadingMore, refresh, remove, error } = useFavoriteProducts(user?.uid);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const renderItem = useCallback(({ item }: { item: { productId: string; title: string; coverImage: string; ownerId: string } }) => (
    <Card onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })} style={{ flexDirection: 'row', marginBottom: SPACING.md, overflow: 'hidden' }}>
      <Image source={{ uri: item.coverImage || 'https://via.placeholder.com/60' }} style={styles.cover} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.ownerId ? (
          <Button label="Ver perfil do criador →" variant="ghost" onPress={() => navigation.navigate('RealProfile', { userId: item.ownerId })} />
        ) : null}
        <View style={styles.actions}>
          <Button label="Ver produto" onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })} variant="primary" size="sm" />
          <Button label="Remover" onPress={() => remove(item.productId)} variant="ghost" size="sm" />
        </View>
      </View>
    </Card>
  ), [navigation, remove]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Favoritos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erro ao carregar favoritos</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <Button label="Tentar novamente" onPress={refresh} variant="primary" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.productId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={COLORS.gold} />}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<MarketplaceEmptyState icon="❤️" title="Nenhum favorito ainda" subtitle="Explore o marketplace e favorite produtos" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.gold} /> : null}
          renderItem={renderItem}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  listContent: { padding: SPACING.md },
  // card removed — now uses Card
  cover: { width: 80, height: 80 },
  info: { flex: 1, padding: SPACING.md, justifyContent: 'center' },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  // creatorLink removed — now uses Button
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.md },
  errorText: { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  errorDetail: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, textAlign: 'center', marginBottom: SPACING.md },
});
