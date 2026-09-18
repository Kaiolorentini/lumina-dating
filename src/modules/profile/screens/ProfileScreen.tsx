// ============================================
// LUMINA — PROFILE SCREEN v5.3
// src/modules/profile/screens/ProfileScreen.tsx
//
// v5.3: data → prestigeData (fix erro linha 226)
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert, Platform,
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
import { ProfileFrame }      from '../../../components/profile/ProfileFrame';
import { Badge }             from '../../../components/profile/Badge';
import {
  frameAppearanceById, badgeAppearanceById, badgeMeaningById, Rarity,
} from '../../../config/cosmeticsCatalog';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
  const { role, isAdmin, isSuperAdmin } = useUserPermissions(user?.uid);
  const { status: xpStatus }       = useXP(user?.uid);
  const { data: prestigeData }     = usePrestige(user?.uid); // ← FIX: era 'data', agora 'prestigeData'

  const [profile, setProfile]               = useState<UserProfile | null>(null);
  const [loading, setLoading]               = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isCreator   = role === 'creator';
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

  // Cosméticos do próprio usuário. O aluguel vencido é
  // descartado aqui como nas demais telas — a limpeza do
  // getFramesStatus só roda quando ele abre a tela de Molduras.
  function activeCosmetic(id: unknown, until: unknown): string | null {
    if (typeof id !== 'string' || !id) return null;
    if (until === null || until === undefined) return id;  // permanente
    const date = (until as { toDate?: () => Date })?.toDate?.() ?? null;
    if (!date) return id;
    return date.getTime() > Date.now() ? id : null;
  }

  const prog = (profile as { progression?: Record<string, unknown> } | null)?.progression ?? {};
  const myFrame = frameAppearanceById(
    activeCosmetic(prog.equippedFrame, prog.equippedFrameUntil)
  );
  const myBadgeId = activeCosmetic(prog.equippedBadge, prog.equippedBadgeUntil);
  const myBadge = myBadgeId
    ? badgeAppearanceById(myBadgeId, (prog.equippedBadgeRarity as Rarity) ?? 'COMMON')
    : null;
  const myMeaning = badgeMeaningById(myBadgeId);

    // TEMPORÁRIO — diagnóstico da moldura no próprio perfil
  console.log('[ProfileScreen] prog:', JSON.stringify(prog));
  console.log('[ProfileScreen] myFrame:', JSON.stringify(myFrame));
  
  if (loading) return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showBack={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Foto e nome */}
        <View style={styles.photoSection}>
          {/* Com moldura, a cena substitui o círculo: é aqui que
              o usuário confere o que comprou. O ícone de câmera
              fica FORA da cena, senão compete com ela e a área de
              toque vira ambígua. */}
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.photoContainer}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : myFrame && profile?.photoURL ? (
              <View style={styles.framedBox}>
                <ProfileFrame
                  photoURL={profile.photoURL}
                  size={168}
                  frame={myFrame}
                />
                <View style={styles.cameraIconFramed}>
                  <Text style={{ fontSize: 14 }}>📷</Text>
                </View>
              </View>
            ) : (
              <View style={styles.photoContainer}>
                {profile?.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>👤</Text>
                  </View>
                )}
                <View style={styles.cameraIcon}>
                  <Text style={{ fontSize: 14 }}>📷</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.nameRow}>
            {myBadge && <Badge appearance={myBadge} size={30} />}
            <Text style={styles.name}>{profile?.name ?? 'Usuário'}</Text>
          </View>

          {myMeaning && (
            <Text style={styles.meaning}>{myMeaning}</Text>
          )}

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
          onPress={() => navigation.navigate('XP' as any)}
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

        {/* Gamificação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Gamificação</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('XP' as any)}>
            <Text style={styles.menuItemIcon}>⬆️</Text>
            <Text style={styles.menuItemText}>XP & Níveis</Text>
            <Text style={styles.menuItemSubtext}>Nível {xpStatus?.level ?? 1}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Achievements' as any)}>
            <Text style={styles.menuItemIcon}>🏆</Text>
            <Text style={styles.menuItemText}>Conquistas</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Vault' as any)}>
            <Text style={styles.menuItemIcon}>🗝️</Text>
            <Text style={styles.menuItemText}>Cofre de Sintonia</Text>
            <Text style={styles.menuItemSubtext}>{wallet?.vaultFragments ?? 0} fragmentos</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Missions' as any)}>
            <Text style={styles.menuItemIcon}>📋</Text>
            <Text style={styles.menuItemText}>Missões do Dia</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Ranking' as any)}>
            <Text style={styles.menuItemIcon}>🏆</Text>
            <Text style={styles.menuItemText}>Ranking Semanal</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Prestige' as any)}>
            <Text style={styles.menuItemIcon}>💜</Text>
            <Text style={styles.menuItemText}>Prestígio</Text>
            <Text style={styles.menuItemSubtext}>{prestigeData?.prestigeName ?? 'Desperto'}</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Frames' as any)}>
            <Text style={styles.menuItemIcon}>🖼️</Text>
            <Text style={styles.menuItemText}>Molduras</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Badges' as any)}>
            <Text style={styles.menuItemIcon}>✦</Text>
            <Text style={styles.menuItemText}>Badges</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PremiumTools' as any)}>
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
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemIcon}>💜</Text>
            <Text style={styles.menuItemText}>Galáxia Plus</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Marketplace */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛍️ Marketplace</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyPurchases')}>
            <Text style={styles.menuItemIcon}>📦</Text>
            <Text style={styles.menuItemText}>Minhas Compras</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyFavorites')}>
            <Text style={styles.menuItemIcon}>❤️</Text>
            <Text style={styles.menuItemText}>Favoritos</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
          {role === 'user' && (
            <TouchableOpacity style={styles.menuItemHighlight} onPress={() => navigation.navigate('CreatorRequest')}>
              <Text style={styles.menuItemIcon}>🎨</Text>
              <Text style={styles.menuItemTextHighlight}>Ser Criador</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          )}
          {(isCreator || isAdminUser) && (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyProducts')}>
                <Text style={styles.menuItemIcon}>📁</Text>
                <Text style={styles.menuItemText}>Meus Produtos</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyEarnings')}>
                <Text style={styles.menuItemIcon}>💰</Text>
                <Text style={styles.menuItemText}>Meus Ganhos</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PaymentSetup')}>
                <Text style={styles.menuItemIcon}>💳</Text>
                <Text style={styles.menuItemText}>Configurar Pagamentos</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            </>
          )}
          {isAdminUser && (
            <TouchableOpacity style={styles.menuItemAdmin} onPress={() => navigation.navigate('AdminDashboard')}>
              <Text style={styles.menuItemIcon}>👑</Text>
              <Text style={styles.menuItemTextAdmin}>Painel Admin</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xl * 2 },
  photoSection:  { alignItems: 'center', paddingVertical: spacing.xl },
  photoContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.gold },
  photo:         { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 40 },
  cameraIcon:    { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.gold, borderRadius: 12, padding: 4 },
  framedBox:     { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  // Câmera na borda da cena, não sobre ela.
  cameraIconFramed: { position: 'absolute', bottom: 6, right: 6, backgroundColor: colors.gold, borderRadius: 12, padding: 4 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  name:          { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold' },
  meaning:       { color: colors.gold, fontSize: fonts.sizes.sm, fontStyle: 'italic', marginTop: spacing.xs, opacity: 0.85, textAlign: 'center', paddingHorizontal: spacing.xl },
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
  menuItemHighlight: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.grayDark + '55', backgroundColor: colors.gold + '11' },
  menuItemAdmin: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.gold + '11' },
  menuItemIcon:  { fontSize: 18, marginRight: spacing.sm },
  menuItemText:  { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  menuItemSubtext: { color: colors.gray, fontSize: fonts.sizes.xs, marginRight: spacing.xs },
  menuItemTextHighlight: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemTextAdmin: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemArrow: { color: colors.gray, fontSize: fonts.sizes.xl },
  logoutButton:  { margin: spacing.md, marginTop: spacing.lg, backgroundColor: colors.error + '22', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.md, alignItems: 'center' },
  logoutText:    { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});