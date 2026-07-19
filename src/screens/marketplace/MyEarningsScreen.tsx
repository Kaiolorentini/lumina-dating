import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT , alpha} from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useCreatorWallet } from '../../hooks/useCreatorWallet';
import { MarketplaceEmptyState } from '../../components/marketplace/MarketplaceEmptyState';
import { CreatorTransaction } from '../../shared/types/marketplace';
import ScreenContainer from '../../components/ScreenContainer';
import { Badge, Button, Card } from '../../components/ui';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const TYPE_CONFIG: Record<string, { label: string; variant: 'success' | 'error' | 'premium'; prefix: string }> = {
  sale:        { label: 'Venda',     variant: 'success', prefix: '+' },
  withdrawal:  { label: 'Saque',     variant: 'error',   prefix: '-' },
  refund:      { label: 'Reembolso', variant: 'error',   prefix: '-' },
  commission:  { label: 'Liberação', variant: 'premium', prefix: '+' },
  chargeback:  { label: 'Chargeback',variant: 'error',   prefix: '-' },
};

export default function MyEarningsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const { wallet, transactions, loading, loadingTransactions, loadMoreTransactions, hasMore, loadingMore, refreshTransactions } = useCreatorWallet(user?.uid);

  useEffect(() => { refreshTransactions(); }, []);

  function renderTransaction({ item }: { item: CreatorTransaction }) {
    const config = TYPE_CONFIG[item.type] ?? { label: item.type, variant: 'default' as const, prefix: '' };
    return (
      <Card padding={SPACING.md} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
        <View style={styles.txInfo}>
          <Text style={styles.txType}>{config.label}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>{item.createdAt.toLocaleDateString('pt-BR')}</Text>
        </View>
        <Text style={[styles.txAmount, { color: config.variant === 'error' ? COLORS.error : COLORS.gold }]}>
          {config.prefix}R$ {Math.abs(item.amount).toFixed(2)}
        </Text>
      </Card>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Meus Ganhos</Text>
        <Button label="💸" variant="ghost" onPress={() => navigation.navigate('Withdrawal')} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          ListHeaderComponent={() => (
            <>
              <View style={styles.balanceGrid}>
                <Card variant="default" padding={SPACING.md} style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Disponível para saque</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.success }]}>R$ {(wallet?.availableBalance ?? 0).toFixed(2)}</Text>
                </Card>
                <Card variant="default" padding={SPACING.md} style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Pendente</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.gold }]}>R$ {(wallet?.pendingBalance ?? 0).toFixed(2)}</Text>
                </Card>
                <Card variant="default" padding={SPACING.md} style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Total ganho</Text>
                  <Text style={styles.balanceValue}>R$ {(wallet?.totalEarned ?? 0).toFixed(2)}</Text>
                </Card>
                <Card variant="default" padding={SPACING.md} style={styles.balanceCard}>
                  <Text style={styles.balanceLabel}>Total sacado</Text>
                  <Text style={styles.balanceValue}>R$ {(wallet?.totalWithdrawn ?? 0).toFixed(2)}</Text>
                </Card>
              </View>

              {wallet?.hasChargebackPending && (
                <Card padding={SPACING.md} style={{ borderWidth: 1, borderColor: COLORS.error }}>
                  <Text style={styles.chargebackText}>⚠️ Há um chargeback pendente. Saques bloqueados temporariamente.</Text>
                </Card>
              )}

              <Button
                label="💸 Solicitar saque"
                onPress={() => navigation.navigate('Withdrawal')}
                variant="primary"
                size="md"
                fullWidth
                disabled={(wallet?.availableBalance ?? 0) <= 0 || wallet?.hasChargebackPending}
                style={{ marginBottom: SPACING.md }}
              />

              <Text style={styles.sectionTitle}>Histórico de transações</Text>
            </>
          )}
          contentContainerStyle={styles.listContent}
          onEndReached={() => { if (hasMore) loadMoreTransactions(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={loadingTransactions ? <ActivityIndicator color={COLORS.gold} /> : <MarketplaceEmptyState icon="💰" title="Nenhuma transação ainda" subtitle="Suas vendas aparecerão aqui" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.gold} /> : null}
          renderItem={renderTransaction}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: alpha(COLORS.gold, 0.27) },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  // backBtn/withdrawBtn removed — now uses Button
  listContent: { padding: SPACING.md },
  balanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  balanceCard: { width: '47%' },
  balanceLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption, marginBottom: SPACING.xs },
  balanceValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  chargebackText: { color: COLORS.error, fontSize: FONT_SIZE.caption },
  sectionTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.sm },
  // txCard/chargebackWarning removed — now uses Card
  txInfo: { flex: 1 },
  txType: { color: COLORS.textPrimary, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  txDesc: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  txDate: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: SPACING.xs },
  txAmount: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
});
