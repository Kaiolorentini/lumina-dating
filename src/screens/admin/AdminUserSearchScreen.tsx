import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buscar Usuário</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="UID, nome ou email..."
          placeholderTextColor={colors.gray}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
          {loading
            ? <ActivityIndicator color={colors.background} size="small" />
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
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  backBtn: { color: colors.gold, fontSize: 28 },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  searchRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, color: colors.white, padding: spacing.md, fontSize: fonts.sizes.md,
  },
  searchBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', justifyContent: 'center', width: 50,
  },
  searchBtnText: { fontSize: 18 },
  list: { padding: spacing.md },
  userCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  userEmail: { color: colors.gray, fontSize: fonts.sizes.sm },
  userUid: { color: colors.grayDark, fontSize: fonts.sizes.xs },
  userMeta: { alignItems: 'center', gap: spacing.xs },
  blockedBadge: {
    backgroundColor: colors.error + '22', borderRadius: borderRadius.full, borderWidth: 1,
    borderColor: colors.error, paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  blockedText: { color: colors.error, fontSize: fonts.sizes.xs },
  arrow: { color: colors.gold, fontSize: fonts.sizes.xl },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.md },
});