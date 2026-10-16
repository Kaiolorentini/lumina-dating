// ============================================
// LUMINA — ADMIN: BUSCAR USUÁRIO
// src/screens/admin/AdminUserSearchScreen.tsx
//
// 14/10/2026 (web T5, correção + melhorias).
//   • Esta tela já tem a busca própria (no servidor), então NÃO usa a
//     AdminListToolbar (era o que dava "search" declarado duas vezes).
//   • Cabeçalho com ‹ voltar e 🏠 início.
//   • Explicação de como a busca funciona (o servidor procura o INÍCIO
//     do nome, e maiúsculas fazem diferença) — e, por isso, a tela
//     tenta também a versão com a primeira letra maiúscula
//     ("ana" → "Ana"): no máximo 2 leituras de 10 documentos.
//   • E-mail: a busca por e-mail não existe no servidor; em vez de
//     mostrar "nada encontrado" sem explicação, a tela avisa.
//   • Estados: dica inicial, carregando, nenhum resultado (com o termo),
//     erro com "Tentar de novo".
//   • Respostas antigas são ignoradas (digitou de novo antes de chegar).
//   • Computador: cartões lado a lado (useDesktopGrid), campo com foco
//     automático e contagem de resultados. No app: igual ao de antes.
// ============================================

import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useDesktopGrid } from '../../hooks/useDesktopGrid';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { getUserById, searchUsers } from '../../services/marketplace/adminService';
import { UserProfile } from '../../shared/types';
import { useSuperAdminGuard } from '../../hooks/useAdminGuard';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import ScreenContainer from '../../components/ScreenContainer';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

/** UIDs do Firebase têm 28 caracteres; nomes raramente passam de 20 sem espaço. */
const UID_MIN_LENGTH = 20;

type Status = 'idle' | 'loading' | 'done' | 'error' | 'email';

function looksLikeUid(term: string): boolean {
  return term.length > UID_MIN_LENGTH && !/\s/.test(term);
}

function capitalizeFirst(term: string): string {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

function isBlockedUser(user: UserProfile): boolean {
  return Boolean((user as { isBlocked?: unknown }).isBlocked);
}

export default function AdminUserSearchScreen() {
  // Computador: cartões lado a lado (useDesktopGrid). App: igual.
  const grid = useDesktopGrid();
  const { isDesktop } = useBreakpoint();
  const navigation = useNavigation<NavProp>();
  const { blocked, loading: guardLoading } = useSuperAdminGuard();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [lastTerm, setLastTerm] = useState('');
  const requestId = useRef(0);

  const handleSearch = useCallback(async () => {
    const term = search.trim();
    if (!term) return;

    const myRequest = ++requestId.current;
    setLastTerm(term);

    if (term.includes('@')) {
      setResults([]);
      setStatus('email');
      return;
    }

    setStatus('loading');
    try {
      let found: UserProfile[];
      if (looksLikeUid(term)) {
        const user = await getUserById(term);
        found = user ? [user] : [];
      } else {
        const variants = Array.from(new Set([term, capitalizeFirst(term)]));
        const lists = await Promise.all(variants.map(v => searchUsers(v)));
        const byUid = new Map<string, UserProfile>();
        lists.flat().forEach(u => { if (!byUid.has(u.uid)) byUid.set(u.uid, u); });
        found = Array.from(byUid.values());
      }
      if (myRequest !== requestId.current) return; // chegou uma busca mais nova
      setResults(found);
      setStatus('done');
    } catch (err) {
      if (myRequest !== requestId.current) return;
      console.warn('[AdminUserSearch] falha na busca', { term, err });
      setResults([]);
      setStatus('error');
    }
  }, [search]);

  const clearSearch = useCallback(() => {
    requestId.current++;
    setSearch('');
    setResults([]);
    setStatus('idle');
    setLastTerm('');
  }, []);

  if (guardLoading || blocked) return null;

  const loading = status === 'loading';

  function renderEmpty() {
    if (loading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.emptyText}>Buscando “{lastTerm}”…</Text>
        </View>
      );
    }
    if (status === 'error') {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Não foi possível buscar</Text>
          <Text style={styles.emptyText}>Confira a conexão e tente de novo.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleSearch} accessibilityRole="button">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (status === 'email') {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✉️</Text>
          <Text style={styles.emptyTitle}>Busca por e-mail não disponível</Text>
          <Text style={styles.emptyText}>
            Procure pelo nome da pessoa ou cole o UID dela (no Firebase Console → Authentication).
          </Text>
        </View>
      );
    }
    if (status === 'done') {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔎</Text>
          <Text style={styles.emptyTitle}>Ninguém encontrado para “{lastTerm}”</Text>
          <Text style={styles.emptyText}>
            {looksLikeUid(lastTerm)
              ? 'Nenhuma conta com esse UID. Confira se copiou o código inteiro.'
              : 'A busca procura o começo do nome, exatamente como foi cadastrado (acentos contam). Tente só o primeiro nome.'}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>Encontre uma conta</Text>
        <Text style={styles.emptyText}>
          Digite o começo do nome (ex.: “Ana”) ou cole o UID completo e toque em 🔍.
        </Text>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.headerBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Buscar usuário</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          accessibilityRole="button"
          accessibilityLabel="Ir para o início"
        >
          <Text style={styles.headerHome}>🏠</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchArea, isDesktop && styles.searchAreaDesktop]}>
        <View style={styles.searchRow}>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              placeholder="Nome (começo) ou UID…"
              placeholderTextColor={colors.gray}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={Platform.OS === 'web' && isDesktop}
              accessibilityLabel="Nome ou UID do usuário"
              nativeID="admin-user-search"
            />
            {search.length > 0 && !loading && (
              <TouchableOpacity onPress={clearSearch} accessibilityRole="button" accessibilityLabel="Limpar busca">
                <Text style={styles.clear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, (!search.trim() || loading) && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={loading || !search.trim()}
            accessibilityRole="button"
            accessibilityLabel="Buscar"
          >
            {loading
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Text style={styles.searchBtnText}>🔍</Text>
            }
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          Nome: procura o começo, até 10 contas. UID: busca exata (código de 28 caracteres).
        </Text>
        {status === 'done' && results.length > 0 && (
          <Text style={styles.count}>
            {results.length === 1 ? '1 conta encontrada' : `${results.length} contas encontradas`}
          </Text>
        )}
      </View>

      <FlatList
        key={grid.listKey}
        {...grid.listProps}
        data={loading ? [] : results}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty()}
        renderItem={grid.wrap(({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => navigation.navigate('AdminUserDetail', { userId: item.uid })}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${item.name ?? 'usuário'}`}
          >
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{item.name || 'Sem nome'}</Text>
              {!!item.email && <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>}
              <Text style={styles.userUid} numberOfLines={1}>UID: {item.uid}</Text>
            </View>
            <View style={styles.userMeta}>
              {isBlockedUser(item) && (
                <View style={styles.blockedBadge}>
                  <Text style={styles.blockedText}>Bloqueado</Text>
                </View>
              )}
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.gold + '44',
  },
  headerBtn: { color: colors.gold, fontSize: 28, width: 40 },
  headerHome: { fontSize: 22, width: 40, textAlign: 'right' },
  headerTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  searchArea: { padding: spacing.md, gap: spacing.xs },
  searchAreaDesktop: { maxWidth: 720, width: '100%' },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  inputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, paddingRight: spacing.sm,
  },
  input: { flex: 1, color: colors.white, padding: spacing.md, fontSize: fonts.sizes.md },
  clear: { color: colors.gray, fontSize: 14, paddingHorizontal: spacing.xs },
  searchBtn: {
    backgroundColor: colors.gold, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', justifyContent: 'center', width: 50,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { fontSize: 18 },
  hint: { color: colors.gray, fontSize: fonts.sizes.xs },
  count: { color: colors.grayLight, fontSize: fonts.sizes.sm, marginTop: spacing.xs },
  list: { padding: spacing.md, paddingTop: 0, flexGrow: 1 },
  userCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.grayDark, padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  userEmail: { color: colors.gray, fontSize: fonts.sizes.sm },
  userUid: { color: colors.grayDark, fontSize: fonts.sizes.xs },
  userMeta: { alignItems: 'center', gap: spacing.xs, marginLeft: spacing.sm },
  blockedBadge: {
    backgroundColor: colors.error + '22', borderRadius: borderRadius.full, borderWidth: 1,
    borderColor: colors.error, paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  blockedText: { color: colors.error, fontSize: fonts.sizes.xs },
  arrow: { color: colors.gold, fontSize: fonts.sizes.xl },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center' },
  emptyText: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center', maxWidth: 420 },
  retryBtn: {
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  retryText: { color: colors.gold, fontWeight: 'bold' },
});
