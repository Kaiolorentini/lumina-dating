// ============================================
// LUMINA — MINHAS COMPRAS v2.0
// src/screens/marketplace/MyPurchasesScreen.tsx
//
// v2.0 — tema do marketplace.
//
// Conteúdos e Cristais continuam separados: uma é a biblioteca
// que o usuário acessa, outra é histórico financeiro que ele
// consulta. Hook, deduplicação e fluxo de reembolso inalterados.
// ============================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
  Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MP, MP_GRADIENT, MP_FONT, spacing, borderRadius,
} from '../../theme/marketplace';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { usePurchases } from '../../hooks/usePurchases';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../core/firebase';
import { Purchase, Product } from '../../shared/types/marketplace';
import { getProductsByIds } from '../../services/marketplace/productService';
import ScreenContainer from '../../components/ScreenContainer';
import CoinsPurchasesTab from './CoinsPurchasesTab';

type PurchaseTab = 'content' | 'coins';
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function MyPurchasesScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { purchases, loading, loadMore, hasMore, loadingMore, refresh } = usePurchases(user?.uid);
  const [requestingRefund, setRequestingRefund] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PurchaseTab>('content');

  const [refundModal, setRefundModal] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Purchase | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Deduplica por productId (evita duplicata quando listener +
  // loadMore se sobrepõem)
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

  // A purchase guarda só IDs — o card mostrava "📦 I0L0vz7Ykp…",
  // que não diz nada ao comprador. getProductsByIds resolve os
  // títulos em lote (1 leitura por página, não 1 por item).
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());

  useEffect(() => {
    const ids = uniquePurchases.map(p => p.productId).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    getProductsByIds(ids)
      .then(map => { if (!cancelled) setProductMap(map); })
      .catch(e => console.error('[MyPurchases] hidratacao falhou:', e));
    return () => { cancelled = true; };
  }, [uniquePurchases]);

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
    const isActive = item.status === 'active';
    const product = productMap.get(item.productId);
    return (
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <Image
            source={{ uri: product?.coverImage || 'https://via.placeholder.com/80' }}
            style={styles.cover}
            resizeMode="cover"
          />
          <View style={styles.cardInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {product?.title ?? 'Produto indisponível'}
            </Text>
            <Text style={styles.amount}>
              {item.amount === 0
                ? 'Grátis'
                : `R$ ${item.amount.toFixed(2).replace('.', ',')}`}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusOther]}>
                <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextOther]}>
                  {isActive ? 'Ativo' : item.status}
                </Text>
              </View>
              <Text style={styles.date}>
                {item.createdAt.toLocaleDateString('pt-BR')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          {isActive && (
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => navigation.navigate('ContentViewer', {
                productId: item.productId,
                purchaseId,
              })}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={MP_GRADIENT.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.openBtnInner}
              >
                <Text style={styles.openBtnText}>📂 Abrir conteúdo</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isActive && item.saleId && (
            <TouchableOpacity
              style={styles.refundBtn}
              onPress={() => openRefund(item)}
              disabled={requestingRefund === item.saleId}
            >
              {requestingRefund === item.saleId ? (
                <ActivityIndicator color={MP.error} size="small" />
              ) : (
                <Text style={styles.refundBtnText}>↩</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [user?.uid, requestingRefund, navigation, productMap]);

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
        <Text style={styles.headerTitle}>Minhas Compras</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'content' && styles.tabActive]}
          onPress={() => setActiveTab('content')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'content' && styles.tabTextActive]}>
            📦 Conteúdos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'coins' && styles.tabActive]}
          onPress={() => setActiveTab('coins')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'coins' && styles.tabTextActive]}>
            💎 Cristais
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'coins' ? (
        <CoinsPurchasesTab uid={user?.uid} />
      ) : loading ? (
        <ActivityIndicator color={MP.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={uniquePurchases}
          keyExtractor={item => `${item.buyerId}_${item.productId}`}
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
                icon="🛒"
                title="Nenhuma compra ainda"
                subtitle="Explore o marketplace e adquira produtos digitais"
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
              placeholderTextColor={MP.textMuted}
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
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmRefund}>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  backBtn: { color: MP.gold, fontSize: 30, width: 32 },
  headerTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.xl,
    fontWeight: MP_FONT.weight.bold,
    letterSpacing: MP_FONT.tracking.tight,
  },

  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: MP.border,
    backgroundColor: MP.surface,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: MP.purpleLight,
    backgroundColor: MP.purpleSubtle,
  },
  tabText: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.semibold,
  },
  tabTextActive: { color: MP.purpleLight, fontWeight: MP_FONT.weight.bold },

  listContent: { padding: spacing.md },
  emptyWrap: { minHeight: 380, justifyContent: 'center' },

  card: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardMain: { flexDirection: 'row', gap: spacing.md },
  cover: {
    width: 68, height: 68,
    borderRadius: borderRadius.sm,
    backgroundColor: MP.bgElevated,
  },
  cardInfo: { flex: 1, gap: 3 },
  productTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.bold,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderColor: MP.success,
  },
  statusOther: {
    backgroundColor: 'rgba(255, 77, 109, 0.12)',
    borderColor: MP.error,
  },
  statusText: {
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
    textTransform: 'capitalize',
  },
  statusTextActive: { color: MP.success },
  statusTextOther: { color: MP.error },
  date: { color: MP.textMuted, fontSize: MP_FONT.size.xs },

  amount: {
    color: MP.gold,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.heavy,
  },


  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  openBtn: { flex: 1, borderRadius: borderRadius.full },
  openBtnInner: {
    borderRadius: borderRadius.full,
    paddingVertical: 11,
    alignItems: 'center',
  },
  openBtnText: {
    color: MP.textOnGold,
    fontWeight: MP_FONT.weight.heavy,
    fontSize: MP_FONT.size.md,
  },
  // Reembolso é ação secundária e rara: ícone em vez de texto,
  // para não competir com "Abrir conteúdo".
  refundBtn: {
    width: 42, height: 42,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundBtnText: { color: MP.error, fontSize: 17 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: MP.surfaceRaised,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    padding: spacing.lg,
    width: '100%',
  },
  modalTitle: {
    color: MP.text,
    fontSize: MP_FONT.size.lg,
    fontWeight: MP_FONT.weight.bold,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    color: MP.textMuted,
    fontSize: MP_FONT.size.sm,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: MP.bg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: MP.border,
    color: MP.text,
    padding: spacing.md,
    fontSize: MP_FONT.size.md,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: MP.surface,
    borderWidth: 1,
    borderColor: MP.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  modalCancelBtnText: { color: MP.textSoft, fontWeight: MP_FONT.weight.bold },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: MP.error,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  modalConfirmBtnText: { color: MP.text, fontWeight: MP_FONT.weight.bold },
});