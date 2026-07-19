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
import { useNavigation }     from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, spacing, borderRadius, alpha, FONT_SIZE } from '../../../theme';
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
import { ProfileSkeleton }   from '../../../components/ui';

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

  useEffect(() => { loadProfile(); }, []);

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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar sua galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && user) {
      try {
        setUploadingPhoto(true);
        const asset = result.assets[0];
        const uri   = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        const url   = await uploadProfilePhoto(user.uid, uri);
        await saveProfile(user.uid, { photoURL: url });
        setProfile(prev => prev ? { ...prev, photoURL: url } : prev);
      } catch {
        Alert.alert('Erro', 'Não foi possível atualizar a foto.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  }

  if (loading) return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showBack={false} />
      <ProfileSkeleton />
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showBack={false} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Foto e nome */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
            <View style={styles.photoContainer}>
              {uploadingPhoto ? (
                <ActivityIndicator color={colors.gold} />
              ) : profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>👤</Text>
                </View>
              )}
              <View style={styles.cameraIcon}>
                <Text style={{ fontSize: fonts.sizes.md }}>📷</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.name ?? 'Usuário'}</Text>

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
  photoSection:  { alignItems: 'center', paddingVertical: spacing.xl, paddingTop: spacing.lg },
  photoContainer: { width: 104, height: 104, borderRadius: 52, backgroundColor: alpha(colors.gold, 0.08), alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: alpha(colors.gold, 0.4) },
  photo:         { width: 96, height: 96, borderRadius: 48 },
  photoPlaceholder: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 36 },
  cameraIcon:    { position: 'absolute', bottom: 2, right: 2, backgroundColor: colors.gold, borderRadius: 14, padding: 6, borderWidth: 2, borderColor: colors.background },
  name:          { color: colors.white, fontSize: fonts.sizes.xl, fontWeight: 'bold', marginTop: spacing.md },
  levelBadge:    { backgroundColor: alpha(colors.gold, 0.1), borderRadius: borderRadius.full, borderWidth: 1, borderColor: alpha(colors.gold, 0.3), paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.xs },
  levelText:     { color: colors.gold, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  crystalsRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  crystalsText:  { color: colors.secondaryLegacy, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  crystalsSep:   { color: colors.gray },
  crystalsPremium: { color: colors.goldLegacy, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  crystalsLabel: { color: colors.gray, fontSize: fonts.sizes.xs, marginTop: 2 },
  xpCard:        { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.cardLegacy, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: alpha(colors.secondaryLegacy, 0.3), gap: spacing.sm },
  xpCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpCardTitle:   { color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  xpCardLink:    { color: colors.secondaryLegacy, fontSize: fonts.sizes.sm },
  treeRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  treeStageName: { color: colors.secondaryLegacy, fontSize: fonts.sizes.sm, fontWeight: 'bold' },
  treeNextStage: { color: colors.gray, fontSize: fonts.sizes.xs },
  section:       { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  sectionTitle:  { color: colors.gray, fontSize: fonts.sizes.sm, fontWeight: 'bold', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textTransform: 'uppercase', letterSpacing: 1, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  infoIcon:      { fontSize: fonts.sizes.lg, marginRight: spacing.sm, marginTop: 2 },
  infoContent:   { flex: 1 },
  infoLabel:     { color: colors.gray, fontSize: fonts.sizes.xs },
  infoValue:     { color: colors.white, fontSize: fonts.sizes.sm, marginTop: 2 },
  editButton:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: alpha(colors.gold, 0.04) },
  editButtonText: { flex: 1, color: colors.white, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  editButtonArrow: { color: colors.gold, fontSize: fonts.sizes.xl },
  menuItem:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  menuItemHighlight: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', backgroundColor: alpha(colors.gold, 0.04) },
  menuItemAdmin: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: alpha(colors.gold, 0.04) },
  menuItemIcon:  { fontSize: FONT_SIZE.xl, marginRight: spacing.sm },
  menuItemText:  { flex: 1, color: colors.white, fontSize: fonts.sizes.md },
  menuItemSubtext: { color: colors.gray, fontSize: fonts.sizes.xs, marginRight: spacing.xs },
  menuItemTextHighlight: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemTextAdmin: { flex: 1, color: colors.gold, fontSize: fonts.sizes.md, fontWeight: 'bold' },
  menuItemArrow: { color: 'rgba(255,255,255,0.2)', fontSize: fonts.sizes.xl },
  logoutButton:  { margin: spacing.md, marginTop: spacing.lg, backgroundColor: alpha(colors.error, 0.08), borderRadius: borderRadius.md, borderWidth: 1, borderColor: alpha(colors.error, 0.3), padding: spacing.md, alignItems: 'center' },
  logoutText:    { color: colors.error, fontSize: fonts.sizes.md, fontWeight: 'bold' },
});