// ============================================
// LUMINA — PROFILE SCREEN v5.5
// src/modules/profile/screens/ProfileScreen.tsx
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

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, LayoutChangeEvent,
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
import { uploadProfilePhoto } from '../services/photoService';
import { UserProfile }       from '../../../shared/types';
import { RootStackParamList } from '../../../navigation/types';
import Header                from '../../../components/Header';
import XPBar                 from '../../../components/XPBar';
import ProfileCard           from '../../../components/ProfileCard';
import { buildOwnProfileCard } from '../../../services/usersService';
import { useProfileBadges } from '../hooks/useProfileBadges';
import { useMissionsSummary } from '../../engagement/hooks/useMissionsSummary';
import GalleryEditor from '../components/GalleryEditor';

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

  if (loading) return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showBack={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

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
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Achievements')}>
            <Text style={styles.menuItemIcon}>🏆</Text>
            <Text style={styles.menuItemText}>Conquistas</Text>
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
          onPress={async () => {
            if (Platform.OS === 'web') {
              const confirmed = (window as any).confirm('Tem certeza que deseja sair?');
              if (confirmed) { try { await logout(); } catch (e) { console.error(e); } }
            } else {
              Alert.alert('Sair', 'Tem certeza que deseja sair?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: async () => {
                  try { await logout(); } catch (e) { console.error(e); }
                }},
              ]);
            }
          }}
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
});
