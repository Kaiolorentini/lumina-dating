// ============================================
// LUMINA — VISITORS SCREEN v1.0
// src/modules/premium/screens/VisitorsScreen.tsx
//
// Ver Visitantes — o backend já existia (visitorsService.ts) e
// nunca tinha sido conectado a nenhuma tela.
//
// MODELO: o número é grátis (isca), a identidade custa 50 cristais
// e libera 24h de acesso. O backend nunca devolve a lista sem
// acesso ativo — a checagem é server-side.
//
// CDC: o custo aparece antes da confirmação, com o saldo do
// usuário e a duração do acesso. Nada é debitado sem confirmar.
//
// PERFORMANCE:
// - FlatList virtualizada (a lista pode chegar a 50 visitantes)
// - Contagem regressiva local, sem polling
// - Sem imagem em cache remoto: usa a photoURL já baixada
// ============================================

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Alert,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useVisitors, VisitorProfile } from '../hooks/useVisitors';
import { RootStackParamList } from '../../../navigation/types';
import Header from '../../../components/Header';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expirado';
  const totalMin = Math.floor(ms / 60000);
  const hours    = Math.floor(totalMin / 60);
  const minutes  = totalMin % 60;
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}`;
  return `${minutes} min`;
}

function formatVisitedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1)  return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;

  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'ontem';
  return `há ${diffD} dias`;
}

function VisitorRow({
  visitor,
  onPress,
}: {
  visitor: VisitorProfile;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      {visitor.photoURL ? (
        <Image source={{ uri: visitor.photoURL }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarLetter}>
            {visitor.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {visitor.name}{visitor.age ? `, ${visitor.age}` : ''}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {visitor.city ? `📍 ${visitor.city} · ` : ''}
          {formatVisitedAt(visitor.visitedAt)}
        </Text>
      </View>

      {visitor.visitCount > 1 && (
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{visitor.visitCount}×</Text>
        </View>
      )}

      <Text style={styles.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function VisitorsScreen() {
  const navigation = useNavigation<NavProp>();
  const { user }   = useAuth();

  const {
    data, loading, revealing, error,
    remainingMs, canAfford, reveal, refresh,
  } = useVisitors(user?.uid);

  const handleReveal = useCallback(() => {
    if (!data) return;

    const saldo = data.coinsGratuitos + data.coinsPremium;

    if (!canAfford) {
      Alert.alert(
        'Saldo insuficiente',
        `Ver Visitantes custa ${data.cost} cristais. Você tem ${saldo}.`,
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Ver a loja', onPress: () => navigation.navigate('Store' as any) },
        ],
      );
      return;
    }

    Alert.alert(
      'Ver quem visitou',
      `Revelar todos os visitantes do seu perfil por 24 horas?\n\n` +
        `Custo: ${data.cost} cristais\nSeu saldo: ${saldo}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revelar',
          onPress: async () => {
            const res = await reveal();
            if (res.ok) {
              Alert.alert('👀 Visitantes revelados!', 'Você tem 24 horas de acesso à lista.');
            } else if (res.error) {
              Alert.alert('Não foi possível revelar', res.error);
            }
          },
        },
      ],
    );
  }, [data, canAfford, reveal, navigation]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Quem me visitou" showBack showHome />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </View>
    );
  }

  // ── Erro ──
  if (error && !data) {
    return (
      <View style={styles.container}>
        <Header title="Quem me visitou" showBack showHome />
        <View style={styles.centered}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.stateTitle}>Algo deu errado</Text>
          <Text style={styles.stateSub}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={refresh} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalVisits = data?.totalVisits ?? 0;
  const todayVisits = data?.todayVisits ?? 0;
  const isActive    = data?.isActive ?? false;

  // ── Vazio: ninguém visitou ainda ──
  if (totalVisits === 0) {
    return (
      <View style={styles.container}>
        <Header title="Quem me visitou" showBack showHome />
        <View style={styles.centered}>
          <Text style={styles.stateIcon}>👀</Text>
          <Text style={styles.stateTitle}>Ninguém visitou ainda</Text>
          <Text style={styles.stateSub}>
            Complete seu perfil e interaja para aparecer para mais pessoas.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Quem me visitou" showBack showHome />

      {/* Resumo — o número é sempre grátis */}
      <View style={styles.summary}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{todayVisits}</Text>
          <Text style={styles.summaryLabel}>HOJE</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{totalVisits}</Text>
          <Text style={styles.summaryLabel}>NO TOTAL</Text>
        </View>
      </View>

      {isActive ? (
        <>
          <View style={styles.activeBar}>
            <Text style={styles.activeBarText}>
              ✓ Acesso liberado · expira em {formatRemaining(remainingMs)}
            </Text>
          </View>

          <FlatList
            data={data?.visitors ?? []}
            keyExtractor={item => item.uid}
            initialNumToRender={10}
            windowSize={7}
            removeClippedSubviews
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
            }
            renderItem={({ item }) => (
              <VisitorRow
                visitor={item}
                onPress={() => navigation.navigate('RealProfile', { userId: item.uid })}
              />
            )}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.stateIcon}>🕵️</Text>
                <Text style={styles.stateTitle}>Visitantes indisponíveis</Text>
                <Text style={styles.stateSub}>
                  As visitas mais antigas não ficam guardadas. Novas visitas aparecem aqui.
                </Text>
              </View>
            }
          />
        </>
      ) : (
        // ── Bloqueado: o número é grátis, a identidade é paga ──
        <View style={styles.lockedArea}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedTitle}>
            {totalVisits === 1
              ? '1 pessoa visitou seu perfil'
              : `${totalVisits} pessoas visitaram seu perfil`}
          </Text>
          <Text style={styles.lockedSub}>
            Revele quem são e veja quando cada uma passou por aqui.
            O acesso vale por 24 horas.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, revealing && styles.primaryButtonBusy]}
            onPress={handleReveal}
            disabled={revealing}
            activeOpacity={0.85}
          >
            {revealing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Revelar por {data?.cost ?? 50} ✨
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.balanceHint}>
            Seu saldo: {(data?.coinsGratuitos ?? 0) + (data?.coinsPremium ?? 0)} cristais
          </Text>

          {error && <Text style={styles.inlineError}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold + '44',
  },
  summaryStat:    { alignItems: 'center', gap: 4 },
  summaryValue:   { color: colors.gold, fontSize: fonts.sizes.xxl, fontWeight: 'bold' },
  summaryLabel:   { color: colors.gray, fontSize: fonts.sizes.xs, letterSpacing: 1 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.grayDark },

  activeBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success + '18',
    borderWidth: 1,
    borderColor: colors.success + '55',
  },
  activeBarText: {
    color: colors.success,
    fontSize: fonts.sizes.xs,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  listContent: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayDark + '55',
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: colors.gold,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  rowInfo:  { flex: 1 },
  rowName:  { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  rowMeta:  { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  rowArrow: { color: colors.gray, fontSize: fonts.sizes.xl },
  countPill: {
    backgroundColor: colors.gold + '22',
    borderColor: colors.gold + '66',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countPillText: { color: colors.gold, fontSize: 10, fontWeight: 'bold' },

  lockedArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  lockedIcon:  { fontSize: 56 },
  lockedTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  lockedSub: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  stateIcon:  { fontSize: 56 },
  stateTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  stateSub: {
    color: colors.gray,
    fontSize: fonts.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  primaryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    minWidth: 200,
  },
  primaryButtonBusy: { opacity: 0.7 },
  primaryButtonText: {
    color: colors.background,
    fontSize: fonts.sizes.md,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  balanceHint:  { color: colors.gray, fontSize: fonts.sizes.xs },
  inlineError:  { color: colors.error, fontSize: fonts.sizes.sm, textAlign: 'center' },
});