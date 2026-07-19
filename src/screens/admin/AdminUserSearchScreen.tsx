import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Input } from '../../components/ui';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../../theme/tokens';
import { RootStackParamList } from '../../navigation/types';
import { getUserById, searchUsers } from '../../services/marketplace/adminService';
import { UserProfile } from '../../shared/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function AdminUserSearchScreen() {
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  if (guardLoading || blocked) return null;

  async function handleSearch() {
    if (!search.trim()) return;
    setLoading(true);
    try {
      if (search.trim().length > 20) {
        const user = await getUserById(search.trim());
        setResults(user ? [user] : []);
      } else {
        const users = await searchUsers(search.trim());
        setResults(users);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Button label="‹" variant="ghost" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Buscar Usuário</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchRow}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="UID, nome ou email..."
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
          {loading
            ? <ActivityIndicator color={COLORS.background} size="small" />
            : <Text style={styles.searchBtnText}>🔍</Text>
          }
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Digite para buscar usuários</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => navigation.navigate('AdminUserDetail', { userId: item.uid })}
          >
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text style={styles.userUid}>UID: {item.uid.slice(0, 16)}...</Text>
            </View>
            <View style={styles.userMeta}>
              {(item as any).isBlocked && (
                <View style={styles.blockedBadge}>
                  <Text style={styles.blockedText}>Bloqueado</Text>
                </View>
              )}
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.gold + '44',
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  searchRow: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.sm },
  searchBtn: {
    backgroundColor: COLORS.gold, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, alignItems: 'center', justifyContent: 'center', width: 50,
  },
  searchBtnText: { fontSize: FONT_SIZE.xl },
  list: { padding: SPACING.md },
  userCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  userEmail: { color: COLORS.textSecondary, fontSize: FONT_SIZE.caption },
  userUid: { color: COLORS.border, fontSize: FONT_SIZE.xs },
  userMeta: { alignItems: 'center', gap: SPACING.xs },
  blockedBadge: {
    backgroundColor: COLORS.error + '22', borderRadius: BORDER_RADIUS.full, borderWidth: 1,
    borderColor: COLORS.error, paddingHorizontal: SPACING.xs, paddingVertical: 2,
  },
  blockedText: { color: COLORS.error, fontSize: FONT_SIZE.xs },
  arrow: { color: COLORS.gold, fontSize: FONT_SIZE.title },
  empty: { alignItems: 'center', padding: SPACING.xl },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.body },
});
