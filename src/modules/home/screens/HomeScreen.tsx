// ============================================
// LUMINA — HOME SCREEN v5.5
// src/modules/home/screens/HomeScreen.tsx
//
// v5.5: Banner Cofre de Sintonia adicionado
// stickyHeaderIndices={[5]} corrigido
// Ordem:
//   0 = faiscaBanner
//   1 = destinyCardBanner
//   2 = missionsBanner
//   3 = vaultBanner
//   4 = visitsBanner
//   5 = tabsWrapper ← sticky
//
// 13/10/2026 (web, responsivo R1): no tablet e no computador o
// conteúdo fica numa coluna central de até 1200 px e a grade de
// perfis ganha colunas (3, 4 ou 5) conforme a largura. No celular
// e no app, tudo como antes (duas colunas). A largura máxima vai no
// contentContainerStyle para não quebrar o stickyHeaderIndices.
//
// v5.6 (13/10/2026, web D3 — tela aprovada no protótipo): no
// COMPUTADOR a Home vira um painel:
//   • saudação pelo horário + quantas missões faltam;
//   • "Ritual do dia": Faísca, Carta, Missões (com progresso) e
//     Cofre em 4 cartões lado a lado (HomeRitualRow);
//   • grade de perfis com os interesses de cada um embaixo do card
//     (os em comum com você em dourado) — mesmos documentos já
//     lidos, sem leitura extra;
//   • coluna "Seu dia" (HomeSideRail): quem viu você, em alta agora
//     e a Árvore. Em telas de computador mais estreitas ela vira uma
//     fileira acima da grade.
// O conteúdo das abas é o MESMO do celular (renderTabContent): só a
// moldura muda. Celular, tablet e app: idênticos à v5.5.
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, ActivityIndicator, LayoutChangeEvent,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { RootStackParamList } from '../../../navigation/types';
import { ProfileCardData }    from '../../../shared/types';
import ProfileCard            from '../../../components/ProfileCard';
import VisitedProfileCard     from '../../../components/VisitedProfileCard';
import VisitsBanner           from '../../../components/VisitsBanner';
import DestinyCardBanner      from '../../../components/DestinyCardBanner';
import MissionsBanner         from '../../../components/MissionsBanner';
import ActiveBoostChip        from '../../premium/components/ActiveBoostChip';
import { useHomeData, HomeTab } from '../hooks/useHomeData';
import { useMissionsSummary } from '../../engagement/hooks/useMissionsSummary';
import { useAuth }            from '../../../context/AuthContext';
import { useCoins }           from '../../../context/CoinsContext';
import { getConexoesAceitas } from '../../profile/services/requestsService';
import { generateChatId }     from '../../chat/services/messageService';
import { getDoc, doc }        from 'firebase/firestore';
import { db }                 from '../../../services/firebase';
import { PUBLIC_PROFILES }    from '../../../services/publicProfileService';
import { COLLECTIONS }        from '../../../core/constants';
import { useBreakpoint }      from '../../../hooks/useBreakpoint';
import PageContainer, { pageContentStyle } from '../../../components/layout/PageContainer';
import { CONTENT_MAX_WIDTH, gridColumns } from '../../../utils/breakpoints';
import HomeRitualRow          from '../components/HomeRitualRow';
import HomeSideRail           from '../components/HomeSideRail';
import { interestLabel }      from '../../../config/sintonia/interestsCatalog';
import HoverPressable         from '../../../components/web/HoverPressable';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const TABS: { key: HomeTab; label: string; icon: string }[] = [
  { key: 'perfis',    label: 'Perfis',    icon: '👤' },
  { key: 'visitados', label: 'Em Alta',   icon: '🔥' },
  { key: 'conversas', label: 'Conversas', icon: '💬' },
];

/** Abaixo disto a coluna "Seu dia" vai para cima da grade (computador). */
const RAIL_BESIDE_MIN_WIDTH = 1180;
/** Largura da coluna "Seu dia" + o espaço entre ela e a grade. */
const RAIL_SPACE = 320 + 28;
/** Interesses mostrados embaixo de cada card no computador. */
const MAX_CARD_INTERESTS = 3;

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12)  return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Interesses do card: os em comum primeiro. */
function CardInterests({ ids, mine }: { ids: string[]; mine: Set<string> }) {
  const ordered = [...ids].sort((a, b) => Number(mine.has(b)) - Number(mine.has(a)));
  const shown = ordered.slice(0, MAX_CARD_INTERESTS);
  return (
    <View style={styles.cardChips}>
      {shown.map(id => {
        const common = mine.has(id);
        return (
          <View key={id} style={[styles.cardChip, common && styles.cardChipCommon]}>
            <Text style={[styles.cardChipText, common && styles.cardChipTextCommon]} numberOfLines={1}>
              {common ? '✦ ' : ''}{interestLabel(id)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

interface ChatPreview {
  userId:      string;
  userName:    string;
  userPhoto:   string;
  lastMessage: string;
}

function ConversasTab({ navigation }: { navigation: any }) {
  const { user }              = useAuth();
  const [chats, setChats]     = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadChats(); }, [user?.uid]);

  // O for/await anterior fazia 2 leituras POR conexão, uma
  // esperando a outra: 20 conexões = 40 leituras em série.
  // Promise.all mantém o mesmo custo em reads e divide o tempo
  // pelo número de conexões.
  async function loadChats() {
    if (!user) return;
    try {
      const conexoes = await getConexoesAceitas(user.uid);

      const previews = await Promise.all(
        conexoes.map(async (conexao) => {
          const otherUserId = conexao.fromUserId === user.uid
            ? conexao.toUserId : conexao.fromUserId;
          const chatId = generateChatId(user.uid, otherUserId);

          const [chatSnap, userSnap] = await Promise.all([
            getDoc(doc(db, COLLECTIONS.CHATS, chatId)),
            // Perfil PÚBLICO (users de outra pessoa fechou nas regras).
            getDoc(doc(db, PUBLIC_PROFILES, otherUserId)),
          ]);

          const otherUser = userSnap.data();
          if (!otherUser) return null;

          return {
            userId:      otherUserId,
            userName:    otherUser.name || 'Usuario',
            userPhoto:   otherUser.photoURL || '',
            lastMessage: chatSnap.exists()
              ? chatSnap.data()?.lastMessage || 'Iniciar conversa'
              : 'Iniciar conversa',
          } as ChatPreview;
        }),
      );

      setChats(previews.filter((p): p is ChatPreview => p !== null));
    } catch (e) {
      console.error('[ConversasTab] error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <View style={styles.emptyContainer}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );

  if (chats.length === 0) return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
      <Text style={styles.emptySubtitle}>Conecte-se com outros usuários para começar!</Text>
    </View>
  );

  return (
    <View>
      {chats.map(chat => (
        <TouchableOpacity
          key={chat.userId}
          style={styles.chatItem}
          onPress={() => navigation.navigate('UserChat', {
            userId: chat.userId, userName: chat.userName, userPhoto: chat.userPhoto,
          })}
          activeOpacity={0.8}
        >
          {chat.userPhoto
            ? <Image source={{ uri: chat.userPhoto }} style={styles.chatAvatar} />
            : <View style={styles.chatAvatarPlaceholder}>
                <Text style={styles.chatAvatarLetter}>{chat.userName.charAt(0).toUpperCase()}</Text>
              </View>
          }
          <View style={styles.chatInfo}>
            <Text style={styles.chatName}>{chat.userName}</Text>
            <Text style={styles.chatLastMessage} numberOfLines={1}>{chat.lastMessage}</Text>
          </View>
          <Text style={styles.chatArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HomeTab>('perfis');

  const {
    realProfiles, interestsById, userProfile, mostVisited, promotedVisited, visitCounts,
    loadingVisited, visitasHoje, totalVisitas, unreadCount,
    coins, loadMostVisited,
    loadingProfiles, loadingMore, hasMoreProfiles,
    errorProfiles, loadMoreProfiles, refreshProfiles,
  } = useHomeData();

  const { wallet } = useCoins();
  const missionsSummary = useMissionsSummary(user?.uid);
  const coinsGratuitos = wallet?.coinsGratuitos ?? 0;
  const coinsPremium   = wallet?.coinsPremium   ?? 0;

  // Grade responsiva (só web, tablet/computador). No celular o card
  // usa a largura padrão dele — idêntico ao app.
  const { isPhone, isDesktop } = useBreakpoint();
  const [containerWidth, setContainerWidth] = useState(0);
  function handleContainerLayout(event: LayoutChangeEvent) {
    const w = event.nativeEvent.layout.width;
    if (Math.abs(w - containerWidth) > 1) setContainerWidth(w);
  }
  const feedWidth = Math.min(containerWidth, CONTENT_MAX_WIDTH.feed);
  const columns   = gridColumns(feedWidth);
  const gridCardWidth = !isPhone && containerWidth > 0
    ? Math.floor((feedWidth - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns)
    : undefined;

  useEffect(() => {
    if (activeTab === 'visitados' && mostVisited.length === 0) {
      loadMostVisited();
    }
  }, [activeTab]);

  // ── Computador ──
  // A coluna "Em alta agora" usa o mesmo ranking da aba Em Alta:
  // busca uma vez quando o seu perfil chega (só no computador).
  useEffect(() => {
    if (isDesktop && userProfile && mostVisited.length === 0) {
      loadMostVisited();
    }
  }, [isDesktop, userProfile]);

  // Largura da coluna principal (grade) no computador.
  const [mainWidth, setMainWidth] = useState(0);
  function handleMainLayout(event: LayoutChangeEvent) {
    const w = event.nativeEvent.layout.width;
    if (Math.abs(w - mainWidth) > 1) setMainWidth(w);
  }
  const railBeside = containerWidth >= RAIL_BESIDE_MIN_WIDTH;
  const desktopColumns = gridColumns(Math.max(0, mainWidth - spacing.lg * 2));
  const desktopCardWidth = mainWidth > 0
    ? Math.floor((mainWidth - spacing.lg * 2 - spacing.sm * (desktopColumns - 1)) / desktopColumns)
    : undefined;
  const myInterests = new Set<string>(userProfile?.interests ?? []);

  function handleCardPress(profile: ProfileCardData) {
    navigation.navigate('RealProfile', { userId: profile.id });
  }

  // O scroll infinito foi REMOVIDO em favor do botão "ver mais".
  //
  // Com rolagem infinita, quem percorria 200 perfis ficava com
  // 200 cards montados na memória — e cada card tem moldura,
  // badge e aura. O lote de 10 SUBSTITUI o anterior: a memória
  // fica constante, e quem decide quando avançar é o usuário.
  const scrollRef = useRef<ScrollView>(null);

  async function handleNextBatch() {
    await loadMoreProfiles();
    // Os cards mudaram: continuar no meio da lista antiga
    // desorienta. Volta ao topo com animação.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  /**
   * Conteúdo da aba ativa — o mesmo no celular e no computador.
   * `cardWidth`: largura dos cards na grade (undefined = padrão do app).
   * `showInterests`: interesses embaixo do card (só computador).
   */
  function renderTabContent(cardWidth: number | undefined, showInterests: boolean) {
    return (
      <>
          {/* Conversas */}
          {activeTab === 'conversas' && <ConversasTab navigation={navigation} />}

          {/* Em Alta */}
          {activeTab === 'visitados' && (
            loadingVisited ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Carregando perfis em alta...</Text>
              </View>
            ) : mostVisited.length === 0 && promotedVisited.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔥</Text>
                <Text style={styles.emptyTitle}>Nenhum perfil ainda</Text>
                <Text style={styles.emptySubtitle}>Visite perfis para que apareçam aqui!</Text>
              </View>
            ) : (
              <View>
                {/* Posição PAGA, separada do ranking: a medalha fica só
                    com quem teve mais visitas de fato. */}
                {promotedVisited.length > 0 && (
                  <>
                    <Text style={styles.promotedTitle}>⚡ Impulsionados agora</Text>
                    <View style={styles.grid}>
                      {promotedVisited.map(profile => (
                        <ProfileCard
                          key={`turbo_${profile.id}`}
                          data={profile}
                          onPress={() => handleCardPress(profile)}
                          viewerUid={user?.uid}
                          width={cardWidth}
                        />
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.mostVisitedBanner}>
                  <Text style={styles.mostVisitedBannerText}>Perfis mais visitados agora</Text>
                </View>
                <View style={styles.grid}>
                  {mostVisited.map((profile, index) => (
                    <VisitedProfileCard
                      key={profile.id}
                      data={profile}
                      visitCount={visitCounts[profile.id] || 0}
                      rank={index + 1}
                      onPress={() => handleCardPress(profile)}
                      width={cardWidth}
                    />
                  ))}
                </View>
              </View>
            )
          )}

          {/* Perfis */}
          {activeTab === 'perfis' && (
            loadingProfiles ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.gold} size="large" />
                <Text style={styles.loadingText}>Carregando perfis...</Text>
              </View>
            ) : errorProfiles ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>⚠️</Text>
                <Text style={styles.emptyTitle}>Algo deu errado</Text>
                <Text style={styles.emptySubtitle}>{errorProfiles}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => refreshProfiles()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : realProfiles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyTitle}>Nenhum perfil encontrado</Text>
                <Text style={styles.emptySubtitle}>Seja o primeiro a se cadastrar na sua região!</Text>
              </View>
            ) : (
              <>
                <View style={styles.grid}>
                  {realProfiles.map(profile => showInterests ? (
                    <View key={profile.id} style={{ width: cardWidth }}>
                      <ProfileCard
                        data={profile}
                        onPress={() => handleCardPress(profile)}
                        viewerUid={user?.uid}
                        width={cardWidth}
                      />
                      <CardInterests ids={interestsById[profile.id] ?? []} mine={myInterests} />
                    </View>
                  ) : (
                    <ProfileCard
                      key={profile.id}
                      data={profile}
                      onPress={() => handleCardPress(profile)}
                      viewerUid={user?.uid}
                      width={cardWidth}
                    />
                  ))}
                </View>

                {hasMoreProfiles ? (
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={handleNextBatch}
                    disabled={loadingMore}
                    activeOpacity={0.85}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <Text style={styles.moreButtonText}>Ver mais perfis ›</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => { refreshProfiles(); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.moreButtonText}>Começar de novo ↻</Text>
                  </TouchableOpacity>
                )}
              </>
            )
          )}
      </>
    );
  }

  if (isDesktop) {
    const firstName = (userProfile?.name ?? '').trim().split(/\s+/)[0] || '';
    const missing = Math.max(0, missionsSummary.total - missionsSummary.completed);
    const subtitle = missionsSummary.total === 0
      ? 'Sua Sintonia de hoje está pronta.'
      : missing === 0
        ? 'Missões de hoje concluídas. Amanhã tem mais.'
        : `Sua Sintonia de hoje está pronta. ${missing === 1 ? 'Falta 1 missão' : `Faltam ${missing} missões`} para fechar o dia.`;
    const trending = mostVisited.slice(0, 5);
    const rail = (layout: 'column' | 'row') => (
      <HomeSideRail
        uid={user?.uid}
        layout={layout}
        visitasHoje={visitasHoje}
        totalVisitas={totalVisitas}
        trending={trending}
        visitCounts={visitCounts}
        loadingTrending={loadingVisited}
        onRevealVisitors={() => navigation.navigate('Visitors' as any)}
        onOpenProfile={uid => navigation.navigate('RealProfile', { userId: uid })}
        onSeeTrending={() => setActiveTab('visitados')}
        onOpenTree={() => navigation.navigate('XP' as any)}
      />
    );

    return (
      <View style={styles.container} onLayout={handleContainerLayout}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.dScroll}>
          <View style={styles.dPage}>

            <View style={styles.dHeader}>
              <View style={styles.dHello}>
                <Text style={styles.dTitle} accessibilityRole="header">
                  {greetingFor(new Date())}{firstName ? `, ${firstName}` : ''}
                </Text>
                <Text style={styles.dSubtitle}>{subtitle}</Text>
              </View>
              <View style={styles.headerRight}>
                <HoverPressable
                  style={styles.coinsButton}
                  hoverStyle={styles.dHoverGold}
                  onPress={() => (navigation as any).jumpTo('Store')}
                  accessibilityRole="button"
                  accessibilityLabel={`Cristais: ${coinsGratuitos} grátis e ${coinsPremium} premium`}
                >
                  <Text style={styles.coinsIcon}>✨</Text>
                  <Text style={styles.coinsText}>{coinsGratuitos}</Text>
                  {coinsPremium > 0 && <Text style={styles.coinsPremiumText}>+{coinsPremium}💎</Text>}
                </HoverPressable>
                <HoverPressable
                  style={styles.bellButton}
                  hoverStyle={styles.dHoverGold}
                  onPress={() => navigation.navigate('Notifications')}
                  accessibilityRole="button"
                  accessibilityLabel={unreadCount > 0 ? `Notificações, ${unreadCount} novas` : 'Notificações'}
                >
                  <Text style={styles.bellIcon}>🔔</Text>
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </HoverPressable>
              </View>
            </View>

            <ActiveBoostChip onPress={() => navigation.navigate('Boosts')} />

            <HomeRitualRow
              missionsCompleted={missionsSummary.completed}
              missionsTotal={missionsSummary.total}
              onFaisca={() => navigation.navigate('Faisca' as any)}
              onDestiny={() => navigation.navigate('DestinyCard' as any)}
              onMissions={() => navigation.navigate('Missions' as any)}
              onVault={() => navigation.navigate('Vault' as any)}
            />

            {!railBeside && rail('row')}

            <View style={styles.dBody}>
              <View style={styles.dMain}>
                <View style={styles.dTabsRow}>
                  <View style={styles.dTabs} accessibilityRole="tablist">
                    {TABS.map(tab => {
                      const active = activeTab === tab.key;
                      return (
                        <HoverPressable
                          key={tab.key}
                          style={[styles.tab, styles.dTab, active && styles.tabActive]}
                          hoverStyle={!active ? styles.dTabHover : undefined}
                          onPress={() => setActiveTab(tab.key)}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={styles.tabIcon}>{tab.icon}</Text>
                          <Text style={[styles.tabLabel, styles.dTabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                        </HoverPressable>
                      );
                    })}
                  </View>
                  {activeTab === 'perfis' && realProfiles.length > 0 && (
                    <Text style={styles.dCaption}>Compatíveis primeiro · ✦ = interesse em comum</Text>
                  )}
                </View>

                {/* Margem negativa: o conteúdo das abas usa o recuo do
                    celular (spacing.lg); aqui ele encosta na borda da coluna. */}
                <View style={styles.dTabContent} onLayout={handleMainLayout}>
                  {renderTabContent(desktopCardWidth, true)}
                </View>
              </View>

              {railBeside && rail('column')}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>

      {/* Header */}
      <PageContainer variant="feed">
      <View style={styles.header}>
        <Text style={styles.logo}>✦ Lumina</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.coinsButton}
            onPress={() => (navigation as any).jumpTo('Store')}
          >
            <Text style={styles.coinsIcon}>✨</Text>
            <Text style={styles.coinsText}>{coinsGratuitos}</Text>
            {coinsPremium > 0 && (
              <Text style={styles.coinsPremiumText}>+{coinsPremium}💎</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </PageContainer>

      {/* Só enquanto o impulso de quem comprou estiver ativo. */}
      <ActiveBoostChip onPress={() => navigation.navigate('Boosts')} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[5]}
        contentContainerStyle={pageContentStyle('feed', isPhone)}
      >

        {/* 0 — Faísca do Destino */}
        <TouchableOpacity
          style={styles.faiscaBanner}
          onPress={() => navigation.navigate('Faisca' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.faiscaIcon}>⚡</Text>
          <View style={styles.faiscaInfo}>
            <Text style={styles.faiscaTitle}>Faísca do Destino</Text>
            <Text style={styles.faiscaSub}>Toque para revelar sua surpresa de hoje</Text>
          </View>
          <Text style={styles.faiscaArrow}>›</Text>
        </TouchableOpacity>

        {/* 1 — Carta do Destino */}
        <DestinyCardBanner
          onPress={() => navigation.navigate('DestinyCard' as any)}
        />

        {/* 2 — Missões */}
        <MissionsBanner
          completedCount={missionsSummary.completed}
          totalCount={missionsSummary.total}
          onPress={() => navigation.navigate('Missions' as any)}
        />

        {/* 3 — Cofre de Sintonia */}
        <TouchableOpacity
          style={styles.vaultBanner}
          onPress={() => navigation.navigate('Vault' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.vaultIcon}>🗝️</Text>
          <View style={styles.vaultInfo}>
            <Text style={styles.vaultTitle}>Cofre de Sintonia</Text>
            <Text style={styles.vaultSub}>Recompensas por atividade social</Text>
          </View>
          <Text style={styles.vaultArrow}>›</Text>
        </TouchableOpacity>

        {/* 4 — Visitas */}
        <View style={styles.notifications}>
          <VisitsBanner
            visitasHoje={visitasHoje}
            totalVisitas={totalVisitas}
            hasAccess={false}
            onPress={() => navigation.navigate('Visitors' as any)}
          />
        </View>

        {/* 5 — Tabs (sticky) */}
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {renderTabContent(gridCardWidth, false)}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  logo:         { fontSize: fonts.sizes.xl, color: colors.gold, fontWeight: 'bold', letterSpacing: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coinsButton:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.gold + '44', gap: 4 },
  coinsIcon:    { fontSize: 14 },
  coinsText:    { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  coinsPremiumText: { color: '#FFD700', fontSize: fonts.sizes.xs, fontWeight: 'bold' },
  bellButton:   { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.grayDark, position: 'relative' },
  bellIcon:     { fontSize: 20 },
  badge:        { position: 'absolute', top: -4, right: -4, backgroundColor: colors.gold, borderRadius: borderRadius.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.background },
  badgeText:    { color: colors.background, fontSize: 10, fontWeight: 'bold' },

  // Faísca
  faiscaBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs, backgroundColor: '#2D1B4E', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: '#7B2FBE', gap: spacing.sm },
  faiscaIcon:   { fontSize: 28 },
  faiscaInfo:   { flex: 1 },
  faiscaTitle:  { color: '#B57BEE', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  faiscaSub:    { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  faiscaArrow:  { color: '#7B2FBE', fontSize: 24, fontWeight: 'bold' },

  // Cofre
  vaultBanner:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.xs, backgroundColor: '#1A0A0A', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: '#8B6914', gap: spacing.sm },
  vaultIcon:    { fontSize: 28 },
  vaultInfo:    { flex: 1 },
  vaultTitle:   { color: '#FFD700', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  vaultSub:     { color: '#888', fontSize: fonts.sizes.xs, marginTop: 2 },
  vaultArrow:   { color: '#8B6914', fontSize: 24, fontWeight: 'bold' },

  notifications: { paddingTop: spacing.xs },
  tabsWrapper:  { backgroundColor: colors.background, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.grayDark },
  tabs:         { paddingHorizontal: spacing.lg, gap: spacing.sm },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark, backgroundColor: colors.surface },
  tabActive:    { borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  tabIcon:      { fontSize: 14 },
  tabLabel:     { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  tabLabelActive: { color: colors.gold },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  promotedTitle:         { color: '#F0D060', fontSize: fonts.sizes.sm, fontWeight: 'bold', letterSpacing: 0.5, marginHorizontal: spacing.lg, marginTop: spacing.md },
  mostVisitedBanner:     { marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.gold + '22', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold + '44' },
  mostVisitedBannerText: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1 },
  loadingContainer: { paddingTop: 80, alignItems: 'center', gap: spacing.md },
  loadingText:  { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  retryButton:  { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.gold + '22' },
  retryText:    { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  moreButton:   { marginHorizontal: spacing.lg, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold + '55', backgroundColor: colors.gold + '11', alignItems: 'center' },
  moreButtonText: { color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold', letterSpacing: 0.5 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing.xl, gap: spacing.md },
  emptyIcon:    { fontSize: 60 },
  emptyTitle:   { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', textAlign: 'center' },
  emptySubtitle: { color: colors.gray, fontSize: fonts.sizes.md, textAlign: 'center', lineHeight: 22 },
  chatItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grayDark, gap: spacing.md },
  chatAvatar:   { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.gold },
  chatAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  chatAvatarLetter: { color: colors.gold, fontSize: fonts.sizes.lg, fontWeight: 'bold' },
  chatInfo:     { flex: 1 },
  chatName:     { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  chatLastMessage: { color: colors.gray, fontSize: fonts.sizes.sm, marginTop: 2 },
  chatArrow:    { color: colors.gray, fontSize: fonts.sizes.xl },

  // ── Computador (v5.6) ──
  dScroll:   { flexGrow: 1 },
  dPage:     { width: '100%', maxWidth: CONTENT_MAX_WIDTH.wide, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 28, paddingBottom: 40, gap: 24 },
  dHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  dHello:    { flex: 1, minWidth: 0, gap: 4 },
  dTitle:    { color: colors.white, fontSize: 28, fontWeight: 'bold' },
  dSubtitle: { color: colors.textSecondary, fontSize: fonts.sizes.md },
  dHoverGold: { borderColor: colors.gold },
  dBody:     { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  dMain:     { flex: 1, minWidth: 0 },
  dTabsRow:  { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dTabs:     { flexDirection: 'row', gap: spacing.sm },
  dTab:      { paddingHorizontal: 18, paddingVertical: 10 },
  dTabHover: { borderColor: colors.goldBorder },
  dTabLabel: { fontSize: fonts.sizes.md },
  dCaption:  { color: colors.gray, fontSize: 13 },
  dTabContent: { marginHorizontal: -spacing.lg },
  // Interesses embaixo do card: sobe sobre a margem inferior do
  // ProfileCard (spacing.md) para ficarem colados nele.
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, height: 24, overflow: 'hidden', marginTop: -(spacing.md - 6), marginBottom: spacing.md },
  cardChip:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: borderRadius.full, backgroundColor: colors.surfaceOverlay, maxWidth: '100%' },
  cardChipCommon: { backgroundColor: colors.goldGlow, borderWidth: 1, borderColor: colors.goldBorder, paddingVertical: 2 },
  cardChipText: { color: colors.textSecondary, fontSize: 11 },
  cardChipTextCommon: { color: colors.gold, fontWeight: 'bold' },
});

