import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, Card, EmptyState } from '../../components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { Block, getBloqueados, desbloquearUsuario } from '../../services/blockService';
import Header from '../../components/Header';

export default function BlockedScreen() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBlocked(); }, []);

  async function loadBlocked() {
    if (!user) return;
    const list = await getBloqueados(user.uid);
    setBlocked(list);
    setLoading(false);
  }

  async function handleUnblock(block: Block) {
    if (!user) return;
    Alert.alert('Desbloquear', `Deseja desbloquear ${block.blockedName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: async () => {
          await desbloquearUsuario(user.uid, block.blockedId);
          setBlocked(prev => prev.filter(b => b.id !== block.id));
        },
      },
    ]);
  }

  function renderBlock({ item }: { item: Block }) {
    return (
      <Card padding={SPACING.lg} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
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
        <Button label="Desbloquear" variant="ghost" onPress={() => handleUnblock(item)} textStyle={{ color: COLORS.gold, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold }} />
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Bloqueados" showBack={true} showHome={true} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      ) : blocked.length === 0 ? (
        <EmptyState icon="✦" title="Nenhum usuário bloqueado" />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // blockItem removed — now uses Card
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: COLORS.border },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  avatarIcon: { fontSize: FONT_SIZE.xxl },
  blockInfo: { flex: 1 },
  blockName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  blockText: { color: COLORS.error, fontSize: FONT_SIZE.caption, marginTop: 2 },
  // unblockButton/unblockButtonText removed — now uses Button
  // emptyContainer/Icon/Title removed — now uses EmptyState
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.lg + 52 + SPACING.md },
});
