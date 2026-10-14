// ============================================
// LUMINA — PROFILE SCREEN v5.9
// src/modules/profile/screens/ProfileScreen.tsx
//
// v5.9 (13/10/2026, web D4 — tela aprovada no protótipo): no
// COMPUTADOR o perfil vira duas colunas:
//   • esquerda: o seu card (sem a escala de 1.45, tamanho fixo),
//     Trocar foto / Moldura, a Árvore com quanto falta e os cristais
//     com "Comprar";
//   • direita: galeria larga (com a foto principal), "Sua jornada"
//     em cartões (Conquistas, Cofre, Missões, XP, Ranking, Prestígio,
//     Molduras, Badges, Títulos + Ferramentas Premium em destaque),
//     "Sobre você" e a lista de configurações lado a lado.
// Mesmos dados e mesmas telas de destino do celular — nenhuma
// leitura nova. Celular, tablet e app: iguais à v5.8.
//
// v5.10 (13/10/2026, web D5): "Seu perfil está X% completo" no topo
// da coluna direita (computador), com o que falta como botões: foto,
// fotos da galeria, bio, 3+ interesses, cidade e "interesse em".
// Some quando chega a 100%. Usa o perfil já carregado.
//
// v5.8 (13/10/2026, web responsivo R1) — no tablet e no computador
// o conteúdo fica numa coluna central de leitura (até 820 px): sem
// isso as listas e a galeria esticavam por toda a largura do monitor.
// No celular e no app, igual.
//
// v5.7 (13/10/2026, web lote 4) — "Sair da conta" usa o mesmo
// Alert.alert no Android e na web (o navegador ganhou o Alert no
// lote 1). Saiu o desvio window.confirm, que mostrava uma caixa
// diferente e sem o botão Cancelar com o texto do app.
//
// v5.6 (11/10/2026) — "Conquistas" mostra o balão e o texto
// "N para coletar" quando há coleção completa com fragmentos; o
// toque abre direto a aba Coleções.
//
// v5.5 (09/10/2026) — A seção Marketplace saiu daqui e virou a
// aba Painel (CreatorPanelScreen): Minhas Compras, Favoritos,
// Ser Criador, Meus Produtos, Meus Ganhos e Pagamentos. Aqui fica
// só o atalho do Painel Admin, para admin e superadmin.
//
// v5.4 — O TOPO VIROU O CARD DA HOME.
// No lugar da foto redonda, o card do usuário exatamente como os
// outros o veem no feed: foto, moldura, badge com significado,
// título, aura de prestígio e selo de boost ativo. Montado pelo
// buildOwnProfileCard (usersService), com as mesmas regras do
// feed. Tamanho do Sintonize (transform 1.45, mesmo mecanismo).
//
// - Tocar no card abre o perfil completo em modo "como os
//   outros veem" (RealProfile com o próprio uid).
// - Trocar a foto passou para o botão "📷 Trocar foto" abaixo
//   do card — o fluxo de upload é o mesmo de antes.
// - A linha de nome, badge, título e significado saiu: o card
//   já mostra os quatro, e repetir abaixo dele duplicava tudo.
//
// v5.3: data → prestigeData (fix erro linha 226)
// ============================================

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, LayoutChangeEvent,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius } from '../../../theme';
import { useAuth }           from '../../../context/AuthContext';
import { useCoins }          from '../../../context/CoinsContext';
import { useUserPermissions } from '../../../hooks/useUserPermissions';
import { useXP }             from '../../engagement/hooks/useXP';
import { usePrestige }       from '../../engagement/hooks/usePrestige';
import { getProfile, saveProfile } from '../services/profileService';
import { uploadProfilePhoto, galleryPhotos } from '../services/photoService';
import { UserProfile }       from '../../../shared/types';
import { RootStackParamList } from '../../../navigation/types';
import Header                from '../../../components/Header';
import XPBar                 from '../../../components/XPBar';
import ProfileCard           from '../../../components/ProfileCard';
import { buildOwnProfileCard } from '../../../services/usersService';
import { useProfileBadges } from '../hooks/useProfileBadges';
import { useMissionsSummary } from '../../engagement/hooks/useMissionsSummary';
import GalleryEditor from '../components/GalleryEditor';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { pageContentStyle } from '../../../components/layout/PageContainer';
import HoverPressable from '../../../components/web/HoverPressable';
import { treeStageProgress } from '../../engagement/utils/treeProgress';
import { CONTENT_MAX_WIDTH } from '../../../utils/breakpoints';

/** Mínimo de interesses para a sintonia ficar boa. */
const MIN_INTERESTS = 3;

/** Largura do card na coluna esquerda do computador. */
const DESKTOP_CARD_WIDTH = 300;
const JOURNEY_GAP = 12;

/** Balão de contagem, ou ponto quando n === true. */
function MenuBadge({ n }: { n: number | boolean }) {
  if (!n) return null;
  if (n === true) return <View style={styles.badgeDot} />;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

/** Mesma escala do card na aba Sintonize. */
const CARD_SCALE = 1.45;

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout }   = useAuth();
  const { wallet }         = useCoins();
  const navigation         = useNavigation<NavProp>();
  const { isAdmin, isSuperAdmin } = useUserPermissions(user?.uid);
  const { status: xpStatus }       = useXP(user?.uid);
  const { data: prestigeData }     = usePrestige(user?.uid); // ← FIX: era 'data', agora 'prestigeData'
  const badges                     = useProfileBadges(user?.uid);
  const missions                   = useMissionsSummary(user?.uid);
  const { isPhone, isDesktop }     = useBreakpoint();
  // Largura da grade "Sua jornada" (computador).
  const [journeyWidth, setJourneyWidth] = useState(0);
  // Rolagem até a galeria pelo "+ Fotos na galeria" (computador).
  const desktopScrollRef = useRef<ScrollView>(null);
  const galleryYRef      = useRef(0);

  const [profile, setProfile]               = useState<UserProfile | null>(null);
  const [loading, setLoading]               = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  /** Altura real do card, medida antes da escala. O transform não
   *  ocupa espaço no layout: sem reservar a altura escalada, o
   *  card maior invadiria o que vem abaixo dele. */
  const [cardHeight, setCardHeight]         = useState(0);

  const isAdminUser = isAdmin || isSuperAdmin;

  // useFocusEffect e não useEffect: ao voltar do ProfileSetup
  // a tela NÃO remonta (fica montada na pilha), então um
  // useEffect com [] não roda de novo e a tela seguia
  // mostrando os dados antigos — parecia que a edição não
  // tinha salvado. O mesmo vale para o papel de criador
  // restaurado depois de um desbloqueio.
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [user?.uid])
  );

  async function loadProfile() {
    if (!user) return;
    try {
      const profileData = await getProfile(user.uid);
      setProfile(profileData);
    } catch (error) {
      console.error('[ProfileScreen] Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  }

    async function handleChangePhoto() {
    if (!user?.uid) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // MediaTypeOptions está deprecado no SDK 54 — a forma
      // de array é a que o useProfileSetup já usa.
      mediaTypes:    ['images'],
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.8,
      // base64 direto do picker: nem fetch nem XMLHttpRequest
      // conseguiram ler a URI local no Android — os dois falhavam
      // antes de o upload começar.
      base64:        true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.uid, asset.uri, asset.base64 ?? null);
      await saveProfile(user.uid, { photoURL: url });
      await loadProfile();
      Alert.alert('Sucesso', 'Foto atualizada!');
    } catch (error) {
      console.error('[ProfileScreen] upload falhou:', error);
      Alert.alert('Erro', `Não foi possível atualizar a foto.\n\n${(error as Error)?.message ?? String(error)}`);
    } finally {
      setUploadingPhoto(false);
    }
  }

  // O card com as mesmas regras do feed: aluguel vencido some,
  // boost só com prazo válido. Recalculado a cada carga do
  // perfil (o useFocusEffect recarrega ao voltar para a tela).
  const ownCard = useMemo(
    () => (user?.uid && profile ? buildOwnProfileCard(user.uid, profile) : null),
    [user?.uid, profile],
  );

  // Estável para o memo do ProfileCard não re-renderizar à toa.
  const openOwnProfile = useCallback(() => {
    if (!user?.uid) return;
    navigation.navigate('RealProfile', { userId: user.uid });
  }, [navigation, user?.uid]);

  function handleCardLayout(event: LayoutChangeEvent) {
    const h = event.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - cardHeight) > 1) setCardHeight(h);
  }

  function handleJourneyLayout(event: LayoutChangeEvent) {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - journeyWidth) > 1) setJourneyWidth(w);
  }

  function confirmLogout() {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        try { await logout(); } catch (e) { console.error('[ProfileScreen] logout falhou:', e); }
      }},
    ]);
  }

  if (loading) return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );

  if (isDesktop) {
    const tree = xpStatus ? treeStageProgress(xpStatus) : null;
    const goEditProfile = () => navigation.navigate('ProfileSetup');
    const completeness: Array<{ key: string; label: string; done: boolean; onPress: () => void }> = [
      { key: 'photo',     label: 'Foto de perfil',            done: !!profile?.photoURL,                        onPress: handleChangePhoto },
      { key: 'gallery',   label: 'Fotos na galeria ↓',          done: galleryPhotos(profile).length > 0,          onPress: () => desktopScrollRef.current?.scrollTo({ y: galleryYRef.current, animated: true }) },
      { key: 'bio',       label: 'Bio',                       done: !!profile?.bio?.trim(),                     onPress: goEditProfile },
      { key: 'interests', label: `${MIN_INTERESTS}+ interesses`, done: (profile?.interests?.length ?? 0) >= MIN_INTERESTS, onPress: () => (navigation as any).navigate('Interests', { editMode: true }) },
      { key: 'city',      label: 'Cidade',                    done: !!profile?.city,                            onPress: goEditProfile },
      { key: 'prefs',     label: 'Interesse em',              done: (profile?.preferences?.length ?? 0) > 0,     onPress: goEditProfile },
    ];
    const doneCount = completeness.filter(c => c.done).length;
    const percent = Math.round((doneCount / completeness.length) * 100);
    const tileWidth = journeyWidth > 0 ? Math.floor((journeyWidth - JOURNEY_GAP * 2) / 3) : undefined;
    const interestsCount = profile?.interests?.length ?? 0;
    const journey: Array<{
      key: string; icon: string; label: string; meta: string;
      badge?: number | boolean; highlight?: boolean; onPress: () => void;
    }> = [
      {
        key: 'achievements', icon: '🏆', label: 'Conquistas',
        meta: badges.collectionsToClaim > 0
          ? (badges.collectionsToClaim === 1 ? '1 coleção para coletar' : `${badges.collectionsToClaim} coleções para coletar`)
          : 'Coleções e medalhas',
        badge: badges.collectionsToClaim, highlight: badges.collectionsToClaim > 0,
        onPress: () => navigation.navigate('Achievements', badges.collectionsToClaim > 0 ? { initialTab: 'colecoes' } : undefined),
      },
      {
        key: 'vault', icon: '🗝️', label: 'Cofre de Sintonia',
        meta: badges.vaultReady ? 'Pronto para sacar' : `${wallet?.vaultFragments ?? 0} fragmentos`,
        badge: badges.vaultReady, highlight: badges.vaultReady,
        onPress: () => navigation.navigate('Vault'),
      },
      { key: 'missions', icon: '📋', label: 'Missões do Dia', meta: `${missions.completed} de ${missions.total}`, onPress: () => navigation.navigate('Missions') },
      { key: 'xp',       icon: '⬆️', label: 'XP e Níveis',     meta: `Nível ${xpStatus?.level ?? 1}`,          onPress: () => navigation.navigate('XP') },
      { key: 'ranking',  icon: '🏅', label: 'Ranking Semanal', meta: 'Sua posição esta semana',               onPress: () => navigation.navigate('Ranking') },
      { key: 'prestige', icon: '💜', label: 'Prestígio',       meta: prestigeData?.prestigeName ?? 'Desperto', onPress: () => navigation.navigate('Prestige') },
      { key: 'frames',   icon: '🖼️', label: 'Molduras',        meta: 'Escolher moldura',                      onPress: () => navigation.navigate('Frames') },
      { key: 'badges',   icon: '✦',  label: 'Badges',          meta: 'Escolher badge',                        onPress: () => navigation.navigate('Badges') },
      { key: 'titles',   icon: '🎖️', label: 'Títulos',         meta: 'Escolher título',                       onPress: () => navigation.navigate('Titles') },
    ];
    const settings: Array<{ key: string; icon: string; label: string; meta?: string; badge?: number | boolean; gold?: boolean; onPress: () => void }> = [
      {
        key: 'interests', icon: '✨', label: 'Meus interesses',
        meta: interestsCount === 0 ? 'Escolher' : interestsCount === 1 ? '1 escolhido' : `${interestsCount} escolhidos`,
        onPress: () => (navigation as any).navigate('Interests', { editMode: true }),
      },
      { key: 'requests', icon: '✦',  label: 'Solicitações recebidas',    badge: badges.requests,      onPress: () => navigation.navigate('Requests') },
      { key: 'notif',    icon: '🔔', label: 'Notificações',              badge: badges.notifications, onPress: () => navigation.navigate('Notifications') },
      { key: 'blocked',  icon: '🚫', label: 'Perfis e chats bloqueados',                              onPress: () => navigation.navigate('Blocked') },
      { key: 'support',  icon: '🆘', label: 'Suporte',                   badge: badges.support,       onPress: () => navigation.navigate('Support') },
      { key: 'plus',     icon: '💜', label: 'Galáxia Plus', meta: 'Conhecer',                          onPress: () => navigation.navigate('GalaxiaPlus') },
      ...(isAdminUser
        ? [{ key: 'admin', icon: '👑', label: 'Painel Admin', gold: true, onPress: () => navigation.navigate('AdminDashboard') }]
        : []),
    ];

    return (
      <View style={styles.container}>
        <ScrollView ref={desktopScrollRef} contentContainerStyle={styles.dScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.dPage}>

            <View style={styles.dHeader}>
              <View style={styles.dHeaderText}>
                <Text style={styles.dTitle} accessibilityRole="header">Meu Perfil</Text>
                <Text style={styles.dSubtitle}>Seu card, suas fotos e sua jornada no Lumina.</Text>
              </View>
              <View style={styles.dHeaderActions}>
                <HoverPressable
                  onPress={openOwnProfile}
                  accessibilityRole="button"
                  style={styles.dOutlineBtn}
                  hoverStyle={styles.dOutlineBtnHover}
                >
                  <Text style={styles.dOutlineBtnText}>Ver como os outros veem</Text>
                </HoverPressable>
                <HoverPressable
                  onPress={() => navigation.navigate('ProfileSetup')}
                  accessibilityRole="button"
                  style={styles.dGoldBtn}
                  hoverStyle={styles.dGoldBtnHover}
                >
                  <Text style={styles.dGoldBtnText}>Editar perfil</Text>
                </HoverPressable>
              </View>
            </View>

            <View style={styles.dBody}>
              {/* ── Esquerda: card, Árvore, cristais ── */}
              <View style={styles.dAside}>
                <View style={styles.dCardBox}>
                  {ownCard ? (
                    <ProfileCard
                      data={ownCard}
                      onPress={openOwnProfile}
                      hideSintonia
                      animatedAura
                      width={DESKTOP_CARD_WIDTH}
                    />
                  ) : (
                    <View style={styles.cardFallback}>
                      <Text style={styles.cardFallbackText}>Não foi possível montar o seu card agora.</Text>
                      <TouchableOpacity onPress={loadProfile} accessibilityRole="button">
                        <Text style={styles.cardFallbackRetry}>Tentar de novo</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.dCardActions}>
                    <HoverPressable
                      onPress={handleChangePhoto}
                      disabled={uploadingPhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Trocar foto de perfil"
                      accessibilityState={{ disabled: uploadingPhoto, busy: uploadingPhoto }}
                      style={[styles.dCardBtn, styles.dCardBtnGold, uploadingPhoto && styles.changePhotoBtnBusy]}
                      hoverStyle={styles.dCardBtnGoldHover}
                    >
                      {uploadingPhoto
                        ? <ActivityIndicator color={colors.gold} size="small" />
                        : <Text style={styles.dCardBtnGoldText}>📷 Trocar foto</Text>}
                    </HoverPressable>
                    <HoverPressable
                      onPress={() => navigation.navigate('Frames')}
                      accessibilityRole="button"
                      style={styles.dCardBtn}
                      hoverStyle={styles.dOutlineBtnHover}
                    >
                      <Text style={styles.dCardBtnText}>🖼️ Moldura</Text>
                    </HoverPressable>
                  </View>
                </View>

                <HoverPressable
                  onPress={() => navigation.navigate('XP')}
                  accessibilityRole="button"
                  accessibilityLabel={xpStatus ? `Árvore da Sintonia: nível ${xpStatus.level}, ${xpStatus.treeName}` : 'Árvore da Sintonia'}
                  style={styles.dTree}
                  hoverStyle={styles.dTreeHover}
                >
                  <View style={styles.dRowBetween}>
                    <Text style={styles.dCardTitle}>{xpStatus?.treeIcon ?? '🌱'} Árvore da Sintonia</Text>
                    {xpStatus && <Text style={styles.dTreeMeta}>Nível {xpStatus.level} · {xpStatus.treeName}</Text>}
                  </View>
                  {xpStatus && tree ? (
                    <>
                      <View style={styles.dTreeTrack}>
                        <View style={[styles.dTreeBar, { width: `${Math.round(tree.fraction * 100)}%` }]} />
                      </View>
                      <Text style={styles.dMuted}>
                        {xpStatus.nextTreeStage && tree.missing !== null
                          ? `Próximo estágio: ${xpStatus.nextTreeStage.icon} ${xpStatus.nextTreeStage.name} · faltam ${tree.missing} XP`
                          : 'Estágio máximo da Árvore. ✦'}
                      </Text>
                    </>
                  ) : (
                    <ActivityIndicator color="#B57BEE" size="small" />
                  )}
                </HoverPressable>

                <View style={styles.dCrystals}>
                  <View style={styles.dCrystalsInfo}>
                    <Text style={styles.dMuted}>Cristais de Sintonia</Text>
                    <Text style={styles.dCrystalsLine}>
                      <Text style={styles.crystalsText}>✨ {wallet?.coinsGratuitos ?? 0}</Text>
                      <Text style={styles.dMuted}> grátis  ·  </Text>
                      <Text style={styles.crystalsPremium}>💎 {wallet?.coinsPremium ?? 0}</Text>
                      <Text style={styles.dMuted}> premium</Text>
                    </Text>
                  </View>
                  <HoverPressable
                    onPress={() => (navigation as any).navigate('Store')}
                    accessibilityRole="button"
                    accessibilityLabel="Comprar cristais"
                    style={styles.dGoldBtnSmall}
                    hoverStyle={styles.dGoldBtnHover}
                  >
                    <Text style={styles.dGoldBtnText}>Comprar</Text>
                  </HoverPressable>
                </View>
              </View>

              {/* ── Direita: galeria, jornada, sobre, configurações ── */}
              <View style={styles.dMain}>
                {percent < 100 && (
                  <View style={styles.dComplete} accessibilityLabel={`Seu perfil está ${percent}% completo`}>
                    <View style={styles.dRowBetween}>
                      <Text style={styles.dCardTitle}>Seu perfil está {percent}% completo</Text>
                      <Text style={styles.dCompletePct}>{doneCount}/{completeness.length}</Text>
                    </View>
                    <View style={styles.dTreeTrack}>
                      <View style={[styles.dCompleteBar, { width: `${percent}%` }]} />
                    </View>
                    <Text style={styles.dMuted}>Perfis completos recebem mais visitas e curtidas. Falta:</Text>
                    <View style={styles.dMissingRow}>
                      {completeness.filter(c => !c.done).map(c => (
                        <HoverPressable
                          key={c.key}
                          onPress={c.onPress}
                          accessibilityRole="button"
                          accessibilityLabel={`Completar: ${c.label}`}
                          style={styles.dMissing}
                          hoverStyle={styles.dOutlineBtnHover}
                        >
                          <Text style={styles.dMissingText}>+ {c.label}</Text>
                        </HoverPressable>
                      ))}
                    </View>
                  </View>
                )}

                {user?.uid && (
                  <View onLayout={e => { galleryYRef.current = Math.max(0, e.nativeEvent.layout.y); }}>
                    <GalleryEditor
                      userId={user.uid}
                      profile={profile}
                      onChanged={loadProfile}
                      layout="wide"
                      mainPhotoURL={profile?.photoURL}
                    />
                  </View>
                )}

                <View style={styles.dSection}>
                  <Text style={styles.dKicker}>Sua jornada</Text>
                  <View style={styles.dJourney} onLayout={handleJourneyLayout}>
                    {journey.map(t => (
                      <HoverPressable
                        key={t.key}
                        onPress={t.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.label}: ${t.meta}`}
                        style={[styles.dTile, tileWidth ? { width: tileWidth } : styles.dTileFallback, t.highlight && styles.dTileHighlight]}
                        hoverStyle={styles.dTileHover}
                      >
                        <View style={styles.dRowBetween}>
                          <Text style={styles.dTileLabel} numberOfLines={1}>{t.icon} {t.label}</Text>
                          <MenuBadge n={t.badge ?? 0} />
                        </View>
                        <Text style={[styles.dTileMeta, t.highlight && styles.dTileMetaGold]} numberOfLines={1}>{t.meta}</Text>
                      </HoverPressable>
                    ))}
                    <HoverPressable
                      onPress={() => navigation.navigate('PremiumTools')}
                      accessibilityRole="button"
                      accessibilityLabel="Ferramentas Premium"
                      style={styles.dPremium}
                      hoverStyle={styles.dTileHover}
                    >
                      <Text style={styles.dPremiumIcon}>💎</Text>
                      <View style={styles.dPremiumInfo}>
                        <Text style={styles.dPremiumTitle}>Ferramentas Premium</Text>
                        <Text style={styles.dMuted}>Recursos para ser visto por mais gente.</Text>
                      </View>
                      <Text style={styles.dPremiumArrow}>›</Text>
                    </HoverPressable>
                  </View>
                </View>

                <View style={styles.dTwoCols}>
                  <View style={[styles.dPanel, styles.dCol]}>
                    <Text style={styles.dCardTitle}>Sobre você</Text>
                    <View style={styles.dFacts}>
                      <View style={styles.dFact}>
                        <Text style={styles.dMuted}>Idade</Text>
                        <Text style={styles.dFactValue}>{profile?.age ? `${profile.age} anos` : 'Não informada'}</Text>
                      </View>
                      <View style={styles.dFact}>
                        <Text style={styles.dMuted}>Cidade</Text>
                        <Text style={styles.dFactValue}>{profile?.city ? `${profile.city}, ${profile.state}` : 'Não informada'}</Text>
                      </View>
                      <View style={styles.dFact}>
                        <Text style={styles.dMuted}>Gênero</Text>
                        <Text style={styles.dFactValue}>{profile?.gender || 'Não informado'}</Text>
                      </View>
                      <View style={styles.dFact}>
                        <Text style={styles.dMuted}>Interesse em</Text>
                        <Text style={styles.dFactValue}>{profile?.preferences?.join(', ') || 'Não informado'}</Text>
                      </View>
                    </View>
                    <Text style={styles.dBio}>{profile?.bio || 'Sem bio. Uma bio curta faz mais gente puxar conversa.'}</Text>
                  </View>

                  <View style={[styles.dPanel, styles.dSettings, styles.dCol]}>
                    {settings.map(item => (
                      <HoverPressable
                        key={item.key}
                        onPress={item.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        style={styles.dSettingRow}
                        hoverStyle={styles.dSettingRowHover}
                      >
                        <Text style={styles.menuItemIcon}>{item.icon}</Text>
                        <Text style={[styles.dSettingLabel, item.gold && styles.menuItemTextAdmin]} numberOfLines={1}>{item.label}</Text>
                        {item.meta ? <Text style={styles.menuItemSubtext}>{item.meta}</Text> : null}
                        <MenuBadge n={item.badge ?? 0} />
                        <Text style={styles.menuItemArrow}>›</Text>
                      </HoverPressable>
                    ))}
                  </View>
                </View>

                <View style={styles.dFooter}>
                  <HoverPressable
                    onPress={confirmLogout}
                    accessibilityRole="button"
                    style={styles.dLogout}
                    hoverStyle={styles.dLogoutHover}
                  >
                    <Text style={styles.logoutText}>Sair da conta</Text>
                  </HoverPressable>
                  <TouchableOpacity onPress={() => navigation.navigate('DeleteAccount')} accessibilityRole="button">
                    <Text style={styles.deleteAccountText}>Excluir conta</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showBack={false} />
      <ScrollView contentContainerStyle={[styles.scrollContent, pageContentStyle('reading', isPhone)]}>

        {/* Card da Home — é aqui que o usuário confere como
            aparece para os outros e o que comprou (moldura,
            badge, aura). */}
        <View style={styles.photoSection}>
          {ownCard ? (
            <View
              style={[
                styles.cardStage,
                cardHeight > 0 && { height: cardHeight * CARD_SCALE },
              ]}
            >
              <View
                style={[styles.cardScale, cardHeight === 0 && styles.cardMeasuring]}
                onLayout={handleCardLayout}
              >
                <ProfileCard
                  data={ownCard}
                  onPress={openOwnProfile}
                  hideSintonia
                  animatedAura
                />
              </View>
            </View>
          ) : (
            <View style={styles.cardFallback}>
              <Text style={styles.cardFallbackText}>
                Não foi possível montar o seu card agora.
              </Text>
              <TouchableOpacity onPress={loadProfile} accessibilityRole="button">
                <Text style={styles.cardFallbackRetry}>Tentar de novo</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.cardCaption}>
            Assim seu card aparece para os outros. Toque nele para ver o perfil completo.
          </Text>

          <TouchableOpacity
            style={[styles.changePhotoBtn, uploadingPhoto && styles.changePhotoBtnBusy]}
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
            accessibilityRole="button"
            accessibilityLabel="Trocar foto de perfil"
            accessibilityState={{ disabled: uploadingPhoto, busy: uploadingPhoto }}
          >
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.gold} size="small" />
            ) : (
              <Text style={styles.changePhotoText}>📷 Trocar foto</Text>
            )}
          </TouchableOpacity>

          {xpStatus && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{xpStatus.treeIcon} {xpStatus.tier}</Text>
            </View>
          )} 
          <View style={styles.crystalsRow}>
            <Text style={styles.crystalsText}>✨ {wallet?.coinsGratuitos ?? 0}</Text>
            <Text style={styles.crystalsSep}>·</Text>
            <Text style={styles.crystalsPremium}>💎 {wallet?.coinsPremium ?? 0}</Text>
          </View>
          <Text style={styles.crystalsLabel}>Cristais de Sintonia</Text>
        </View>

        {/* XP Card */}
        <TouchableOpacity
          style={styles.xpCard}
          onPress={() => navigation.navigate('XP')}
          activeOpacity={0.85}
        >
          <View style={styles.xpCardHeader}>
            <Text style={styles.xpCardTitle}>{xpStatus?.treeIcon ?? '🌱'} Árvore da Sintonia</Text>
            <Text style={styles.xpCardLink}>Ver tudo ›</Text>
          </View>
          {xpStatus ? (
            <XPBar
              level={xpStatus.level}
              tier={xpStatus.tier}
              totalXP={xpStatus.totalXP}
              nextLevelXP={xpStatus.nextLevelXP}
              progress={xpStatus.levelProgress}
              compact
            />
          ) : (
            <ActivityIndicator color={colors.gold} size="small" />
          )}
          {xpStatus && (
            <View style={styles.treeRow}>
              <Text style={styles.treeStageName}>{xpStatus.treeIcon} {xpStatus.treeName}</Text>
              {xpStatus.nextTreeStage && (
                <Text style={styles.treeNextStage}>→ {xpStatus.nextTreeStage.icon} {xpStatus.nextTreeStage.name}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Galeria: 3 fotos além da foto de perfil */}
        {user?.uid && (
          <GalleryEditor userId={user.uid} profile={profile} onChanged={loadProfile} />
        )}

        {/* Gamificação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Gamificação</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('XP')}>
            <Text style={styles.menuItemIcon}>⬆️</Text>
            <Text style={styles.menuItemText}>XP & Níveis</Text>
            <Text style={styles.menuItemSubtext}>Nível {xpStatus?.level ?? 1}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate(
              'Achievements',
              badges.collectionsToClaim > 0 ? { initialTab: 'colecoes' } : undefined,
            )}
            accessibilityLabel={badges.collectionsToClaim > 0
              ? `Conquistas, ${badges.collectionsToClaim} ${badges.collectionsToClaim === 1 ? 'coleção' : 'coleções'} para coletar`
              : 'Conquistas'}
          >
            <Text style={styles.menuItemIcon}>🏆</Text>
            <Text style={styles.menuItemText}>Conquistas</Text>
            {badges.collectionsToClaim > 0 && (
              <Text style={styles.menuItemSubtext}>
                {badges.collectionsToClaim === 1 ? '1 para coletar' : `${badges.collectionsToClaim} para coletar`}
              </Text>
            )}
            <MenuBadge n={badges.collectionsToClaim} />
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Vault')}>
            <Text style={styles.menuItemIcon}>🗝️</Text>
            <Text style={styles.menuItemText}>Cofre de Sintonia</Text>
            <Text style={styles.menuItemSubtext}>
              {badges.vaultReady ? 'Pronto para sacar' : `${wallet?.vaultFragments ?? 0} fragmentos`}
            </Text>
            <MenuBadge n={badges.vaultReady} />
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Missions')}>
            <Text style={styles.menuItemIcon}>📋</Text>
            <Text style={styles.menuItemText}>Missões do Dia</Text>
            <Text style={styles.menuItemSubtext}>{missions.completed} de {missions.total}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Ranking')}>
            <Text style={styles.menuItemIcon}>🏆</Text>
            <Text style={styles.menuItemText}>Ranking Semanal</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Prestige')}>
            <Text style={styles.menuItemIcon}>💜</Text>
            <Text style={styles.menuItemText}>Prestígio</Text>
            <Text style={styles.menuItemSubtext}>{prestigeData?.prestigeName ?? 'Desperto'}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Frames')}>
            <Text style={styles.menuItemIcon}>🖼️</Text>
            <Text style={styles.menuItemText}>Molduras</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Badges')}>
            <Text style={styles.menuItemIcon}>✦</Text>
            <Text style={styles.menuItemText}>Badges</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Titles')}>
            <Text style={styles.menuItemIcon}>🎖️</Text>
            <Text style={styles.menuItemText}>Títulos</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PremiumTools')}>
            <Text style={styles.menuItemIcon}>💎</Text>
            <Text style={styles.menuItemText}>Ferramentas Premium</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Informações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Informações</Text>
          <InfoRow icon="🏙️" label="Cidade"       value={profile?.city ? `${profile.city}, ${profile.state}` : 'Não informada'} />
          <InfoRow icon="🎂" label="Idade"        value={profile?.age ? `${profile.age} anos` : 'Não informada'} />
          <InfoRow icon="💬" label="Bio"          value={profile?.bio || 'Sem bio'} />
          <InfoRow icon="💫" label="Gênero"       value={profile?.gender || 'Não informado'} />
          <InfoRow icon="❤️" label="Interesse em" value={profile?.preferences?.join(', ') || 'Não informado'} />
        </View>

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Configurações</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('ProfileSetup')}>
            <Text style={styles.menuItemIcon}>✏️</Text>
            <Text style={styles.editButtonText}>Editar perfil completo</Text>
            <Text style={styles.editButtonArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Requests')}>
            <Text style={styles.menuItemIcon}>✦</Text>
            <Text style={styles.menuItemText}>Solicitações recebidas</Text>
            <MenuBadge n={badges.requests} />
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Blocked')}>
            <Text style={styles.menuItemIcon}>🚫</Text>
            <Text style={styles.menuItemText}>Perfis e chats bloqueados</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.menuItemIcon}>🔔</Text>
            <Text style={styles.menuItemText}>Notificações</Text>
            <MenuBadge n={badges.notifications} />
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Support')}>
            <Text style={styles.menuItemIcon}>🆘</Text>
            <Text style={styles.menuItemText}>Suporte</Text>
            <MenuBadge n={badges.support} />
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('GalaxiaPlus')}>
            <Text style={styles.menuItemIcon}>💜</Text>
            <Text style={styles.menuItemText}>Galáxia Plus</Text>

            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Marketplace SAIU do Perfil (09/10/2026): compras, favoritos,
            "Ser Criador" e as ferramentas de criador ficam na aba Painel
            (CreatorPanelScreen). O superadmin, sem essa aba, entra pelo
            card "Meu Painel" do Painel Admin. */}
        {isAdminUser && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👑 Administração</Text>
            <TouchableOpacity style={styles.menuItemAdmin} onPress={() => navigation.navigate('AdminDashboard')}>
              <Text style={styles.menuItemIcon}>👑</Text>
              <Text style={styles.menuItemTextAdmin}>Painel Admin</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={confirmLogout}
        >
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteAccountLink}
          onPress={() => navigation.navigate('DeleteAccount')}
          accessibilityRole="button"
        >
          <Text style={styles.deleteAccountText}>Excluir conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xl * 2 },
  photoSection:  { alignItems: 'center', paddingVertical: spacing.xl },
  // Reserva a altura do card JÁ escalado e centraliza: o
  // transform cresce a partir do centro, então o card cabe
  // exatamente no espaço reservado.
  cardStage:     { width: '100%', alignItems: 'center', justifyContent: 'center' },
  cardScale:     { transform: [{ scale: CARD_SCALE }] },
  // Invisível no primeiro quadro, antes da medida: sem isso o
  // card aparece por um instante sobre o texto de baixo.
  cardMeasuring: { opacity: 0 },
  cardFallback:  { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  cardFallbackText: { color: colors.gray, fontSize: fonts.sizes.sm, textAlign: 'center' },
  cardFallbackRetry: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  cardCaption:   { color: colors.gray, fontSize: fonts.sizes.xs, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl },
  changePhotoBtn: { marginTop: spacing.md, minWidth: 160, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.gold + '18' },
  changePhotoBtnBusy: { opacity: 0.6 },
  changePhotoText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  levelBadge:    { backgroundColor: colors.gold + '22', borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2, marginTop: spacing.xs },
  levelText:     { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  crystalsRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  crystalsText:  { color: '#B57BEE', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  crystalsSep:   { color: colors.gray },
  crystalsPremium: { color: '#FFD700', fontSize: fonts.sizes.md, fontWeight: 'bold' },
  crystalsLabel: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  xpCard:        { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: '#1A0A2E', borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(181,123,238,0.3)', gap: spacing.sm },
  xpCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpCardTitle:   { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  xpCardLink:    { color: '#B57BEE', fontSize: fonts.sizes.sm },
  treeRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  treeStageName: { color: '#B57BEE', fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  treeNextStage: { color: colors.gray, fontSize: fonts.sizes.xs },
  section:       { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.grayDark, overflow: 'hidden' },
  sectionTitle:  { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textTransform: 'uppercase', letterSpacing: 1, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55' },
  infoIcon:      { fontSize: 16, marginRight: spacing.sm, marginTop: 2 },
  infoContent:   { flex: 1 },
  infoLabel:     { color: colors.gray, fontSize: fonts.sizes.xs },
  infoValue:     { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },
  editButton:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55', backgroundColor: colors.gold + '11' },
  editButtonText: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  editButtonArrow: { color: colors.gold, fontSize: fonts.sizes.xl },
  menuItem:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55' },
  menuItemAdmin: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.gold + '11' },
  menuItemIcon:  { fontSize: 18, marginRight: spacing.sm },
  menuItemText:  { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  menuItemSubtext: { color: colors.gray, fontSize: fonts.sizes.xs, marginRight: spacing.xs },
  menuItemTextAdmin: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemArrow: { color: colors.gray, fontSize: fonts.sizes.xl },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, marginRight: spacing.xs,
    backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  badgeDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error, marginRight: spacing.xs },
  logoutButton:  { margin: spacing.md, marginTop: spacing.lg, backgroundColor: colors.error + '22', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.md, alignItems: 'center' },
  logoutText:    { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  deleteAccountLink: { alignSelf: 'center', padding: spacing.sm, marginBottom: spacing.md },
  deleteAccountText: { color: colors.gray, fontSize: fonts.sizes.sm, textDecorationLine: 'underline' },

  // ── Computador (v5.9) ──
  dScroll:     { flexGrow: 1 },
  dPage:       { width: '100%', maxWidth: CONTENT_MAX_WIDTH.wide, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 28, paddingBottom: 48, gap: 24 },
  dHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  dHeaderText: { gap: 4, flexShrink: 1 },
  dTitle:      { color: colors.white, fontSize: 28, fontWeight: 'bold' },
  dSubtitle:   { color: colors.textSecondary, fontSize: fonts.sizes.md },
  dHeaderActions: { flexDirection: 'row', gap: 10 },
  dOutlineBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.grayDark },
  dOutlineBtnHover: { borderColor: colors.gold },
  dOutlineBtnText: { color: colors.grayLight, fontWeight: 'bold', fontSize: fonts.sizes.md },
  dGoldBtn:    { paddingHorizontal: 18, paddingVertical: 10, borderRadius: borderRadius.full, backgroundColor: colors.gold },
  dGoldBtnSmall: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.gold },
  dGoldBtnHover: { backgroundColor: colors.goldLight },
  dGoldBtnText: { color: colors.background, fontWeight: 'bold', fontSize: fonts.sizes.md },
  dBody:       { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  dAside:      { width: 340, gap: 16 },
  dMain:       { flex: 1, minWidth: 0, gap: 22 },
  dCardBox:    { alignItems: 'center', padding: 16, gap: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldBorder },
  dCardActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  dCardBtn:    { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.grayDark, backgroundColor: colors.surface },
  dCardBtnText: { color: colors.grayLight, fontWeight: 'bold', fontSize: 13 },
  dCardBtnGold: { borderColor: colors.goldBorder, backgroundColor: colors.goldSubtle },
  dCardBtnGoldHover: { borderColor: colors.gold },
  dCardBtnGoldText: { color: colors.gold, fontWeight: 'bold', fontSize: 13 },
  dTree:       { padding: 18, gap: 10, borderRadius: 18, backgroundColor: '#1A0F2A', borderWidth: 1, borderColor: '#4A2A7A' },
  dTreeHover:  { borderColor: '#B57BEE' },
  dTreeMeta:   { color: '#C9A0F5', fontWeight: 'bold', fontSize: 13 },
  dTreeTrack:  { height: 8, borderRadius: 4, backgroundColor: '#2D1B4E', overflow: 'hidden' },
  dTreeBar:    { height: 8, borderRadius: 4, backgroundColor: '#B57BEE' },
  dRowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dCardTitle:  { color: colors.white, fontWeight: 'bold', fontSize: 15 },
  dMuted:      { color: colors.textSecondary, fontSize: fonts.sizes.sm },
  dCrystals:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E', gap: spacing.sm },
  dCrystalsInfo: { gap: 4, flexShrink: 1 },
  dCrystalsLine: { fontSize: 18 },
  dSection:    { gap: 12 },
  dKicker:     { color: colors.gray, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  dJourney:    { flexDirection: 'row', flexWrap: 'wrap', gap: JOURNEY_GAP },
  dTile:       { padding: 16, gap: 6, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E' },
  dTileFallback: { width: '31%' },
  dTileHighlight: { borderColor: colors.goldBorder },
  dTileHover:  { borderColor: colors.gold, backgroundColor: colors.surfaceRaised },
  dTileLabel:  { color: colors.white, fontWeight: 'bold', fontSize: 15, flexShrink: 1 },
  dTileMeta:   { color: colors.textSecondary, fontSize: 13 },
  dTileMetaGold: { color: colors.gold },
  dPremium:    { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: '#1E150A', borderWidth: 1, borderColor: '#6B5212' },
  dPremiumIcon: { fontSize: 26 },
  dPremiumInfo: { flex: 1, gap: 2 },
  dPremiumTitle: { color: colors.goldLight, fontWeight: 'bold', fontSize: 15 },
  dPremiumArrow: { color: colors.goldLight, fontSize: 24, fontWeight: 'bold' },
  dTwoCols:    { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  dCol:        { flex: 1, minWidth: 0 },
  dPanel:      { padding: 20, gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#2E2E2E' },
  dFacts:      { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  dFact:       { width: '50%', gap: 2, paddingRight: spacing.sm },
  dFactValue:  { color: colors.white, fontSize: 13 },
  dBio:        { color: colors.grayLight, fontSize: 13, lineHeight: 19 },
  dSettings:   { padding: 8, gap: 0 },
  dSettingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  dSettingRowHover: { backgroundColor: colors.surfaceRaised },
  dSettingLabel: { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  dFooter:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dLogout:     { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.error + '18' },
  dLogoutHover: { backgroundColor: colors.error + '30' },
  dComplete:    { padding: 18, gap: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.goldBorder },
  dCompletePct: { color: colors.gold, fontWeight: 'bold', fontSize: 13 },
  dCompleteBar: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
  dMissingRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dMissing:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.goldSubtle },
  dMissingText: { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
});

