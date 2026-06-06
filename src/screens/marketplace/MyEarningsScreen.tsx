import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useCreatorWallet } from '../../hooks/useCreatorWallet';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { CreatorTransaction } from '../../shared/types/marketplace';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const TYPE_LABELS: Record<string, { label: string; color: string; prefix: string }> = {
  sale:        { label: 'Venda',     color: colors.success, prefix: '+' },
  withdrawal:  { label: 'Saque',     color: colors.error,   prefix: '-' },
  refund:      { label: 'Reembolso', color: colors.error,   prefix: '-' },
  commission:  { label: 'Liberação', color: colors.gold,    prefix: '+' },
  chargeback:  { label: 'Chargeback',color: colors.error,   prefix: '-' },
};

export default function MyEarningsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const {
    wallet, transactions, loading, loadingTransactions,
    loadMoreTransactions, hasMore, loadingMore, refreshTransactions,
  } = useCreatorWallet(user?.uid);

  useEffect(() => {
    refreshTransactions();
  }, []);

  function renderTransaction({ item }: { item: CreatorTransaction }) {
    const config = TYPE_LABELS[item.type] ?? { label: item.type, color: colors.gray, prefix: '' };
    return (
      <View style={styles.txCard}>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{config.label}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>{item.createdAt.toLocaleDateString('pt-BR')}</Text>
        </View>
        <Text style={[styles.txAmount, { color: config.color }]}>
          {config.prefix}R$ {Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Ganhos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Withdrawal')}>
          <Text style={styles.withdrawBtn}>💸</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          ListHeaderComponent={() => (
            <>
              {/* Cards de saldo */}
              <View style={styles.balanceGrid}>
                <View style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Disponível para saque</Text>
                  <Text style={[styles.balanceValue, { color: colors.success }]}>
                    R$ {(wallet?.availableBalance ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Pendente</Text>
                  <Text style={[styles.balanceValue, { color: colors.gold }]}>
                    R$ {(wallet?.pendingBalance ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Total ganho</Text>
                  <Text style={styles.balanceValue}>
                    R$ {(wallet?.totalEarned ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Total sacado</Text>
                  <Text style={styles.balanceValue}>
                    R$ {(wallet?.totalWithdrawn ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {wallet?.hasChargebackPending && (
                <View style={styles.chargebackWarning}>
                  <Text style={styles.chargebackText}>
                    ⚠️ Há um chargeback pendente. Saques bloqueados temporariamente.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.withdrawAction,
                  ((wallet?.availableBalance ?? 0) <= 0 || wallet?.hasChargebackPending)
                    && styles.withdrawActionDisabled,
                ]}
                onPress={() => navigation.navigate('Withdrawal')}
                disabled={(wallet?.availableBalance ?? 0) <= 0 || wallet?.hasChargebackPending}
              >
                <Text style={styles.withdrawActionText}>💸 Solicitar saque</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Histórico de transações</Text>
            </>
          )}
          contentContainerStyle={styles.listContent}
          onEndReached={() => { if (hasMore) loadMoreTransactions(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            loadingTransactions ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <MarketplaceEmptyState
                icon="💰"
                title="Nenhuma transação ainda"
                subtitle="Suas vendas aparecerão aqui"
              />
            )
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.gold} /> : null}
          renderItem={renderTransaction}
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
  withdrawBtn: { fontSize: 24 },
  listContent: { padding: spacing.md },
  balanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  balanceCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, width: '47%',
  },
  balanceLabel: { color: colors.gray, fontSize: fonts.sizes.sm, marginBottom: spacing.xs },
  balanceValue: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  chargebackWarning: {
    backgroundColor: colors.error + '11', borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error, padding: spacing.md, marginBottom: spacing.md,
  },
  chargebackText: { color: colors.error, fontSize: fonts.sizes.sm },
  withdrawAction: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.md,
  },
  withdrawActionDisabled: { opacity: 0.4 },
  withdrawActionText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  sectionTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', marginBottom: spacing.sm },
  txCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  txInfo: { flex: 1 },
  txType: { color: colors.white, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  txDesc: { color: colors.gray, fontSize: fonts.sizes.sm },
  txDate: { color: colors.grayDark, fontSize: fonts.sizes.xs, marginTop: spacing.xs },
  txAmount: { fontSize: fonts.sizes.md, fontWeight: 'bold' },
});