import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
  Modal, TextInput,
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
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyPurchasesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { purchases, loading, loadMore, hasMore, loadingMore, refresh } = usePurchases(user?.uid);
  const [requestingRefund, setRequestingRefund] = useState<string | null>(null);

  // Modal de reembolso (cross-platform — substitui Alert.prompt iOS-only)
  const [refundModal, setRefundModal] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Purchase | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Deduplica por productId (evita duplicata quando listener + loadMore se sobrepõem)
  const uniquePurchases = useMemo(() => {
    const seen = new Set<string>();
    const result: Purchase[] = [];
    for (const p of purchases) {
      const key = `${p.buyerId}_${p.productId}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  }, [purchases]);

  function openRefund(purchase: Purchase) {
    setRefundTarget(purchase);
    setRefundReason('');
    setRefundModal(true);
  }

  async function confirmRefund() {
    if (!refundTarget) return;
    if (!refundReason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo da solicitação.');
      return;
    }
    const saleId = refundTarget.saleId ?? '';
    setRequestingRefund(saleId);
    setRefundModal(false);
    try {
      const functions = getFunctions(app, 'us-central1');
      const requestRefund = httpsCallable(functions, 'requestRefund');
      await requestRefund({ saleId: refundTarget.saleId, reason: refundReason.trim() });
      Alert.alert('✅ Solicitação enviada', 'Nossa equipe analisará em até 24 horas.');
    } catch (error: any) {
      Alert.alert('Erro', error.message ?? 'Não foi possível enviar a solicitação.');
    } finally {
      setRequestingRefund(null);
      setRefundTarget(null);
    }
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
              onPress={() => openRefund(item)}
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
    <ScreenContainer>
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
          data={uniquePurchases}
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

      {/* Modal de reembolso — cross-platform */}
      <Modal
        visible={refundModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRefundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitar reembolso</Text>
            <Text style={styles.modalSubtitle}>Informe o motivo da solicitação:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: não era o que eu esperava"
              placeholderTextColor={colors.gray}
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
              maxLength={300}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRefundModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmRefund}
              >
                <Text style={styles.modalConfirmBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.grayDark, padding: spacing.lg, width: '100%',
  },
  modalTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', marginBottom: spacing.xs },
  modalSubtitle: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.md },
  modalInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md,
    fontSize: fonts.sizes.md, minHeight: 80, textAlignVertical: 'top', marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.grayDark, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalCancelBtnText: { color: colors.white, fontWeight: 'bold' },
  modalConfirmBtn: {
    flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center',
  },
  modalConfirmBtnText: { color: colors.white, fontWeight: 'bold' },
});