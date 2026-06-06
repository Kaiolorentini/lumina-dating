import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { usePurchases } from '../../hooks/usePurchases';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import { Purchase } from '../../shared/types/marketplace';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyPurchasesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { purchases, loading, loadMore, hasMore, loadingMore, refresh } = usePurchases(user?.uid);
  const [requestingRefund, setRequestingRefund] = useState<string | null>(null);

  async function handleRefund(purchase: Purchase) {
    Alert.prompt(
      'Solicitar reembolso',
      'Informe o motivo da solicitação:',
      async (reason) => {
        if (!reason?.trim()) return;
        setRequestingRefund(purchase.saleId ?? '');
        try {
          const functions = getFunctions(app, 'us-central1');
          const requestRefund = httpsCallable(functions, 'requestRefund');
          await requestRefund({ saleId: purchase.saleId, reason });
          Alert.alert('✅ Solicitação enviada', 'Nossa equipe analisará em até 24 horas.');
        } catch (error: any) {
          Alert.alert('Erro', error.message ?? 'Não foi possível enviar a solicitação.');
        } finally {
          setRequestingRefund(null);
        }
      },
      'plain-text',
    );
  }

  const renderItem = useCallback(({ item }: { item: Purchase }) => {
    const purchaseId = `${user?.uid}_${item.productId}`;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.productId} numberOfLines={1}>
            📦 {item.productId.slice(0, 16)}...
          </Text>
          <View style={[
            styles.statusBadge,
            item.status === 'active' ? styles.statusActive : styles.statusRefunded,
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'active' ? 'Ativo' : item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.amount}>
          {item.amount === 0 ? 'Grátis' : `R$ ${item.amount.toFixed(2)}`}
        </Text>

        <Text style={styles.date}>
          Comprado em {item.createdAt.toLocaleDateString('pt-BR')}
        </Text>

        <View style={styles.cardActions}>
          {item.status === 'active' && (
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => navigation.navigate('ContentViewer', {
                productId: item.productId,
                purchaseId,
              })}
            >
              <Text style={styles.openBtnText}>📂 Abrir</Text>
            </TouchableOpacity>
          )}

          {item.status === 'active' && item.saleId && (
            <TouchableOpacity
              style={styles.refundBtn}
              onPress={() => handleRefund(item)}
              disabled={requestingRefund === item.saleId}
            >
              {requestingRefund === item.saleId ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <Text style={styles.refundBtnText}>↩️ Reembolso</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [user?.uid, requestingRefund]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas Compras</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={item => `${item.buyerId}_${item.productId}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
          }
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <MarketplaceEmptyState
              icon="🛒"
              title="Nenhuma compra ainda"
              subtitle="Explore o marketplace e adquira produtos digitais"
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
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  productId: { color: colors.gray, fontSize: fonts.sizes.sm, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, borderRadius: borderRadius.full },
  statusActive: { backgroundColor: colors.success + '22', borderWidth: 1, borderColor: colors.success },
  statusRefunded: { backgroundColor: colors.error + '22', borderWidth: 1, borderColor: colors.error },
  statusText: { color: colors.white, fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  amount: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.xs },
  date: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.md },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  openBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flex: 1, alignItems: 'center',
  },
  openBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.sm },
  refundBtn: {
    backgroundColor: 'transparent', borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.error, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  refundBtnText: { color: colors.error, fontSize: fonts.sizes.sm },
});