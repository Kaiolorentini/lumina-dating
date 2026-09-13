// ============================================
// LUMINA — CURADORIA DO MARKETPLACE
// src/screens/admin/AdminCurationScreen.tsx
//
// Painel de decisão editorial: o que está no carrossel da home
// e o que mais vende. Antes o destaque só era acessível produto
// a produto, dentro da tela de revisão — não dava para ver o
// conjunto nem comparar desempenho.
//
// A contagem de vendas vem da CF: o app não pode (e não deve)
// ler a collection sales inteira.
// ============================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import app from '../../core/firebase';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface CurationProduct {
  id:            string;
  title:         string;
  category:      string;
  price:         number;
  isFree:        boolean;
  coverImage:    string;
  ownerId:       string;
  isFeatured:    boolean;
  averageRating: number;
  salesCount:    number;
  revenue:       number;
}

interface CurationResponse {
  featured:   CurationProduct[];
  topSelling: CurationProduct[];
  totals: {
    approvedProducts:  number;
    featuredCount:     number;
    productsWithSales: number;
  };
}

function money(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function AdminCurationScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();

  const [data, setData] = useState<CurationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const functions = getFunctions(app, 'us-central1');
      const fn = httpsCallable<void, CurationResponse>(functions, 'getCurationDashboard');
      const result = await fn();
      setData(result.data);
    } catch (e: any) {
      console.error('[AdminCuration] erro:', e?.code, e?.message);
      setError(e?.message ?? 'Não foi possível carregar a curadoria.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(product: CurationProduct) {
    const next = !product.isFeatured;
    setToggling(product.id);
    try {
      const functions = getFunctions(app, 'us-central1');
      const toggle = httpsCallable(functions, 'toggleProductFeatured');
      await toggle({ productId: product.id, isFeatured: next });
      // Recarrega do servidor: o estado local não sabe se outro
      // admin mexeu no mesmo produto enquanto a tela estava aberta.
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível alterar o destaque.');
    } finally {
      setToggling(null);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  if (guardLoading || blocked) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      </ScreenContainer>
    );
  }

  function renderProduct(p: CurationProduct, rank?: number) {
    const busy = toggling === p.id;
    return (
      <View key={p.id} style={styles.card}>
        {rank !== undefined && (
          <View style={styles.rank}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('AdminProductReview', { productId: p.id })}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: p.coverImage || 'https://via.placeholder.com/80' }}
            style={styles.cover}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{p.title}</Text>
          <Text style={styles.category}>{p.category}</Text>

          <View style={styles.statsRow}>
            <Text style={styles.stat}>
              🛒 {p.salesCount} {p.salesCount === 1 ? 'venda' : 'vendas'}
            </Text>
            {p.revenue > 0 && (
              <Text style={styles.statRevenue}>{money(p.revenue)}</Text>
            )}
            {p.averageRating > 0 && (
              <Text style={styles.stat}>★ {p.averageRating.toFixed(1)}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.toggleBtn, p.isFeatured && styles.toggleBtnActive]}
          onPress={() => handleToggle(p)}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={p.isFeatured ? colors.background : colors.gold} size="small" />
          ) : (
            <Text style={[styles.toggleText, p.isFeatured && styles.toggleTextActive]}>
              {p.isFeatured ? '✦' : '+'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Gerenciar Vitrine</Text>
          <Text style={styles.headerSubtitle}>Marketplace</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>👑 Super</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
          }
        >
          {/* Resumo */}
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{data?.totals.featuredCount ?? 0}</Text>
              <Text style={styles.summaryLabel}>Em destaque</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{data?.totals.approvedProducts ?? 0}</Text>
              <Text style={styles.summaryLabel}>Aprovados</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{data?.totals.productsWithSales ?? 0}</Text>
              <Text style={styles.summaryLabel}>Com vendas</Text>
            </View>
          </View>

          {/* Em destaque */}
          <Text style={styles.sectionTitle}>✦ No carrossel</Text>
          {data && data.featured.length > 0 ? (
            data.featured.map(p => renderProduct(p))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Nenhum produto em destaque. O carrossel da home fica oculto
                enquanto não houver nenhum.
              </Text>
            </View>
          )}

          {/* Mais vendidos */}
          <Text style={styles.sectionTitle}>🛒 Mais vendidos</Text>
          {data && data.topSelling.length > 0 ? (
            data.topSelling.map((p, i) => renderProduct(p, i + 1))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nenhuma venda registrada ainda.</Text>
            </View>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  headerSubtitle: {
    color: colors.gray, fontSize: fonts.sizes.xs,
    letterSpacing: 0.5, marginTop: 1,
  },
  roleBadge: {
    backgroundColor: colors.gold + '22', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gold,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2,
  },
  roleBadgeText: { color: colors.gold, fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  content: { padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
  },
  retryBtnText: { color: colors.background, fontWeight: 'bold' },

  summary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    paddingVertical: spacing.md, marginBottom: spacing.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: colors.gold, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  summaryLabel: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.grayDark },

  sectionTitle: {
    color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold',
    marginTop: spacing.lg, marginBottom: spacing.sm,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  rank: {
    width: 22, alignItems: 'center',
  },
  rankText: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  cover: {
    width: 56, height: 56, borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
  },
  info: { flex: 1, gap: 2 },
  title: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  category: {
    color: colors.gray, fontSize: fonts.sizes.xs,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  stat: { color: colors.grayLight, fontSize: fonts.sizes.xs },
  statRevenue: { color: colors.success, fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  toggleBtn: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtnActive: { backgroundColor: colors.gold },
  toggleText: { color: colors.gold, fontSize: 18, fontWeight: 'bold' },
  toggleTextActive: { color: colors.background },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.grayDark,
    padding: spacing.md,
  },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.sm, lineHeight: 19, textAlign: 'center' },
});