import React, { useState, useEffect } from 'react';
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
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Block, getBloqueados, desbloquearUsuario } from '../../services/blockService';
import Header from '../../components/Header';

export default function BlockedScreen() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlocked();
  }, []);

  async function loadBlocked() {
    if (!user) return;
    const list = await getBloqueados(user.uid);
    setBlocked(list);
    setLoading(false);
  }

  async function handleUnblock(block: Block) {
    if (!user) return;
    Alert.alert(
      'Desbloquear',
      `Deseja desbloquear ${block.blockedName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            await desbloquearUsuario(user.uid, block.blockedId);
            setBlocked(prev => prev.filter(b => b.id !== block.id));
          },
        },
      ]
    );
  }

  function renderBlock({ item }: { item: Block }) {
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
          style={styles.unblockButton}
          onPress={() => handleUnblock(item)}
        >
          <Text style={styles.unblockButtonText}>Desbloquear</Text>
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
      ) : blocked.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyTitle}>Nenhum usuário bloqueado</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={item => item.id}
          renderItem={renderBlock}
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
  },
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
  },
  emptyIcon: { fontSize: 60, color: colors.gold },
  emptyTitle: {
    color: colors.white,
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
  },
});
