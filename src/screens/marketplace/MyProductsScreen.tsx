// ============================================
// LUMINA — MEUS PRODUTOS v2
// src/screens/marketplace/MyProductsScreen.tsx
//
// v2 (28/09): Editar e Apagar em cada card.
// - Apagar = tirar da venda (unpublishProduct). Quem comprou mantém o
//   acesso; os arquivos só somem se ninguém comprou.
// - "Alterações em análise" quando há capa ou arquivos novos esperando
//   o admin, e o motivo quando uma alteração foi recusada.
// ============================================

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../hooks/useProducts';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { ProductStatus } from '../../shared/types/marketplace';
import { unpublishProduct, ProductWithChanges } from '../../services/marketplace/productService';
import ScreenContainer from '../../components/ScreenContainer';
import { useFocusEffect } from '@react-navigation/native';
import { markNotificationsReadByTypes } from '../../modules/notifications/services/notificationService';
import { BADGE_TYPES } from '../../modules/profile/hooks/useProfileBadges';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<ProductStatus, { label: string; color: string }> = {
  draft:    { label: 'Rascunho',   color: colors.gray },
  pending:  { label: 'Em análise', color: colors.gold },
  approved: { label: 'À venda',    color: colors.success },
  rejected: { label: 'Rejeitado',  color: colors.error },
};

export default function MyProductsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Abrir a área apaga o balão dela no Perfil.
  useFocusEffect(useCallback(() => {
    if (user?.uid) markNotificationsReadByTypes(user.uid, [...BADGE_TYPES.products]).catch(() => {});
  }, [user?.uid]));

  const { products, loading, loadMore, hasMore, loadingMore, refresh } = useProducts({
    ownerId: user?.uid,
  });

  const confirmDelete = useCallback((item: ProductWithChanges) => {
    const sold = item.status === 'approved';
    Alert.alert(
      sold ? 'Tirar da venda?' : 'Apagar produto?',
      sold
        ? `"${item.title}" sai do marketplace e não pode mais ser comprado. Quem já comprou continua com acesso ao conteúdo.`
        : `"${item.title}" e os arquivos dele serão apagados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: sold ? 'Tirar da venda' : 'Apagar',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              const res = await unpublishProduct(item.id);
              Alert.alert(
                sold ? 'Produto retirado da venda' : 'Produto apagado',
                res.keptForBuyers ? 'Quem comprou continua com acesso.' : undefined,
              );
              refresh();
            } catch (e: unknown) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível concluir.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  }, [refresh]);

  const openEdit = useCallback((item: ProductWithChanges) => {
    if (item.status === 'pending') {
      Alert.alert('Em análise', 'Seu produto está sendo analisado. Você poderá editar assim que ele for aprovado ou rejeitado.');
      return;
    }
    navigation.navigate('EditProduct', { productId: item.id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: ProductWithChanges }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const busy = deletingId === item.id;
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardRow} onPress={() => openEdit(item)} activeOpacity={0.85}>
          {item.coverImage ? (
            <Image source={{ uri: item.coverImage }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}><Text style={styles.coverEmptyText}>📦</Text></View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
            <Text style={styles.cardPrice}>
              {item.isFree ? 'Grátis' : `R$ ${item.price.toFixed(2).replace('.', ',')}`}
            </Text>
            <View style={styles.badges}>
              <View style={[styles.statusBadge, { borderColor: statusConfig.color }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
              {item.hasPendingChanges && (
                <View style={[styles.statusBadge, { borderColor: colors.gold }]}>
                  <Text style={[styles.statusText, { color: colors.gold }]}>✏️ Alterações em análise</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {item.status === 'rejected' && item.rejectionReason ? (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionText}>❌ Motivo: {item.rejectionReason}</Text>
          </View>
        ) : null}

        {!item.hasPendingChanges && item.lastChangesRejection?.reason ? (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionText}>Última alteração recusada: {item.lastChangesRejection.reason}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, item.status === 'pending' && styles.actionBtnDisabled]}
            onPress={() => openEdit(item)}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.title}`}
          >
            <Text style={styles.editText}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => confirmDelete(item)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Apagar ${item.title}`}
          >
            {busy
              ? <ActivityIndicator color={colors.error} size="small" />
              : <Text style={styles.deleteText}>🗑️ Apagar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [deletingId, openEdit, confirmDelete]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Produtos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateProduct')} accessibilityRole="button" accessibilityLabel="Novo produto">
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={products as ProductWithChanges[]}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceEmptyState icon="📦" title="Nenhum produto ainda" subtitle="Crie seu primeiro produto digital" />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.gold} /> : null}
          renderItem={renderItem}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateProduct')} accessibilityRole="button">
        <Text style={styles.fabText}>+ Novo produto</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  addBtn: { color: colors.gold, fontSize: 28, fontWeight: 'bold' },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm,
  },
  cardRow: { flexDirection: 'row', gap: spacing.md },
  cover: { width: 72, height: 72, borderRadius: borderRadius.sm, backgroundColor: colors.background },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  coverEmptyText: { fontSize: 28 },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  cardCategory: { color: colors.gray, fontSize: fonts.sizes.sm, textTransform: 'capitalize' },
  cardPrice: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 },
  statusBadge: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  rejectionBox: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.sm,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.error + '44',
  },
  rejectionText: { color: colors.error, fontSize: fonts.sizes.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gold,
  },
  actionBtnDisabled: { opacity: 0.4 },
  editText: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  deleteBtn: { borderColor: colors.error },
  deleteText: { color: colors.error, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  fab: {
    position: 'absolute', bottom: spacing.xl, left: spacing.md, right: spacing.md,
    backgroundColor: colors.gold, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center',
  },
  fabText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});