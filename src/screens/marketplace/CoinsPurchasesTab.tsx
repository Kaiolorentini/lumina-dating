// ============================================
// LUMINA — ABA DE COMPRAS DE CRISTAIS v1.0
// src/screens/marketplace/CoinsPurchasesTab.tsx
//
// Histórico financeiro de Cristais Premium.
// Componente separado para não inchar MyPurchasesScreen, que já
// carrega a lógica de reembolso de conteúdos.
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
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useCoinsPurchases, CoinsPurchase } from '../../hooks/useCoinsPurchases';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';

interface Props {
  uid: string | undefined;
}

function StatusBadge({ status }: { status: CoinsPurchase['status'] }) {
  const config = {
    completed:  { label: 'Concluída', style: styles.badgeSuccess },
    chargeback: { label: 'Estornada', style: styles.badgeError },
    pending:    { label: 'Pendente',  style: styles.badgeNeutral },
  }[status] ?? { label: status, style: styles.badgeNeutral };

  return (
    <View style={[styles.badge, config.style]}>
      <Text style={styles.badgeText}>{config.label}</Text>
    </View>
  );
}

function PurchaseCard({ item }: { item: CoinsPurchase }) {
  const isChargeback = item.status === 'chargeback';

  return (
    <View style={[styles.card, isChargeback && styles.cardChargeback]}>
      <View style={styles.cardHeader}>
        <Text style={styles.packageLabel} numberOfLines={1}>
          💎 {item.packageLabel}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.coinsRow}>
        <Text style={[styles.coins, isChargeback && styles.coinsStruck]}>
          {item.totalCoins.toLocaleString('pt-BR')} cristais
        </Text>
        {item.bonus > 0 && !isChargeback && (
          <Text style={styles.bonus}>+{item.bonus} bônus</Text>
        )}
      </View>

      <Text style={styles.amount}>R$ {item.amount.toFixed(2).replace('.', ',')}</Text>

      <Text style={styles.date}>
        {item.createdAt.toLocaleDateString('pt-BR')} às{' '}
        {item.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </Text>

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
    return <ActivityIndicator color={colors.gold} style={styles.centered} />;
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
      initialNumToRender={8}
      windowSize={7}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
      }
      ListEmptyComponent={
        <MarketplaceEmptyState
          icon="💎"
          title="Nenhuma compra de cristais"
          subtitle="Suas compras de Cristais Premium aparecem aqui"
        />
      }
      renderItem={({ item }) => <PurchaseCard item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  centered:    { flex: 1, marginTop: spacing.xl * 2 },
  listContent: { padding: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardChargeback: { borderColor: colors.error + '88' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  packageLabel: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', flex: 1 },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  badgeSuccess: { backgroundColor: colors.success + '22', borderColor: colors.success },
  badgeError:   { backgroundColor: colors.error + '22',   borderColor: colors.error },
  badgeNeutral: { backgroundColor: colors.grayDark,       borderColor: colors.gray },
  badgeText:    { color: colors.white, fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  coinsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coins:    { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  coinsStruck: { textDecorationLine: 'line-through', color: colors.gray },
  bonus:    { color: colors.success, fontSize: fonts.sizes.xs, fontWeight: 'bold' },

  amount: { color: colors.grayLight, fontSize: fonts.sizes.md, marginTop: 2 },
  date:   { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: spacing.xs },

  chargebackBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error + '11',
    borderWidth: 1,
    borderColor: colors.error + '44',
  },
  chargebackTitle: {
    color: colors.error,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  chargebackText: { color: colors.grayLight, fontSize: fonts.sizes.xs, lineHeight: 18 },

  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.gold + '22',
  },
  retryText: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});