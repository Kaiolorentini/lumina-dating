// ============================================
// LUMINA — SINTONIAS NO COMPUTADOR
// src/screens/Chat/SintoniasDesktop.tsx
//
// Só no computador (SintoniasScreen escolhe pela useBreakpoint; no
// app nunca aparece). Layout aprovado no protótipo:
//   • esquerda: suas sintonias com foto, última mensagem e horário,
//     busca por nome e as abas "Conversas" / "Novas sintonias";
//   • direita: a conversa aberta ao lado (ChatConversation, o MESMO
//     chat do celular), com "% de Sintonia", a faixa dos interesses em
//     comum e respostas rápidas montadas a partir deles.
//
// Leituras: as mesmas da aba Conversas da Home — por sintonia, o
// perfil público e o documento do chat (em paralelo, não em série) —
// mais o seu próprio perfil (1), para a sintonia e os interesses.
// Bloqueados e contas bloqueadas ficam de fora, como no celular.
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TextInput, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { PUBLIC_PROFILES } from '../../services/publicProfileService';
import { COLLECTIONS } from '../../core/constants';
import { colors, fonts, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getConexoesAceitas } from '../../modules/profile/services/requestsService';
import { getBloqueados } from '../../modules/profile/services/blockService';
import { getProfile } from '../../modules/profile/services/profileService';
import { generateChatId } from '../../modules/chat/services/messageService';
import { calcularSintonia } from '../../modules/ai/services/sintoniaCalculator';
import { RootStackParamList } from '../../navigation/types';
import { UserProfile } from '../../shared/types';
import ChatConversation from '../../modules/chat/components/ChatConversation';
import { buildChatSuggestions, commonInterestsBanner } from '../../modules/chat/utils/chatSuggestions';
import HoverPressable from '../../components/web/HoverPressable';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ListTab = 'conversas' | 'novas';

interface SintoniaItem {
  userId:      string;
  userName:    string;
  userPhoto:   string;
  profile:     UserProfile;
  lastMessage: string | null;
  lastTime:    Date | null;
}

const LIST_WIDTH = 340;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const maybe = value as { toDate?: () => Date };
  return typeof maybe.toDate === 'function' ? maybe.toDate() : null;
}

function formatWhen(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = date.getTime();
  if (t >= startToday) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  if (t >= startToday - 86_400_000) return 'ontem';
  if (t >= startToday - 6 * 86_400_000) {
    return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][date.getDay()];
  }
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function SintoniasDesktop() {
  const { user }   = useAuth();
  const navigation = useNavigation<NavProp>();

  const [items,    setItems]    = useState<SintoniaItem[]>([]);
  const [viewer,   setViewer]   = useState<UserProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab,      setTab]      = useState<ListTab>('conversas');
  const [search,   setSearch]   = useState('');

  const load = useCallback(async () => {
    if (!user?.uid) return;
    const uid = user.uid;
    setLoading(true);
    setError(false);
    try {
      const [me, conexoes, blocked] = await Promise.all([
        getProfile(uid),
        getConexoesAceitas(uid),
        getBloqueados(uid),
      ]);
      const blockedIds = new Set(blocked.map(b => b.blockedId));

      const loaded = await Promise.all(conexoes.map(async conexao => {
        const otherId = conexao.fromUserId === uid ? conexao.toUserId : conexao.fromUserId;
        if (blockedIds.has(otherId)) return null;
        const [profileSnap, chatSnap] = await Promise.all([
          getDoc(doc(db, PUBLIC_PROFILES, otherId)),
          getDoc(doc(db, COLLECTIONS.CHATS, generateChatId(uid, otherId))),
        ]);
        const other = profileSnap.data();
        if (!other || other.isBlocked) return null;
        const chat = chatSnap.exists() ? chatSnap.data() : null;
        return {
          userId:      otherId,
          userName:    (other.name as string) || 'Usuário',
          userPhoto:   (other.photoURL as string) || '',
          profile:     { ...(other as UserProfile), uid: otherId },
          lastMessage: (chat?.lastMessage as string | undefined) || null,
          lastTime:    toDate(chat?.lastMessageTime),
        } as SintoniaItem;
      }));

      // Sem duplicados (duas conexões com a mesma pessoa).
      const unique = new Map<string, SintoniaItem>();
      loaded.forEach(item => { if (item && !unique.has(item.userId)) unique.set(item.userId, item); });
      const list = [...unique.values()].sort((a, b) =>
        (b.lastTime?.getTime() ?? 0) - (a.lastTime?.getTime() ?? 0));

      setViewer(me);
      setItems(list);
      setSelected(prev => (prev && unique.has(prev)) ? prev : (list[0]?.userId ?? null));
    } catch (e) {
      console.error('[SintoniasDesktop] Falha ao carregar:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const conversations = items.filter(i => i.lastMessage);
  const fresh         = items.filter(i => !i.lastMessage);
  const shown = (tab === 'conversas' ? conversations : fresh)
    .filter(i => !search.trim() || i.userName.toLowerCase().includes(search.trim().toLowerCase()));
  const current = items.find(i => i.userId === selected) ?? null;

  const chatExtras = useMemo(() => {
    if (!current || !viewer) return { subtitle: undefined, banner: undefined, suggestions: undefined };
    const result = calcularSintonia(viewer, current.profile);
    const common = result.breakdown?.commonInterests ?? [];
    return {
      subtitle:    `${result.score}% de Sintonia`,
      banner:      commonInterestsBanner(common),
      suggestions: buildChatSuggestions(common),
    };
  }, [current, viewer]);

  function handleBlocked(userId: string) {
    setItems(prev => prev.filter(i => i.userId !== userId));
    setSelected(null);
  }

  return (
    <View style={styles.container}>
      {/* ── Lista ── */}
      <View style={styles.list}>
        <View style={styles.listHead}>
          <Text style={styles.h1} accessibilityRole="header">Sintonias</Text>
          <HoverPressable
            onPress={load}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista"
            style={styles.iconBtn}
            hoverStyle={styles.iconBtnHover}
          >
            <Text style={styles.iconBtnText}>↻</Text>
          </HoverPressable>
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar pelo nome"
            placeholderTextColor={colors.gray}
            accessibilityLabel="Buscar sintonia pelo nome"
            nativeID="sintonias-search"
          />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {([
            { key: 'conversas' as ListTab, label: 'Conversas', count: conversations.length },
            { key: 'novas' as ListTab,     label: 'Novas sintonias', count: fresh.length },
          ]).map(t => {
            const active = tab === t.key;
            return (
              <HoverPressable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
                hoverStyle={!active ? styles.tabHover : undefined}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
                </Text>
              </HoverPressable>
            );
          })}
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.listState}><ActivityIndicator color={colors.gold} /></View>
        ) : error ? (
          <View style={styles.listState}>
            <Text style={styles.stateTitle}>Não foi possível carregar</Text>
            <HoverPressable onPress={load} accessibilityRole="button" style={styles.goldBtn} hoverStyle={styles.goldBtnHover}>
              <Text style={styles.goldBtnText}>Tentar de novo</Text>
            </HoverPressable>
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.listState}>
            <Text style={styles.stateText}>
              {search.trim()
                ? 'Ninguém com esse nome.'
                : tab === 'conversas'
                  ? 'Nenhuma conversa ainda. Veja suas novas sintonias e diga oi!'
                  : 'Nenhuma sintonia nova. Curta perfis no Sintonize para criar mais.'}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
            {shown.map(item => {
              const active = item.userId === selected;
              return (
                <HoverPressable
                  key={item.userId}
                  onPress={() => setSelected(item.userId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Conversa com ${item.userName}`}
                  style={[styles.row, active && styles.rowActive]}
                  hoverStyle={!active ? styles.rowHover : undefined}
                >
                  {item.userPhoto ? (
                    <Image source={{ uri: item.userPhoto }} style={[styles.avatar, !item.lastMessage && styles.avatarNew]} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarEmpty]}>
                      <Text style={styles.avatarLetter}>{item.userName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.userName}</Text>
                      <Text style={styles.rowTime}>{formatWhen(item.lastTime)}</Text>
                    </View>
                    <Text style={[styles.rowMsg, !item.lastMessage && styles.rowMsgNew]} numberOfLines={1}>
                      {item.lastMessage ?? 'Nova sintonia — diga oi!'}
                    </Text>
                  </View>
                </HoverPressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Conversa ── */}
      <View style={styles.pane}>
        {current ? (
          <ChatConversation
            key={current.userId}
            variant="pane"
            targetUserId={current.userId}
            targetUserName={current.userName}
            targetUserPhoto={current.userPhoto}
            onBlocked={() => handleBlocked(current.userId)}
            onOpenProfile={() => navigation.navigate('RealProfile', { userId: current.userId })}
            subtitle={chatExtras.subtitle}
            banner={chatExtras.banner}
            suggestions={chatExtras.suggestions}
          />
        ) : (
          <View style={styles.paneEmpty}>
            <Text style={styles.paneEmptyIcon}>💬</Text>
            <Text style={styles.stateTitle}>
              {items.length === 0 && !loading ? 'Nenhuma sintonia ainda' : 'Escolha uma conversa'}
            </Text>
            <Text style={styles.stateText}>
              {items.length === 0 && !loading
                ? 'Quando vocês se curtirem, a conversa aparece aqui.'
                : 'Selecione alguém na lista ao lado.'}
            </Text>
            {items.length === 0 && !loading && (
              <HoverPressable
                onPress={() => (navigation as any).navigate('Sintonize')}
                accessibilityRole="button"
                style={styles.goldBtn}
                hoverStyle={styles.goldBtnHover}
              >
                <Text style={styles.goldBtnText}>✦ Ir para o Sintonize</Text>
              </HoverPressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },

  list:     { width: LIST_WIDTH, borderRightWidth: 1, borderRightColor: '#262626', paddingTop: 24, gap: 12 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  h1:       { color: colors.white, fontSize: 24, fontWeight: 'bold' },
  iconBtn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark },
  iconBtnHover: { borderColor: colors.gold },
  iconBtnText:  { color: colors.gold, fontSize: 18, fontWeight: 'bold' },
  search:   { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E' },
  searchIcon:  { color: colors.gray, fontSize: 16 },
  searchInput: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, padding: 0 },
  tabs:     { flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  tab:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#333333' },
  tabActive: { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  tabHover: { borderColor: colors.gold + '66' },
  tabText:  { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  tabTextActive: { color: colors.gold },
  listScroll: { flex: 1 },
  listState:  { padding: 24, alignItems: 'center', gap: 12 },

  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14 },
  rowActive: { backgroundColor: colors.gold + '18' },
  rowHover:  { backgroundColor: colors.surface },
  avatar:    { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.grayDark },
  avatarNew: { borderColor: colors.gold },
  avatarEmpty: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderColor: colors.gold },
  avatarLetter: { color: colors.gold, fontWeight: 'bold', fontSize: fonts.sizes.lg },
  rowInfo:   { flex: 1, minWidth: 0, gap: 3 },
  rowTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName:   { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  rowTime:   { color: colors.gray, fontSize: 12 },
  rowMsg:    { color: colors.grayLight, fontSize: 13 },
  rowMsgNew: { color: colors.gold },

  pane:      { flex: 1, minWidth: 0 },
  paneEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  paneEmptyIcon: { fontSize: 56 },
  stateTitle: { color: colors.white, fontSize: fonts.sizes.lg, fontWeight: 'bold', textAlign: 'center' },
  stateText:  { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 21 },
  goldBtn:    { marginTop: 6, paddingHorizontal: 20, paddingVertical: 11, borderRadius: borderRadius.full, backgroundColor: colors.gold },
  goldBtnHover: { backgroundColor: colors.goldLight },
  goldBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
});
