// ============================================
// LUMINA — ABA DE COMPRAS DE CRISTAIS v2.0
// src/screens/marketplace/CoinsPurchasesTab.tsx
//
// v2.0 — tema do marketplace, para não destoar da aba ao lado.
//
// SEM BOTÃO DE REEMBOLSO: cristais não são reembolsáveis. Quando
// um estorno chega pelo banco, o status vira 'chargeback' e o
// card explica o que aconteceu — inclusive a pendência, que é o
// motivo de novas compras ficarem bloqueadas.
// ============================================

import React from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { MP, MP_FONT, spacing, borderRadius } from '../../theme/marketplace';
import { useCoinsPurchases, CoinsPurchase } from '../../hooks/useCoinsPurchases';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';

interface Props {
  uid: string | undefined;
}

function StatusBadge({ status }: { status: CoinsPurchase['status'] }) {
  const config = {
    completed:  { label: 'Concluída', style: styles.badgeSuccess, text: styles.badgeTextSuccess },
    chargeback: { label: 'Estornada', style: styles.badgeError,   text: styles.badgeTextError },
    pending:    { label: 'Pendente',  style: styles.badgeNeutral, text: styles.badgeTextNeutral },
  }[status] ?? { label: status, style: styles.badgeNeutral, text: styles.badgeTextNeutral };

  return (
    <View style={[styles.badge, config.style]}>
      <Text style={[styles.badgeText, config.text]}>{config.label}</Text>
    </View>
  );
}

function PurchaseCard({ item }: { item: CoinsPurchase }) {
  const isChargeback = item.status === 'chargeback';

  return (
    <View style={[styles.card, isChargeback && styles.cardChargeback]}>
      <View style={styles.cardTop}>
        <Text style={styles.packageLabel} numberOfLines={1}>
          💎 {item.packageLabel}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.coinsRow}>
        <Text style={[styles.coins, isChargeback && styles.coinsStruck]}>
          {item.totalCoins.toLocaleString('pt-BR')}
        </Text>
        <Text style={[styles.coinsUnit, isChargeback && styles.coinsStruck]}>
          cristais
        </Text>
        {item.bonus > 0 && !isChargeback && (
          <View style={styles.bonusPill}>
            <Text style={styles.bonusText}>+{item.bonus} bônus</Text>
          </View>
        )}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.amount}>
          R$ {item.amount.toFixed(2).replace('.', ',')}
        </Text>
        <Text style={styles.date}>
          {item.createdAt.toLocaleDateString('pt-BR')} ·{' '}
          {item.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {isChargeback && (
        <View style={styles.chargebackBox}>
          <Text style={styles.chargebackTitle}>Pagamento estornado</Text>
          <Text style={styles.chargebackText}>
            {(item.debtCreated ?? 0) > 0
              ? `${item.coinsReverted ?? 0} cristais foram removidos da sua carteira. ` +
                `Como ${item.debtCreated} já haviam sido usados, sua conta ficou com pendência ` +
                `e novas compras estão bloqueadas até a análise da nossa equipe.`
              : `${item.coinsReverted ?? item.totalCoins} cristais foram removidos da sua carteira.`}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function CoinsPurchasesTab({ uid }: Props) {
  const { purchases, loading, error, refresh } = useCoinsPurchases(uid);

  if (loading) {
    return <ActivityIndicator color={MP.gold} style={styles.centered} />;
  }

  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={refresh} activeOpacity={0.85}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={purchases}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      windowSize={7}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refresh} tintColor={MP.gold} />
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <MarketplaceEmptyState
            icon="💎"
            title="Nenhuma compra de cristais"
            subtitle="Suas compras de Cristais Premium aparecem aqui"
          />
        </View>
      }
      renderItem={({ item }) => <PurchaseCard item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  centered:    { flex: 1, marginTop: spacing.xxl },
  listContent: { padding: spacing.md },
  emptyWrap:   { minHeight: 340, justifyContent: 'center' },

  card: {
    backgroundColor: MP.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: MP.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardChargeback: { borderColor: 'rgba(255, 77, 109, 0.5)' },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  packageLabel: {
    color: MP.text,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.bold,
    flex: 1,
  },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  badgeSuccess: { backgroundColor: 'rgba(0, 230, 118, 0.12)', borderColor: MP.success },
  badgeError:   { backgroundColor: 'rgba(255, 77, 109, 0.12)', borderColor: MP.error },
  badgeNeutral: { backgroundColor: MP.bgElevated, borderColor: MP.border },
  badgeText:    { fontSize: MP_FONT.size.xs, fontWeight: MP_FONT.weight.bold },
  badgeTextSuccess: { color: MP.success },
  badgeTextError:   { color: MP.error },
  badgeTextNeutral: { color: MP.textMuted },

  coinsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  coins: {
    color: MP.gold,
    fontSize: MP_FONT.size.xxl,
    fontWeight: MP_FONT.weight.heavy,
    letterSpacing: MP_FONT.tracking.tight,
  },
  coinsUnit: {
    color: MP.goldLight,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.semibold,
  },
  coinsStruck: { textDecorationLine: 'line-through', color: MP.textMuted },
  bonusPill: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.4)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    marginLeft: 2,
  },
  bonusText: {
    color: MP.success,
    fontSize: MP_FONT.size.xs,
    fontWeight: MP_FONT.weight.bold,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: MP.border,
  },
  amount: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.semibold,
  },
  date: { color: MP.textMuted, fontSize: MP_FONT.size.xs },

  chargebackBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 77, 109, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.3)',
  },
  chargebackTitle: {
    color: MP.error,
    fontSize: MP_FONT.size.sm,
    fontWeight: MP_FONT.weight.bold,
    marginBottom: 2,
  },
  chargebackText: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.xs,
    lineHeight: 18,
  },

  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorIcon: { fontSize: 44 },
  errorText: {
    color: MP.textSoft,
    fontSize: MP_FONT.size.sm,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: MP.borderGold,
    backgroundColor: MP.goldSubtle,
  },
  retryText: {
    color: MP.goldLight,
    fontSize: MP_FONT.size.md,
    fontWeight: MP_FONT.weight.bold,
  },
});