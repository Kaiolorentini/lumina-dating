// ============================================
// LUMINA — BLOQUEADOS
// src/screens/Profile/BlockedScreen.tsx
//
// 13/10/2026 (web lote 4):
// - Falha ao carregar a lista mostra erro com "Tentar de novo";
//   antes o carregamento ficava girando para sempre.
// - Desbloquear: botão travado enquanto grava, aviso se falhar, e
//   a pessoa volta a aparecer na Home/Sintonize na hora
//   (invalidateBlockedUids limpa o cache de 2 min dos bloqueios).
// - O Alert com botões funciona também na web (WebAlertHost).
//
// 14/10/2026 (web T4): no computador a lista mostra os itens lado a
// lado (useDesktopGrid). Celular e app: igual.
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDesktopGrid } from '../../hooks/useDesktopGrid';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Block, getBloqueados, desbloquearUsuario } from '../../services/blockService';
import { invalidateBlockedUids } from '../../services/blockedUsersService';
import Header from '../../components/Header';

export default function BlockedScreen() {
  // Computador: itens lado a lado (useDesktopGrid). App: igual.
  const grid = useDesktopGrid(380);
  const { user } = useAuth();
  const [blocked, setBlocked]       = useState<Block[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const loadBlocked = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const list = await getBloqueados(user.uid);
      setBlocked(list);
    } catch (error) {
      console.error('[BlockedScreen] carregar bloqueados falhou:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  function handleUnblock(block: Block) {
    if (!user || unblocking) return;
    Alert.alert(
      'Desbloquear',
      `Deseja desbloquear ${block.blockedName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            setUnblocking(block.id);
            try {
              await desbloquearUsuario(user.uid, block.blockedId);
              invalidateBlockedUids(); // volta a aparecer na Home/Sintonize
              setBlocked(prev => prev.filter(b => b.id !== block.id));
            } catch (error) {
              console.error('[BlockedScreen] desbloquear falhou:', error);
              Alert.alert('Não foi possível desbloquear', 'Verifique a conexão e tente de novo.');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  }

  function renderBlock({ item }: { item: Block }) {
    const busy = unblocking === item.id;
    return (
      <View style={styles.blockItem}>
        {item.blockedPhoto ? (
          <Image source={{ uri: item.blockedPhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
        )}
        <View style={styles.blockInfo}>
          <Text style={styles.blockName}>{item.blockedName}</Text>
          <Text style={styles.blockText}>Bloqueado</Text>
        </View>
        <TouchableOpacity
          style={[styles.unblockButton, busy && styles.unblockButtonBusy]}
          onPress={() => handleUnblock(item)}
          disabled={unblocking !== null}
          accessibilityRole="button"
          accessibilityLabel={`Desbloquear ${item.blockedName}`}
          accessibilityState={{ disabled: unblocking !== null, busy }}
        >
          {busy
            ? <ActivityIndicator color={colors.gold} size="small" />
            : <Text style={styles.unblockButtonText}>Desbloquear</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Bloqueados" showBack={true} showHome={true} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : loadError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Não foi possível carregar</Text>
          <Text style={styles.emptyText}>Verifique a conexão e tente de novo.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBlocked} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>Nenhum usuário bloqueado</Text>
          <Text style={styles.emptyText}>
            Quem você bloquear aparece aqui. Bloquear tira a pessoa do seu feed e fecha a conversa entre vocês.
          </Text>
        </View>
      ) : (
        <FlatList
          key={grid.listKey}
          {...grid.listProps}
          data={blocked}
          keyExtractor={item => item.id}
          renderItem={grid.wrap(renderBlock)}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.grayDark,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 22 },
  blockInfo: { flex: 1 },
  blockName: {
    color: colors.white,
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
  },
  blockText: { color: colors.error, fontSize: fonts.sizes.sm, marginTop: 2 },
  unblockButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    minWidth: 112,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockButtonBusy: { opacity: 0.6 },
  unblockButtonText: {
    color: colors.gold,
    fontSize: fonts.sizes.sm,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: colors.grayDark,
    marginLeft: spacing.lg + 52 + spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: { fontSize: 60, color: colors.gold },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.gray,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryText: { color: colors.background, fontWeight: 'bold' },
});

