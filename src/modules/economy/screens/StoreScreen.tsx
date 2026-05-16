import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import {
  purchaseCoins,
  COIN_PACKAGES,
  CoinPackage,
} from '../services/purchaseService';
import { getTransactions } from '../services/transactionService';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import Header from '../../../components/Header';
import { Transaction } from '../../../shared/types';
import { formatRelativeTime } from '../../../shared/utils';

// ============================================
// STORE SCREEN — MÓDULO ECONOMY
// Screen limpa: apenas renderiza UI.
// ============================================

export default function StoreScreen() {
  const { user } = useAuth();
  const { wallet, loading, refresh } = useWallet();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function handlePurchase(pkg: CoinPackage) {
    if (!user) return;

    Alert.alert(
      '💰 Confirmar compra',
      `Deseja comprar ${pkg.coins + pkg.bonus} moedas por ${pkg.price}?\n\n(Simulação — sem cobrança real)`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setPurchasing(pkg.id);
              const success = await purchaseCoins(user.uid, pkg.id);
              if (success) {
                await refresh();
                Alert.alert(
                  '✅ Compra realizada!',
                  `${pkg.coins + pkg.bonus} moedas adicionadas!`
                );
              }
            } catch {
              Alert.alert('Erro', 'Não foi possível completar a compra.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  }

  async function handleShowHistory() {
    if (!user) return;
    setShowHistory(!showHistory);
    if (!showHistory && transactions.length === 0) {
      setLoadingHistory(true);
      const trans = await getTransactions(user.uid);
      setTransactions(trans);
      setLoadingHistory(false);
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Header title="Lumina Store" showBack={false} showHome={false} />

      {/* Carteira */}
      <View style={styles.walletCard}>
        <Text style={styles.walletIcon}>💰</Text>
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>Suas Lumina Coins</Text>
          {loading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Text style={styles.walletCoins}>
              {wallet?.coins || 0} moedas
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handleShowHistory}
        >
          <Text style={styles.historyButtonText}>
            {showHistory ? 'Fechar' : 'Histórico'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Histórico */}
      {showHistory && (
        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>📋 Histórico</Text>
          {loadingHistory ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 16 }} />
          ) : transactions.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma transação ainda</Text>
          ) : (
            transactions.map(trans => (
              <View key={trans.id} style={styles.transactionItem}>
                <Text style={styles.transactionIcon}>
                  {trans.type === 'earn' ? '⬆️' : '⬇️'}
                </Text>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc}>{trans.description}</Text>
                  <Text style={styles.transactionDate}>
                    {formatRelativeTime(trans.timestamp)}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: trans.type === 'earn' ? colors.success : colors.error },
                ]}>
                  {trans.type === 'earn' ? '+' : '-'}{trans.amount}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Banner */}
      <View style={styles.scarcityBanner}>
        <Text style={styles.scarcityIcon}>🔥</Text>
        <Text style={styles.scarcityText}>
          Conteúdo exclusivo disponível agora!
        </Text>
      </View>

      {/* Pacotes */}
      <Text style={styles.sectionTitle}>💎 Pacotes de Moedas</Text>
      {COIN_PACKAGES.map(pkg => (
        <TouchableOpacity
          key={pkg.id}
          style={[
            styles.packageCard,
            pkg.highlighted && styles.packageCardHighlighted,
          ]}
          onPress={() => handlePurchase(pkg)}
          disabled={purchasing === pkg.id}
        >
          {pkg.highlighted && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>⭐ MAIS POPULAR</Text>
            </View>
          )}
          <View style={styles.packageLeft}>
            <Text style={styles.packageIcon}>{pkg.icon}</Text>
            <View>
              <Text style={styles.packageLabel}>{pkg.label}</Text>
              <Text style={styles.packageCoins}>
                {pkg.coins} moedas
                {pkg.bonus > 0 && (
                  <Text style={styles.packageBonus}> +{pkg.bonus} bônus</Text>
                )}
              </Text>
            </View>
          </View>
          <View style={styles.packageRight}>
            {purchasing === pkg.id ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.packagePrice}>{pkg.price}</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* O que desbloquear */}
      <Text style={styles.sectionTitle}>🔓 O que desbloquear</Text>
      <View style={styles.unlockGrid}>
        {[
          { icon: '📸', label: 'Mídia exclusiva', coins: 50 },
          { icon: '🖼️', label: 'Galeria completa', coins: 100 },
          { icon: '💬', label: 'Mensagem especial', coins: 30 },
          { icon: '✦', label: 'Super Sintonia', coins: 200 },
          { icon: '🚀', label: 'Boost de perfil', coins: 150 },
          { icon: '🎁', label: 'Conteúdo VIP', coins: 75 },
        ].map((item, index) => (
          <View key={index} style={styles.unlockItem}>
            <Text style={styles.unlockIcon}>{item.icon}</Text>
            <Text style={styles.unlockLabel}>{item.label}</Text>
            <Text style={styles.unlockCoins}>💰 {item.coins}</Text>
          </View>
        ))}
      </View>

      {/* Aviso */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          🔒 Pagamentos simulados — sem cobranças reais.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: spacing.md,
  },
  walletIcon: { fontSize: 36 },
  walletInfo: { flex: 1 },
  walletLabel: { color: colors.gray, fontSize: fonts.sizes.sm },
  walletCoins: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
  historyButton: {
    backgroundColor: colors.gold + '22',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  historyButtonText: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  historyContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayDark,
    gap: spacing.sm,
  },
  transactionIcon: { fontSize: 18 },
  transactionInfo: { flex: 1 },
  transactionDesc: { color: colors.white, fontSize: fonts.sizes.sm },
  transactionDate: { color: colors.gray, fontSize: fonts.sizes.xs },
  transactionAmount: { fontSize: fonts.sizes.md, fontWeight: 'bold' },
  scarcityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.gold + '22',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
    gap: spacing.sm,
  },
  scarcityIcon: { fontSize: 24 },
  scarcityText: {
    flex: 1,
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    letterSpacing: 1,
  },
  packageCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grayDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageCardHighlighted: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '11',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  popularBadgeText: {
    color: colors.background,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  packageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  packageIcon: { fontSize: 36 },
  packageLabel: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  packageCoins: { color: colors.gray, fontSize: fonts.sizes.sm },
  packageBonus: { color: colors.gold, fontWeight: 'bold' },
  packageRight: { alignItems: 'flex-end' },
  packagePrice: {
    color: colors.gold,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
  unlockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  unlockItem: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grayDark,
    gap: spacing.xs,
  },
  unlockIcon: { fontSize: 28 },
  unlockLabel: {
    color: colors.grayLight,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
  },
  unlockCoins: {
    color: colors.gold,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
  },
  disclaimer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  disclaimerText: {
    color: colors.gray,
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});