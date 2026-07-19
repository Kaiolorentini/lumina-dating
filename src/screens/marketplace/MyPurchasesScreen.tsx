import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, Alert, RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS , alpha} from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { usePurchases } from '../../hooks/usePurchases';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import { Purchase } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';
import { Badge, Button, Input } from '../../components/ui';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyPurchasesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { purchases, loading, loadMore, hasMore, loadingMore, refresh } = usePurchases(user?.uid);
  const [requestingRefund, setRequestingRefund] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Purchase | null>(null);
  const [refundReason, setRefundReason] = useState('');

  const uniquePurchases = useMemo(() => {
    const seen = new Set<string>();
    const result: Purchase[] = [];
    for (const p of purchases) {
      const key = `${p.buyerId}_${p.productId}`;
      if (!seen.has(key)) { seen.add(key); result.push(p); }
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
    if (!refundReason.trim()) { Alert.alert('Motivo obrigatório', 'Informe o motivo da solicitação.'); return; }
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
          <Text style={styles.productId} numberOfLines={1}>📦 {item.productId.slice(0, 16)}...</Text>
          <Badge label={item.status === 'active' ? 'Ativo' : item.status} variant={item.status === 'active' ? 'success' : 'error'} size="sm" />
        </View>
        <Text style={styles.amount}>{item.amount === 0 ? 'Grátis' : `R$ ${item.amount.toFixed(2)}`}</Text>
        <Text style={styles.date}>Comprado em {item.createdAt.toLocaleDateString('pt-BR')}</Text>
        <View style={styles.cardActions}>
          {item.status === 'active' && (
            <Button label="📂 Abrir" onPress={() => navigation.navigate('ContentViewer', { productId: item.productId, purchaseId })} variant="primary" size="sm" />
          )}
          {item.status === 'active' && item.saleId && (
            <Button
              label="↩️ Reembolso"
              onPress={() => openRefund(item)}
              variant="danger"
              size="sm"
              loading={requestingRefund === item.saleId}
              disabled={requestingRefund === item.saleId}
            />
          )}
        </View>
      </View>
    );
  }, [user?.uid, requestingRefund]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Minhas Compras</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={uniquePurchases}
          keyExtractor={item => `${item.buyerId}_${item.productId}`}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={COLORS.gold} />}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<MarketplaceEmptyState icon="🛒" title="Nenhuma compra ainda" subtitle="Explore o marketplace e adquira produtos digitais" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.gold} /> : null}
          renderItem={renderItem}
        />
      )}

      <Modal visible={refundModal} transparent animationType="fade" onRequestClose={() => setRefundModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitar reembolso</Text>
            <Text style={styles.modalSubtitle}>Informe o motivo da solicitação:</Text>
            <Input placeholder="Ex: não era o que eu esperava" value={refundReason} onChangeText={setRefundReason} multiline maxLength={300} />
            <View style={styles.modalActions}>
              <Button label="Cancelar" onPress={() => setRefundModal(false)} variant="ghost" />
              <Button label="Enviar" onPress={confirmRefund} variant="danger" />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  // backBtn removed — now uses Button
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  listContent: { padding: SPACING.md },
  card: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  productId: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, flex: 1 },
  amount: { color: COLORS.gold, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  date: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.md },
  cardActions: { flexDirection: 'row', gap: SPACING.sm },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, width: '100%' },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  modalSubtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.md },
  // modalInput removed — now uses Input
  modalActions: { flexDirection: 'row', gap: SPACING.sm },
});
